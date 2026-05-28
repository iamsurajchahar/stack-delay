import axios from 'axios';
import { logger } from '../../utils/logger';

export interface EolInfo {
  eolDate: string | null;
  latestVersion: string | null;
  supportEndDate: string | null;
  isEol: boolean;
}

/** Map common product names to endoflife.date product identifiers */
const PRODUCT_NAME_MAP: Record<string, string> = {
  node: 'nodejs',
  nodejs: 'nodejs',
  python: 'python',
  ruby: 'ruby',
  go: 'go',
  golang: 'go',
  java: 'java',
  dotnet: 'dotnet',
  '.net': 'dotnet',
  php: 'php',
  rust: 'rust',
  react: 'react',
  angular: 'angular',
  vue: 'vue',
  django: 'django',
  rails: 'rails',
  spring: 'spring-boot',
  laravel: 'laravel',
};

/**
 * Fetch end-of-life information for a product from endoflife.date.
 *
 * @param product - The product name (e.g., 'node', 'python')
 * @param version - Optional version string to find the matching cycle
 */
export async function getEolInfo(
  product: string,
  version?: string,
): Promise<EolInfo | null> {
  try {
    const normalizedProduct = PRODUCT_NAME_MAP[product.toLowerCase()] || product.toLowerCase();
    const url = `https://endoflife.date/api/${encodeURIComponent(normalizedProduct)}.json`;

    const response = await axios.get(url, {
      timeout: 10000,
    });

    const cycles = response.data;
    if (!Array.isArray(cycles) || cycles.length === 0) return null;

    // If a version is provided, try to find the matching cycle
    if (version) {
      const matchingCycle = findMatchingCycle(cycles, version);
      if (matchingCycle) {
        return parseCycle(matchingCycle);
      }
    }

    // Return the latest cycle if no version match
    return parseCycle(cycles[0]);
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status === 404) {
      logger.debug({ product }, 'Product not tracked by endoflife.date');
    } else {
      logger.warn({ err, product }, 'Failed to fetch EOL info');
    }
    return null;
  }
}

/**
 * Find the cycle that matches the given version string.
 * Tries to match the major.minor pattern against cycle identifiers.
 */
function findMatchingCycle(
  cycles: Array<Record<string, unknown>>,
  version: string,
): Record<string, unknown> | null {
  // Extract major and major.minor from the version
  const parts = version.replace(/^v/, '').split('.');
  const major = parts[0];
  const majorMinor = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : major;

  // Try exact match on cycle identifier
  for (const cycle of cycles) {
    const cycleId = String(cycle.cycle || '');
    if (cycleId === majorMinor || cycleId === major || cycleId === version) {
      return cycle;
    }
  }

  // Try prefix match (e.g., version "3.11.5" matches cycle "3.11")
  for (const cycle of cycles) {
    const cycleId = String(cycle.cycle || '');
    if (majorMinor.startsWith(cycleId) || version.startsWith(cycleId)) {
      return cycle;
    }
  }

  return null;
}

function parseCycle(cycle: Record<string, unknown>): EolInfo {
  const eolRaw = cycle.eol;
  let eolDate: string | null = null;
  let isEol = false;

  if (typeof eolRaw === 'string') {
    eolDate = eolRaw;
    isEol = new Date(eolRaw) < new Date();
  } else if (typeof eolRaw === 'boolean') {
    isEol = eolRaw;
    eolDate = null;
  }

  const supportRaw = cycle.support;
  let supportEndDate: string | null = null;
  if (typeof supportRaw === 'string') {
    supportEndDate = supportRaw;
  }

  const latestVersion = typeof cycle.latest === 'string' ? cycle.latest : null;

  return {
    eolDate,
    latestVersion,
    supportEndDate,
    isEol,
  };
}
