import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Repository } from '../models/Repository';
import { Scan } from '../models/Scan';
import { Package } from '../models/Package';
import { AppError } from '../middleware/errorHandler.middleware';

/**
 * GET /repos/:repoId/vulnerabilities
 * Aggregates vulnerabilities from all packages in the latest completed scan.
 */
export async function getRepoVulnerabilities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const repoId = req.params.repoId as string;

    if (!Types.ObjectId.isValid(repoId)) {
      throw new AppError('Invalid repository ID', 400, 'INVALID_REPO_ID');
    }

    const repo = await Repository.findOne({
      _id: new Types.ObjectId(repoId),
      userId: new Types.ObjectId(req.userId!),
    });

    if (!repo) {
      throw new AppError('Repository not found', 404, 'REPO_NOT_FOUND');
    }

    // Get the latest completed scan
    const latestScan = await Scan.findOne({
      repositoryId: repo._id,
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!latestScan) {
      res.json({
        status: 'success',
        data: { vulnerabilities: [] },
      });
      return;
    }

    // Collect all unique package IDs from the scan
    const packageIds = new Set<string>();
    for (const manifest of latestScan.manifests || []) {
      for (const dep of manifest.dependencies || []) {
        if (dep.packageId) {
          packageIds.add(dep.packageId.toString());
        }
      }
    }

    if (packageIds.size === 0) {
      res.json({
        status: 'success',
        data: { vulnerabilities: [] },
      });
      return;
    }

    // Fetch all packages with their vulnerabilities
    const packages = await Package.find({
      _id: { $in: Array.from(packageIds).map((id) => new Types.ObjectId(id)) },
      'vulnerabilities.0': { $exists: true },
    })
      .select('name ecosystem vulnerabilities')
      .lean();

    // Flatten and annotate with package name
    const vulnerabilities = [];
    for (const pkg of packages) {
      for (const vuln of pkg.vulnerabilities) {
        vulnerabilities.push({
          id: vuln.sourceId,
          packageName: pkg.name,
          ecosystem: pkg.ecosystem,
          source: vuln.source,
          sourceId: vuln.sourceId,
          severity: vuln.severity,
          cvssScore: vuln.cvssScore,
          summary: vuln.summary,
          affectedVersions: vuln.affectedVersions,
          fixedVersion: vuln.fixedVersion,
          publishedAt: vuln.publishedAt,
          withdrawnAt: vuln.withdrawnAt,
          url: vuln.url,
        });
      }
    }

    // Sort by severity (critical first)
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    vulnerabilities.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

    res.json({
      status: 'success',
      data: { vulnerabilities },
    });
  } catch (err) {
    next(err);
  }
}
