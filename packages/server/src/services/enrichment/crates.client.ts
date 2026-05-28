import axios from 'axios';
import { logger } from '../../utils/logger';

export interface CrateInfo {
  newestVersion: string;
  license: string | null;
  repository: string | null;
  downloads: number;
  description: string | null;
}

/**
 * Fetch crate metadata from the crates.io API.
 * Sets a User-Agent header as required by crates.io.
 */
export async function getCrateInfo(name: string): Promise<CrateInfo | null> {
  try {
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`;

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'stack-decay-score/1.0 (https://github.com/stack-decay)',
      },
    });

    const data = response.data;
    if (!data || !data.crate) return null;

    const crate = data.crate;

    return {
      newestVersion: crate.newest_version || crate.max_version || '',
      license: crate.license || null,
      repository: crate.repository || null,
      downloads: typeof crate.downloads === 'number' ? crate.downloads : 0,
      description: crate.description || null,
    };
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status === 404) {
      logger.debug({ name }, 'Crate not found');
    } else {
      logger.warn({ err, name }, 'Failed to fetch crate info');
    }
    return null;
  }
}
