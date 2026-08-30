import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../../database/database.provider';
import { OpportunityStateMachineService } from '../state/opportunity-state-machine.service';
import { PrioritizationService } from './prioritization.service';

describe('PrioritizationService', () => {
  let service: PrioritizationService;
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
        PrioritizationService,
        { provide: DRIZZLE_DB, useValue: mockDb },
        { provide: OpportunityStateMachineService, useValue: mockStateMachine },
      ],
    }).compile();

    service = module.get<PrioritizationService>(PrioritizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should compute priorityScore = ERV * urgencyMultiplier * customerLtvWeight and transition to PRIORITIZED', async () => {
    const mockValuedOpp = {
      id: 'opp_100',
      merchantId: 'mer_100',
      expectedRecoveryValue: 750000,
      status: 'VALUED',
    };

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([mockValuedOpp]),
      }),
    });

    const mockPrioritizedOpp = {
      ...mockValuedOpp,
      priorityScore: 750000,
      status: 'PRIORITIZED',
    };

    mockStateMachine.transitionState.mockResolvedValue(mockPrioritizedOpp);

    const result = await service.prioritizeOpportunity('opp_100', 1.0, 1.0);

    expect(result).toEqual(mockPrioritizedOpp);
    expect(mockStateMachine.transitionState).toHaveBeenCalledWith(
      'opp_100',
      'PRIORITIZED',
      'PRIORITIZATION_RANKING_COMPLETE',
      { priorityScore: 750000 },
    );
  });
});
