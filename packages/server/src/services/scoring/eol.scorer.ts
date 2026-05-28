import { IHealthSnapshot } from '@stack-decay/shared';

/**
 * Score the end-of-life / deprecation risk of a package.
 *
 * - If deprecated or archived => 0
 * - Based on runtimeEolDate or frameworkEolDate proximity
 * - "Effectively abandoned" penalty: no release in 2+ years AND low commits => score * 0.3
 */
export function scoreEol(health: IHealthSnapshot): number {
  const eol = health.eol;
  const maintenance = health.maintenance;

  // Deprecated or archived => 0
  if (eol?.isDeprecated || eol?.isArchived) {
    return 0;
  }

  // Calculate base score from EOL dates
  let baseScore = 100;

  const runtimeEol = eol?.runtimeEolDate ? new Date(eol.runtimeEolDate) : null;
  const frameworkEol = eol?.frameworkEolDate ? new Date(eol.frameworkEolDate) : null;

  // Take the nearest EOL date
  const eolDate = getClosestEolDate(runtimeEol, frameworkEol);

  if (eolDate) {
    const now = new Date();
    const daysUntilEol = Math.floor(
      (eolDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilEol < 0) {
      // Past EOL
      baseScore = 0;
    } else if (daysUntilEol <= 30) {
      baseScore = 10;
    } else if (daysUntilEol <= 90) {
      baseScore = 30;
    } else if (daysUntilEol <= 180) {
      baseScore = 50;
    } else if (daysUntilEol <= 365) {
      baseScore = 70;
    } else {
      baseScore = 90;
    }
  }
  // If no EOL date info at all, assume fine (100)

  // Apply "effectively abandoned" penalty
  // No release in 2+ years AND low commit activity AND not archived
  const daysSinceRelease = maintenance?.daysSinceLastRelease;
  const commitsLast90d = maintenance?.commitsLast90d;

  if (daysSinceRelease != null && daysSinceRelease > 730) {
    // 2+ years without a release
    const lowCommits = commitsLast90d == null || commitsLast90d < 5;
    if (lowCommits) {
      baseScore = Math.round(baseScore * 0.3);
    }
  }

  return Math.max(0, Math.min(100, baseScore));
}

/**
 * Get the closest (earliest) EOL date from runtime and framework dates.
 */
function getClosestEolDate(runtimeEol: Date | null, frameworkEol: Date | null): Date | null {
  if (runtimeEol && frameworkEol) {
    return runtimeEol < frameworkEol ? runtimeEol : frameworkEol;
  }
  return runtimeEol || frameworkEol;
}
