import { IHealthSnapshot } from '@stack-decay/shared';

const NEUTRAL_DEFAULT = 50;

/**
 * Score the community health of a package using log-scaled metrics.
 *
 * Sub-scores (0-100 each, log-scaled):
 * 1. Popularity (25%): based on stars count
 * 2. Growth (25%): based on stars growth in last 30 days
 * 3. Contributors (25%): based on contributor count
 * 4. Adoption (25%): based on dependent repos count
 */
export function scoreCommunity(health: IHealthSnapshot): number {
  const c = health.community;

  // 1. Popularity: log-scaled stars
  const stars = c?.starsCount;
  let popularity: number;
  if (stars == null) {
    popularity = NEUTRAL_DEFAULT;
  } else {
    popularity = Math.min(100, (Math.log10(stars + 1) / Math.log10(100000)) * 100);
  }

  // 2. Growth: stars growth relative to total
  const starsGrowth = c?.starsGrowth30d;
  const starsCount = c?.starsCount;
  let growth: number;
  if (starsGrowth == null || starsCount == null) {
    growth = NEUTRAL_DEFAULT;
  } else {
    const base = Math.max(starsCount, 1);
    growth = clamp(50 + (starsGrowth / base) * 1000, 0, 100);
  }

  // 3. Contributors: log-scaled
  const contributors = c?.contributorCount;
  let contributorScore: number;
  if (contributors == null) {
    contributorScore = NEUTRAL_DEFAULT;
  } else {
    contributorScore = Math.min(
      100,
      (Math.log10(contributors + 1) / Math.log10(500)) * 100,
    );
  }

  // 4. Adoption: log-scaled dependent repos
  const dependentRepos = c?.dependentReposCount;
  let adoption: number;
  if (dependentRepos == null) {
    adoption = NEUTRAL_DEFAULT;
  } else {
    adoption = Math.min(
      100,
      (Math.log10(dependentRepos + 1) / Math.log10(50000)) * 100,
    );
  }

  // Equal weights
  const score = popularity * 0.25 + growth * 0.25 + contributorScore * 0.25 + adoption * 0.25;

  return Math.round(Math.max(0, Math.min(100, score)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
