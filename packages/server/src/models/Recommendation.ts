import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IRecommendationDocument extends Document {
  repositoryId: Types.ObjectId;
  scanId: Types.ObjectId;
  packageId: Types.ObjectId;
  type: 'upgrade' | 'replace' | 'remove';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  currentVersion?: string;
  suggestedVersion?: string;
  alternativePackage?: string;
  scoreImpact: number;
  migrationUrl?: string;
  isDismissed: boolean;
  dismissedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const recommendationSchema = new Schema<IRecommendationDocument>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    scanId: { type: Schema.Types.ObjectId, ref: 'Scan', required: true },
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', required: true },
    type: {
      type: String,
      enum: ['upgrade', 'replace', 'remove'],
      required: true,
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    currentVersion: { type: String },
    suggestedVersion: { type: String },
    alternativePackage: { type: String },
    scoreImpact: { type: Number, default: 0 },
    migrationUrl: { type: String },
    isDismissed: { type: Boolean, default: false },
    dismissedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

recommendationSchema.index({ repositoryId: 1, scanId: 1 });
recommendationSchema.index({ repositoryId: 1, priority: 1 });
recommendationSchema.index({ packageId: 1 });

export const Recommendation: Model<IRecommendationDocument> =
  mongoose.model<IRecommendationDocument>('Recommendation', recommendationSchema);
