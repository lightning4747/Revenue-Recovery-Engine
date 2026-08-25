import { Test, TestingModule } from '@nestjs/testing';
import { CryptoService } from '../auth/crypto/crypto.service';
import { DRIZZLE_DB } from '../database/database.provider';
import { MerchantService } from './merchant.service';

describe('MerchantService', () => {
  let service: MerchantService;
  let mockDb: any;
  let mockCryptoService: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    mockCryptoService = {
      encrypt: jest.fn().mockImplementation((val: string) => `enc_${val}`),
      decrypt: jest.fn().mockImplementation((val: string) => val.replace('enc_', '')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantService,
        { provide: DRIZZLE_DB, useValue: mockDb },
        { provide: CryptoService, useValue: mockCryptoService },
      ],
    }).compile();

    service = module.get<MerchantService>(MerchantService);
  });

  it('should encrypt secrets and insert credential record when creating credentials', async () => {
    const result = await service.updateCredentials('m_123', {
      keyId: 'rzp_test_key_123',
      keySecret: 'secret_key_456',
      webhookSecret: 'wh_secret_789',
    });

    expect(mockCryptoService.encrypt).toHaveBeenCalledWith('secret_key_456');
    expect(mockCryptoService.encrypt).toHaveBeenCalledWith('wh_secret_789');
    expect(mockDb.insert).toHaveBeenCalled();
    expect(result).toHaveProperty('keyId', 'rzp_test_key_123');
    expect(result).not.toHaveProperty('keySecret');
    expect(result).not.toHaveProperty('webhookSecret');
  });
});
