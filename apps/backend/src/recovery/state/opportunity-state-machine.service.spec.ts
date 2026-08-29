import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../../database/database.provider';
import { OpportunityStateMachineService } from './opportunity-state-machine.service';
import {
  InvalidStateTransitionException,
  StateTransitionMatrix,
} from './state-transition.matrix';

describe('StateTransitionMatrix', () => {
  it('should allow valid transitions', () => {
    expect(StateTransitionMatrix.isValidTransition('OBSERVED', 'DIAGNOSED')).toBe(true);
    expect(StateTransitionMatrix.isValidTransition('DIAGNOSED', 'VALUED')).toBe(true);
    expect(StateTransitionMatrix.isValidTransition('VALUED', 'PRIORITIZED')).toBe(true);
    expect(StateTransitionMatrix.isValidTransition('PRIORITIZED', 'ACTION_DISPATCHED')).toBe(true);
    expect(StateTransitionMatrix.isValidTransition('PRIORITIZED', 'POLICY_BLOCKED')).toBe(true);
    expect(StateTransitionMatrix.isValidTransition('ACTION_DISPATCHED', 'RECOVERED')).toBe(true);
  });

  it('should block illegal transitions', () => {
    expect(StateTransitionMatrix.isValidTransition('OBSERVED', 'RECOVERED')).toBe(false);
    expect(StateTransitionMatrix.isValidTransition('OBSERVED', 'ACTION_DISPATCHED')).toBe(false);
    expect(StateTransitionMatrix.isValidTransition('VALUED', 'RECOVERED')).toBe(false);
    expect(StateTransitionMatrix.isValidTransition('RECOVERED', 'OBSERVED')).toBe(false);
  });
});

describe('OpportunityStateMachineService', () => {
  let service: OpportunityStateMachineService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpportunityStateMachineService,
        { provide: DRIZZLE_DB, useValue: mockDb },
      ],
    }).compile();

    service = module.get<OpportunityStateMachineService>(
      OpportunityStateMachineService,
    );
  });

  it('should transition valid state and record audit log', async () => {
    const mockValuedOpp = {
      id: 'opp_100',
      merchantId: 'mer_100',
      status: 'VALUED',
    };

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([mockValuedOpp]),
      }),
    });

    const mockPrioritizedOpp = {
      ...mockValuedOpp,
      status: 'PRIORITIZED',
    };

    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockPrioritizedOpp]),
        }),
      }),
    });

    mockDb.insert.mockReturnValue({
      values: jest.fn().mockResolvedValue([]),
    });

    const result = await service.transitionState('opp_100', 'PRIORITIZED', 'RANKING_COMPLETE');

    expect(result?.status).toBe('PRIORITIZED');
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('should throw InvalidStateTransitionException for illegal transition', async () => {
    const mockObservedOpp = {
      id: 'opp_100',
      merchantId: 'mer_100',
      status: 'OBSERVED',
    };

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([mockObservedOpp]),
      }),
    });

    await expect(
      service.transitionState('opp_100', 'RECOVERED', 'ILLEGAL_DIRECT_RECOVERY'),
    ).rejects.toThrow(InvalidStateTransitionException);
  });
});
