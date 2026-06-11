import { Request, Response, NextFunction } from 'express';
import * as repoService from '../services/repo.service';
import { decrypt } from '../utils/encryption';
import { AppError } from '../middleware/errorHandler.middleware';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const repos = await repoService.listUserRepos(req.userId!);
    res.json({
      status: 'success',
      data: { repos },
    });
  } catch (err) {
    next(err);
  }
}

export async function listAvailable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401, 'AUTH_REQUIRED');
    }

    let accessToken: string;
    try {
      accessToken = decrypt(req.user.accessToken);
    } catch {
      throw new AppError(
        'Unable to decrypt access token. Please re-authenticate with GitHub.',
        401,
        'TOKEN_DECRYPT_FAILED',
      );
    }

    const repos = await repoService.listAvailableRepos(req.userId!, accessToken);

    res.json({
      status: 'success',
      data: { repos },
    });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { githubRepoId, owner, name } = req.body;

    if (!githubRepoId || !owner || !name) {
      throw new AppError('githubRepoId, owner, and name are required', 400, 'MISSING_FIELDS');
    }

    const repo = await repoService.connectRepo(req.userId!, {
      githubRepoId: Number(githubRepoId),
      owner: String(owner),
      name: String(name),
    });

    res.status(201).json({
      status: 'success',
      data: { repo },
    });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const repo = await repoService.getRepo(req.params.repoId as string, req.userId!);
    res.json({
      status: 'success',
      data: { repo },
    });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const allowedFields: Record<string, boolean> = {
      scanFrequency: true,
      isActive: true,
    };

    const updates: Record<string, unknown> = {};
    for (const key of Object.keys(req.body)) {
      if (allowedFields[key]) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('No valid fields to update', 400, 'NO_VALID_UPDATES');
    }

    const repo = await repoService.updateRepo(
      req.params.repoId as string,
      req.userId!,
      updates as { scanFrequency?: 'manual' | 'daily' | 'weekly' | 'monthly'; isActive?: boolean },
    );

    res.json({
      status: 'success',
      data: { repo },
    });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await repoService.disconnectRepo(req.params.repoId as string, req.userId!);
    res.json({
      status: 'success',
      message: 'Repository disconnected successfully',
    });
  } catch (err) {
    next(err);
  }
}
