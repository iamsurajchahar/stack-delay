import axios from 'axios';
import { logger } from '../../utils/logger';

export interface NpmPackageInfo {
  latestVersion: string;
  license: string | null;
  homepage: string | null;
  repository: string | null;
  description: string | null;
}

export interface NpmDownloadCount {
  downloads: number;
  period: string;
}

/**
 * Fetch package metadata from the npm registry.
 * Handles scoped packages (@scope/name).
 */
export async function getPackageInfo(name: string): Promise<NpmPackageInfo | null> {
  try {
    // Scoped packages need URL encoding: @scope/name -> @scope%2fname
    const encodedName = name.startsWith('@') ? name.replace('/', '%2f') : name;
    const url = `https://registry.npmjs.org/${encodedName}`;

    const response = await axios.get(url, {
      timeout: 15000,
      headers: { Accept: 'application/json' },
      // Only fetch the abbreviated metadata to reduce payload size
      // Actually, we need full metadata for license/homepage. Use accept header.
    });

    const data = response.data;
    if (!data || typeof data !== 'object') return null;

    const distTags = data['dist-tags'];
    const latestVersion = distTags?.latest || '';

    // Get metadata from the latest version entry or top-level
    const latestMeta = data.versions?.[latestVersion] || {};
    const license = extractLicense(data.license || latestMeta.license);
    const homepage = data.homepage || latestMeta.homepage || null;
    const description = data.description || latestMeta.description || null;

    let repository: string | null = null;
    const repo = data.repository || latestMeta.repository;
    if (typeof repo === 'string') {
      repository = repo;
    } else if (repo && typeof repo === 'object' && repo.url) {
      repository = repo.url;
    }

    return {
      latestVersion,
      license,
      homepage,
      repository,
      description,
    };
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status === 404) {
      logger.debug({ name }, 'npm package not found');
    } else {
      logger.warn({ err, name }, 'Failed to fetch npm package info');
    }
    return null;
  }
}

/**
 * Fetch weekly download count for an npm package.
 */
export async function getDownloadCount(name: string): Promise<NpmDownloadCount | null> {
  try {
    // Scoped packages work with the downloads API using the regular name
    const url = `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`;

    const response = await axios.get(url, {
      timeout: 10000,
    });

    const data = response.data;
    if (!data || typeof data.downloads !== 'number') return null;

    return {
      downloads: data.downloads,
      period: data.start && data.end ? `${data.start}:${data.end}` : 'last-week',
    };
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status === 404) {
      logger.debug({ name }, 'npm download count not found');
    } else {
      logger.warn({ err, name }, 'Failed to fetch npm download count');
    }
    return null;
  }
}

function extractLicense(license: unknown): string | null {
  if (typeof license === 'string') return license;
  if (license && typeof license === 'object' && 'type' in license) {
    return (license as { type: string }).type;
  }
  return null;
}
