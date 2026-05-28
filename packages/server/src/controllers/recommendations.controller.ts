import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Repository } from '../models/Repository';
import { Scan } from '../models/Scan';
import { DependencyScore } from '../models/DependencyScore';
import { Package } from '../models/Package';
import { AppError } from '../middleware/errorHandler.middleware';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { repoId } = req.params;

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
        data: {
          recommendations: [],
          message: 'No completed scans found. Trigger a scan first.',
        },
      });
      return;
    }

    // Find low-scoring dependencies
    const lowScores = await DependencyScore.find({
      scanId: latestScan._id,
      compositeScore: { $lt: 65 },
    })
      .populate('packageId')
      .sort({ compositeScore: 1 })
      .lean();

    const recommendations = [];

    for (const score of lowScores) {
      const pkg = score.packageId as unknown as Record<string, unknown>;
      if (!pkg) continue;

      const pkgName = pkg.name as string;
      const ecosystem = pkg.ecosystem as string;
      const latestHealth = pkg.latestHealth as Record<string, unknown> | null;
      const vulns = (pkg.vulnerabilities as unknown[]) || [];

      // Determine recommendation type and priority
      let type: 'upgrade' | 'replace' | 'remove' = 'upgrade';
      let priority: 'critical' | 'high' | 'medium' | 'low' = 'medium';
      let title = '';
      let description = '';

      if (latestHealth) {
        const eol = latestHealth.eol as Record<string, unknown> | undefined;
        if (eol?.isDeprecated || eol?.isArchived) {
          type = 'replace';
          priority = 'high';
          title = `Replace deprecated package: ${pkgName}`;
          description = `${pkgName} is ${eol.isArchived ? 'archived' : 'deprecated'}. Consider finding an actively maintained alternative.`;
        }
      }

      if (vulns.length > 0 && type !== 'replace') {
        const hasCritical = vulns.some((v) => (v as Record<string, unknown>).severity === 'critical');
        const hasHigh = vulns.some((v) => (v as Record<string, unknown>).severity === 'high');

        if (hasCritical) {
          priority = 'critical';
          title = `Critical vulnerability in ${pkgName}`;
          description = `${pkgName} has ${vulns.length} known vulnerabilities including critical ones. Upgrade immediately.`;
        } else if (hasHigh) {
          priority = 'high';
          title = `High-severity vulnerability in ${pkgName}`;
          description = `${pkgName} has ${vulns.length} known vulnerabilities. Upgrade as soon as possible.`;
        } else {
          title = `Vulnerabilities found in ${pkgName}`;
          description = `${pkgName} has ${vulns.length} known vulnerabilities. Consider upgrading.`;
        }
      }

      if (!title) {
        if (score.compositeScore < 35) {
          priority = 'high';
          title = `Low health score for ${pkgName}`;
          description = `${pkgName} has a health score of ${score.compositeScore}/100. Review its maintenance and community status.`;
        } else {
          priority = 'medium';
          title = `Below-average health for ${pkgName}`;
          description = `${pkgName} has a health score of ${score.compositeScore}/100. Monitor for improvements or consider alternatives.`;
        }
      }

      recommendations.push({
        packageId: pkg._id,
        packageName: pkgName,
        ecosystem,
        type,
        priority,
        title,
        description,
        currentScore: score.compositeScore,
        grade: score.grade,
        scoreImpact: Math.max(0, 65 - score.compositeScore),
      });
    }

    // Sort by priority weight
    const priorityWeight: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]);

    res.json({
      status: 'success',
      data: { recommendations },
    });
  } catch (err) {
    next(err);
  }
}
