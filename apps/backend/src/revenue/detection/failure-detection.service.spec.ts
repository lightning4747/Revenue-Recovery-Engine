import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../../database/database.provider';
import { DiagnosisService } from '../diagnosis/diagnosis.service';
import { ValuationService } from '../valuation/valuation.service';
import { AiExplanationService } from '../ai/ai-explanation.service';
import { PrioritizationService } from '../../recovery/prioritization/prioritization.service';
import { PolicyEngineService } from '../../recovery/policy/policy-engine.service';
import { FailureDetectionService } from './failure-detection.service';

describe('FailureDetectionService', () => {
  let service: FailureDetectionService;
  let mockDb: any;
  let mockDiagnosisService: any;
  let mockValuationService: any;
  let mockAiExplanationService: any;
  let mockPrioritizationService: any;
  let mockPolicyEngineService: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
    };
    mockDiagnosisService = {
      diagnoseOpportunity: jest.fn().mockImplementation((id, details) =>
        Promise.resolve({
          id,
          status: 'DIAGNOSED',
          cause: 'CUSTOMER_AUTH_TIMEOUT',
          recoveryProbability: 0.75,
        }),
      ),
    };
    mockValuationService = {
      valueOpportunity: jest.fn().mockImplementation((id) =>
        Promise.resolve({
          id,
          status: 'VALUED',
          expectedRecoveryValue: 112500,
          interventionCost: 500,
        }),
      ),
    };
    mockAiExplanationService = {
      generateExplanation: jest.fn().mockResolvedValue('Explanation narrative'),
    };
    mockPrioritizationService = {
      prioritizeOpportunity: jest.fn().mockImplementation((id) =>
        Promise.resolve({
          id,
          status: 'PRIORITIZED',
          priorityScore: 112500,
        }),
      ),
    };
    mockPolicyEngineService = {
      evaluatePolicy: jest.fn().mockImplementation((id) =>
        Promise.resolve({
          opportunity: {
            id,
            status: 'ACTION_DISPATCHED',
            priorityScore: 112500,
          },
          evaluation: { approved: true, reason: 'POLICY_RULES_PASSED_OK' },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FailureDetectionService,
        { provide: DRIZZLE_DB, useValue: mockDb },
        { provide: DiagnosisService, useValue: mockDiagnosisService },
        { provide: ValuationService, useValue: mockValuationService },
        { provide: AiExplanationService, useValue: mockAiExplanationService },
        { provide: PrioritizationService, useValue: mockPrioritizationService },
        { provide: PolicyEngineService, useValue: mockPolicyEngineService },
      ],
    }).compile();

    service = module.get<FailureDetectionService>(FailureDetectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should process failed payment and create RecoveryOpportunity with status OBSERVED', async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]), // No existing duplicate opportunity
      }),
    });

    const mockCreatedOpp = {
      id: 'opp_12345678',
      merchantId: 'mer_100',
      sourceType: 'FAILED_PAYMENT',
      sourceId: 'pay_fail_999',
      originalTransactionId: 'pay_fail_999',
      originalOrderId: 'order_999',
      amount: 150000,
      recoveredAmount: 0,
      remainingAmount: 150000,
      currency: 'INR',
      status: 'OBSERVED',
    };

    const valuesFn = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([mockCreatedOpp]),
    });
    mockDb.insert.mockReturnValue({ values: valuesFn });

    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_fail_999',
            order_id: 'order_999',
            amount: 150000,
            currency: 'INR',
          },
        },
      },
    };

    const result = await service.processFailedPayment('mer_100', 'evt_1', payload);

    expect(result).toEqual({
      id: 'opp_12345678',
      status: 'ACTION_DISPATCHED',
      priorityScore: 112500,
    });
    expect(valuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'mer_100',
        sourceType: 'FAILED_PAYMENT',
        originalTransactionId: 'pay_fail_999',
        amount: 150000,
        status: 'OBSERVED',
      }),
    );
  });

  it('should skip creation and return existing opportunity if transaction already recorded', async () => {
    const existingOpp = {
      id: 'opp_existing_111',
      merchantId: 'mer_100',
      originalTransactionId: 'pay_duplicate_1',
      status: 'OBSERVED',
    };

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([existingOpp]),
      }),
    });

    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_duplicate_1',
            amount: 10000,
          },
        },
      },
    };

    const result = await service.processFailedPayment('mer_100', 'evt_1', payload);

    expect(result).toEqual(existingOpp);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
