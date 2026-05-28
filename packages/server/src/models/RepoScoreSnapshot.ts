import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IRepoScoreSnapshotDocument extends Document {
  repositoryId: Types.ObjectId;
  scanId: Types.ObjectId;
  snapshotDate: Date;
  compositeScore: number;
  grade: string;
  maintenanceAvg: number;
  communityAvg: number;
  vulnerabilityAvg: number;
  eolAvg: number;
  licenseAvg: number;
  totalDependencies: number;
  vulnerableCount: number;
  deprecatedCount: number;
  outdatedCount: number;
}

const repoScoreSnapshotSchema = new Schema<IRepoScoreSnapshotDocument>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    scanId: { type: Schema.Types.ObjectId, ref: 'Scan', required: true },
    snapshotDate: { type: Date, required: true },
    compositeScore: { type: Number, required: true, min: 0, max: 100 },
    grade: { type: String, required: true },
    maintenanceAvg: { type: Number, required: true, min: 0, max: 100 },
    communityAvg: { type: Number, required: true, min: 0, max: 100 },
    vulnerabilityAvg: { type: Number, required: true, min: 0, max: 100 },
    eolAvg: { type: Number, required: true, min: 0, max: 100 },
    licenseAvg: { type: Number, required: true, min: 0, max: 100 },
    totalDependencies: { type: Number, default: 0 },
    vulnerableCount: { type: Number, default: 0 },
    deprecatedCount: { type: Number, default: 0 },
    outdatedCount: { type: Number, default: 0 },
  },
  {
    timestamps: false,
  },
);

repoScoreSnapshotSchema.index({ repositoryId: 1, snapshotDate: -1 }, { unique: true });

export const RepoScoreSnapshot: Model<IRepoScoreSnapshotDocument> =
  mongoose.model<IRepoScoreSnapshotDocument>('RepoScoreSnapshot', repoScoreSnapshotSchema);
