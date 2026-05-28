export const SCORE_WEIGHTS = {
  vulnerability: 0.30,
  maintenance: 0.25,
  eol: 0.20,
  community: 0.15,
  license: 0.10,
} as const;

export const GRADE_THRESHOLDS = {
  A: 80,
  B: 65,
  C: 50,
  D: 35,
  F: 0,
} as const;

export function getGrade(score: number): string {
  if (score >= GRADE_THRESHOLDS.A) return 'A';
  if (score >= GRADE_THRESHOLDS.B) return 'B';
  if (score >= GRADE_THRESHOLDS.C) return 'C';
  if (score >= GRADE_THRESHOLDS.D) return 'D';
  return 'F';
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'green';
    case 'B': return 'blue';
    case 'C': return 'yellow';
    case 'D': return 'orange';
    case 'F': return 'red';
    default: return 'gray';
  }
}

export const DEP_WEIGHTS = {
  direct: 1.0,
  dev: 0.5,
  transitive: 0.3,
} as const;

export const LICENSE_TIERS: Record<string, 'low' | 'medium' | 'high' | 'unknown'> = {
  'MIT': 'low',
  'Apache-2.0': 'low',
  'BSD-2-Clause': 'low',
  'BSD-3-Clause': 'low',
  'ISC': 'low',
  'CC0-1.0': 'low',
  'Unlicense': 'low',
  'MPL-2.0': 'medium',
  'LGPL-2.1': 'medium',
  'LGPL-3.0': 'medium',
  'EPL-1.0': 'medium',
  'EPL-2.0': 'medium',
  'CDDL-1.0': 'medium',
  'GPL-2.0': 'high',
  'GPL-3.0': 'high',
  'AGPL-3.0': 'high',
  'SSPL-1.0': 'high',
  'BSL-1.1': 'high',
} as const;

export const CACHE_TTL = {
  /** TTL for package metadata in seconds */
  PACKAGE_METADATA: 86400,
  /** TTL for vulnerability data in seconds */
  VULNERABILITY_DATA: 3600,
  /** TTL for health snapshots in seconds */
  HEALTH_SNAPSHOT: 43200,
  /** TTL for repository score in seconds */
  REPO_SCORE: 1800,
  /** TTL for user session in seconds */
  USER_SESSION: 604800,
} as const;

export const SCAN_STATUSES = [
  'pending',
  'scanning',
  'enriching',
  'scoring',
  'completed',
  'failed',
] as const;

export const API_RATE_LIMITS = {
  /** Requests per minute for free tier */
  FREE_RPM: 30,
  /** Requests per minute for pro tier */
  PRO_RPM: 120,
  /** Requests per minute for team tier */
  TEAM_RPM: 300,
  /** Max concurrent scans for free tier */
  FREE_CONCURRENT_SCANS: 1,
  /** Max concurrent scans for pro tier */
  PRO_CONCURRENT_SCANS: 5,
  /** Max concurrent scans for team tier */
  TEAM_CONCURRENT_SCANS: 20,
} as const;
