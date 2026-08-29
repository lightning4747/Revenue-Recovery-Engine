import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AiExplanationService } from './ai-explanation.service';

describe('AiExplanationService', () => {
  let service: AiExplanationService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue(undefined), // No API key configured
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiExplanationService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AiExplanationService>(AiExplanationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return deterministic fallback explanation when GEMINI_API_KEY is unconfigured', async () => {
    const explanation = await service.generateExplanation(
      'CUSTOMER_AUTH_TIMEOUT',
      'customer',
      'invalid_otp',
    );

    expect(explanation).toBe(
      'Payment failure classified as CUSTOMER_AUTH_TIMEOUT based on Razorpay error taxonomy (source: customer, reason: invalid_otp). Action authorized per merchant policy rules.',
    );
  });

  it('should execute fallback cleanly on timeout or error without crashing', async () => {
    const mockServiceWithTimeout = new AiExplanationService({
      get: () => 'fake_api_key',
    } as any);

    // Mock internal aiClient generateContent to simulate slow response (>3000ms)
    (mockServiceWithTimeout as any).aiClient = {
      models: {
        generateContent: jest
          .fn()
          .mockImplementation(
            () => new Promise((resolve) => setTimeout(resolve, 5000)),
          ),
      },
    };

    const startTime = Date.now();
    const explanation = await mockServiceWithTimeout.generateExplanation(
      'INSUFFICIENT_FUNDS',
      'bank',
      'insufficient_funds',
    );
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(4000); // Must complete within ~3000ms timeout window
    expect(explanation).toContain('Payment failure classified as INSUFFICIENT_FUNDS');
  });
});
