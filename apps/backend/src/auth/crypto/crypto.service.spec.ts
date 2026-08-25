import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue(
              '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            ),
          },
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
  });

  it('should encrypt and decrypt a string successfully', () => {
    const plaintext = 'rzp_test_secret_key_12345';
    const encrypted = service.encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce unique IVs for identical plaintexts', () => {
    const plaintext = 'same_secret_key';
    const enc1 = service.encrypt(plaintext);
    const enc2 = service.encrypt(plaintext);

    expect(enc1).not.toBe(enc2);
    expect(service.decrypt(enc1)).toBe(plaintext);
    expect(service.decrypt(enc2)).toBe(plaintext);
  });

  it('should throw on tampered authentication tag', () => {
    const encrypted = service.encrypt('sensitive_data');
    const parts = encrypted.split(':');
    const tamperedTag = (parseInt(parts[1][0], 16) ^ 1).toString(16) + parts[1].slice(1);
    const tampered = `${parts[0]}:${tamperedTag}:${parts[2]}`;

    expect(() => service.decrypt(tampered)).toThrow();
  });
});
