import {
  IHealthSnapshot,
  IDependencyScore,
  IRepoScoreSnapshot,
} from '@stack-decay/shared';
import { scoreMaintenance } from './maintenance.scorer';
import { scoreCommunity } from './community.scorer';
import { scoreVulnerability } from './vulnerability.scorer';
import { scoreEol } from './eol.scorer';
import { scoreLicense } from './license.scorer';
import { SCORE_WEIGHTS, DEP_WEIGHTS, GRADE_THRESHOLDS } from './weights.config';
import { logger } from '../../utils/logger';

/**
 * Score a single dependency based on its health snapshot.
 * Runs all 5 dimension scorers, applies weights, and computes the composite score and grade.
 */
export function scoreDependency(
  healthSnapshot: IHealthSnapshot,
  scanId: string,
  packageId: string,
): IDependencyScore {
  const maintenanceScore = scoreMaintenance(healthSnapshot);
  const communityScore = scoreCommunity(healthSnapshot);
  const vulnerabilityScore = scoreVulnerability(healthSnapshot);
  const eolScore = scoreEol(healthSnapshot);
  const licenseScore = scoreLicense(healthSnapshot);

  const compositeScore = Math.round(
    vulnerabilityScore * SCORE_WEIGHTS.vulnerability +
    maintenanceScore * SCORE_WEIGHTS.maintenance +
    eolScore * SCORE_WEIGHTS.eol +
    communityScore * SCORE_WEIGHTS.community +
    licenseScore * SCORE_WEIGHTS.license,
  );

  const clampedScore = Math.max(0, Math.min(100, compositeScore));
  const grade = getGrade(clampedScore);

  return {
    id: '', // Will be assigned by MongoDB
    scanId,
    packageId,
    maintenanceScore,
    communityScore,
    vulnerabilityScore,
    eolScore,
    licenseScore,
    compositeScore: clampedScore,
    grade,
    scoringVersion: '1.0.0',
  };
}

/**
 * Compute the aggregate repository score from individual dependency scores.
 *
 * Applies type-based weighting:
 * - Direct dependencies: weight 1.0
 * - Dev dependencies: weight 0.5
 * - Transitive dependencies: weight 0.3
 *
 * Also applies concentration risk penalties:
 * - Any dependency with score < 20: -5 from aggregate
 * - More than 20% of dependencies with score < 40: -10 from aggregate
 */
export function scoreRepository(
  dependencyScores: IDependencyScore[],
  dependencyMeta: Array<{ isDev: boolean; isDirect: boolean }>,
): IRepoScoreSnapshot {
  if (dependencyScores.length === 0) {
    return createEmptyRepoSnapshot();
  }

  let totalWeight = 0;
  let weightedComposite = 0;
  let weightedMaintenance = 0;
  let weightedCommunity = 0;
  let weightedVulnerability = 0;
  let weightedEol = 0;
  let weightedLicense = 0;

  let vulnerableCount = 0;
  let deprecatedCount = 0;
  let outdatedCount = 0;
  let lowScoreCount = 0;
  let veryLowScoreCount = 0;

  for (let i = 0; i < dependencyScores.length; i++) {
    const score = dependencyScores[i];
    const meta = dependencyMeta[i] || { isDev: false, isDirect: true };

    // Determine weight based on dependency type
    let weight: number;
    if (meta.isDev) {
      weight = DEP_WEIGHTS.dev;
    } else if (meta.isDirect) {
      weight = DEP_WEIGHTS.direct;
    } else {
      weight = DEP_WEIGHTS.transitive;
    }

    totalWeight += weight;
    weightedComposite += score.compositeScore * weight;
    weightedMaintenance += score.maintenanceScore * weight;
    weightedCommunity += score.communityScore * weight;
    weightedVulnerability += score.vulnerabilityScore * weight;
    weightedEol += score.eolScore * weight;
    weightedLicense += score.licenseScore * weight;

    // Track risk metrics
    if (score.vulnerabilityScore < 80) vulnerableCount++;
    if (score.eolScore === 0) deprecatedCount++;
    if (score.maintenanceScore < 30) outdatedCount++;
    if (score.compositeScore < 40) lowScoreCount++;
    if (score.compositeScore < 20) veryLowScoreCount++;
  }

  // Compute weighted averages
  const divisor = totalWeight || 1;
  let compositeAvg = weightedComposite / divisor;
  const maintenanceAvg = Math.round(weightedMaintenance / divisor);
  const communityAvg = Math.round(weightedCommunity / divisor);
  const vulnerabilityAvg = Math.round(weightedVulnerability / divisor);
  const eolAvg = Math.round(weightedEol / divisor);
  const licenseAvg = Math.round(weightedLicense / divisor);

  // Apply concentration risk penalties
  if (veryLowScoreCount > 0) {
    compositeAvg -= 5;
  }
  const lowScorePercentage = lowScoreCount / dependencyScores.length;
  if (lowScorePercentage > 0.2) {
    compositeAvg -= 10;
  }

  compositeAvg = Math.round(Math.max(0, Math.min(100, compositeAvg)));
  const grade = getGrade(compositeAvg);

  return {
    id: '',
    repositoryId: '',
    scanId: '',
    snapshotDate: new Date(),
    compositeScore: compositeAvg,
    grade,
    maintenanceAvg,
    communityAvg,
    vulnerabilityAvg,
    eolAvg,
    licenseAvg,
    totalDependencies: dependencyScores.length,
    vulnerableCount,
    deprecatedCount,
    outdatedCount,
  };
}

/**
 * Map a numeric score to a letter grade.
 */
export function getGrade(score: number): string {
  if (score >= GRADE_THRESHOLDS.A) return 'A';
  if (score >= GRADE_THRESHOLDS.B) return 'B';
  if (score >= GRADE_THRESHOLDS.C) return 'C';
  if (score >= GRADE_THRESHOLDS.D) return 'D';
  return 'F';
}

function createEmptyRepoSnapshot(): IRepoScoreSnapshot {
  return {
    id: '',
    repositoryId: '',
    scanId: '',
    snapshotDate: new Date(),
    compositeScore: 100,
    grade: 'A',
    maintenanceAvg: 100,
    communityAvg: 100,
    vulnerabilityAvg: 100,
    eolAvg: 100,
    licenseAvg: 100,
    totalDependencies: 0,
    vulnerableCount: 0,
    deprecatedCount: 0,
    outdatedCount: 0,
  };
}
