import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserDocument extends Document {
  githubId: number;
  githubLogin: string;
  displayName: string;
  avatarUrl: string;
  email: string;
  plan: 'free' | 'pro' | 'team';
  accessToken: string;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
  toSafeJSON(): Record<string, unknown>;
}

const userSchema = new Schema<IUserDocument>(
  {
    githubId: { type: Number, required: true },
    githubLogin: { type: String, required: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
    email: { type: String, default: '' },
    plan: { type: String, enum: ['free', 'pro', 'team'], default: 'free' },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ githubId: 1 }, { unique: true });

userSchema.methods.toSafeJSON = function (this: IUserDocument): Record<string, unknown> {
  const obj = this.toObject();
  delete obj.accessToken;
  delete obj.refreshToken;
  delete obj.__v;
  obj.id = obj._id.toString();
  delete obj._id;
  return obj;
};

userSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const User: Model<IUserDocument> = mongoose.model<IUserDocument>('User', userSchema);
