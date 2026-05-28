import axios from 'axios';
import { logger } from '../../utils/logger';
import { config } from '../../config/index';
import { Ecosystem } from '@stack-decay/shared';

export interface LibrariesIoInfo {
  dependentReposCount: number;
  dependentsCount: number;
  rank: number;
  latestReleasePublishedAt: string | null;
}

/** Map our Ecosystem enum to Libraries.io platform names */
const PLATFORM_MAP: Record<string, string> = {
  [Ecosystem.npm]: 'npm',
  [Ecosystem.pypi]: 'pypi',
  [Ecosystem.rubygems]: 'rubygems',
  [Ecosystem.cargo]: 'cargo',
  [Ecosystem.go]: 'go',
  [Ecosystem.maven]: 'maven',
  [Ecosystem.nuget]: 'nuget',
  [Ecosystem.composer]: 'packagist',
};

/**
 * Fetch package analytics from the Libraries.io API.
 *
 * @param ecosystem - The ecosystem identifier
 * @param name - The package name
 */
export async function getPackageInfo(
  ecosystem: string,
  name: string,
): Promise<LibrariesIoInfo | null> {
  const apiKey = config.LIBRARIES_IO_API_KEY;
  if (!apiKey) {
    logger.debug('Libraries.io API key not configured, skipping');
    return null;
  }

  const platform = PLATFORM_MAP[ecosystem] || ecosystem;

  try {
    const url = `https://libraries.io/api/${encodeURIComponent(platform)}/${encodeURIComponent(name)}?api_key=${apiKey}`;

    const response = await axios.get(url, {
      timeout: 15000,
    });

    const data = response.data;
    if (!data || typeof data !== 'object') return null;

    return {
      dependentReposCount: typeof data.dependent_repos_count === 'number'
        ? data.dependent_repos_count
        : 0,
      dependentsCount: typeof data.dependents_count === 'number'
        ? data.dependents_count
        : 0,
      rank: typeof data.rank === 'number' ? data.rank : 0,
      latestReleasePublishedAt: typeof data.latest_release_published_at === 'string'
        ? data.latest_release_published_at
        : null,
    };
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status === 404) {
      logger.debug({ ecosystem, name }, 'Package not found on Libraries.io');
    } else if (status === 429) {
      logger.warn({ ecosystem, name }, 'Libraries.io rate limit exceeded');
    } else {
      logger.warn({ err, ecosystem, name }, 'Failed to fetch Libraries.io data');
    }
    return null;
  }
}

/**
 * Map an ecosystem to its Libraries.io platform name.
 */
export function getPlatformName(ecosystem: string): string {
  return PLATFORM_MAP[ecosystem] || ecosystem;
}
