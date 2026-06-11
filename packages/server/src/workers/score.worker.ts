import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { QUEUE_NAMES, alertQueue } from './queues';
import { scoreDependency, scoreRepository } from '../services/scoring/scoring.service';
import { Scan } from '../models/Scan';
import { Package } from '../models/Package';
import { Repository } from '../models/Repository';
import { DependencyScore } from '../models/DependencyScore';
import { RepoScoreSnapshot } from '../models/RepoScoreSnapshot';
import { logger } from '../utils/logger';

interface ScoreJobData {
  scanId: string;
  repositoryId: string;
  totalPackages: number;
}

export function createScoreWorker() {
  const worker = new Worker<ScoreJobData>(
    QUEUE_NAMES.SCORE_COMPUTE,
    async (job: Job<ScoreJobData>) => {
      const { scanId, repositoryId, totalPackages } = job.data;
      const log = logger.child({ scanId, repositoryId, jobId: job.id });

      log.info('Starting score computation');

      const scan = await Scan.findById(scanId);
      if (!scan) throw new Error(`Scan ${scanId} not found`);

      const repository = await Repository.findById(repositoryId);
      if (!repository) throw new Error(`Repository ${repositoryId} not found`);

      try {
        scan.status = 'scoring';
        await scan.save();
        await job.updateProgress(10);

        // Collect all unique package IDs from scan
        const packageIds = new Set<string>();
        const depMeta: { packageId: string; isDev: boolean; isDirect: boolean }[] = [];

        for (const manifest of scan.manifests) {
          for (const dep of manifest.dependencies) {
            if (dep.packageId) {
              packageIds.add(dep.packageId.toString());
              depMeta.push({
                packageId: dep.packageId.toString(),
                isDev: dep.isDev,
                isDirect: dep.isDirect,
              });
            }
          }
        }

        // Load all packages with their health data
        const packages = await Package.find({ _id: { $in: Array.from(packageIds) } });
        const packageMap = new Map(packages.map((p) => [p._id.toString(), p]));

        await job.updateProgress(30);

        // Score each dependency
        const dependencyScores: any[] = [];
        for (const pkg of packages) {
          if (!pkg.latestHealth) {
            log.warn({ packageId: pkg._id, name: pkg.name }, 'Package has no health data, using defaults');
          }

          const health = pkg.latestHealth || createDefaultHealth();
          const scores = scoreDependency(health, scanId, pkg._id.toString());

          const depScore = new DependencyScore({
            scanId,
            packageId: pkg._id,
            maintenanceScore: scores.maintenanceScore,
            communityScore: scores.communityScore,
            vulnerabilityScore: scores.vulnerabilityScore,
            eolScore: scores.eolScore,
            licenseScore: scores.licenseScore,
            compositeScore: scores.compositeScore,
            grade: scores.grade,
            scoringVersion: '1.0',
          });

          dependencyScores.push(depScore);
        }

        // Bulk insert dependency scores
        if (dependencyScores.length > 0) {
          await DependencyScore.insertMany(dependencyScores);
        }

        await job.updateProgress(60);

        // Compute repository aggregate score
        const scoreInputs = dependencyScores.map((ds) => {
          const meta = depMeta.find((m) => m.packageId === ds.packageId.toString());
          return {
            compositeScore: ds.compositeScore,
            maintenanceScore: ds.maintenanceScore,
            communityScore: ds.communityScore,
            vulnerabilityScore: ds.vulnerabilityScore,
            eolScore: ds.eolScore,
            licenseScore: ds.licenseScore,
            isDev: meta?.isDev ?? false,
            isDirect: meta?.isDirect ?? true,
          };
        });

        const repoScore = scoreRepository(
          dependencyScores.map(ds => ({
            id: ds._id?.toString() || '',
            scanId,
            packageId: ds.packageId.toString(),
            maintenanceScore: ds.maintenanceScore,
            communityScore: ds.communityScore,
            vulnerabilityScore: ds.vulnerabilityScore,
            eolScore: ds.eolScore,
            licenseScore: ds.licenseScore,
            compositeScore: ds.compositeScore,
            grade: ds.grade,
            scoringVersion: ds.scoringVersion || '1.0',
          })),
          depMeta.map(m => ({ isDev: m.isDev, isDirect: m.isDirect })),
        );

        // Create repo score snapshot
        const snapshot = await RepoScoreSnapshot.findOneAndUpdate(
          {
            repositoryId,
            snapshotDate: new Date(new Date().toISOString().split('T')[0]),
          },
          {
            $set: {
              scanId,
              compositeScore: repoScore.compositeScore,
              grade: repoScore.grade,
              maintenanceAvg: repoScore.maintenanceAvg,
              communityAvg: repoScore.communityAvg,
              vulnerabilityAvg: repoScore.vulnerabilityAvg,
              eolAvg: repoScore.eolAvg,
              licenseAvg: repoScore.licenseAvg,
              totalDependencies: dependencyScores.length,
              vulnerableCount: dependencyScores.filter((d) => d.vulnerabilityScore < 50).length,
              deprecatedCount: dependencyScores.filter((d) => d.eolScore === 0).length,
              outdatedCount: dependencyScores.filter((d) => d.maintenanceScore < 30).length,
            },
          },
          { upsert: true, new: true }
        );

        await job.updateProgress(80);

        // Update repository with latest score
        repository.latestScore = repoScore.compositeScore;
        repository.latestGrade = repoScore.grade;
        repository.lastScannedAt = new Date();
        await repository.save();

        // Update scan as completed
        scan.status = 'completed';
        scan.aggregateScore = repoScore.compositeScore;
        scan.aggregateGrade = repoScore.grade;
        scan.completedAt = new Date();
        await scan.save();

        await job.updateProgress(90);

        // Enqueue alert evaluation
        await alertQueue.add('evaluate-alerts', {
          repositoryId,
          scanId,
          userId: repository.userId.toString(),
          compositeScore: repoScore.compositeScore,
          grade: repoScore.grade,
        }, {
          jobId: `alert:${scanId}`,
        });

        await job.updateProgress(100);
        log.info({
          compositeScore: repoScore.compositeScore,
          grade: repoScore.grade,
          dependencies: dependencyScores.length,
        }, 'Score computation completed');

      } catch (error: any) {
        log.error({ error: error.message }, 'Score computation failed');
        scan.status = 'failed';
        scan.errorMessage = `Scoring failed: ${error.message}`;
        scan.completedAt = new Date();
        await scan.save();
        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 10,
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, scanId: job.data.scanId }, 'Score worker completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, scanId: job?.data.scanId, error: err.message }, 'Score worker failed');
  });

  return worker;
}

function createDefaultHealth() {
  return {
    snapshotDate: new Date(),
    maintenance: {
      commitsLast90d: 0,
      releasesLastYear: 0,
      daysSinceLastRelease: 999,
      openIssuesCount: 0,
      closedIssuesLast90d: 0,
      openPrCount: 0,
      avgIssueCloseDays: 0,
    },
    community: {
      starsCount: 0,
      starsGrowth30d: 0,
      forksCount: 0,
      contributorCount: 0,
      dependentReposCount: 0,
      downloadsLastWeek: 0,
    },
    vulnerability: {
      openCveCount: 0,
      totalCveCount: 0,
      criticalCveCount: 0,
      highCveCount: 0,
      avgFixTimeDays: 0,
    },
    eol: {
      isDeprecated: false,
      isArchived: false,
    },
    license: {
      spdx: '',
      riskTier: 'unknown' as const,
    },
  };
}
