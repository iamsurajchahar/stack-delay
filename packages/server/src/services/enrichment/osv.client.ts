import axios from 'axios';
import { logger } from '../../utils/logger';
import { Ecosystem } from '@stack-decay/shared';

export interface OsvVulnerability {
  id: string;
  summary: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedRanges: string;
  fixedVersions: string[];
}

/** Map our Ecosystem enum to OSV ecosystem names */
const OSV_ECOSYSTEM_MAP: Record<string, string> = {
  [Ecosystem.npm]: 'npm',
  [Ecosystem.pypi]: 'PyPI',
  [Ecosystem.cargo]: 'crates.io',
  [Ecosystem.go]: 'Go',
  [Ecosystem.maven]: 'Maven',
  [Ecosystem.rubygems]: 'RubyGems',
  [Ecosystem.nuget]: 'NuGet',
  [Ecosystem.composer]: 'Packagist',
};

/**
 * Query the OSV.dev API for known vulnerabilities affecting a package.
 */
export async function queryVulnerabilities(
  ecosystem: string,
  packageName: string,
  version?: string,
): Promise<OsvVulnerability[]> {
  try {
    const osvEcosystem = OSV_ECOSYSTEM_MAP[ecosystem] || ecosystem;

    const body: Record<string, unknown> = {
      package: {
        name: packageName,
        ecosystem: osvEcosystem,
      },
    };

    if (version) {
      body.version = version;
    }

    const response = await axios.post('https://api.osv.dev/v1/query', body, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    const data = response.data;
    if (!data || !Array.isArray(data.vulns)) {
      return [];
    }

    return data.vulns.map((vuln: Record<string, unknown>) => parseOsvVuln(vuln)).filter(Boolean) as OsvVulnerability[];
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.code === 'ECONNABORTED') {
      logger.warn({ ecosystem, packageName }, 'OSV query timed out');
    } else {
      logger.warn({ err, ecosystem, packageName }, 'Failed to query OSV vulnerabilities');
    }
    return [];
  }
}

function parseOsvVuln(vuln: Record<string, unknown>): OsvVulnerability | null {
  try {
    const id = typeof vuln.id === 'string' ? vuln.id : '';
    if (!id) return null;

    const summary = typeof vuln.summary === 'string' ? vuln.summary : '';

    // Determine severity from database_specific or severity array
    const severity = extractSeverity(vuln);

    // Extract affected ranges
    const affected = Array.isArray(vuln.affected) ? vuln.affected : [];
    const ranges: string[] = [];
    const fixedVersions: string[] = [];

    for (const aff of affected) {
      if (aff && typeof aff === 'object') {
        const affRanges = Array.isArray((aff as Record<string, unknown>).ranges)
          ? (aff as Record<string, unknown>).ranges as Array<Record<string, unknown>>
          : [];
        for (const range of affRanges) {
          if (range && typeof range === 'object') {
            const events = Array.isArray(range.events) ? range.events as Array<Record<string, string>> : [];
            for (const event of events) {
              if (event.introduced) ranges.push(`>=${event.introduced}`);
              if (event.fixed) {
                ranges.push(`<${event.fixed}`);
                fixedVersions.push(event.fixed);
              }
            }
          }
        }
      }
    }

    return {
      id,
      summary,
      severity,
      affectedRanges: ranges.join(', ') || 'unknown',
      fixedVersions,
    };
  } catch {
    return null;
  }
}

function extractSeverity(vuln: Record<string, unknown>): 'critical' | 'high' | 'medium' | 'low' {
  // Try severity array first
  if (Array.isArray(vuln.severity)) {
    for (const sev of vuln.severity) {
      if (sev && typeof sev === 'object') {
        const s = sev as Record<string, unknown>;
        if (typeof s.score === 'string') {
          const cvss = parseFloat(s.score);
          if (!isNaN(cvss)) return cvssToSeverity(cvss);
        }
        if (typeof s.type === 'string' && typeof s.score === 'string') {
          // CVSS vector string - try to parse the numeric score
          const numMatch = s.score.match(/(\d+\.?\d*)/);
          if (numMatch) {
            const cvss = parseFloat(numMatch[1]);
            if (!isNaN(cvss)) return cvssToSeverity(cvss);
          }
        }
      }
    }
  }

  // Try database_specific.severity
  const dbSpecific = vuln.database_specific;
  if (dbSpecific && typeof dbSpecific === 'object') {
    const severity = (dbSpecific as Record<string, unknown>).severity;
    if (typeof severity === 'string') {
      const lower = severity.toLowerCase();
      if (lower === 'critical') return 'critical';
      if (lower === 'high') return 'high';
      if (lower === 'moderate' || lower === 'medium') return 'medium';
      if (lower === 'low') return 'low';
    }
  }

  return 'medium'; // default if we can't determine
}

function cvssToSeverity(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  return 'low';
}
