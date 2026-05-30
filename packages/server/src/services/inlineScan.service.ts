import { Scan } from '../models/Scan';
import { Repository } from '../models/Repository';
import { Package } from '../models/Package';
import { DependencyScore } from '../models/DependencyScore';
import { RepoScoreSnapshot } from '../models/RepoScoreSnapshot';
import { User } from '../models/User';
import { decrypt } from '../utils/encryption';
import { scanRepository } from './scanner/scanner.service';
import { enrichPackage } from './enrichment/enrichment.orchestrator';
import { scoreDependency, scoreRepository } from './scoring/scoring.service';
import { logger } from '../utils/logger';
import type { IHealthSnapshot } from '@stack-decay/shared';
import type { OsvVulnerability } from './enrichment/osv.client';
import * as osv from './enrichment/osv.client';

/**
 * Run a full scan pipeline inline (no BullMQ/Redis required).
 * Calls real enrichment APIs (npm registry, OSV, Libraries.io, GitHub advisories)
 * and the real scoring service to produce accurate dependency health reports.
 */
export async function runInlineScan(scanId: string): Promise<void> {
  const log = logger.child({ scanId });

  const scan = await Scan.findById(scanId);
  if (!scan) throw new Error(`Scan ${scanId} not found`);

  const repository = await Repository.findById(scan.repositoryId);
  if (!repository) throw new Error(`Repository not found`);

  const user = await User.findById(repository.userId);
  if (!user) throw new Error(`User not found`);

  try {
    // Stage 1: Scanning — detect manifests and parse dependencies
    scan.status = 'scanning';
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
    await scan.save();

    // Collect unique packages with their version info
    const uniquePackages = new Map<string, { ecosystem: string; name: string; version: string }>();
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

    // Enrich each package and store in DB
    const healthSnapshots = new Map<string, IHealthSnapshot>();

    for (const [key, pkg] of uniquePackages) {
      // Call real enrichment orchestrator
      let healthSnapshot: IHealthSnapshot | null = null;
      try {
        healthSnapshot = await enrichPackage({
          ecosystem: pkg.ecosystem,
          name: pkg.name,
          version: pkg.version,
          githubToken: accessToken,
        });
      } catch (err: any) {
        log.warn({ err: err.message, pkg: pkg.name }, 'Enrichment failed for package, using defaults');
      }

      // Also fetch vulnerabilities directly for storing on the Package model
      let vulns: OsvVulnerability[] = [];
      try {
        vulns = await osv.queryVulnerabilities(pkg.ecosystem, pkg.name, pkg.version);
      } catch {
        // Already handled by enrichment orchestrator, this is a fallback
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

      // Link packageId in scan manifests
      for (const manifest of scan.manifests) {
        for (const dep of manifest.dependencies) {
          if (dep.name === pkg.name && manifest.ecosystem === pkg.ecosystem) {
            dep.packageId = dbPkg._id;
          }
        }
      }

      log.debug(
        {
          pkg: pkg.name,
          hasHealth: !!healthSnapshot,
          vulnCount: vulns.length,
        },
        'Package enriched',
      );
    }

    await scan.save();

    // Stage 3: Scoring — use real scoring service with enriched health data
    scan.status = 'scoring';
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
    scan.errorMessage = error.message || 'Unknown error during scan';
    scan.completedAt = new Date();
    await scan.save();
  }
}
