import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface INotificationDocument extends Document {
  userId: Types.ObjectId;
  alertRuleId?: Types.ObjectId;
  channel: 'email' | 'webhook' | 'slack';
  subject: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

const notificationSchema = new Schema<INotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    alertRuleId: { type: Schema.Types.ObjectId, ref: 'AlertRule' },
    channel: { type: String, enum: ['email', 'webhook', 'slack'], required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    sentAt: { type: Date },
    errorMessage: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ status: 1 });

export const Notification: Model<INotificationDocument> =
  mongoose.model<INotificationDocument>('Notification', notificationSchema);
