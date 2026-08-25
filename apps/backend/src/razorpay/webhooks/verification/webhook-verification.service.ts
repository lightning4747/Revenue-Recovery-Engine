import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class WebhookVerificationService {
  /**
   * Verifies the HMAC SHA-256 signature of an unparsed raw request body against a secret.
   * Uses constant-time equality check (crypto.timingSafeEqual) to prevent timing attacks.
   *
   * @param rawBody - The unparsed request body Buffer
   * @param signature - The signature hex string from X-Razorpay-Signature header
   * @param secret - The merchant's decrypted webhook secret
   * @returns true if signature is valid, false otherwise
   */
  verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
    if (!rawBody || !signature || !secret) {
      return false;
    }

    try {
      const expectedDigest = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedDigest, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    } catch {
      return false;
    }
  }
}
