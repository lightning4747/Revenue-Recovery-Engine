import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RazorpayWebhookController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

describe('RazorpayWebhookController', () => {
  let controller: RazorpayWebhookController;
  let mockWebhooksService: any;

  beforeEach(async () => {
    mockWebhooksService = {
      handleWebhook: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RazorpayWebhookController],
      providers: [
        { provide: WebhooksService, useValue: mockWebhooksService },
      ],
    }).compile();

    controller = module.get<RazorpayWebhookController>(RazorpayWebhookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should throw BadRequestException if rawBody is missing or empty', async () => {
    await expect(
      controller.receiveWebhook('mer_123', undefined, 'sig_123'),
    ).rejects.toThrow('Raw request body is required');

    await expect(
      controller.receiveWebhook('mer_123', Buffer.from([]), 'sig_123'),
    ).rejects.toThrow('Raw request body is required');
  });

  it('should throw BadRequestException if X-Razorpay-Signature is missing', async () => {
    const rawBody = Buffer.from('{"test": true}', 'utf8');
    await expect(
      controller.receiveWebhook('mer_123', rawBody, undefined),
    ).rejects.toThrow('Missing X-Razorpay-Signature header');
  });

  it('should call WebhooksService.handleWebhook and return response', async () => {
    const rawBody = Buffer.from('{"event": "payment.failed"}', 'utf8');
    const signature = 'sig_test_123';
    const eventIdHeader = 'evt_header_456';
    const expectedResult = {
      status: 'persisted' as const,
      duplicate: false,
      id: '550e8400-e29b-41d4-a716-446655440000',
    };

    mockWebhooksService.handleWebhook.mockResolvedValue(expectedResult);

    const result = await controller.receiveWebhook(
      'mer_123',
      rawBody,
      signature,
      eventIdHeader,
    );

    expect(mockWebhooksService.handleWebhook).toHaveBeenCalledWith(
      'mer_123',
      rawBody,
      signature,
      eventIdHeader,
    );
    expect(result).toEqual(expectedResult);
  });
});
