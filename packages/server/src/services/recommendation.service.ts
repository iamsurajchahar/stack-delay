import { IDependencyScore } from '@stack-decay/shared';
import { Recommendation } from '../models/Recommendation';
import { logger } from '../utils/logger';

/** Map of deprecated/problematic packages to recommended alternatives */
const KNOWN_ALTERNATIVES: Record<string, { alternatives: string[]; migrationUrl?: string }> = {
  'moment': {
    alternatives: ['date-fns', 'luxon', 'dayjs'],
    migrationUrl: 'https://momentjs.com/docs/#/-project-status/',
  },
  'request': {
    alternatives: ['axios', 'got', 'node-fetch', 'undici'],
    migrationUrl: 'https://github.com/request/request/issues/3142',
  },
  'underscore': {
    alternatives: ['lodash', 'ramda'],
  },
  'bower': {
    alternatives: ['npm', 'yarn', 'pnpm'],
  },
  'tslint': {
    alternatives: ['eslint', '@typescript-eslint/eslint-plugin'],
    migrationUrl: 'https://github.com/palantir/tslint/issues/4534',
  },
  'istanbul': {
    alternatives: ['nyc', 'c8'],
  },
  'node-uuid': {
    alternatives: ['uuid'],
  },
  'nomnom': {
    alternatives: ['commander', 'yargs', 'meow'],
  },
  'jade': {
    alternatives: ['pug'],
  },
  'coffee-script': {
    alternatives: ['typescript', 'babel'],
  },
  'left-pad': {
    alternatives: [],
    migrationUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart',
  },
  'colors': {
    alternatives: ['chalk', 'picocolors', 'kleur'],
  },
  'faker': {
    alternatives: ['@faker-js/faker'],
  },
};

interface DepScoreWithMeta {
  score: IDependencyScore;
  packageName: string;
  ecosystem: string;
  currentVersion?: string;
  latestVersion?: string;
  isDeprecated?: boolean;
  isArchived?: boolean;
}

/**
 * Analyze dependency scores and generate actionable recommendations.
 *
 * @param repoId - The repository ID
 * @param scanId - The current scan ID
 * @param deps - Array of dependency scores with metadata
 */
export async function generateRecommendations(
  repoId: string,
  scanId: string,
  deps: DepScoreWithMeta[],
): Promise<void> {
  const recommendations: Array<{
    repositoryId: string;
    scanId: string;
    packageId: string;
    type: 'upgrade' | 'replace' | 'remove';
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    currentVersion?: string;
    suggestedVersion?: string;
    alternativePackage?: string;
    scoreImpact: number;
    migrationUrl?: string;
  }> = [];

  for (const dep of deps) {
    const { score, packageName, ecosystem, currentVersion, latestVersion, isDeprecated, isArchived } = dep;

    // Check for deprecated/archived packages -> replace recommendation
    if (isDeprecated || isArchived) {
      const known = KNOWN_ALTERNATIVES[packageName];
      const alternative = known?.alternatives?.[0] || null;

      recommendations.push({
        repositoryId: repoId,
        scanId,
        packageId: score.packageId,
        type: 'replace',
        priority: 'critical',
        title: `Replace deprecated package: ${packageName}`,
        description: `${packageName} is ${isDeprecated ? 'deprecated' : 'archived'} and should be replaced.${alternative ? ` Consider using ${known!.alternatives.join(' or ')} instead.` : ''}`,
        currentVersion,
        alternativePackage: alternative || undefined,
        scoreImpact: estimateScoreImpact(score.compositeScore, 80),
        migrationUrl: known?.migrationUrl,
      });
      continue;
    }

    // Check for known problematic packages -> replace recommendation
    const knownAlt = KNOWN_ALTERNATIVES[packageName];
    if (knownAlt && knownAlt.alternatives.length > 0) {
      recommendations.push({
        repositoryId: repoId,
        scanId,
        packageId: score.packageId,
        type: 'replace',
        priority: getPriority(score.compositeScore),
        title: `Consider replacing ${packageName}`,
        description: `${packageName} has known alternatives with better maintenance. Consider using ${knownAlt.alternatives.join(' or ')}.`,
        currentVersion,
        alternativePackage: knownAlt.alternatives[0],
        scoreImpact: estimateScoreImpact(score.compositeScore, 70),
        migrationUrl: knownAlt.migrationUrl,
      });
    }

    // Extremely risky packages -> remove recommendation
    if (score.compositeScore < 10) {
      recommendations.push({
        repositoryId: repoId,
        scanId,
        packageId: score.packageId,
        type: 'remove',
        priority: 'critical',
        title: `Remove extremely risky package: ${packageName}`,
        description: `${packageName} has a critically low score of ${score.compositeScore}. It poses a significant risk to your project and should be removed or replaced immediately.`,
        currentVersion,
        scoreImpact: estimateScoreImpact(score.compositeScore, 100),
      });
      continue;
    }

    // Upgrade recommendations: if resolved version is behind latest
    if (currentVersion && latestVersion && currentVersion !== latestVersion) {
      const wouldImprove = score.maintenanceScore < 70 || score.vulnerabilityScore < 80;
      if (wouldImprove) {
        recommendations.push({
          repositoryId: repoId,
          scanId,
          packageId: score.packageId,
          type: 'upgrade',
          priority: getPriority(score.compositeScore),
          title: `Upgrade ${packageName} from ${currentVersion} to ${latestVersion}`,
          description: `Upgrading ${packageName} to the latest version may improve your maintenance and vulnerability scores.`,
          currentVersion,
          suggestedVersion: latestVersion,
          scoreImpact: estimateScoreImpact(score.compositeScore, Math.min(score.compositeScore + 15, 100)),
        });
      }
    }
  }

  // Persist all recommendations
  if (recommendations.length > 0) {
    try {
      await Recommendation.insertMany(recommendations);
      logger.info(
        { repoId, scanId, count: recommendations.length },
        'Stored recommendations',
      );
    } catch (err) {
      logger.error({ err, repoId, scanId }, 'Failed to store recommendations');
    }
  } else {
    logger.debug({ repoId, scanId }, 'No recommendations generated');
  }
}

/**
 * Map a composite score to a recommendation priority level.
 */
function getPriority(compositeScore: number): 'critical' | 'high' | 'medium' | 'low' {
  if (compositeScore < 20) return 'critical';
  if (compositeScore < 35) return 'high';
  if (compositeScore < 50) return 'medium';
  return 'low';
}

/**
 * Estimate the score impact of applying a recommendation.
 * Represents the potential score improvement.
 */
function estimateScoreImpact(currentScore: number, estimatedNewScore: number): number {
  return Math.max(0, Math.round(estimatedNewScore - currentScore));
}
