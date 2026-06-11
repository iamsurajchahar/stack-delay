import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { QUEUE_NAMES, enrichQueue, scoreQueue } from './queues';
import { scanRepository, ScanResult } from '../services/scanner/scanner.service';
import { GitHubService } from '../services/github.service';
import { Scan } from '../models/Scan';
import { Repository } from '../models/Repository';
import { Package } from '../models/Package';
import { User } from '../models/User';
import { decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';

interface ScanJobData {
  repositoryId: string;
  userId: string;
  scanId: string;
  triggeredBy: 'manual' | 'scheduled' | 'webhook';
}

export function createScanWorker() {
  const worker = new Worker<ScanJobData>(
    QUEUE_NAMES.REPO_SCAN,
    async (job: Job<ScanJobData>) => {
      const { repositoryId, userId, scanId, triggeredBy } = job.data;
      const log = logger.child({ scanId, repositoryId, jobId: job.id });

      log.info('Starting repo scan');

      const scan = await Scan.findById(scanId);
      if (!scan) throw new Error(`Scan ${scanId} not found`);

      const repository = await Repository.findById(repositoryId);
      if (!repository) throw new Error(`Repository ${repositoryId} not found`);

      const user = await User.findById(userId);
      if (!user) throw new Error(`User ${userId} not found`);

      try {
        // Stage 1: Scanning - detect manifests and parse dependencies
        scan.status = 'scanning';
        scan.startedAt = new Date();
        await scan.save();
        await job.updateProgress(10);

        const accessToken = decrypt(user.accessToken);
        const github = new GitHubService(accessToken);

        // Get repo tree and detect manifests
        const treeResult = await github.getRepoTree(repository.owner, repository.name, repository.defaultBranch);
        const treePaths = treeResult.tree.map((item) => item.path);

        const manifestResults: ScanResult[] = await scanRepository(
          { owner: repository.owner, name: repository.name, defaultBranch: repository.defaultBranch },
          accessToken
        );

        scan.manifests = manifestResults.map((m: ScanResult) => ({
          filePath: m.filePath,
          ecosystem: m.ecosystem,
          dependencies: m.dependencies.map((d: any) => ({
            packageId: null,
            name: d.name,
            versionConstraint: d.versionConstraint,
            resolvedVersion: d.versionConstraint.replace(/[\^~>=<! ]/g, ''),
            isDev: d.isDev,
            isDirect: d.isDirect,
            depth: 0,
          })),
        })) as any;

        scan.manifestCount = manifestResults.length;
        scan.dependencyCount = manifestResults.reduce((sum: number, m: ScanResult) => sum + m.dependencies.length, 0);
        await scan.save();
        await job.updateProgress(40);

        log.info({ manifestCount: scan.manifestCount, dependencyCount: scan.dependencyCount }, 'Manifests parsed');

        // Stage 2: Enriching - fan out enrichment jobs per unique package
        scan.status = 'enriching';
        await scan.save();

        const uniquePackages = new Map<string, { ecosystem: string; name: string }>();
        for (const manifest of manifestResults) {
          for (const dep of manifest.dependencies) {
            const key = `${manifest.ecosystem}:${dep.name}`;
            if (!uniquePackages.has(key)) {
              uniquePackages.set(key, { ecosystem: manifest.ecosystem, name: dep.name });
            }
          }
        }

        // Ensure packages exist in DB and enqueue enrichment
        const enrichJobs: { name: string; data: any; opts: any }[] = [];
        for (const [key, pkg] of uniquePackages) {
          const dbPkg = await Package.findOneAndUpdate(
            { ecosystem: pkg.ecosystem, name: pkg.name },
            {
              $setOnInsert: {
                ecosystem: pkg.ecosystem,
                name: pkg.name,
                registryUrl: '',
                latestVersion: '',
                vulnerabilities: [],
                createdAt: new Date(),
              },
              $set: { updatedAt: new Date() },
            },
            { upsert: true, new: true }
          );

          // Update dependency entries with packageId
          for (const manifest of scan.manifests) {
            for (const dep of manifest.dependencies) {
              if (dep.name === pkg.name && manifest.ecosystem === pkg.ecosystem) {
                dep.packageId = dbPkg._id.toString() as any;
              }
            }
          }

          enrichJobs.push({
            name: 'enrich-package',
            data: {
              packageId: dbPkg._id.toString(),
              ecosystem: pkg.ecosystem,
              packageName: pkg.name,
              scanId,
            },
            opts: {
              jobId: `enrich:${pkg.ecosystem}:${pkg.name}`,
            },
          });
        }

        await scan.save();

        if (enrichJobs.length > 0) {
          await enrichQueue.addBulk(enrichJobs);
        }

        await job.updateProgress(60);

        // Enqueue score computation (it will wait for enrichment to finish via polling)
        await scoreQueue.add('compute-scores', {
          scanId,
          repositoryId,
          totalPackages: uniquePackages.size,
        }, {
          delay: Math.max(5000, uniquePackages.size * 500), // Delay to allow enrichment
          jobId: `score:${scanId}`,
        });

        log.info({ uniquePackages: uniquePackages.size }, 'Enrichment jobs dispatched, score job queued');
        await job.updateProgress(70);

      } catch (error: any) {
        log.error({ error: error.message }, 'Scan failed');
        scan.status = 'failed';
        scan.errorMessage = error.message || 'Unknown error during scan';
        scan.completedAt = new Date();
        await scan.save();
        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, scanId: job.data.scanId }, 'Scan worker completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, scanId: job?.data.scanId, error: err.message }, 'Scan worker failed');
  });

  return worker;
}
