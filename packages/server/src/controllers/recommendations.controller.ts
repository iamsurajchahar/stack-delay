import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Repository } from '../models/Repository';
import { Scan } from '../models/Scan';
import { DependencyScore } from '../models/DependencyScore';
import { AppError } from '../middleware/errorHandler.middleware';

/** Well-known alternatives for deprecated/problematic packages */
const KNOWN_ALTERNATIVES: Record<string, { alternatives: string[]; migrationUrl?: string; reason?: string }> = {
  moment: {
    alternatives: ['date-fns', 'dayjs', 'luxon'],
    migrationUrl: 'https://momentjs.com/docs/#/-project-status/',
    reason: 'moment is in maintenance mode and is a heavy bundle (~300kB). Modern alternatives are tree-shakeable and much smaller.',
  },
  request: {
    alternatives: ['axios', 'got', 'node-fetch', 'undici'],
    migrationUrl: 'https://github.com/request/request/issues/3142',
    reason: 'request has been officially deprecated since Feb 2020 and no longer receives security patches.',
  },
  underscore: {
    alternatives: ['lodash', 'ramda', 'es-toolkit'],
    reason: 'underscore has slower release cadence. lodash provides a superset API with better tree-shaking.',
  },
  bower: {
    alternatives: ['npm', 'yarn', 'pnpm'],
    reason: 'bower is deprecated. All modern package management should use npm/yarn/pnpm.',
  },
  tslint: {
    alternatives: ['eslint', '@typescript-eslint/eslint-plugin'],
    migrationUrl: 'https://github.com/palantir/tslint/issues/4534',
    reason: 'TSLint has been officially deprecated in favor of ESLint with typescript-eslint.',
  },
  istanbul: {
    alternatives: ['nyc', 'c8'],
    reason: 'istanbul CLI is deprecated. nyc is its successor; c8 uses native V8 coverage.',
  },
  'node-uuid': {
    alternatives: ['uuid', 'crypto.randomUUID()'],
    reason: 'node-uuid was renamed to uuid. Use the uuid package or built-in crypto.randomUUID().',
  },
  nomnom: {
    alternatives: ['commander', 'yargs', 'meow'],
    reason: 'nomnom is deprecated and unmaintained.',
  },
  jade: {
    alternatives: ['pug'],
    migrationUrl: 'https://pugjs.org/api/migration-v2.html',
    reason: 'jade was renamed to pug. jade no longer receives updates.',
  },
  'coffee-script': {
    alternatives: ['typescript', 'babel'],
    reason: 'CoffeeScript has very low adoption and limited tooling support.',
  },
  'left-pad': {
    alternatives: [],
    migrationUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart',
    reason: 'left-pad is unnecessary — use built-in String.prototype.padStart().',
  },
  colors: {
    alternatives: ['chalk', 'picocolors', 'kleur'],
    reason: 'colors had a supply-chain incident. picocolors is the fastest and smallest alternative.',
  },
  faker: {
    alternatives: ['@faker-js/faker'],
    reason: 'faker was corrupted by its maintainer. @faker-js/faker is the community-maintained fork.',
  },
};

/**
 * Build actionable fix steps depending on the recommendation type, ecosystem, and context.
 */
