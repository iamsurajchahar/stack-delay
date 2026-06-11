import mongoose from 'mongoose';
import { IRepoScoreSnapshot, IHealthSnapshot } from '@stack-decay/shared';
import { logger } from '../utils/logger';

// We reference models by name since they may be registered by other agents.
// Use mongoose.model() for dynamic access.

/**
 * Capture and persist a repository score snapshot after scoring is complete.
 */
export async function captureRepoSnapshot(
  repoId: string,
  scanId: string,
  scores: IRepoScoreSnapshot,
): Promise<string | null> {
  try {
    // Use the RepoScoreSnapshot model if registered, otherwise create inline
    let RepoScoreSnapshotModel: mongoose.Model<any>;
    try {
      RepoScoreSnapshotModel = mongoose.model('RepoScoreSnapshot');
    } catch {
      // Model not registered yet - define a minimal schema
      const schema = new mongoose.Schema(
        {
          repositoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository', required: true },
          scanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scan', required: true },
          snapshotDate: { type: Date, default: Date.now },
          compositeScore: { type: Number, required: true },
          grade: { type: String, required: true },
          maintenanceAvg: { type: Number, default: 0 },
          communityAvg: { type: Number, default: 0 },
          vulnerabilityAvg: { type: Number, default: 0 },
          eolAvg: { type: Number, default: 0 },
          licenseAvg: { type: Number, default: 0 },
          totalDependencies: { type: Number, default: 0 },
          vulnerableCount: { type: Number, default: 0 },
          deprecatedCount: { type: Number, default: 0 },
          outdatedCount: { type: Number, default: 0 },
        },
        { timestamps: false },
      );
      schema.index({ repositoryId: 1, snapshotDate: -1 });
      RepoScoreSnapshotModel = mongoose.model('RepoScoreSnapshot', schema);
    }

    const doc = await RepoScoreSnapshotModel.create({
      repositoryId: repoId,
      scanId,
      snapshotDate: scores.snapshotDate || new Date(),
      compositeScore: scores.compositeScore,
      grade: scores.grade,
      maintenanceAvg: scores.maintenanceAvg,
      communityAvg: scores.communityAvg,
      vulnerabilityAvg: scores.vulnerabilityAvg,
      eolAvg: scores.eolAvg,
      licenseAvg: scores.licenseAvg,
      totalDependencies: scores.totalDependencies,
      vulnerableCount: scores.vulnerableCount,
      deprecatedCount: scores.deprecatedCount,
      outdatedCount: scores.outdatedCount,
    });

    logger.info({ repoId, scanId, score: scores.compositeScore }, 'Captured repo score snapshot');
    return (doc as mongoose.Document & { _id: mongoose.Types.ObjectId })._id.toString();
  } catch (err) {
    logger.error({ err, repoId, scanId }, 'Failed to capture repo score snapshot');
    return null;
  }
}

/**
 * Capture a package health history snapshot.
 */
export async function capturePackageSnapshot(
  packageId: string,
  healthData: IHealthSnapshot,
): Promise<string | null> {
  try {
    let PackageHealthModel: mongoose.Model<any>;
    try {
      PackageHealthModel = mongoose.model('PackageHealthHistory');
    } catch {
      const schema = new mongoose.Schema(
        {
          packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true },
          snapshotDate: { type: Date, default: Date.now },
          maintenance: { type: mongoose.Schema.Types.Mixed },
          community: { type: mongoose.Schema.Types.Mixed },
          vulnerability: { type: mongoose.Schema.Types.Mixed },
          eol: { type: mongoose.Schema.Types.Mixed },
          license: { type: mongoose.Schema.Types.Mixed },
        },
        { timestamps: false },
      );
      schema.index({ packageId: 1, snapshotDate: -1 });
      PackageHealthModel = mongoose.model('PackageHealthHistory', schema);
    }

    const doc = await PackageHealthModel.create({
      packageId,
      snapshotDate: healthData.snapshotDate || new Date(),
      maintenance: healthData.maintenance,
      community: healthData.community,
      vulnerability: healthData.vulnerability,
      eol: healthData.eol,
      license: healthData.license,
    });

    logger.debug({ packageId }, 'Captured package health snapshot');
    return (doc as mongoose.Document & { _id: mongoose.Types.ObjectId })._id.toString();
  } catch (err) {
    logger.error({ err, packageId }, 'Failed to capture package health snapshot');
    return null;
  }
}

/**
 * Query repository score snapshots for trend/decay graph data.
 *
 * @param repoId - The repository ID
 * @param from - Start date
 * @param to - End date
 * @param granularity - 'day' | 'week' | 'month' - controls aggregation grouping
 */
export async function getRepoTrend(
  repoId: string,
  from: Date,
  to: Date,
  granularity: 'day' | 'week' | 'month' = 'day',
): Promise<Array<{ date: string; compositeScore: number; grade: string }>> {
  try {
    let RepoScoreSnapshotModel: mongoose.Model<any>;
    try {
      RepoScoreSnapshotModel = mongoose.model('RepoScoreSnapshot');
    } catch {
      logger.warn('RepoScoreSnapshot model not registered');
      return [];
    }

    // Build the date format for grouping
    let dateFormat: string;
    switch (granularity) {
      case 'week':
        dateFormat = '%Y-W%V';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      case 'day':
      default:
        dateFormat = '%Y-%m-%d';
        break;
    }

    const results = await RepoScoreSnapshotModel.aggregate([
      {
        $match: {
          repositoryId: new mongoose.Types.ObjectId(repoId),
          snapshotDate: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$snapshotDate' } },
          compositeScore: { $avg: '$compositeScore' },
          grade: { $last: '$grade' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return results.map((r: { _id: string; compositeScore: number; grade: string }) => ({
      date: r._id,
      compositeScore: Math.round(r.compositeScore),
      grade: r.grade,
    }));
  } catch (err) {
    logger.error({ err, repoId }, 'Failed to query repo trend data');
    return [];
  }
}
