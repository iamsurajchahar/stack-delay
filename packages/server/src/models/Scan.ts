import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IScanDocument extends Document {
  repositoryId: Types.ObjectId;
  status: 'pending' | 'scanning' | 'enriching' | 'scoring' | 'completed' | 'failed';
  triggeredBy: 'manual' | 'scheduled' | 'webhook';
  commitSha: string;
  manifestCount: number;
  dependencyCount: number;
  aggregateScore: number | null;
  aggregateGrade: string | null;
  errorMessage: string | null;
  manifests: Array<{
    filePath: string;
    ecosystem: string;
    dependencies: Array<{
      packageId: Types.ObjectId | null;
      name: string;
      versionConstraint: string;
      resolvedVersion: string;
      isDev: boolean;
      isDirect: boolean;
      depth: number;
    }>;
  }>;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  markAs(status: IScanDocument['status'], errorMessage?: string): Promise<IScanDocument>;
}

const dependencyEntrySchema = new Schema(
  {
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', default: null },
    name: { type: String, required: true },
    versionConstraint: { type: String, default: '' },
    resolvedVersion: { type: String, default: '' },
    isDev: { type: Boolean, default: false },
    isDirect: { type: Boolean, default: true },
    depth: { type: Number, default: 0 },
  },
  { _id: false },
);

const manifestSchema = new Schema(
  {
    filePath: { type: String, required: true },
    ecosystem: { type: String, required: true },
    dependencies: [dependencyEntrySchema],
  },
  { _id: false },
);

const scanSchema = new Schema<IScanDocument>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    status: {
      type: String,
      enum: ['pending', 'scanning', 'enriching', 'scoring', 'completed', 'failed'],
      default: 'pending',
    },
    triggeredBy: {
      type: String,
      enum: ['manual', 'scheduled', 'webhook'],
      default: 'manual',
    },
    commitSha: { type: String, default: '' },
    manifestCount: { type: Number, default: 0 },
    dependencyCount: { type: Number, default: 0 },
    aggregateScore: { type: Number, default: null },
    aggregateGrade: { type: String, default: null },
    errorMessage: { type: String, default: null },
    manifests: [manifestSchema],
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

scanSchema.index({ repositoryId: 1 });
scanSchema.index({ status: 1 });
scanSchema.index({ repositoryId: 1, createdAt: -1 });

scanSchema.methods.markAs = async function (
  this: IScanDocument,
  status: IScanDocument['status'],
  errorMessage?: string,
): Promise<IScanDocument> {
  this.status = status;

  if (status === 'scanning' && !this.startedAt) {
    this.startedAt = new Date();
  }

  if (status === 'completed' || status === 'failed') {
    this.completedAt = new Date();
  }

  if (errorMessage) {
    this.errorMessage = errorMessage;
  }

  return this.save();
};

export const Scan: Model<IScanDocument> = mongoose.model<IScanDocument>('Scan', scanSchema);
