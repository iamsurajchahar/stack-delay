import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { updateBudget, isPaused } from '../utils/rateLimitTracker';
import { AppError } from '../middleware/errorHandler.middleware';

const GITHUB_API_BASE = 'https://api.github.com';
const SERVICE_NAME = 'github';

export class GitHubService {
  private client: AxiosInstance;

  constructor(accessToken: string) {
    this.client = axios.create({
      baseURL: GITHUB_API_BASE,
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    // Response interceptor to track rate limits
    this.client.interceptors.response.use(
      (response) => {
        this.trackRateLimit(response);
        return response;
      },
      (error) => {
        if (error.response) {
          this.trackRateLimit(error.response);

          if (error.response.status === 403 && error.response.headers['x-ratelimit-remaining'] === '0') {
            const resetAt = parseInt(error.response.headers['x-ratelimit-reset'] || '0', 10) * 1000;
            throw new AppError(
              `GitHub API rate limit exceeded. Resets at ${new Date(resetAt).toISOString()}`,
              429,
              'GITHUB_RATE_LIMIT',
            );
          }

          if (error.response.status === 401) {
            throw new AppError('GitHub access token is invalid or revoked', 401, 'GITHUB_AUTH_INVALID');
          }

          if (error.response.status === 404) {
            throw new AppError('GitHub resource not found', 404, 'GITHUB_NOT_FOUND');
          }
        }

        throw error;
      },
    );
  }

  private trackRateLimit(response: AxiosResponse): void {
    const remaining = parseInt(response.headers['x-ratelimit-remaining'] || '', 10);
    const resetAt = parseInt(response.headers['x-ratelimit-reset'] || '', 10) * 1000;

    if (!isNaN(remaining) && !isNaN(resetAt)) {
      updateBudget(SERVICE_NAME, remaining, resetAt);
    }
  }

  private ensureNotPaused(): void {
    if (isPaused(SERVICE_NAME)) {
      throw new AppError(
        'GitHub API rate limit budget is critically low. Request deferred.',
        429,
        'GITHUB_BUDGET_PAUSED',
      );
    }
  }

  async getRepoDetails(owner: string, name: string): Promise<Record<string, unknown>> {
    this.ensureNotPaused();
    try {
      const response = await this.client.get(`/repos/${owner}/${name}`);
      return response.data;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error({ err, owner, name }, 'Failed to get repo details');
      throw new AppError('Failed to fetch repository details from GitHub', 502, 'GITHUB_API_ERROR');
    }
  }

  async listUserRepos(page = 1, perPage = 30): Promise<Array<Record<string, unknown>>> {
    this.ensureNotPaused();
    try {
      const response = await this.client.get('/user/repos', {
        params: {
          page,
          per_page: perPage,
          sort: 'updated',
          direction: 'desc',
          affiliation: 'owner,collaborator,organization_member',
        },
      });
      return response.data;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error({ err, page, perPage }, 'Failed to list user repos');
      throw new AppError('Failed to list repositories from GitHub', 502, 'GITHUB_API_ERROR');
    }
  }

  async getRepoTree(
    owner: string,
    name: string,
    branch: string,
  ): Promise<{ tree: Array<{ path: string; type: string; sha: string }> }> {
    this.ensureNotPaused();
    try {
      const response = await this.client.get(
        `/repos/${owner}/${name}/git/trees/${branch}`,
        { params: { recursive: '1' } },
      );
      return response.data;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error({ err, owner, name, branch }, 'Failed to get repo tree');
      throw new AppError('Failed to fetch repository tree from GitHub', 502, 'GITHUB_API_ERROR');
    }
  }

  async getFileContent(
    owner: string,
    name: string,
    path: string,
    ref?: string,
  ): Promise<{ content: string; encoding: string; sha: string }> {
    this.ensureNotPaused();
    try {
      const response = await this.client.get(
        `/repos/${owner}/${name}/contents/${path}`,
        { params: ref ? { ref } : undefined },
      );
      return response.data;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error({ err, owner, name, path, ref }, 'Failed to get file content');
      throw new AppError('Failed to fetch file content from GitHub', 502, 'GITHUB_API_ERROR');
    }
  }

  async getRepoStats(
    owner: string,
    name: string,
  ): Promise<{
    commitActivity: unknown;
    contributors: unknown;
  }> {
    this.ensureNotPaused();
    try {
      const [commitActivity, contributors] = await Promise.allSettled([
        this.client.get(`/repos/${owner}/${name}/stats/commit_activity`),
        this.client.get(`/repos/${owner}/${name}/stats/contributors`),
      ]);

      return {
        commitActivity:
          commitActivity.status === 'fulfilled' ? commitActivity.value.data : null,
        contributors:
          contributors.status === 'fulfilled' ? contributors.value.data : null,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error({ err, owner, name }, 'Failed to get repo stats');
      throw new AppError('Failed to fetch repository stats from GitHub', 502, 'GITHUB_API_ERROR');
    }
  }
}
