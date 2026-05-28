import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IWebhookEndpointDocument extends Document {
  userId: Types.ObjectId;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt?: Date;
  createdAt: Date;
}

const webhookEndpointSchema = new Schema<IWebhookEndpointDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    url: { type: String, required: true },
    events: [{ type: String }],
    isActive: { type: Boolean, default: true },
    lastTriggeredAt: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

webhookEndpointSchema.index({ userId: 1 });

export const WebhookEndpoint: Model<IWebhookEndpointDocument> =
  mongoose.model<IWebhookEndpointDocument>('WebhookEndpoint', webhookEndpointSchema);
