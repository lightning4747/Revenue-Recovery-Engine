import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { RazorpayApiClientService } from './razorpay-api-client.service';

describe('RazorpayApiClientService', () => {
  let service: RazorpayApiClientService;
  let mockHttpService: any;

  beforeEach(async () => {
    mockHttpService = {
      post: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RazorpayApiClientService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<RazorpayApiClientService>(RazorpayApiClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send authenticated POST /v1/payment_links request and return PaymentLinkResponse', async () => {
    const mockCredentials = {
      keyId: 'rzp_test_123',
      keySecret: 'secret_456',
    };

    const mockPayload = {
      amount: 250000,
      currency: 'INR',
      accept_partial: true,
      reference_id: 'opp_12345_att_1',
      notes: { opportunity_id: 'opp_12345' },
    };

    const mockApiResponse = {
      data: {
        id: 'plink_999888',
        entity: 'payment_link',
        amount: 250000,
        currency: 'INR',
        status: 'created',
        reference_id: 'opp_12345_att_1',
        short_url: 'https://rzp.io/i/testlink',
      },
    };

    mockHttpService.post.mockReturnValue(of(mockApiResponse));

    const result = await service.createPaymentLink(mockCredentials, mockPayload);

    expect(result).toEqual(mockApiResponse.data);
    expect(mockHttpService.post).toHaveBeenCalledWith(
      'https://api.razorpay.com/v1/payment_links',
      mockPayload,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Basic '),
        }),
      }),
    );
  });

  it('should handle API errors cleanly', async () => {
    const mockCredentials = { keyId: 'rzp_test_123', keySecret: 'secret_456' };
    const mockPayload = {
      amount: 250000,
      currency: 'INR',
      accept_partial: true,
      reference_id: 'opp_12345_att_1',
    };

    mockHttpService.post.mockReturnValue(
      throwError(() => ({
        response: {
          data: {
            error: { description: 'Invalid API credentials' },
          },
        },
      })),
    );

    await expect(
      service.createPaymentLink(mockCredentials, mockPayload),
    ).rejects.toThrow('RAZORPAY_API_ERROR: Invalid API credentials');
  });
});
