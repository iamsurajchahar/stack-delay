import axios from 'axios';
import { logger } from '../../utils/logger';

export interface PypiPackageInfo {
  latestVersion: string;
  license: string | null;
  homePage: string | null;
  summary: string | null;
  projectUrl: string | null;
}

/**
 * Fetch package metadata from the PyPI JSON API.
 */
export async function getPackageInfo(name: string): Promise<PypiPackageInfo | null> {
  try {
    const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;

    const response = await axios.get(url, {
      timeout: 15000,
    });

    const data = response.data;
    if (!data || !data.info) return null;

    const info = data.info;

    return {
      latestVersion: info.version || '',
      license: info.license || null,
      homePage: info.home_page || info.project_url || null,
      summary: info.summary || null,
      projectUrl: info.project_url || null,
    };
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status === 404) {
      logger.debug({ name }, 'PyPI package not found');
    } else {
      logger.warn({ err, name }, 'Failed to fetch PyPI package info');
    }
    return null;
  }
}
