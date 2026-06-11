import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Scan } from '../models/Scan';
import { Repository } from '../models/Repository';
import { AppError } from '../middleware/errorHandler.middleware';
import { runInlineScan } from '../services/inlineScan.service';

export async function trigger(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const repoId = req.params.repoId as string;

    if (!Types.ObjectId.isValid(repoId)) {
      throw new AppError('Invalid repository ID', 400, 'INVALID_REPO_ID');
    }

    // Verify ownership
    const repo = await Repository.findOne({
      _id: new Types.ObjectId(repoId),
      userId: new Types.ObjectId(req.userId!),
      isActive: true,
    });

    if (!repo) {
      throw new AppError('Repository not found', 404, 'REPO_NOT_FOUND');
    }

    // Check for already-running scan — auto-fail scans stuck for more than 5 minutes
    const activeScan = await Scan.findOne({
      repositoryId: repo._id,
      status: { $in: ['pending', 'scanning', 'enriching', 'scoring'] },
    });

    if (activeScan) {
      const ageMs = Date.now() - new Date(activeScan.createdAt).getTime();
      if (ageMs > 5 * 60 * 1000) {
        activeScan.status = 'failed';
        activeScan.errorMessage = 'Scan timed out';
        activeScan.completedAt = new Date();
        await activeScan.save();
      } else {
        throw new AppError(
          'A scan is already in progress for this repository',
          409,
          'SCAN_ALREADY_RUNNING',
        );
      }
    }

    const triggeredBy = (req.body.triggeredBy as string) || 'manual';
    const validTriggers = ['manual', 'scheduled', 'webhook'];
    if (!validTriggers.includes(triggeredBy)) {
      throw new AppError('Invalid triggeredBy value', 400, 'INVALID_TRIGGER');
    }

    const scan = new Scan({
      repositoryId: repo._id,
      status: 'pending',
      triggeredBy,
    });

    await scan.save();

    // Run scan inline (no BullMQ/Redis needed in dev mode)
    // Fire and forget — the scan runs in the background
    runInlineScan(scan._id.toString()).catch(() => {});

    res.status(201).json({
      status: 'success',
      data: { scan },
    });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const repoId = req.params.repoId as string;

    if (!Types.ObjectId.isValid(repoId)) {
      throw new AppError('Invalid repository ID', 400, 'INVALID_REPO_ID');
    }

    // Verify ownership
    const repo = await Repository.findOne({
      _id: new Types.ObjectId(repoId),
      userId: new Types.ObjectId(req.userId!),
    });

    if (!repo) {
      throw new AppError('Repository not found', 404, 'REPO_NOT_FOUND');
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;

    const [scans, total] = await Promise.all([
      Scan.find({ repositoryId: repo._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Scan.countDocuments({ repositoryId: repo._id }),
    ]);

    res.json({
      status: 'success',
      data: {
        scans,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getLatest(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    const scan = await Scan.findOne({
      repositoryId: repo._id,
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!scan) {
      throw new AppError('No completed scans found', 404, 'NO_COMPLETED_SCANS');
    }

    res.json({
      status: 'success',
      data: { scan },
    });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const repoId = req.params.repoId as string;
    const scanId = req.params.scanId as string;

    if (!Types.ObjectId.isValid(repoId) || !Types.ObjectId.isValid(scanId)) {
      throw new AppError('Invalid ID parameter', 400, 'INVALID_ID');
    }

    const repo = await Repository.findOne({
      _id: new Types.ObjectId(repoId),
      userId: new Types.ObjectId(req.userId!),
    });

    if (!repo) {
      throw new AppError('Repository not found', 404, 'REPO_NOT_FOUND');
    }

    const scan = await Scan.findOne({
      _id: new Types.ObjectId(scanId),
      repositoryId: repo._id,
    }).lean();

    if (!scan) {
      throw new AppError('Scan not found', 404, 'SCAN_NOT_FOUND');
    }

    res.json({
      status: 'success',
      data: { scan },
    });
  } catch (err) {
    next(err);
  }
}
