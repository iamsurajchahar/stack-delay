import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Repository } from '../models/Repository';
import { RepoScoreSnapshot } from '../models/RepoScoreSnapshot';
import { DependencyScore } from '../models/DependencyScore';
import { Scan } from '../models/Scan';
import { AppError } from '../middleware/errorHandler.middleware';

export async function getCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const latestSnapshot = await RepoScoreSnapshot.findOne({
      repositoryId: repo._id,
    })
      .sort({ snapshotDate: -1 })
      .lean();

    if (!latestSnapshot) {
      res.json({
        status: 'success',
        data: {
          score: null,
          message: 'No score available. Trigger a scan first.',
        },
      });
      return;
    }

    res.json({
      status: 'success',
      data: { score: latestSnapshot },
    });
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    // Parse date range from query
    const query: Record<string, unknown> = { repositoryId: repo._id };
    const dateFilter: Record<string, Date> = {};

    if (req.query.from) {
      const fromDate = new Date(req.query.from as string);
      if (isNaN(fromDate.getTime())) {
        throw new AppError('Invalid "from" date format', 400, 'INVALID_DATE');
      }
      dateFilter.$gte = fromDate;
    }

    if (req.query.to) {
      const toDate = new Date(req.query.to as string);
      if (isNaN(toDate.getTime())) {
        throw new AppError('Invalid "to" date format', 400, 'INVALID_DATE');
      }
      dateFilter.$lte = toDate;
    }

    if (Object.keys(dateFilter).length > 0) {
      query.snapshotDate = dateFilter;
    }

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));

    const snapshots = await RepoScoreSnapshot.find(query)
      .sort({ snapshotDate: -1 })
      .limit(limit)
      .lean();

    res.json({
      status: 'success',
      data: { snapshots },
    });
  } catch (err) {
    next(err);
  }
}

export async function getDependencyScores(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    // Find the latest completed scan
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
          scores: [],
          message: 'No completed scans found',
        },
      });
      return;
    }

    const scores = await DependencyScore.find({ scanId: latestScan._id })
      .populate('packageId', 'ecosystem name latestVersion')
      .sort({ compositeScore: 1 })
      .lean();

    res.json({
      status: 'success',
      data: { scanId: latestScan._id, scores },
    });
  } catch (err) {
    next(err);
  }
}
