import { IHealthSnapshot } from '@stack-decay/shared';

/** License tier scores */
const LICENSE_SCORES: Record<string, number> = {
  'mit': 100,
  'apache-2.0': 100,
  'bsd-2-clause': 100,
  'bsd-3-clause': 100,
  'isc': 100,
  'unlicense': 100,
  '0bsd': 100,
  'cc0-1.0': 100,

  'lgpl-2.1': 70,
  'lgpl-3.0': 70,
  'lgpl-2.1-only': 70,
  'lgpl-2.1-or-later': 70,
  'lgpl-3.0-only': 70,
  'lgpl-3.0-or-later': 70,
  'mpl-2.0': 70,
  'epl-2.0': 70,
  'epl-1.0': 70,

  'gpl-2.0': 40,
  'gpl-3.0': 40,
  'gpl-2.0-only': 40,
  'gpl-2.0-or-later': 40,
  'gpl-3.0-only': 40,
  'gpl-3.0-or-later': 40,
  'agpl-3.0': 40,
  'agpl-3.0-only': 40,
  'agpl-3.0-or-later': 40,
};

const UNKNOWN_SCORE = 30;
const NO_LICENSE_SCORE = 5;

/**
 * Score the license risk of a package.
 *
 * Tier mapping:
 * - Permissive (MIT, Apache, BSD, ISC, etc.) => 100
 * - Weak copyleft (LGPL, MPL, EPL) => 70
 * - Strong copyleft (GPL, AGPL) => 40
 * - Unknown or custom => 30
 * - No license detected => 5
 *
 * Handles SPDX expressions like "MIT OR Apache-2.0" by taking the best (highest) score.
 */
export function scoreLicense(health: IHealthSnapshot): number {
  const spdx = health.license?.spdx;

  if (!spdx || spdx.trim() === '') {
    return NO_LICENSE_SCORE;
  }

  // Handle SPDX expressions with OR/AND operators
  // For OR: take the best (most permissive) license
  // For AND: take the worst (most restrictive) license
  const score = evaluateSpdxExpression(spdx);

  return Math.max(0, Math.min(100, score));
}

/**
 * Evaluate an SPDX license expression, handling OR and AND operators.
 * OR takes the maximum (user can choose), AND takes the minimum (must comply with all).
 */
function evaluateSpdxExpression(expression: string): number {
  // Split on OR first (higher precedence in terms of user benefit)
  const orParts = expression.split(/\s+OR\s+/i);

  if (orParts.length > 1) {
    // For OR expressions, the user can choose the best one
    let bestScore = 0;
    for (const part of orParts) {
      const partScore = evaluateSpdxExpression(part.trim());
      bestScore = Math.max(bestScore, partScore);
    }
    return bestScore;
  }

  // Split on AND
  const andParts = expression.split(/\s+AND\s+/i);

  if (andParts.length > 1) {
    // For AND expressions, must comply with the most restrictive
    let worstScore = 100;
    for (const part of andParts) {
      const partScore = evaluateSpdxExpression(part.trim());
      worstScore = Math.min(worstScore, partScore);
    }
    return worstScore;
  }

  // Single license identifier - strip any parentheses and WITH exceptions
  let license = expression.trim().replace(/^\(+|\)+$/g, '');
  // Handle WITH exceptions like "Apache-2.0 WITH LLVM-exception"
  const withIdx = license.search(/\s+WITH\s+/i);
  if (withIdx >= 0) {
    license = license.substring(0, withIdx).trim();
  }

  return lookupLicenseScore(license);
}

/**
 * Look up the score for a single license identifier.
 * Case-insensitive matching.
 */
function lookupLicenseScore(license: string): number {
  const lower = license.toLowerCase().trim();

  const score = LICENSE_SCORES[lower];
  if (score !== undefined) return score;

  // Try without trailing "-only" or "-or-later" suffixes
  const withoutSuffix = lower.replace(/-(only|or-later)$/, '');
  const suffixScore = LICENSE_SCORES[withoutSuffix];
  if (suffixScore !== undefined) return suffixScore;

  return UNKNOWN_SCORE;
}
