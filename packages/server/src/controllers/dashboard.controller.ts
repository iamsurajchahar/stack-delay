import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Repository } from '../models/Repository';
import { Scan } from '../models/Scan';
import { RepoScoreSnapshot } from '../models/RepoScoreSnapshot';
import { AppError } from '../middleware/errorHandler.middleware';

export async function getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = new Types.ObjectId(req.userId!);

    const repos = await Repository.find({ userId, isActive: true }).lean();
    const repoIds = repos.map((r) => r._id);

    // Aggregate stats in parallel
    const [totalScans, activeScans, recentScans] = await Promise.all([
      Scan.countDocuments({ repositoryId: { $in: repoIds } }),
      Scan.countDocuments({
        repositoryId: { $in: repoIds },
        status: { $in: ['pending', 'scanning', 'enriching', 'scoring'] },
      }),
      Scan.find({ repositoryId: { $in: repoIds }, status: 'completed' })
        .sort({ completedAt: -1 })
        .limit(5)
        .select('repositoryId aggregateScore aggregateGrade completedAt')
        .lean(),
    ]);

    // Score distribution
    const scoreDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0, unscored: 0 };
    for (const repo of repos) {
      const grade = repo.latestGrade;
      if (grade && grade in scoreDistribution) {
        scoreDistribution[grade as keyof typeof scoreDistribution]++;
      } else {
        scoreDistribution.unscored++;
      }
    }

    // Average score across repos with scores
    const scoredRepos = repos.filter((r) => r.latestScore !== null);
    const avgScore =
      scoredRepos.length > 0
        ? Math.round(scoredRepos.reduce((sum, r) => sum + (r.latestScore || 0), 0) / scoredRepos.length)
        : null;

    res.json({
      status: 'success',
      data: {
        summary: {
          totalRepos: repos.length,
          scoredRepos: scoredRepos.length,
          averageScore: avgScore,
          totalScans,
          activeScans,
          scoreDistribution,
          recentScans,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getTrends(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = new Types.ObjectId(req.userId!);

    const repos = await Repository.find({ userId, isActive: true }).select('_id name fullName').lean();
    const repoIds = repos.map((r) => r._id);

    // Default to last 30 days
    const daysBack = Math.min(365, Math.max(7, parseInt(req.query.days as string, 10) || 30));
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const snapshots = await RepoScoreSnapshot.find({
      repositoryId: { $in: repoIds },
      snapshotDate: { $gte: since },
    })
      .sort({ snapshotDate: 1 })
      .lean();

    // Group snapshots by repo
    const repoMap = new Map(repos.map((r) => [r._id.toString(), r]));
    const trends: Array<{
      repositoryId: string;
      name: string;
      fullName: string;
      snapshots: Array<{
        date: Date;
        score: number;
        grade: string;
      }>;
      scoreChange: number | null;
    }> = [];

    const groupedByRepo = new Map<string, typeof snapshots>();
    for (const snap of snapshots) {
      const key = snap.repositoryId.toString();
      if (!groupedByRepo.has(key)) {
        groupedByRepo.set(key, []);
      }
      groupedByRepo.get(key)!.push(snap);
    }

    for (const [repoIdStr, repoSnapshots] of groupedByRepo) {
      const repo = repoMap.get(repoIdStr);
      if (!repo) continue;

      const first = repoSnapshots[0];
      const last = repoSnapshots[repoSnapshots.length - 1];
      const scoreChange = repoSnapshots.length >= 2 ? last.compositeScore - first.compositeScore : null;

      trends.push({
        repositoryId: repoIdStr,
        name: repo.name as string,
        fullName: repo.fullName as string,
        snapshots: repoSnapshots.map((s) => ({
          date: s.snapshotDate,
          score: s.compositeScore,
          grade: s.grade,
        })),
        scoreChange,
      });
    }

    res.json({
      status: 'success',
      data: { trends, period: { days: daysBack, since } },
    });
  } catch (err) {
    next(err);
  }
}
