import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { DRIZZLE_DB } from '../database/database.provider';

describe('AuthService', () => {
  let service: AuthService;
  let mockDb: any;
  let mockJwtService: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockResolvedValue([]),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock_jwt_token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DRIZZLE_DB, useValue: mockDb },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should register a new merchant successfully', async () => {
    const result = await service.register({
      email: 'test@merchant.com',
      password: 'password123',
      businessName: 'Test Business',
    });

    expect(result).toHaveProperty('accessToken', 'mock_jwt_token');
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it('should throw ConflictException if email is already registered', async () => {
    mockDb.where.mockResolvedValueOnce([{ id: 'm_1', email: 'test@merchant.com' }]);

    await expect(
      service.register({
        email: 'test@merchant.com',
        password: 'password123',
        businessName: 'Test Business',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw UnauthorizedException on invalid login credentials', async () => {
    mockDb.where.mockResolvedValueOnce([]);

    await expect(
      service.login({
        email: 'nonexistent@merchant.com',
        password: 'password123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
