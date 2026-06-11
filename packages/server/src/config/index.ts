import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GITHUB_CALLBACK_URL: z.string().default('http://localhost:4000/api/auth/github/callback'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Run BullMQ workers inside the API process (for single-service deploys)
  START_WORKERS: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  MONGODB_URI: z.string().default('mongodb://localhost:27017/stack-decay-score'),
  REDIS_HOST: z.string().default(''),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().default(''),

  ENCRYPTION_KEY: z.string().min(16, 'ENCRYPTION_KEY must be at least 16 hex characters'),

  LIBRARIES_IO_API_KEY: z.string().default(''),
  NVD_API_KEY: z.string().default(''),

  SENDGRID_API_KEY: z.string().default(''),
  SLACK_WEBHOOK_URL: z.string().default(''),
  DISCORD_WEBHOOK_URL: z.string().default(''),
  GITHUB_WEBHOOK_SECRET: z.string().default(''),
});

type EnvConfig = z.infer<typeof envSchema>;

function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    const messages: string[] = [];

    for (const [key, value] of Object.entries(formatted)) {
      if (key === '_errors') continue;
      const errors = (value as { _errors?: string[] })?._errors;
      if (errors && errors.length > 0) {
        messages.push(`  ${key}: ${errors.join(', ')}`);
      }
    }

    console.error('Environment validation failed:\n' + messages.join('\n'));
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();

export const isDev = config.NODE_ENV === 'development';
export const isProd = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
