import axios from 'axios';
import { logger } from '../../utils/logger';
import { Ecosystem } from '@stack-decay/shared';

export interface GitHubAdvisory {
  ghsaId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  publishedAt: string;
  withdrawnAt: string | null;
  vulnerableVersionRange: string;
  firstPatchedVersion: string | null;
}

/** Map our ecosystem to GitHub Advisory ecosystem names */
const GITHUB_ECOSYSTEM_MAP: Record<string, string> = {
  [Ecosystem.npm]: 'npm',
  [Ecosystem.pypi]: 'pip',
  [Ecosystem.rubygems]: 'rubygems',
  [Ecosystem.cargo]: 'rust',
  [Ecosystem.go]: 'go',
  [Ecosystem.maven]: 'maven',
  [Ecosystem.nuget]: 'nuget',
  [Ecosystem.composer]: 'composer',
};

/**
 * Fetch security advisories for a package from the GitHub Advisories REST API.
 * Requires a GitHub token.
 */
export async function getAdvisories(
  ecosystem: string,
  packageName: string,
  githubToken?: string,
): Promise<GitHubAdvisory[]> {
  if (!githubToken) {
    logger.debug({ ecosystem, packageName }, 'No GitHub token available for advisory lookup');
    return [];
  }

  const ghEcosystem = GITHUB_ECOSYSTEM_MAP[ecosystem] || ecosystem;

  try {
    const url = `https://api.github.com/advisories`;

    const response = await axios.get(url, {
      params: {
        ecosystem: ghEcosystem,
        package: packageName,
        per_page: 100,
      },
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      timeout: 15000,
    });

    const data = response.data;
    if (!Array.isArray(data)) return [];

    // The GitHub Advisories API uses `package` as a text search, not exact match.
    // Filter results to only include advisories that actually affect this specific package.
    return data
      .filter((advisory: Record<string, unknown>) => {
        if (!Array.isArray(advisory.vulnerabilities)) return false;
        return (advisory.vulnerabilities as Array<Record<string, unknown>>).some((vuln) => {
          const vulnPkg = vuln?.package as Record<string, unknown> | undefined;
          return vulnPkg?.name === packageName && vulnPkg?.ecosystem === ghEcosystem;
        });
      })
      .map((advisory: Record<string, unknown>) => parseAdvisory(advisory))
      .filter(Boolean) as GitHubAdvisory[];
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        logger.debug({ ecosystem, packageName }, 'GitHub token lacks advisory access');
      } else if (status === 422) {
        logger.debug({ ecosystem, packageName }, 'Invalid advisory query parameters');
      } else {
        logger.warn({ err, ecosystem, packageName }, 'Failed to fetch GitHub advisories');
      }
    } else {
      logger.warn({ err, ecosystem, packageName }, 'Failed to fetch GitHub advisories');
    }
    return [];
  }
}

function parseAdvisory(advisory: Record<string, unknown>): GitHubAdvisory | null {
  try {
    const ghsaId = typeof advisory.ghsa_id === 'string' ? advisory.ghsa_id : '';
    if (!ghsaId) return null;

    const severity = normalizeSeverity(advisory.severity);
    const summary = typeof advisory.summary === 'string' ? advisory.summary : '';
    const publishedAt = typeof advisory.published_at === 'string' ? advisory.published_at : '';
    const withdrawnAt = typeof advisory.withdrawn_at === 'string' ? advisory.withdrawn_at : null;

    // Extract vulnerable version range and patched version from vulnerabilities array
    let vulnerableVersionRange = '';
    let firstPatchedVersion: string | null = null;

    if (Array.isArray(advisory.vulnerabilities)) {
      for (const vuln of advisory.vulnerabilities as Array<Record<string, unknown>>) {
        if (vuln && typeof vuln === 'object') {
          if (typeof vuln.vulnerable_version_range === 'string') {
            vulnerableVersionRange = vuln.vulnerable_version_range;
          }
          const patched = vuln.first_patched_version;
          if (patched && typeof patched === 'object' && 'identifier' in patched) {
            firstPatchedVersion = (patched as { identifier: string }).identifier;
          }
        }
      }
    }

    return {
      ghsaId,
      severity,
      summary,
      publishedAt,
      withdrawnAt,
      vulnerableVersionRange,
      firstPatchedVersion,
    };
  } catch {
    return null;
  }
}

function normalizeSeverity(raw: unknown): 'critical' | 'high' | 'medium' | 'low' {
  if (typeof raw !== 'string') return 'medium';
  const lower = raw.toLowerCase();
  if (lower === 'critical') return 'critical';
  if (lower === 'high') return 'high';
  if (lower === 'medium' || lower === 'moderate') return 'medium';
  if (lower === 'low') return 'low';
  return 'medium';
}
