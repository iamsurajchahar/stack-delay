import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IRepositoryDocument extends Document {
  userId: Types.ObjectId;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  language: string;
  latestScore: number | null;
  latestGrade: string | null;
  lastScannedAt: Date | null;
  scanFrequency: 'manual' | 'daily' | 'weekly' | 'monthly';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const repositorySchema = new Schema<IRepositoryDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    githubRepoId: { type: Number, required: true },
    owner: { type: String, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    defaultBranch: { type: String, default: 'main' },
    isPrivate: { type: Boolean, default: false },
    language: { type: String, default: '' },
    latestScore: { type: Number, default: null },
    latestGrade: { type: String, default: null },
    lastScannedAt: { type: Date, default: null },
    scanFrequency: {
      type: String,
      enum: ['manual', 'daily', 'weekly', 'monthly'],
      default: 'weekly',
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

repositorySchema.index({ userId: 1 });
repositorySchema.index({ userId: 1, githubRepoId: 1 }, { unique: true });
repositorySchema.index({ latestScore: 1 });

repositorySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const Repository: Model<IRepositoryDocument> = mongoose.model<IRepositoryDocument>(
  'Repository',
  repositorySchema,
);
