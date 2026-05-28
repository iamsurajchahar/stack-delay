import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IDependencyScoreDocument extends Document {
  scanId: Types.ObjectId;
  packageId: Types.ObjectId;
  maintenanceScore: number;
  communityScore: number;
  vulnerabilityScore: number;
  eolScore: number;
  licenseScore: number;
  compositeScore: number;
  grade: string;
  scoringVersion: string;
}

const dependencyScoreSchema = new Schema<IDependencyScoreDocument>(
  {
    scanId: { type: Schema.Types.ObjectId, ref: 'Scan', required: true },
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', required: true },
    maintenanceScore: { type: Number, required: true, min: 0, max: 100 },
    communityScore: { type: Number, required: true, min: 0, max: 100 },
    vulnerabilityScore: { type: Number, required: true, min: 0, max: 100 },
    eolScore: { type: Number, required: true, min: 0, max: 100 },
    licenseScore: { type: Number, required: true, min: 0, max: 100 },
    compositeScore: { type: Number, required: true, min: 0, max: 100 },
    grade: { type: String, required: true },
    scoringVersion: { type: String, required: true },
  },
  {
    timestamps: false,
  },
);

dependencyScoreSchema.index({ scanId: 1 });
dependencyScoreSchema.index({ packageId: 1 });

export const DependencyScore: Model<IDependencyScoreDocument> =
  mongoose.model<IDependencyScoreDocument>('DependencyScore', dependencyScoreSchema);
