import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AlertRule } from '../models/AlertRule';
import { Notification } from '../models/Notification';
import { Repository } from '../models/Repository';
import { AppError } from '../middleware/errorHandler.middleware';

const VALID_RULE_TYPES = ['score_drop', 'eol_approaching', 'new_cve', 'grade_change', 'deprecated_dep'];
const VALID_CHANNELS = ['email', 'webhook', 'slack'];

export async function listRules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rules = await AlertRule.find({ userId: new Types.ObjectId(req.userId!) })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      status: 'success',
      data: { rules },
    });
  } catch (err) {
    next(err);
  }
}

export async function createRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ruleType, repositoryId, thresholdValue, thresholdDays, channels, isEnabled } = req.body;

    if (!ruleType || !VALID_RULE_TYPES.includes(ruleType)) {
      throw new AppError(
        `Invalid rule type. Must be one of: ${VALID_RULE_TYPES.join(', ')}`,
        400,
        'INVALID_RULE_TYPE',
      );
    }

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      throw new AppError('At least one channel is required', 400, 'MISSING_CHANNELS');
    }

    for (const ch of channels) {
      if (!VALID_CHANNELS.includes(ch)) {
        throw new AppError(
          `Invalid channel "${ch}". Must be one of: ${VALID_CHANNELS.join(', ')}`,
          400,
          'INVALID_CHANNEL',
        );
      }
    }

    // Verify repository ownership if repositoryId is provided
    if (repositoryId) {
      if (!Types.ObjectId.isValid(repositoryId)) {
        throw new AppError('Invalid repository ID', 400, 'INVALID_REPO_ID');
      }

      const repo = await Repository.findOne({
        _id: new Types.ObjectId(repositoryId),
        userId: new Types.ObjectId(req.userId!),
      });

      if (!repo) {
        throw new AppError('Repository not found', 404, 'REPO_NOT_FOUND');
      }
    }

    const rule = new AlertRule({
      userId: new Types.ObjectId(req.userId!),
      ruleType,
      repositoryId: repositoryId ? new Types.ObjectId(repositoryId) : undefined,
      thresholdValue: thresholdValue !== undefined ? Number(thresholdValue) : undefined,
      thresholdDays: thresholdDays !== undefined ? Number(thresholdDays) : undefined,
      channels,
      isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
    });

    await rule.save();

    res.status(201).json({
      status: 'success',
      data: { rule },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ruleId } = req.params;

    if (!Types.ObjectId.isValid(ruleId)) {
      throw new AppError('Invalid rule ID', 400, 'INVALID_RULE_ID');
    }

    const rule = await AlertRule.findOne({
      _id: new Types.ObjectId(ruleId),
      userId: new Types.ObjectId(req.userId!),
    });

    if (!rule) {
      throw new AppError('Alert rule not found', 404, 'RULE_NOT_FOUND');
    }

    const { ruleType, thresholdValue, thresholdDays, channels, isEnabled } = req.body;

    if (ruleType !== undefined) {
      if (!VALID_RULE_TYPES.includes(ruleType)) {
        throw new AppError('Invalid rule type', 400, 'INVALID_RULE_TYPE');
      }
      rule.ruleType = ruleType;
    }

    if (channels !== undefined) {
      if (!Array.isArray(channels) || channels.length === 0) {
        throw new AppError('At least one channel is required', 400, 'MISSING_CHANNELS');
      }
      for (const ch of channels) {
        if (!VALID_CHANNELS.includes(ch)) {
          throw new AppError(`Invalid channel "${ch}"`, 400, 'INVALID_CHANNEL');
        }
      }
      rule.channels = channels;
    }

    if (thresholdValue !== undefined) rule.thresholdValue = Number(thresholdValue);
    if (thresholdDays !== undefined) rule.thresholdDays = Number(thresholdDays);
    if (isEnabled !== undefined) rule.isEnabled = Boolean(isEnabled);

    await rule.save();

    res.json({
      status: 'success',
      data: { rule },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ruleId } = req.params;

    if (!Types.ObjectId.isValid(ruleId)) {
      throw new AppError('Invalid rule ID', 400, 'INVALID_RULE_ID');
    }

    const result = await AlertRule.deleteOne({
      _id: new Types.ObjectId(ruleId),
      userId: new Types.ObjectId(req.userId!),
    });

    if (result.deletedCount === 0) {
      throw new AppError('Alert rule not found', 404, 'RULE_NOT_FOUND');
    }

    res.json({
      status: 'success',
      message: 'Alert rule deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find({ userId: new Types.ObjectId(req.userId!) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId: new Types.ObjectId(req.userId!) }),
    ]);

    res.json({
      status: 'success',
      data: {
        notifications,
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