function buildFixSteps(opts: {
  type: 'upgrade' | 'replace' | 'remove';
  packageName: string;
  ecosystem: string;
  currentVersion?: string;
  latestVersion?: string;
  vulns: unknown[];
  alternativePackage?: string;
  knownInfo?: typeof KNOWN_ALTERNATIVES[string];
}): string[] {
  const { type, packageName, ecosystem, currentVersion, latestVersion, vulns, alternativePackage, knownInfo } = opts;

  // Detect the package manager install command
  const installCmd = ecosystem === 'pip' ? 'pip install' : ecosystem === 'gem' ? 'gem install' : 'npm install';
  const uninstallCmd = ecosystem === 'pip' ? 'pip uninstall' : ecosystem === 'gem' ? 'gem uninstall' : 'npm uninstall';
  const auditCmd = ecosystem === 'npm' ? 'npm audit fix' : ecosystem === 'pip' ? 'pip-audit --fix' : null;

  const steps: string[] = [];

  if (type === 'upgrade') {
    if (latestVersion) {
      steps.push(`Run: ${installCmd} ${packageName}@${latestVersion}`);
    } else {
      steps.push(`Run: ${installCmd} ${packageName}@latest`);
    }
    steps.push(`Check CHANGELOG for breaking changes between ${currentVersion || 'current'} and ${latestVersion || 'latest'}`);
    if (vulns.length > 0 && auditCmd) {
      steps.push(`Run: ${auditCmd} — to auto-patch known vulnerabilities`);
    }
    steps.push(`Run your test suite to verify nothing broke: npm test`);
    if (vulns.length > 0) {
      steps.push(`After upgrading, re-scan to confirm vulnerabilities are resolved`);
    }
  } else if (type === 'replace') {
    const alt = alternativePackage || knownInfo?.alternatives?.[0];
    if (alt) {
      steps.push(`Install the replacement: ${installCmd} ${alt}`);
      steps.push(`Update all import/require statements: replace '${packageName}' → '${alt}'`);
      if (knownInfo?.alternatives && knownInfo.alternatives.length > 1) {
        steps.push(`Other alternatives to evaluate: ${knownInfo.alternatives.join(', ')}`);
      }
    }
    steps.push(`Remove the old package: ${uninstallCmd} ${packageName}`);
    if (knownInfo?.migrationUrl) {
      steps.push(`Follow the official migration guide: ${knownInfo.migrationUrl}`);
    }
    if (knownInfo?.reason) {
      steps.push(`Why: ${knownInfo.reason}`);
    }
    steps.push(`Run your test suite to verify the replacement works: npm test`);
    steps.push(`Search your codebase for any remaining references: grep -r "${packageName}" src/`);
  } else if (type === 'remove') {
    steps.push(`Check if ${packageName} is actually used: grep -r "require('${packageName}')" src/ or grep -r "from '${packageName}'" src/`);
    steps.push(`If unused, remove it: ${uninstallCmd} ${packageName}`);
    steps.push(`If used, find a maintained alternative or inline the functionality`);
    if (vulns.length > 0) {
      steps.push(`WARNING: This package has ${vulns.length} known vulnerabilities — removal is strongly recommended`);
    }
    steps.push(`Run your test suite after removal: npm test`);
    steps.push(`Remove any configuration files specific to this package`);
  }

  return steps;
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { repoId } = req.params;

    if (!Types.ObjectId.isValid(repoId)) {
      throw new AppError('Invalid repository ID', 400, 'INVALID_REPO_ID');
    }

    const repo = await Repository.findOne({
      _id: new Types.ObjectId(repoId),
      userId: new Types.ObjectId(req.userId!),
    });

    if (!repo) {
      throw new AppError('Repository not found', 404, 'REPO_NOT_FOUND');
    }

    // Get the latest completed scan
    const latestScan = await Scan.findOne({
      repositoryId: repo._id,
      status: 'completed',
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!latestScan) {
      res.json({
        status: 'success',
        data: {
          recommendations: [],
          message: 'No completed scans found. Trigger a scan first.',
        },
      });
      return;
    }

    // Find dependencies that need attention:
    // - Score below 70 (below-average health)
    // - Or un-enriched packages that defaulted to exactly 65
    const lowScores = await DependencyScore.find({
      scanId: latestScan._id,
      compositeScore: { $lte: 70 },
    })
      .populate('packageId')
      .sort({ compositeScore: 1 })
      .lean();

    const recommendations = [];

    for (const score of lowScores) {
      const pkg = score.packageId as unknown as Record<string, unknown>;
      if (!pkg) continue;

      const pkgName = pkg.name as string;
      const ecosystem = (pkg.ecosystem as string) || 'npm';
      const latestHealth = pkg.latestHealth as Record<string, unknown> | null;
      const vulns = (pkg.vulnerabilities as unknown[]) || [];
      const latestVersion = pkg.latestVersion as string | undefined;
      const currentVersion = pkg.resolvedVersion as string | undefined;
      const knownAlt = KNOWN_ALTERNATIVES[pkgName];

      let type: 'upgrade' | 'replace' | 'remove' = 'upgrade';
      let priority: 'critical' | 'high' | 'medium' | 'low' = 'medium';
      let title = '';
      let description = '';
      let alternativePackage: string | undefined;
      let migrationUrl: string | undefined;
      let suggestedVersion: string | undefined;

      // --- Deprecated / Archived → replace ---
      if (latestHealth) {
        const eol = latestHealth.eol as Record<string, unknown> | undefined;
        if (eol?.isDeprecated || eol?.isArchived) {
          type = 'replace';
          priority = 'high';
          title = `Replace deprecated package: ${pkgName}`;
          const status = eol.isArchived ? 'archived' : 'deprecated';
          description = `${pkgName} is ${status} and will not receive updates or security patches.`;
          if (knownAlt) {
            alternativePackage = knownAlt.alternatives[0];
            migrationUrl = knownAlt.migrationUrl;
            description += ` Consider migrating to ${knownAlt.alternatives.join(' or ')}.`;
            if (knownAlt.reason) {
              description += ` ${knownAlt.reason}`;
            }
          } else {
            description += ` Search npmjs.com for actively maintained alternatives.`;
          }
        }
      }

      // --- Known problematic package → replace ---
      if (type !== 'replace' && knownAlt && knownAlt.alternatives.length > 0) {
        type = 'replace';
        priority = score.compositeScore < 35 ? 'high' : 'medium';
        alternativePackage = knownAlt.alternatives[0];
        migrationUrl = knownAlt.migrationUrl;
        title = `Consider replacing ${pkgName}`;
        description = knownAlt.reason || `${pkgName} has known alternatives with better maintenance.`;
        description += ` Recommended replacement: ${knownAlt.alternatives.join(' or ')}.`;
      }

      // --- Critical vulnerabilities ---
      if (vulns.length > 0 && type !== 'replace') {
        const hasCritical = vulns.some((v) => (v as Record<string, unknown>).severity === 'critical');
        const hasHigh = vulns.some((v) => (v as Record<string, unknown>).severity === 'high');
        const critCount = vulns.filter((v) => (v as Record<string, unknown>).severity === 'critical').length;
        const highCount = vulns.filter((v) => (v as Record<string, unknown>).severity === 'high').length;

        if (hasCritical) {
          priority = 'critical';
          title = `Critical vulnerability in ${pkgName}`;
          description = `${pkgName} has ${vulns.length} known vulnerabilities (${critCount} critical). Upgrade immediately to patch security holes.`;
        } else if (hasHigh) {
          priority = 'high';
          title = `High-severity vulnerability in ${pkgName}`;
          description = `${pkgName} has ${vulns.length} known vulnerabilities (${highCount} high). Upgrade as soon as possible.`;
        } else {
          title = `Vulnerabilities found in ${pkgName}`;
          description = `${pkgName} has ${vulns.length} known vulnerabilities. Consider upgrading to a patched version.`;
        }

        // Check if a fixed version exists from vuln data
        const fixedVersions = vulns
          .map((v) => (v as Record<string, unknown>).fixedVersion as string | null)
          .filter(Boolean);
        if (fixedVersions.length > 0) {
          suggestedVersion = fixedVersions[fixedVersions.length - 1]!;
          description += ` A fix is available in version ${suggestedVersion}.`;
        } else if (latestVersion && latestVersion !== currentVersion) {
          suggestedVersion = latestVersion;
        }
      }

      // --- Un-enriched package (no health data available) ---
      if (!title && !latestHealth) {
        priority = 'low';
        title = `Unable to assess health of ${pkgName}`;
        description = `${pkgName} could not be enriched with health data from package registries. This may indicate an unlisted, private, or very new package. Consider verifying it is actively maintained.`;
        if (latestVersion && latestVersion !== currentVersion) {
          suggestedVersion = latestVersion;
        }
      }

      // --- Low health score (fallback) ---
      if (!title) {
        if (score.compositeScore < 20) {
          type = 'remove';
          priority = 'critical';
          title = `Critically low health score for ${pkgName}`;
          description = `${pkgName} has a health score of ${score.compositeScore}/100. This package poses significant risk — it may be unmaintained, have no community, or lack security practices.`;
        } else if (score.compositeScore < 35) {
          priority = 'high';
          title = `Low health score for ${pkgName}`;
          description = `${pkgName} has a health score of ${score.compositeScore}/100. The package shows signs of poor maintenance or limited community support.`;
          if (latestVersion && latestVersion !== currentVersion) {
            suggestedVersion = latestVersion;
          }
        } else {
          priority = 'medium';
          title = `Below-average health for ${pkgName}`;
          description = `${pkgName} has a health score of ${score.compositeScore}/100. Monitor for improvements or consider alternatives if the score continues declining.`;
          if (latestVersion && latestVersion !== currentVersion) {
            suggestedVersion = latestVersion;
          }
        }
      }

      // Build actionable fix steps
      const fixSteps = buildFixSteps({
        type,
        packageName: pkgName,
        ecosystem,
        currentVersion,
        latestVersion: suggestedVersion || latestVersion,
        vulns,
        alternativePackage,
        knownInfo: knownAlt,
      });

      recommendations.push({
        id: (score._id as Types.ObjectId).toHexString(),
        packageId: pkg._id,
        packageName: pkgName,
        ecosystem,
        type,
        priority,
        title,
        description,
        currentVersion,
        suggestedVersion,
        alternativePackage,
        migrationUrl,
        currentScore: score.compositeScore,
        grade: score.grade,
        scoreImpact: Math.max(0, 70 - score.compositeScore),
        fixSteps,
      });
    }

    // Sort by priority weight
    const priorityWeight: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]);

    res.json({
      status: 'success',
      data: { recommendations },
    });
  } catch (err) {
    next(err);
  }
}
