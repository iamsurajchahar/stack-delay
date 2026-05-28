import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAlertRuleDocument extends Document {
  userId: Types.ObjectId;
  repositoryId?: Types.ObjectId;
  ruleType: 'score_drop' | 'eol_approaching' | 'new_cve' | 'grade_change' | 'deprecated_dep';
  thresholdValue?: number;
  thresholdDays?: number;
  channels: string[];
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const alertRuleSchema = new Schema<IAlertRuleDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository' },
    ruleType: {
      type: String,
      enum: ['score_drop', 'eol_approaching', 'new_cve', 'grade_change', 'deprecated_dep'],
      required: true,
    },
    thresholdValue: { type: Number },
    thresholdDays: { type: Number },
    channels: [{ type: String }],
    isEnabled: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

alertRuleSchema.index({ userId: 1 });
alertRuleSchema.index({ userId: 1, repositoryId: 1 });

export const AlertRule: Model<IAlertRuleDocument> = mongoose.model<IAlertRuleDocument>(
  'AlertRule',
  alertRuleSchema,
);
