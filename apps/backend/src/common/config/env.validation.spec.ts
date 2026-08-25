import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const validEnv = {
    NODE_ENV: 'development',
    PORT: 3000,
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    RAZORPAY_KEY_ID: 'rzp_test_123',
    RAZORPAY_KEY_SECRET: 'secret_123',
    WEBHOOK_SECRET: 'whsec_123',
    JWT_SECRET: 'jwt_secret_key_32_characters_min',
  };

  it('should validate complete valid environment configuration', () => {
    const { error, value } = envValidationSchema.validate(validEnv);
    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
  });

  it('should fail validation when required key is missing', () => {
    const invalidEnv = { ...validEnv, RAZORPAY_KEY_ID: undefined };
    const { error } = envValidationSchema.validate(invalidEnv);
    expect(error).toBeDefined();
  });
});
