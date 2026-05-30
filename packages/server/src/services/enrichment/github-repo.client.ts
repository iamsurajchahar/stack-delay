import axios from 'axios';
import { logger } from '../../utils/logger';

export interface GitHubRepoStats {
  starsCount: number;
  starsGrowth30d: number;
  forksCount: number;
  contributorCount: number;
  commitsLast90d: number;
  openIssuesCount: number;
  closedIssuesLast90d: number;
  openPrCount: number;
  avgIssueCloseDays: number;
  isArchived: boolean;
}

/**
 * Extract owner/repo from a GitHub repository URL.
 * Handles formats like:
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo.git
 *   - git+https://github.com/owner/repo.git
 *   - git://github.com/owner/repo.git
 *   - github:owner/repo
 */
export function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } | null {
  if (!repoUrl) return null;

  // Handle github:owner/repo shorthand
  const shortMatch = repoUrl.match(/^github:([^/]+)\/([^/]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2].replace(/\.git$/, '') };
  }

  // Handle full URLs
  const urlMatch = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  return null;
}

/**
 * Fetch repository statistics from the GitHub API.
 * Populates stars, forks, issues, contributors, and commit activity.
 */
export async function getRepoStats(
  repoUrl: string,
  githubToken?: string,
): Promise<GitHubRepoStats | null> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    logger.debug({ repoUrl }, 'Could not parse GitHub URL');
    return null;
  }

  const { owner, repo } = parsed;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  try {
    // Fetch repo info + recent issues + commit activity in parallel
    const [repoInfo, closedIssues, openPrs, commitActivity, contributors] = await Promise.all([
      fetchRepoInfo(owner, repo, headers),
      fetchClosedIssuesLast90d(owner, repo, headers),
      fetchOpenPrCount(owner, repo, headers),
      fetchCommitActivityLast90d(owner, repo, headers),
      fetchContributorCount(owner, repo, headers),
    ]);

    if (!repoInfo) return null;

    return {
      starsCount: typeof repoInfo.stargazers_count === 'number' ? repoInfo.stargazers_count : 0,
      starsGrowth30d: 0, // GitHub API doesn't provide this directly
      forksCount: typeof repoInfo.forks_count === 'number' ? repoInfo.forks_count : 0,
      contributorCount: contributors,
      commitsLast90d: commitActivity,
      openIssuesCount: typeof repoInfo.open_issues_count === 'number' ? repoInfo.open_issues_count : 0,
      closedIssuesLast90d: closedIssues.count,
      openPrCount: openPrs,
      avgIssueCloseDays: closedIssues.avgCloseDays,
      isArchived: repoInfo.archived === true,
    };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 404) {
        logger.debug({ owner, repo }, 'GitHub repo not found');
      } else if (status === 403 || status === 429) {
        logger.warn({ owner, repo }, 'GitHub API rate limit hit');
      } else {
        logger.warn({ err, owner, repo }, 'Failed to fetch GitHub repo stats');
      }
    } else {
      logger.warn({ err, owner, repo }, 'Failed to fetch GitHub repo stats');
    }
    return null;
  }
}

async function fetchRepoInfo(
  owner: string,
  repo: string,
  headers: Record<string, string>,
): Promise<Record<string, unknown> | null> {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers, timeout: 10000 },
    );
    return response.data;
  } catch {
    return null;
  }
}

async function fetchClosedIssuesLast90d(
  owner: string,
  repo: string,
  headers: Record<string, string>,
): Promise<{ count: number; avgCloseDays: number }> {
  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        headers,
        timeout: 10000,
        params: {
          state: 'closed',
          since,
          per_page: 100,
          sort: 'updated',
          direction: 'desc',
        },
      },
    );

    const issues = Array.isArray(response.data) ? response.data : [];
    // Filter out pull requests (GitHub includes them in issues endpoint)
    const realIssues = issues.filter((i: Record<string, unknown>) => !i.pull_request);

    if (realIssues.length === 0) return { count: 0, avgCloseDays: 0 };

    let totalCloseDays = 0;
    for (const issue of realIssues) {
      const created = new Date(issue.created_at as string).getTime();
      const closed = new Date(issue.closed_at as string).getTime();
      totalCloseDays += (closed - created) / (1000 * 60 * 60 * 24);
    }

    return {
      count: realIssues.length,
      avgCloseDays: Math.round(totalCloseDays / realIssues.length),
    };
  } catch {
    return { count: 0, avgCloseDays: 0 };
  }
}

async function fetchOpenPrCount(
  owner: string,
  repo: string,
  headers: Record<string, string>,
): Promise<number> {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        headers,
        timeout: 10000,
        params: { state: 'open', per_page: 1 },
      },
    );
    // Use the Link header to get total count, or just count the results
    const linkHeader = response.headers.link as string | undefined;
    if (linkHeader) {
      const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
      if (lastMatch) return parseInt(lastMatch[1], 10);
    }
    return Array.isArray(response.data) ? response.data.length : 0;
  } catch {
    return 0;
  }
}

async function fetchCommitActivityLast90d(
  owner: string,
  repo: string,
  headers: Record<string, string>,
): Promise<number> {
  try {
    // Use the stats/participation endpoint which gives weekly commit counts for the last year
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/stats/participation`,
      { headers, timeout: 15000 },
    );

    const data = response.data;
    if (!data || !Array.isArray(data.all)) return 0;

    // data.all is an array of 52 weeks, most recent last
    // Last ~13 weeks ≈ 90 days
    const allWeeks: number[] = data.all;
    const last13 = allWeeks.slice(-13);
    return last13.reduce((sum, count) => sum + count, 0);
  } catch {
    return 0;
  }
}

async function fetchContributorCount(
  owner: string,
  repo: string,
  headers: Record<string, string>,
): Promise<number> {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contributors`,
      {
        headers,
        timeout: 10000,
        params: { per_page: 1, anon: 'false' },
      },
    );
    // Use the Link header to get total count
    const linkHeader = response.headers.link as string | undefined;
    if (linkHeader) {
      const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
      if (lastMatch) return parseInt(lastMatch[1], 10);
    }
    return Array.isArray(response.data) ? response.data.length : 0;
  } catch {
    return 0;
  }
}
