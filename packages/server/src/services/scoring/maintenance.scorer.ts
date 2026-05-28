import { IHealthSnapshot } from '@stack-decay/shared';

const NEUTRAL_DEFAULT = 50;

/**
 * Score the maintenance health of a package based on its health snapshot.
 *
 * Sub-scores (0-100 each):
 * 1. Commit Freshness (30%): based on daysSinceLastRelease
 * 2. Release Cadence (30%): based on releasesLastYear
 * 3. Issue Health (20%): ratio of closedIssuesLast90d to openIssuesCount
 * 4. Responsiveness (20%): based on avgIssueCloseDays
 */
export function scoreMaintenance(health: IHealthSnapshot): number {
  const m = health.maintenance;

  // 1. Commit Freshness based on days since last release
  const daysSinceLastRelease = m?.daysSinceLastRelease;
  let commitFreshness: number;
  if (daysSinceLastRelease == null) {
    commitFreshness = NEUTRAL_DEFAULT;
  } else if (daysSinceLastRelease <= 7) {
    commitFreshness = 100;
  } else if (daysSinceLastRelease <= 30) {
    commitFreshness = 80;
  } else if (daysSinceLastRelease <= 90) {
    commitFreshness = 60;
  } else if (daysSinceLastRelease <= 180) {
    commitFreshness = 30;
  } else if (daysSinceLastRelease <= 365) {
    commitFreshness = 10;
  } else {
    commitFreshness = 0;
  }

  // 2. Release Cadence based on releases in the last year
  const releasesLastYear = m?.releasesLastYear;
  let releaseCadence: number;
  if (releasesLastYear == null) {
    releaseCadence = NEUTRAL_DEFAULT;
  } else if (releasesLastYear >= 6) {
    releaseCadence = 100;
  } else if (releasesLastYear >= 3) {
    releaseCadence = 75;
  } else if (releasesLastYear >= 1) {
    releaseCadence = 50;
  } else {
    releaseCadence = 10;
  }

  // 3. Issue Health: ratio of closed issues to open issues
  const openIssues = m?.openIssuesCount;
  const closedIssues = m?.closedIssuesLast90d;
  let issueHealth: number;
  if (openIssues == null && closedIssues == null) {
    issueHealth = NEUTRAL_DEFAULT;
  } else {
    const open = openIssues ?? 0;
    const closed = closedIssues ?? 0;
    const ratio = closed / (open + 1); // +1 to avoid division by zero
    if (ratio > 0.5) {
      issueHealth = 100;
    } else if (ratio >= 0.2) {
      issueHealth = 70;
    } else if (ratio >= 0.05) {
      issueHealth = 40;
    } else {
      issueHealth = 10;
    }
  }

  // 4. Responsiveness: average days to close issues
  const avgCloseDays = m?.avgIssueCloseDays;
  let responsiveness: number;
  if (avgCloseDays == null) {
    responsiveness = NEUTRAL_DEFAULT;
  } else if (avgCloseDays < 7) {
    responsiveness = 100;
  } else if (avgCloseDays <= 30) {
    responsiveness = 70;
  } else if (avgCloseDays <= 90) {
    responsiveness = 40;
  } else {
    responsiveness = 10;
  }

  // Weighted average
  const score =
    commitFreshness * 0.3 +
    releaseCadence * 0.3 +
    issueHealth * 0.2 +
    responsiveness * 0.2;

  return Math.round(Math.max(0, Math.min(100, score)));
}
