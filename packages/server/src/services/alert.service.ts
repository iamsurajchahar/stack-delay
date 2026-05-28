import {
  IAlertRule,
  IRepoScoreSnapshot,
  IDependencyScore,
  IHealthSnapshot,
} from '@stack-decay/shared';
import { logger } from '../utils/logger';

export interface TriggeredAlert {
  ruleId: string;
  ruleType: IAlertRule['ruleType'];
  channels: string[];
  subject: string;
  body: string;
  context: Record<string, unknown>;
}

export interface SnapshotPair {
  previous: IRepoScoreSnapshot | null;
  current: IRepoScoreSnapshot;
}

export interface DependencyContext {
  scores: IDependencyScore[];
  previousScores?: IDependencyScore[];
  healthSnapshots: Map<string, IHealthSnapshot>;
  packageNames: Map<string, string>;
}

/**
 * Evaluate all alert rules for a repository by comparing the previous and current scan snapshots.
 * Returns an array of triggered alerts that should be dispatched as notifications.
 */
export function evaluateAlerts(
  repoId: string,
  rules: IAlertRule[],
  snapshots: SnapshotPair,
  depContext: DependencyContext,
): TriggeredAlert[] {
  const triggered: TriggeredAlert[] = [];

  const enabledRules = rules.filter((r) => r.isEnabled);

  for (const rule of enabledRules) {
    // Only evaluate rules that apply to this repo or are global (no repositoryId)
    if (rule.repositoryId && rule.repositoryId !== repoId) continue;

    try {
      const result = evaluateRule(rule, snapshots, depContext);
      if (result) {
        triggered.push(result);
      }
    } catch (err) {
      logger.error({ err, ruleId: rule.id, ruleType: rule.ruleType }, 'Error evaluating alert rule');
    }
  }

  return triggered;
}

function evaluateRule(
  rule: IAlertRule,
  snapshots: SnapshotPair,
  depContext: DependencyContext,
): TriggeredAlert | null {
  switch (rule.ruleType) {
    case 'score_drop':
      return evaluateScoreDrop(rule, snapshots);
    case 'eol_approaching':
      return evaluateEolApproaching(rule, depContext);
    case 'new_cve':
      return evaluateNewCve(rule, depContext);
    case 'grade_change':
      return evaluateGradeChange(rule, snapshots);
    case 'deprecated_dep':
      return evaluateDeprecatedDep(rule, depContext);
    default:
      logger.warn({ ruleType: rule.ruleType }, 'Unknown alert rule type');
      return null;
  }
}

/**
 * score_drop: compositeScore dropped below a threshold value.
 */
function evaluateScoreDrop(
  rule: IAlertRule,
  snapshots: SnapshotPair,
): TriggeredAlert | null {
  const threshold = rule.thresholdValue ?? 50;
  const current = snapshots.current.compositeScore;
  const previous = snapshots.previous?.compositeScore ?? 100;

  // Only trigger if score dropped AND is now below threshold
  if (current < threshold && current < previous) {
    const drop = previous - current;
    return {
      ruleId: rule.id,
      ruleType: rule.ruleType,
      channels: rule.channels,
      subject: `Score dropped to ${current} (was ${previous})`,
      body: `Your repository's Stack Decay Score dropped by ${drop} points to ${current}, which is below your alert threshold of ${threshold}.`,
      context: {
        currentScore: current,
        previousScore: previous,
        threshold,
        drop,
      },
    };
  }

  return null;
}

/**
 * eol_approaching: any dependency's EOL date is within thresholdDays.
 */
