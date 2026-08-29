import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../../database/database.provider';
import { OpportunityStateMachineService } from '../state/opportunity-state-machine.service';
import { LedgerTransactionService } from './ledger-transaction.service';

describe('LedgerTransactionService', () => {
  let service: LedgerTransactionService;
  let mockDb: any;
  let mockStateMachine: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };
    mockStateMachine = {
      transitionState: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerTransactionService,
        { provide: DRIZZLE_DB, useValue: mockDb },
        { provide: OpportunityStateMachineService, useValue: mockStateMachine },
      ],
    }).compile();

    service = module.get<LedgerTransactionService>(LedgerTransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should process partial payment, update ledger, and transition status to PARTIALLY_RECOVERED', async () => {
    const mockOpp = {
      id: 'opp_1000',
      merchantId: 'm_100',
      amount: 1000000, // ₹10,000 in paise
      recoveredAmount: 0,
      remainingAmount: 1000000,
      status: 'ACTION_DISPATCHED',
    };

    // First select: payment idempotency check -> return empty array (no duplicate)
    // Second select: fetch opportunity -> return [mockOpp]
    let selectCallCount = 0;
    mockDb.select.mockImplementation(() => ({
      from: () => ({
        where: jest.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return Promise.resolve([]); // No existing payment
          return Promise.resolve([mockOpp]); // Opportunity found
        }),
      }),
    }));

    mockDb.insert.mockReturnValue({
      values: jest.fn().mockResolvedValue([]),
    });

    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });

    mockStateMachine.transitionState.mockResolvedValue({
      ...mockOpp,
      recoveredAmount: 200000,
      remainingAmount: 800000,
      status: 'PARTIALLY_RECOVERED',
    });

    const result = await service.processPaymentLedger({
      merchantId: 'm_100',
      opportunityId: 'opp_1000',
      paymentLinkId: 'plink_111',
      razorpayPaymentId: 'pay_999888',
      capturedAmountPaise: 200000, // ₹2,000 partial payment
    });

    expect(result.isDuplicate).toBe(false);
    expect(result.opportunity?.status).toBe('PARTIALLY_RECOVERED');
    expect(mockStateMachine.transitionState).toHaveBeenCalledWith(
      'opp_1000',
      'PARTIALLY_RECOVERED',
      expect.stringContaining('PAYMENT_VERIFIED_CAPTURED_200000_PAISE'),
      expect.objectContaining({
        razorpayPaymentId: 'pay_999888',
        capturedAmountPaise: 200000,
        newRecoveredAmount: 200000,
        newRemainingAmount: 800000,
      }),
    );
  });

  it('should skip ledger update if razorpayPaymentId is duplicate (Payment Idempotency)', async () => {
    const mockExistingPayment = {
      id: 'pay_rec_1',
      merchantId: 'm_100',
      razorpayPaymentId: 'pay_999888',
    };

    mockDb.select.mockReturnValue({
      from: () => ({
        where: jest.fn().mockResolvedValue([mockExistingPayment]),
      }),
    });

    const result = await service.processPaymentLedger({
      merchantId: 'm_100',
      opportunityId: 'opp_1000',
      razorpayPaymentId: 'pay_999888',
      capturedAmountPaise: 200000,
    });

    expect(result.isDuplicate).toBe(true);
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockStateMachine.transitionState).not.toHaveBeenCalled();
  });
});
