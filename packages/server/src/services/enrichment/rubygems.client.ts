import axios from 'axios';
import { logger } from '../../utils/logger';

export interface RubyGemInfo {
  version: string;
  licenses: string[];
  homepageUri: string | null;
  downloads: number;
  sourceCodeUri: string | null;
}

/**
 * Fetch gem metadata from the RubyGems API.
 */
export async function getGemInfo(name: string): Promise<RubyGemInfo | null> {
  try {
    const url = `https://rubygems.org/api/v1/gems/${encodeURIComponent(name)}.json`;

    const response = await axios.get(url, {
      timeout: 15000,
    });

    const data = response.data;
    if (!data || typeof data !== 'object') return null;

    return {
      version: data.version || '',
      licenses: Array.isArray(data.licenses) ? data.licenses : [],
      homepageUri: data.homepage_uri || null,
      downloads: typeof data.downloads === 'number' ? data.downloads : 0,
      sourceCodeUri: data.source_code_uri || null,
    };
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status === 404) {
      logger.debug({ name }, 'RubyGem not found');
    } else {
      logger.warn({ err, name }, 'Failed to fetch RubyGem info');
    }
    return null;
  }
}