function evaluateEolApproaching(
  rule: IAlertRule,
  depContext: DependencyContext,
): TriggeredAlert | null {
  const thresholdDays = rule.thresholdDays ?? 90;
  const now = new Date();
  const approachingEol: Array<{ name: string; eolDate: string; daysRemaining: number }> = [];

  for (const [packageId, health] of depContext.healthSnapshots) {
    const eolDates = [health.eol?.runtimeEolDate, health.eol?.frameworkEolDate].filter(Boolean);

    for (const eolDate of eolDates) {
      if (!eolDate) continue;
      const eol = new Date(eolDate);
      const daysRemaining = Math.floor((eol.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysRemaining > 0 && daysRemaining <= thresholdDays) {
        const name = depContext.packageNames.get(packageId) || packageId;
        approachingEol.push({
          name,
          eolDate: eol.toISOString().split('T')[0],
          daysRemaining,
        });
      }
    }
  }

  if (approachingEol.length > 0) {
    const names = approachingEol.map((e) => `${e.name} (${e.daysRemaining}d)`).join(', ');
    return {
      ruleId: rule.id,
      ruleType: rule.ruleType,
      channels: rule.channels,
      subject: `${approachingEol.length} dependencies approaching end-of-life`,
      body: `The following dependencies have EOL dates within ${thresholdDays} days: ${names}.`,
      context: { approachingEol, thresholdDays },
    };
  }

  return null;
}

/**
 * new_cve: new vulnerabilities found since last scan.
 */
function evaluateNewCve(
  rule: IAlertRule,
  depContext: DependencyContext,
): TriggeredAlert | null {
  if (!depContext.previousScores || depContext.previousScores.length === 0) {
    // First scan - check if there are any CVEs at all
    const newVulnPackages: string[] = [];
    for (const [packageId, health] of depContext.healthSnapshots) {
      if (health.vulnerability && health.vulnerability.openCveCount > 0) {
        const name = depContext.packageNames.get(packageId) || packageId;
        newVulnPackages.push(`${name} (${health.vulnerability.openCveCount} CVEs)`);
      }
    }

    if (newVulnPackages.length > 0) {
      return {
        ruleId: rule.id,
        ruleType: rule.ruleType,
        channels: rule.channels,
        subject: `${newVulnPackages.length} packages have known vulnerabilities`,
        body: `Vulnerabilities found in: ${newVulnPackages.join(', ')}.`,
        context: { newVulnPackages },
      };
    }
    return null;
  }

  // Compare current vs previous vulnerability scores to detect new CVEs
  const previousScoreMap = new Map(
    depContext.previousScores.map((s) => [s.packageId, s]),
  );

  const worsenedPackages: string[] = [];

  for (const score of depContext.scores) {
    const prevScore = previousScoreMap.get(score.packageId);
    if (!prevScore) {
      // New dependency - check if it has vulnerabilities
      const health = depContext.healthSnapshots.get(score.packageId);
      if (health?.vulnerability?.openCveCount && health.vulnerability.openCveCount > 0) {
        const name = depContext.packageNames.get(score.packageId) || score.packageId;
        worsenedPackages.push(name);
      }
    } else if (score.vulnerabilityScore < prevScore.vulnerabilityScore) {
      // Existing dependency with worse vulnerability score
      const name = depContext.packageNames.get(score.packageId) || score.packageId;
      worsenedPackages.push(name);
    }
  }

  if (worsenedPackages.length > 0) {
    return {
      ruleId: rule.id,
      ruleType: rule.ruleType,
      channels: rule.channels,
      subject: `New vulnerabilities detected in ${worsenedPackages.length} packages`,
      body: `New or worsened vulnerabilities found in: ${worsenedPackages.join(', ')}.`,
      context: { affectedPackages: worsenedPackages },
    };
  }

  return null;
}

/**
 * grade_change: the repository grade worsened (e.g., A -> B).
 */
function evaluateGradeChange(
  rule: IAlertRule,
  snapshots: SnapshotPair,
): TriggeredAlert | null {
  if (!snapshots.previous) return null;

  const gradeOrder = ['A', 'B', 'C', 'D', 'F'];
  const prevIdx = gradeOrder.indexOf(snapshots.previous.grade);
  const currIdx = gradeOrder.indexOf(snapshots.current.grade);

  // Grade worsened if current index is higher (F is worse than A)
  if (currIdx > prevIdx && prevIdx >= 0 && currIdx >= 0) {
    return {
      ruleId: rule.id,
      ruleType: rule.ruleType,
      channels: rule.channels,
      subject: `Grade dropped from ${snapshots.previous.grade} to ${snapshots.current.grade}`,
      body: `Your repository's grade has worsened from ${snapshots.previous.grade} to ${snapshots.current.grade}. Review your dependencies to identify areas for improvement.`,
      context: {
        previousGrade: snapshots.previous.grade,
        currentGrade: snapshots.current.grade,
        previousScore: snapshots.previous.compositeScore,
        currentScore: snapshots.current.compositeScore,
      },
    };
  }

  return null;
}

/**
 * deprecated_dep: a newly deprecated dependency was detected.
 */
function evaluateDeprecatedDep(
  rule: IAlertRule,
  depContext: DependencyContext,
): TriggeredAlert | null {
  const deprecatedPackages: string[] = [];

  for (const [packageId, health] of depContext.healthSnapshots) {
    if (health.eol?.isDeprecated || health.eol?.isArchived) {
      const name = depContext.packageNames.get(packageId) || packageId;
      deprecatedPackages.push(name);
    }
  }

  if (deprecatedPackages.length > 0) {
    return {
      ruleId: rule.id,
      ruleType: rule.ruleType,
      channels: rule.channels,
      subject: `${deprecatedPackages.length} deprecated dependencies detected`,
      body: `The following dependencies are deprecated or archived: ${deprecatedPackages.join(', ')}. Consider replacing them with maintained alternatives.`,
      context: { deprecatedPackages },
    };
  }

  return null;
}
