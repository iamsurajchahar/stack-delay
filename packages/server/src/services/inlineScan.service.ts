import { Types } from 'mongoose';
import { Scan } from '../models/Scan';
import { Repository } from '../models/Repository';
import { Package } from '../models/Package';
import { DependencyScore } from '../models/DependencyScore';
import { RepoScoreSnapshot } from '../models/RepoScoreSnapshot';
import { User } from '../models/User';
import { decrypt } from '../utils/encryption';
import { scanRepository } from './scanner/scanner.service';
import { enrichPackageDetailed } from './enrichment/enrichment.orchestrator';
import { scoreDependency, scoreRepository } from './scoring/scoring.service';
import { logger } from '../utils/logger';
import type { IHealthSnapshot } from '@stack-decay/shared';
import type { OsvVulnerability } from './enrichment/osv.client';

/**
 * How many packages are enriched at once. Each package fans out to several
 * upstream APIs, so this is the main lever on how long a scan takes; keep it
 * high enough to hide network latency, low enough to stay clear of GitHub's
 * secondary rate limits.
 */
const ENRICH_CONCURRENCY = 8;

/** Progress percentages for each stage, so the UI can show real movement. */
const PROGRESS_SCANNING = 10;
const PROGRESS_ENRICH_START = 20;
const PROGRESS_ENRICH_END = 85;
const PROGRESS_SCORING = 90;

/** Don't write a progress update to Mongo more often than this. */
const PROGRESS_WRITE_INTERVAL_MS = 1000;

interface UniquePackage {
  ecosystem: string;
  name: string;
  version: string;
}

/**
 * Run `fn` over every item with a bounded number of tasks in flight.
 * Results come back in input order.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

/** Statuses that mean a scan is still in flight. */
const IN_FLIGHT_STATUSES = ['pending', 'scanning', 'enriching', 'scoring'];

/** How long an untouched in-flight scan may sit before startup treats it as dead. */
const STALE_SCAN_AGE_MS = 15 * 60 * 1000;

/**
 * Fail off scans left mid-flight by a previous process. Inline scans don't
 * survive a restart, so without this they sit at "pending" forever and the
 * progress UI polls them indefinitely.
 */
export async function reapStaleScans(): Promise<number> {
  const result = await Scan.updateMany(
    {
      status: { $in: IN_FLIGHT_STATUSES },
      createdAt: { $lt: new Date(Date.now() - STALE_SCAN_AGE_MS) },
    },
    {
      $set: {
        status: 'failed',
        progress: 0,
        errorMessage: 'Scan was interrupted and did not finish',
        completedAt: new Date(),
      },
    },
  );

  if (result.modifiedCount > 0) {
    logger.warn({ count: result.modifiedCount }, 'Marked interrupted scans as failed');
  }

  return result.modifiedCount;
}

/**
 * Run a full scan pipeline inline (no BullMQ/Redis required).
 * Calls real enrichment APIs (npm registry, OSV, Libraries.io, GitHub advisories)
 * and the real scoring service to produce accurate dependency health reports.
 */
