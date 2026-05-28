import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { QUEUE_NAMES } from './queues';
import { enrichPackage } from '../services/enrichment/enrichment.orchestrator';
import { Package } from '../models/Package';
import { PackageHealthHistory } from '../models/PackageHealthHistory';
import { logger } from '../utils/logger';

interface EnrichJobData {
  packageId: string;
  ecosystem: string;
  packageName: string;
  scanId: string;
}

export function createEnrichWorker() {
  const worker = new Worker<EnrichJobData>(
    QUEUE_NAMES.DEPENDENCY_ENRICH,
    async (job: Job<EnrichJobData>) => {
      const { packageId, ecosystem, packageName, scanId } = job.data;
      const log = logger.child({ packageId, ecosystem, packageName, jobId: job.id });

      log.info('Starting package enrichment');

      const pkg = await Package.findById(packageId);
      if (!pkg) {
        log.warn('Package not found, skipping');
        return;
      }

      // Check if recently enriched (within last 6 hours)
      if (pkg.lastEnrichedAt) {
        const hoursSinceEnrich = (Date.now() - pkg.lastEnrichedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceEnrich < 6) {
          log.info({ hoursSinceEnrich }, 'Package recently enriched, skipping');
          return;
        }
      }

      try {
        const healthSnapshot = await enrichPackage({
          ecosystem,
          name: packageName,
          repoUrl: pkg.repoUrl || undefined,
        });

        if (!healthSnapshot) {
          log.warn('Enrichment returned null, no data available');
          return;
        }

        // Update package with latest health data
        pkg.latestHealth = healthSnapshot;
        pkg.lastEnrichedAt = new Date();

        // Update package metadata from enrichment
        if (healthSnapshot.license?.spdx) {
          pkg.license = healthSnapshot.license.spdx;
        }

        await pkg.save();

        // Store health history snapshot
        await PackageHealthHistory.findOneAndUpdate(
          {
            packageId: pkg._id,
            snapshotDate: new Date(new Date().toISOString().split('T')[0]), // Date only
          },
          {
            $set: {
              packageId: pkg._id,
              snapshotDate: new Date(new Date().toISOString().split('T')[0]),
              maintenance: healthSnapshot.maintenance,
              community: healthSnapshot.community,
              vulnerability: healthSnapshot.vulnerability,
              eol: healthSnapshot.eol,
              license: healthSnapshot.license,
            },
          },
          { upsert: true, new: true }
        );

        await job.updateProgress(100);
        log.info('Package enrichment completed');

      } catch (error: any) {
        log.error({ error: error.message }, 'Package enrichment failed');
        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 20,
      limiter: {
        max: 30,
        duration: 60000, // 30 jobs per minute (GitHub API budget)
      },
    }
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, package: job.data.packageName }, 'Enrich worker completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, package: job?.data.packageName, error: err.message }, 'Enrich worker failed');
  });

  return worker;
}
