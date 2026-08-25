import * as crypto from 'crypto';
import { WebhookVerificationService } from './webhook-verification.service';

describe('WebhookVerificationService', () => {
  let service: WebhookVerificationService;
  const secret = 'super_secret_webhook_key_123';
  const payloadString = JSON.stringify({
    entity: 'event',
    account_id: 'acc_12345',
    event: 'payment.failed',
  });
  const rawBody = Buffer.from(payloadString, 'utf8');

  beforeEach(() => {
    service = new WebhookVerificationService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return true for a valid signature calculated against rawBody Buffer', () => {
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const isValid = service.verifySignature(rawBody, validSignature, secret);
    expect(isValid).toBe(true);
  });

  it('should return false if payload rawBody is tampered with', () => {
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const tamperedBody = Buffer.from(
      JSON.stringify({ ...JSON.parse(payloadString), event: 'payment.captured' }),
      'utf8',
    );

    const isValid = service.verifySignature(tamperedBody, validSignature, secret);
    expect(isValid).toBe(false);
  });

  it('should return false if signature string is invalid or tampered', () => {
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const tamperedSignature = validSignature.substring(0, validSignature.length - 2) + 'ff';

    const isValid = service.verifySignature(rawBody, tamperedSignature, secret);
    expect(isValid).toBe(false);
  });

  it('should return false if signature length is different from expected digest length', () => {
    const shortSignature = 'invalid_short_sig';
    const isValid = service.verifySignature(rawBody, shortSignature, secret);
    expect(isValid).toBe(false);
  });

  it('should return false if rawBody, signature, or secret are empty/null', () => {
    expect(service.verifySignature(null as any, 'sig', secret)).toBe(false);
    expect(service.verifySignature(rawBody, '', secret)).toBe(false);
    expect(service.verifySignature(rawBody, 'sig', '')).toBe(false);
  });
});