export async function runInlineScan(scanId: string): Promise<void> {
  const log = logger.child({ scanId });

  const scan = await Scan.findById(scanId);
  if (!scan) throw new Error(`Scan ${scanId} not found`);

  // Anything that goes wrong from here on has to land on the scan document —
  // a scan left at "pending" makes the progress UI spin forever.
  const repository = await Repository.findById(scan.repositoryId);
  const user = repository ? await User.findById(repository.userId) : null;

  if (!repository || !user) {
    const reason = !repository ? 'Repository not found' : 'User not found';
    log.error({ reason }, 'Inline scan cannot start');
    scan.status = 'failed';
    scan.progress = 0;
    scan.errorMessage = reason;
    scan.completedAt = new Date();
    await scan.save();
    return;
  }

  // Progress is written straight to the collection rather than through the
  // in-memory document, which is being rebuilt while enrichment runs.
  let lastProgressWriteAt = 0;
  const reportProgress = async (progress: number, force = false): Promise<void> => {
    const now = Date.now();
    if (!force && now - lastProgressWriteAt < PROGRESS_WRITE_INTERVAL_MS) return;
    lastProgressWriteAt = now;
    try {
      await Scan.updateOne({ _id: scan._id }, { $set: { progress: Math.round(progress) } });
    } catch {
      // Progress reporting must never break a scan
    }
  };

  try {
    // Stage 1: Scanning — detect manifests and parse dependencies
    scan.status = 'scanning';
    scan.progress = PROGRESS_SCANNING;
    scan.startedAt = new Date();
    await scan.save();

    const accessToken = decrypt(user.accessToken);

    const manifestResults = await scanRepository(
      { owner: repository.owner, name: repository.name, defaultBranch: repository.defaultBranch },
      accessToken,
    );

    log.info({ manifestCount: manifestResults.length }, 'Manifests detected');

    // Build scan manifests
    scan.manifests = manifestResults.map((m) => ({
      filePath: m.filePath,
      ecosystem: m.ecosystem,
      dependencies: m.dependencies.map((d) => ({
        packageId: null,
        name: d.name,
        versionConstraint: d.versionConstraint,
        resolvedVersion: d.versionConstraint.replace(/[\^~>=<! ]/g, ''),
        isDev: d.isDev,
        isDirect: d.isDirect,
        depth: 0,
      })),
    }));

    scan.manifestCount = manifestResults.length;
    scan.dependencyCount = manifestResults.reduce((sum, m) => sum + m.dependencies.length, 0);

    // Stage 2: Enriching — fetch real data from registries, OSV, Libraries.io, GitHub advisories
    scan.status = 'enriching';
    scan.progress = PROGRESS_ENRICH_START;
    await scan.save();

    // Collect unique packages with their version info
    const uniquePackages = new Map<string, UniquePackage>();
    for (const manifest of manifestResults) {
      for (const dep of manifest.dependencies) {
        const key = `${manifest.ecosystem}:${dep.name}`;
        if (!uniquePackages.has(key)) {
          uniquePackages.set(key, {
            ecosystem: manifest.ecosystem,
            name: dep.name,
            version: dep.versionConstraint.replace(/[\^~>=<! ]/g, ''),
          });
        }
      }
    }

    // Enrich packages concurrently — this is where nearly all of the wall time goes
    const healthSnapshots = new Map<string, IHealthSnapshot>();
    const packageIdsByKey = new Map<string, Types.ObjectId>();
    const entries = [...uniquePackages.entries()];
    let enrichedCount = 0;

    await mapWithConcurrency(entries, ENRICH_CONCURRENCY, async ([key, pkg]) => {
      // Call the real enrichment orchestrator. It returns the vulnerabilities it
      // already fetched, so we don't query OSV a second time here.
      let healthSnapshot: IHealthSnapshot | null = null;
      let vulns: OsvVulnerability[] = [];

      try {
        const enriched = await enrichPackageDetailed({
          ecosystem: pkg.ecosystem,
          name: pkg.name,
          version: pkg.version,
          githubToken: accessToken,
        });

        if (enriched) {
          healthSnapshot = enriched.snapshot;
          vulns = enriched.vulnerabilities;
        }
      } catch (err: any) {
        log.warn({ err: err.message, pkg: pkg.name }, 'Enrichment failed for package, using defaults');
      }

      // Upsert package in DB with enriched data
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (healthSnapshot) {
        updateData.latestHealth = healthSnapshot;
        updateData.lastEnrichedAt = new Date();
        // Update license from health snapshot if available
        if (healthSnapshot.license?.spdx) {
          updateData.license = healthSnapshot.license.spdx;
        }
        healthSnapshots.set(key, healthSnapshot);
      }

      // Build vulnerability documents for the Package model
      const vulnDocs = vulns.map((v) => ({
        source: 'osv' as const,
        sourceId: v.id,
        severity: v.severity,
        cvssScore: null,
        summary: v.summary,
        affectedVersions: v.affectedRanges,
        fixedVersion: v.fixedVersions[0] || null,
        publishedAt: new Date(),
        withdrawnAt: null,
        url: `https://osv.dev/vulnerability/${v.id}`,
      }));

      const dbPkg = await Package.findOneAndUpdate(
        { ecosystem: pkg.ecosystem, name: pkg.name },
        {
          $setOnInsert: {
            ecosystem: pkg.ecosystem,
            name: pkg.name,
            registryUrl: '',
            createdAt: new Date(),
          },
          $set: {
            ...updateData,
            ...(vulnDocs.length > 0 ? { vulnerabilities: vulnDocs } : {}),
          },
        },
        { upsert: true, new: true },
      );

      packageIdsByKey.set(key, dbPkg._id as Types.ObjectId);

      enrichedCount++;
      const span = PROGRESS_ENRICH_END - PROGRESS_ENRICH_START;
      await reportProgress(PROGRESS_ENRICH_START + (enrichedCount / entries.length) * span);

      log.debug(
        {
          pkg: pkg.name,
          hasHealth: !!healthSnapshot,
          vulnCount: vulns.length,
        },
        'Package enriched',
      );
    });

    // Link packageIds in scan manifests
    for (const manifest of scan.manifests) {
      for (const dep of manifest.dependencies) {
        const packageId = packageIdsByKey.get(`${manifest.ecosystem}:${dep.name}`);
        if (packageId) {
          dep.packageId = packageId;
        }
      }
    }

    scan.progress = PROGRESS_ENRICH_END;
    await scan.save();

    // Stage 3: Scoring — use real scoring service with enriched health data
    scan.status = 'scoring';
    scan.progress = PROGRESS_SCORING;
    await scan.save();

    const depScores: Array<{
      scanId: unknown;
      packageId: unknown;
      maintenanceScore: number;
      communityScore: number;
      vulnerabilityScore: number;
      eolScore: number;
      licenseScore: number;
      compositeScore: number;
      grade: string;
      scoringVersion: string;
    }> = [];
    const depMeta: Array<{ isDev: boolean; isDirect: boolean }> = [];

    for (const manifest of scan.manifests) {
      for (const dep of manifest.dependencies) {
        if (!dep.packageId) continue;

        const key = `${manifest.ecosystem}:${dep.name}`;
        const healthSnapshot = healthSnapshots.get(key);

        if (healthSnapshot) {
          // Use real scoring service
          const scored = scoreDependency(
            healthSnapshot,
            scan._id.toString(),
            dep.packageId.toString(),
          );

          depScores.push({
            scanId: scan._id,
            packageId: dep.packageId,
            maintenanceScore: scored.maintenanceScore,
            communityScore: scored.communityScore,
            vulnerabilityScore: scored.vulnerabilityScore,
            eolScore: scored.eolScore,
            licenseScore: scored.licenseScore,
            compositeScore: scored.compositeScore,
            grade: scored.grade,
            scoringVersion: scored.scoringVersion,
          });
        } else {
          // Fallback: conservative defaults when enrichment failed
          depScores.push({
            scanId: scan._id,
            packageId: dep.packageId,
            maintenanceScore: 40,
            communityScore: 40,
            vulnerabilityScore: 70,
            eolScore: 60,
            licenseScore: 30,
            compositeScore: 48,
            grade: 'C',
            scoringVersion: '1.0.0',
          });
        }

        depMeta.push({ isDev: dep.isDev, isDirect: dep.isDirect });
      }
    }

    if (depScores.length > 0) {
      await DependencyScore.insertMany(depScores);
    }

    // Compute aggregate repo score using real scoring service
    const repoSnapshot = scoreRepository(
      depScores.map((d) => ({
        id: '',
        scanId: scan._id.toString(),
        packageId: d.packageId?.toString() || '',
        maintenanceScore: d.maintenanceScore,
        communityScore: d.communityScore,
        vulnerabilityScore: d.vulnerabilityScore,
        eolScore: d.eolScore,
        licenseScore: d.licenseScore,
        compositeScore: d.compositeScore,
        grade: d.grade,
        scoringVersion: d.scoringVersion,
      })),
      depMeta,
    );

    const avgScore = repoSnapshot.compositeScore;
    const grade = repoSnapshot.grade;

    // Save repo score snapshot
    await RepoScoreSnapshot.create({
      repositoryId: repository._id,
      scanId: scan._id,
      compositeScore: avgScore,
      maintenanceAvg: repoSnapshot.maintenanceAvg,
      communityAvg: repoSnapshot.communityAvg,
      vulnerabilityAvg: repoSnapshot.vulnerabilityAvg,
      eolAvg: repoSnapshot.eolAvg,
      licenseAvg: repoSnapshot.licenseAvg,
      grade,
      totalDependencies: scan.dependencyCount,
      vulnerableCount: repoSnapshot.vulnerableCount,
      deprecatedCount: repoSnapshot.deprecatedCount,
      outdatedCount: repoSnapshot.outdatedCount,
      snapshotDate: new Date(),
    });

    // Update repo with latest score
    repository.latestScore = avgScore;
    repository.latestGrade = grade;
    repository.lastScannedAt = new Date();
    await repository.save();

    // Mark scan complete
    scan.status = 'completed';
    scan.progress = 100;
    scan.aggregateScore = avgScore;
    scan.aggregateGrade = grade;
    scan.completedAt = new Date();
    await scan.save();

    log.info(
      {
        manifestCount: scan.manifestCount,
        dependencyCount: scan.dependencyCount,
        score: avgScore,
        grade,
        vulnerableCount: repoSnapshot.vulnerableCount,
        deprecatedCount: repoSnapshot.deprecatedCount,
        outdatedCount: repoSnapshot.outdatedCount,
      },
      'Inline scan completed',
    );
  } catch (error: any) {
    log.error({ error: error.message }, 'Inline scan failed');
    scan.status = 'failed';
    scan.progress = 0;
    scan.errorMessage = error.message || 'Unknown error during scan';
    scan.completedAt = new Date();
    await scan.save();
  }
}
