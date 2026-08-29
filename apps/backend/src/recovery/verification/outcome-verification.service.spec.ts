import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../../database/database.provider';
import { OpportunityStateMachineService } from '../state/opportunity-state-machine.service';
import { LedgerTransactionService } from './ledger-transaction.service';
import { OutcomeVerificationService } from './outcome-verification.service';

describe('OutcomeVerificationService', () => {
  let service: OutcomeVerificationService;
  let mockDb: any;
  let mockLedgerService: any;
  let mockStateMachine: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
    };
    mockLedgerService = {
      processPaymentLedger: jest.fn(),
    };
    mockStateMachine = {
      transitionState: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutcomeVerificationService,
        { provide: DRIZZLE_DB, useValue: mockDb },
        { provide: LedgerTransactionService, useValue: mockLedgerService },
        { provide: OpportunityStateMachineService, useValue: mockStateMachine },
      ],
    }).compile();

    service = module.get<OutcomeVerificationService>(OutcomeVerificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should process payment_link.partially_paid event and delegate to LedgerTransactionService', async () => {
    const mockOpp = { id: 'opp_123', merchantId: 'm_100' };
    mockDb.select.mockReturnValue({
      from: () => ({
        where: jest.fn().mockResolvedValue([mockOpp]),
      }),
    });

    mockLedgerService.processPaymentLedger.mockResolvedValue({
      opportunity: { ...mockOpp, status: 'PARTIALLY_RECOVERED' },
      isDuplicate: false,
    });

    const payload = {
      payment_link: {
        entity: {
          id: 'plink_001',
          reference_id: 'opp_123_att_1',
          notes: { opportunity_id: 'opp_123' },
        },
      },
      payment: {
        entity: {
          id: 'pay_999',
          amount: 200000,
        },
      },
    };

    const result = await service.processPaymentLinkEvent('m_100', 'payment_link.partially_paid', payload);

    expect(result.success).toBe(true);
    expect(result.opportunityId).toBe('opp_123');
    expect(mockLedgerService.processPaymentLedger).toHaveBeenCalledWith({
      merchantId: 'm_100',
      opportunityId: 'opp_123',
      paymentLinkId: 'plink_001',
      razorpayPaymentId: 'pay_999',
      capturedAmountPaise: 200000,
    });
  });

  it('should process payment_link.expired event and transition status to EXPIRED', async () => {
    const mockOpp = { id: 'opp_123', merchantId: 'm_100' };
    mockDb.select.mockReturnValue({
      from: () => ({
        where: jest.fn().mockResolvedValue([mockOpp]),
      }),
    });

    const payload = {
      payment_link: {
        entity: {
          id: 'plink_001',
          reference_id: 'opp_123_att_1',
        },
      },
    };

    const result = await service.processPaymentLinkEvent('m_100', 'payment_link.expired', payload);

    expect(result.success).toBe(true);
    expect(mockStateMachine.transitionState).toHaveBeenCalledWith(
      'opp_123',
      'EXPIRED',
      'LINK_PAYMENT_LINK_EXPIRED',
    );
  });
});
