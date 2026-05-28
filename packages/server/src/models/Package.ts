import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPackageDocument extends Document {
  ecosystem: string;
  name: string;
  registryUrl: string;
  homepageUrl: string | null;
  repoUrl: string | null;
  license: string | null;
  latestVersion: string;
  description: string | null;
  latestHealth: {
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
  } | null;
  vulnerabilities: Array<{
    source: 'osv' | 'nvd' | 'github_advisory';
    sourceId: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    cvssScore: number | null;
    summary: string;
    affectedVersions: string;
    fixedVersion: string | null;
    publishedAt: Date;
    withdrawnAt: Date | null;
    url: string;
  }>;
  lastEnrichedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const healthSnapshotSchema = new Schema(
  {
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
  { _id: false },
);

const vulnerabilitySchema = new Schema(
  {
    source: { type: String, enum: ['osv', 'nvd', 'github_advisory'], required: true },
    sourceId: { type: String, required: true },
    severity: { type: String, enum: ['critical', 'high', 'medium', 'low'], required: true },
    cvssScore: { type: Number, default: null },
    summary: { type: String, default: '' },
    affectedVersions: { type: String, default: '' },
    fixedVersion: { type: String, default: null },
    publishedAt: { type: Date, required: true },
    withdrawnAt: { type: Date, default: null },
    url: { type: String, default: '' },
  },
  { _id: false },
);

const packageSchema = new Schema<IPackageDocument>(
  {
    ecosystem: { type: String, required: true },
    name: { type: String, required: true },
    registryUrl: { type: String, default: '' },
    homepageUrl: { type: String, default: null },
    repoUrl: { type: String, default: null },
    license: { type: String, default: null },
    latestVersion: { type: String, default: '' },
    description: { type: String, default: null },
    latestHealth: { type: healthSnapshotSchema, default: null },
    vulnerabilities: [vulnerabilitySchema],
    lastEnrichedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

packageSchema.index({ ecosystem: 1, name: 1 }, { unique: true });

packageSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const Package: Model<IPackageDocument> = mongoose.model<IPackageDocument>(
  'Package',
  packageSchema,
);
