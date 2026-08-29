import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../../database/database.provider';
import { OpportunityStateMachineService } from '../state/opportunity-state-machine.service';
import { PolicyEngineService } from './policy-engine.service';

describe('PolicyEngineService', () => {
  let service: PolicyEngineService;
  let mockDb: any;
  let mockStateMachine: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
    };
    mockStateMachine = {
      transitionState: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyEngineService,
        { provide: DRIZZLE_DB, useValue: mockDb },
        { provide: OpportunityStateMachineService, useValue: mockStateMachine },
      ],
    }).compile();

    service = module.get<PolicyEngineService>(PolicyEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should approve policy and transition to ACTION_DISPATCHED for valid opportunity', async () => {
    const mockPrioritizedOpp = {
      id: 'opp_100',
      merchantId: 'mer_100',
      amount: 250000,
      attemptCount: 0,
      status: 'PRIORITIZED',
    };

    mockDb.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockPrioritizedOpp]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]), // Default policy used
        }),
      });

    const mockDispatchedOpp = {
      ...mockPrioritizedOpp,
      status: 'ACTION_DISPATCHED',
    };

    mockStateMachine.transitionState.mockResolvedValue(mockDispatchedOpp);

    const { opportunity, evaluation } = await service.evaluatePolicy('opp_100');

    expect(evaluation.approved).toBe(true);
    expect(opportunity?.status).toBe('ACTION_DISPATCHED');
    expect(mockStateMachine.transitionState).toHaveBeenCalledWith(
      'opp_100',
      'ACTION_DISPATCHED',
      expect.stringContaining('POLICY_RULES_PASSED'),
    );
  });

  it('should block policy and transition to POLICY_BLOCKED if amount < minRecoveryAmount', async () => {
    const mockLowAmountOpp = {
      id: 'opp_200',
      merchantId: 'mer_100',
      amount: 500, // ₹5 in paise (below ₹10 min)
      attemptCount: 0,
      status: 'PRIORITIZED',
    };

    mockDb.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockLowAmountOpp]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

    const mockBlockedOpp = {
      ...mockLowAmountOpp,
      status: 'POLICY_BLOCKED',
    };

    mockStateMachine.transitionState.mockResolvedValue(mockBlockedOpp);

    const { opportunity, evaluation } = await service.evaluatePolicy('opp_200');

    expect(evaluation.approved).toBe(false);
    expect(evaluation.reason).toContain('AMOUNT_BELOW_MINIMUM');
    expect(opportunity?.status).toBe('POLICY_BLOCKED');
    expect(mockStateMachine.transitionState).toHaveBeenCalledWith(
      'opp_200',
      'POLICY_BLOCKED',
      expect.stringContaining('AMOUNT_BELOW_MINIMUM'),
    );
  });

  it('should block policy and transition to POLICY_BLOCKED if attemptCount >= maxRetryCount', async () => {
    const mockMaxRetriesOpp = {
      id: 'opp_300',
      merchantId: 'mer_100',
      amount: 250000,
      attemptCount: 3, // Exhausted max retries (3)
      status: 'PRIORITIZED',
    };

    mockDb.select
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([mockMaxRetriesOpp]),
        }),
      })
      .mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

    const mockBlockedOpp = {
      ...mockMaxRetriesOpp,
      status: 'POLICY_BLOCKED',
    };

    mockStateMachine.transitionState.mockResolvedValue(mockBlockedOpp);

    const { opportunity, evaluation } = await service.evaluatePolicy('opp_300');

    expect(evaluation.approved).toBe(false);
    expect(evaluation.reason).toContain('MAX_RETRIES_EXCEEDED');
    expect(opportunity?.status).toBe('POLICY_BLOCKED');
  });
});
