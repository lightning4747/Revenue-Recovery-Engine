import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly keyBuffer: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.getOrThrow<string>('ENCRYPTION_KEY');
    this.keyBuffer = crypto.createHash('sha256').update(rawKey).digest();
  }

  encrypt(plaintext: string): string {
    if (!plaintext) {
      throw new Error('Plaintext input cannot be empty');
    }
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.keyBuffer, iv);

      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();

      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (error) {
      throw new InternalServerErrorException(
        `Encryption failed: ${(error as Error).message}`,
      );
    }
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext) {
      throw new Error('Ciphertext input cannot be empty');
    }
    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid ciphertext format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = Buffer.from(parts[2], 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.keyBuffer, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      throw new InternalServerErrorException(
        `Decryption failed: ${(error as Error).message}`,
      );
    }
  }
}
