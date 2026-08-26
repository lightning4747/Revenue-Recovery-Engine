import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  RAZORPAY_KEY_ID: Joi.string().required(),
  RAZORPAY_KEY_SECRET: Joi.string().required(),
  WEBHOOK_SECRET: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  ENCRYPTION_KEY: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  WORKER_CONCURRENCY: Joi.number().default(5),
  JOB_MAX_RETRIES: Joi.number().default(3),
  JOB_BACKOFF_INITIAL_DELAY_MS: Joi.number().default(5000),
});
