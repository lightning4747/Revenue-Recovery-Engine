import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../../database/database.provider';
import { MerchantService } from '../../merchant/merchant.service';
import { OpportunityStateMachineService } from '../../recovery/state/opportunity-state-machine.service';
import { RazorpayApiClientService } from '../client/razorpay-api-client.service';
import { PaymentLinkActionService } from './payment-link-action.service';

describe('PaymentLinkActionService', () => {
  let service: PaymentLinkActionService;
  let mockDb: any;
  let mockMerchantService: any;
  let mockRazorpayApiClient: any;
  let mockStateMachine: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      update: jest.fn(),
    };
    mockMerchantService = {
      getDecryptedCredentials: jest.fn().mockResolvedValue({
        keyId: 'rzp_test_123',
        keySecret: 'secret_456',
      }),
    };
    mockRazorpayApiClient = {
      createPaymentLink: jest.fn().mockResolvedValue({
        id: 'plink_777666',
        reference_id: 'opp_12345678_att_1',
        short_url: 'https://rzp.io/i/testlink123',
      }),
    };
    mockStateMachine = {
      transitionState: jest.fn().mockResolvedValue({
        id: 'opp_12345678',
        status: 'ACTION_DISPATCHED',
        lastPaymentLinkId: 'plink_777666',
        lastPaymentLinkUrl: 'https://rzp.io/i/testlink123',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentLinkActionService,
        { provide: DRIZZLE_DB, useValue: mockDb },
        { provide: MerchantService, useValue: mockMerchantService },
        { provide: RazorpayApiClientService, useValue: mockRazorpayApiClient },
        { provide: OpportunityStateMachineService, useValue: mockStateMachine },
      ],
    }).compile();

    service = module.get<PaymentLinkActionService>(PaymentLinkActionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create payment link, persist short_url, and transition state to ACTION_DISPATCHED', async () => {
    const mockPrioritizedOpp = {
      id: 'opp_12345678',
      merchantId: 'mer_100',
      amount: 250000,
      attemptCount: 0,
      currency: 'INR',
      status: 'PRIORITIZED',
      originalTransactionId: 'pay_fail_111',
      originalOrderId: 'order_111',
    };

    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([mockPrioritizedOpp]),
      }),
    });

    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });

    const result = await service.executePaymentLinkAction('opp_12345678');

    expect(result?.status).toBe('ACTION_DISPATCHED');
    expect(mockRazorpayApiClient.createPaymentLink).toHaveBeenCalledWith(
      { keyId: 'rzp_test_123', keySecret: 'secret_456' },
      expect.objectContaining({
        amount: 250000,
        reference_id: 'opp_12345678_att_1',
        notes: expect.objectContaining({
          opportunity_id: 'opp_12345678',
          original_order_id: 'order_111',
        }),
      }),
    );
    expect(mockStateMachine.transitionState).toHaveBeenCalledWith(
      'opp_12345678',
      'ACTION_DISPATCHED',
      expect.stringContaining('PAYMENT_LINK_DISPATCHED_REF_'),
      expect.objectContaining({
        paymentLinkId: 'plink_777666',
        paymentLinkUrl: 'https://rzp.io/i/testlink123',
      }),
    );
  });
});
