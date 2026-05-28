import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IPackageHealthHistoryDocument extends Document {
  packageId: Types.ObjectId;
  snapshotDate: Date;
  maintenance: {
    commitsLast90d: number;
    releasesLastYear: number;
    daysSinceLastRelease: number;
    openIssuesCount: number;
    closedIssuesLast90d: number;
    openPrCount: number;
    avgIssueCloseDays: number;
  };
  community: {
    starsCount: number;
    starsGrowth30d: number;
    forksCount: number;
    contributorCount: number;
    dependentReposCount: number;
    downloadsLastWeek: number;
  };
  vulnerability: {
    openCveCount: number;
    totalCveCount: number;
    criticalCveCount: number;
    highCveCount: number;
    avgFixTimeDays: number;
  };
  eol: {
    runtimeEolDate?: Date;
    frameworkEolDate?: Date;
    isDeprecated: boolean;
    isArchived: boolean;
  };
  license: {
    spdx: string;
    riskTier: 'low' | 'medium' | 'high' | 'unknown';
  };
}

const packageHealthHistorySchema = new Schema<IPackageHealthHistoryDocument>(
  {
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', required: true },
    snapshotDate: { type: Date, required: true },
    maintenance: {
      commitsLast90d: { type: Number, default: 0 },
      releasesLastYear: { type: Number, default: 0 },
      daysSinceLastRelease: { type: Number, default: 0 },
      openIssuesCount: { type: Number, default: 0 },
      closedIssuesLast90d: { type: Number, default: 0 },
      openPrCount: { type: Number, default: 0 },
      avgIssueCloseDays: { type: Number, default: 0 },
    },
    community: {
      starsCount: { type: Number, default: 0 },
      starsGrowth30d: { type: Number, default: 0 },
      forksCount: { type: Number, default: 0 },
      contributorCount: { type: Number, default: 0 },
      dependentReposCount: { type: Number, default: 0 },
      downloadsLastWeek: { type: Number, default: 0 },
    },
    vulnerability: {
      openCveCount: { type: Number, default: 0 },
      totalCveCount: { type: Number, default: 0 },
      criticalCveCount: { type: Number, default: 0 },
      highCveCount: { type: Number, default: 0 },
      avgFixTimeDays: { type: Number, default: 0 },
    },
    eol: {
      runtimeEolDate: { type: Date },
      frameworkEolDate: { type: Date },
      isDeprecated: { type: Boolean, default: false },
      isArchived: { type: Boolean, default: false },
    },
    license: {
      spdx: { type: String, default: '' },
      riskTier: { type: String, enum: ['low', 'medium', 'high', 'unknown'], default: 'unknown' },
    },
  },
  {
    timestamps: false,
  },
);

packageHealthHistorySchema.index({ packageId: 1, snapshotDate: -1 });

export const PackageHealthHistory: Model<IPackageHealthHistoryDocument> =
  mongoose.model<IPackageHealthHistoryDocument>(
    'PackageHealthHistory',
    packageHealthHistorySchema,
  );
