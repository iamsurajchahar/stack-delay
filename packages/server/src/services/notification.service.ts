import axios from 'axios';
import crypto from 'node:crypto';
import { INotification } from '@stack-decay/shared';
import { config } from '../config/index';
import { logger } from '../utils/logger';

/**
 * Dispatch a notification based on its channel type.
 * Handles email (SendGrid), webhook (HMAC-signed), and Slack (formatted blocks).
 *
 * Returns the updated notification with delivery status.
 */
export async function sendNotification(
  notification: INotification,
): Promise<{ status: 'sent' | 'failed'; errorMessage?: string }> {
  try {
    switch (notification.channel) {
      case 'email':
        await sendEmail(notification);
        break;
      case 'webhook':
        await sendWebhook(notification);
        break;
      case 'slack':
        await sendSlack(notification);
        break;
      default:
        throw new Error(`Unknown notification channel: ${notification.channel}`);
    }

    logger.info(
      { channel: notification.channel, notificationId: notification.id },
      'Notification sent successfully',
    );
    return { status: 'sent' };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error(
      { err, channel: notification.channel, notificationId: notification.id },
      'Failed to send notification',
    );
    return { status: 'failed', errorMessage };
  }
}

/**
 * Send an email notification via the SendGrid API.
 */
async function sendEmail(notification: INotification): Promise<void> {
  const apiKey = config.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SendGrid API key not configured');
  }

  // We need the user's email - for now it's embedded in the notification body or we use a default
  // In a real implementation, we'd look up the user's email from the userId
  const toEmail = extractEmailFromContext(notification) || '';
  if (!toEmail) {
    throw new Error('No recipient email address available');
  }

  const payload = {
    personalizations: [
      {
        to: [{ email: toEmail }],
        subject: notification.subject,
      },
    ],
    from: {
      email: 'alerts@stackdecay.dev',
      name: 'Stack Decay Score',
    },
    content: [
      {
        type: 'text/html',
        value: formatEmailHtml(notification.subject, notification.body),
      },
    ],
  };

  await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

/**
 * Send a webhook notification with HMAC-SHA256 signature.
 */
async function sendWebhook(notification: INotification): Promise<void> {
  // The webhook URL should come from the user's webhook endpoint configuration
  // For now, we expect it to be embedded in context or derived from the notification
  const webhookUrl = extractWebhookUrl(notification);
  if (!webhookUrl) {
    throw new Error('No webhook URL configured');
  }

  // Validate URL format
  try {
    new URL(webhookUrl);
  } catch {
    throw new Error(`Invalid webhook URL: ${webhookUrl}`);
  }

  const payload = {
    event: 'alert.triggered',
    notificationId: notification.id,
    subject: notification.subject,
    body: notification.body,
    timestamp: new Date().toISOString(),
  };

  const payloadString = JSON.stringify(payload);

  // Sign the payload with HMAC-SHA256 using a secret derived from the JWT secret
  const secret = config.JWT_SECRET;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');

  await axios.post(webhookUrl, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Signature-256': `sha256=${signature}`,
      'X-Hook-ID': notification.id || 'unknown',
    },
    timeout: 10000,
  });
}

/**
 * Send a Slack notification with formatted message blocks.
 */
async function sendSlack(notification: INotification): Promise<void> {
  const webhookUrl = config.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('Slack webhook URL not configured');
  }

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: notification.subject,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: notification.body,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Sent by Stack Decay Score at ${new Date().toISOString()}`,
        },
      ],
    },
  ];

  await axios.post(
    webhookUrl,
    {
      text: notification.subject,
      blocks,
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    },
  );
}

/**
 * Format an HTML email body.
 */
function formatEmailHtml(subject: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
    <h2 style="color: #1a202c; margin-top: 0;">${escapeHtml(subject)}</h2>
    <p style="line-height: 1.6; color: #4a5568;">${escapeHtml(body)}</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
    <p style="font-size: 12px; color: #a0aec0;">
      This alert was generated by Stack Decay Score. Manage your alert preferences in your dashboard.
    </p>
  </div>
</body>
</html>`.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Extract email from notification context. The userId is available but we need
 * the actual email which should be looked up from the User model.
 * For the worker integration, the email should be passed as part of the job data.
 */
function extractEmailFromContext(notification: INotification): string | null {
  // In practice, the worker will look up the user's email and pass it along.
  // We check for a property that may be added to the notification object at dispatch time.
  const extended = notification as INotification & { recipientEmail?: string };
  return extended.recipientEmail || null;
}

/**
 * Extract webhook URL from notification context.
 */
function extractWebhookUrl(notification: INotification): string | null {
  const extended = notification as INotification & { webhookUrl?: string };
  return extended.webhookUrl || null;
}
