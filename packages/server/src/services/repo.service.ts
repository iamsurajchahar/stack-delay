import { Types } from 'mongoose';
import { Repository, IRepositoryDocument } from '../models/Repository';
import { Scan } from '../models/Scan';
import { DependencyScore } from '../models/DependencyScore';
import { RepoScoreSnapshot } from '../models/RepoScoreSnapshot';
import { AlertRule } from '../models/AlertRule';
import { Notification } from '../models/Notification';
import { GitHubService } from './github.service';
import { decrypt } from '../utils/encryption';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler.middleware';
import { logger } from '../utils/logger';

export async function listUserRepos(userId: string): Promise<IRepositoryDocument[]> {
  const repos = await Repository.find({ userId: new Types.ObjectId(userId), isActive: true })
    .sort({ updatedAt: -1 })
    .exec();
  return repos;
}

export async function connectRepo(
  userId: string,
  data: { githubRepoId: number; owner: string; name: string },
): Promise<IRepositoryDocument> {
  // Check for existing connection
  const existing = await Repository.findOne({
    userId: new Types.ObjectId(userId),
    githubRepoId: data.githubRepoId,
  });

  if (existing) {
    if (existing.isActive) {
      throw new AppError('Repository is already connected', 409, 'REPO_ALREADY_CONNECTED');
    }
    // Reactivate previously disconnected repo
    existing.isActive = true;
    existing.owner = data.owner;
    existing.name = data.name;
    existing.fullName = `${data.owner}/${data.name}`;
    await existing.save();
    return existing;
  }

  // Fetch additional details from GitHub
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  let repoDetails: Record<string, unknown>;
  try {
    const accessToken = decrypt(user.accessToken);
    const github = new GitHubService(accessToken);
    repoDetails = await github.getRepoDetails(data.owner, data.name);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.warn({ err, owner: data.owner, name: data.name }, 'Could not fetch repo details, using defaults');
    repoDetails = {};
  }

  const repo = new Repository({
    userId: new Types.ObjectId(userId),
    githubRepoId: data.githubRepoId,
    owner: data.owner,
    name: data.name,
    fullName: `${data.owner}/${data.name}`,
    defaultBranch: (repoDetails.default_branch as string) || 'main',
    isPrivate: (repoDetails.private as boolean) || false,
    language: (repoDetails.language as string) || '',
    isActive: true,
  });

  try {
    await repo.save();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new AppError('Repository is already connected', 409, 'REPO_ALREADY_CONNECTED');
    }
    throw err;
  }

  return repo;
}

export async function getRepo(
  repoId: string,
  userId: string,
): Promise<IRepositoryDocument> {
  if (!Types.ObjectId.isValid(repoId)) {
    throw new AppError('Invalid repository ID', 400, 'INVALID_REPO_ID');
  }

  const repo = await Repository.findOne({
    _id: new Types.ObjectId(repoId),
    userId: new Types.ObjectId(userId),
  });

  if (!repo) {
    throw new AppError('Repository not found', 404, 'REPO_NOT_FOUND');
  }

  return repo;
}

export async function updateRepo(
  repoId: string,
  userId: string,
  updates: Partial<Pick<IRepositoryDocument, 'scanFrequency' | 'isActive'>>,
): Promise<IRepositoryDocument> {
  const repo = await getRepo(repoId, userId);

  if (updates.scanFrequency !== undefined) {
    repo.scanFrequency = updates.scanFrequency;
  }
  if (updates.isActive !== undefined) {
    repo.isActive = updates.isActive;
  }

  await repo.save();
  return repo;
}

export async function disconnectRepo(repoId: string, userId: string): Promise<void> {
  const repo = await getRepo(repoId, userId);
  const repoObjectId = repo._id as Types.ObjectId;

  // Delete all associated data in parallel
  const scanIds = await Scan.find({ repositoryId: repoObjectId }).distinct('_id');

  await Promise.all([
    Scan.deleteMany({ repositoryId: repoObjectId }),
    DependencyScore.deleteMany({ scanId: { $in: scanIds } }),
    RepoScoreSnapshot.deleteMany({ repositoryId: repoObjectId }),
    AlertRule.deleteMany({ repositoryId: repoObjectId }),
    Repository.deleteOne({ _id: repoObjectId }),
  ]);

  logger.info({ repoId, userId }, 'Repository disconnected and associated data deleted');
}

export async function listAvailableRepos(
  userId: string,
  accessToken: string,
): Promise<Array<Record<string, unknown>>> {
  const github = new GitHubService(accessToken);

  // Fetch all repos from GitHub (paginate up to a reasonable limit)
  const allGitHubRepos: Array<Record<string, unknown>> = [];
  let page = 1;
  const maxPages = 10;

  while (page <= maxPages) {
    const repos = await github.listUserRepos(page, 100);
    if (repos.length === 0) break;
    allGitHubRepos.push(...repos);
    if (repos.length < 100) break;
    page++;
  }

  // Get already-connected repo IDs
  const connectedRepos = await Repository.find({
    userId: new Types.ObjectId(userId),
    isActive: true,
  })
    .select('githubRepoId')
    .lean();

  const connectedIds = new Set(connectedRepos.map((r) => r.githubRepoId));

  // Filter out already connected repos
  return allGitHubRepos.filter((repo) => !connectedIds.has(repo.id as number));
}
