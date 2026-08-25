import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import { CryptoService } from '../../auth/crypto/crypto.service';
import { DRIZZLE_DB } from '../../database/database.provider';
import { WebhookVerificationService } from './verification/webhook-verification.service';
import { WebhooksService } from './webhooks.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let mockDb: any;
  let mockCryptoService: any;
  let mockVerificationService: any;

  const merchantId = 'mer_test_123';
  const webhookSecret = 'test_webhook_secret_key';
  const encryptedSecret = 'iv:tag:encrypted';

  const validPayload = {
    entity: 'event',
    account_id: 'acc_123',
    event: 'payment.failed',
    event_id: 'evt_test_999',
    payload: {
      payment: {
        entity: {
          id: 'pay_12345',
          amount: 5000,
          status: 'failed',
        },
      },
    },
  };
  const rawBody = Buffer.from(JSON.stringify(validPayload), 'utf8');
  const validSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
    };

    mockCryptoService = {
      decrypt: jest.fn(),
    };

    mockVerificationService = {
      verifySignature: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: DRIZZLE_DB, useValue: mockDb },
        { provide: CryptoService, useValue: mockCryptoService },
        { provide: WebhookVerificationService, useValue: mockVerificationService },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw BadRequestException if merchantId, rawBody, or signature are missing', async () => {
    await expect(
      service.handleWebhook('', rawBody, validSignature),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.handleWebhook(merchantId, Buffer.from([]), validSignature),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.handleWebhook(merchantId, rawBody, ''),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if merchant credentials do not exist', async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });

    await expect(
      service.handleWebhook(merchantId, rawBody, validSignature),
    ).rejects.toThrow('Invalid webhook signature');
  });

  it('should throw BadRequestException if HMAC signature verification fails', async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ encryptedWebhookSecret: encryptedSecret }]),
      }),
    });
    mockCryptoService.decrypt.mockReturnValue(webhookSecret);
    mockVerificationService.verifySignature.mockReturnValue(false);

    await expect(
      service.handleWebhook(merchantId, rawBody, 'invalid_sig'),
    ).rejects.toThrow('Invalid webhook signature');
  });

  it('should throw BadRequestException if JSON payload is malformed', async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ encryptedWebhookSecret: encryptedSecret }]),
      }),
    });
    mockCryptoService.decrypt.mockReturnValue(webhookSecret);
    mockVerificationService.verifySignature.mockReturnValue(true);

    const malformedBody = Buffer.from('invalid json {{{', 'utf8');

    await expect(
      service.handleWebhook(merchantId, malformedBody, validSignature),
    ).rejects.toThrow('Malformed JSON payload');
  });

  it('should throw BadRequestException if event_id or event field is missing', async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ encryptedWebhookSecret: encryptedSecret }]),
      }),
    });
    mockCryptoService.decrypt.mockReturnValue(webhookSecret);
    mockVerificationService.verifySignature.mockReturnValue(true);

    const bodyNoEventId = Buffer.from(JSON.stringify({ event: 'payment.failed' }), 'utf8');
    await expect(
      service.handleWebhook(merchantId, bodyNoEventId, validSignature),
    ).rejects.toThrow('Missing event identifier');

    const bodyNoEventType = Buffer.from(JSON.stringify({ event_id: 'evt_1' }), 'utf8');
    await expect(
      service.handleWebhook(merchantId, bodyNoEventType, validSignature),
    ).rejects.toThrow('Missing event type');
  });

  it('should persist new webhook event in DB and return persisted status', async () => {
    // 1. Select merchant credentials
    // 2. Select duplicate check (returns empty)
    const selectWhereChain = jest
      .fn()
      .mockResolvedValueOnce([{ encryptedWebhookSecret: encryptedSecret }]) // credentials
      .mockResolvedValueOnce([]); // deduplication query

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: selectWhereChain,
      }),
    });

    mockCryptoService.decrypt.mockReturnValue(webhookSecret);
    mockVerificationService.verifySignature.mockReturnValue(true);

    const mockInsertedId = '550e8400-e29b-41d4-a716-446655440000';
    mockDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: mockInsertedId }]),
      }),
    });

    const result = await service.handleWebhook(
      merchantId,
      rawBody,
      validSignature,
      'evt_header_123',
    );

    expect(result).toEqual({
      status: 'persisted',
      duplicate: false,
      id: mockInsertedId,
    });
  });

  it('should acknowledge duplicate event if record already exists in DB', async () => {
    const existingId = '550e8400-e29b-41d4-a716-446655440001';
    const selectWhereChain = jest
      .fn()
      .mockResolvedValueOnce([{ encryptedWebhookSecret: encryptedSecret }])
      .mockResolvedValueOnce([{ id: existingId }]); // existing duplicate found

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: selectWhereChain,
      }),
    });

    mockCryptoService.decrypt.mockReturnValue(webhookSecret);
    mockVerificationService.verifySignature.mockReturnValue(true);

    const result = await service.handleWebhook(merchantId, rawBody, validSignature);

    expect(result).toEqual({
      status: 'acknowledged',
      duplicate: true,
      id: existingId,
    });
  });

  it('should catch PG unique constraint violation (code 23505) and return duplicate acknowledged', async () => {
    const selectWhereChain = jest
      .fn()
      .mockResolvedValueOnce([{ encryptedWebhookSecret: encryptedSecret }])
      .mockResolvedValueOnce([]); // empty deduplication query

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: selectWhereChain,
      }),
    });

    mockCryptoService.decrypt.mockReturnValue(webhookSecret);
    mockVerificationService.verifySignature.mockReturnValue(true);

    const pgError = new Error('duplicate key value violates unique constraint') as any;
    pgError.code = '23505';

    mockDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockRejectedValue(pgError),
      }),
    });

    const result = await service.handleWebhook(merchantId, rawBody, validSignature);

    expect(result).toEqual({
      status: 'acknowledged',
      duplicate: true,
    });
  });
});
