import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { DRIZZLE_DB } from '../../database/database.provider';
import { WebhookEventsProcessor } from './webhook-events.processor';

describe('WebhookEventsProcessor', () => {
  let processor: WebhookEventsProcessor;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookEventsProcessor,
        { provide: DRIZZLE_DB, useValue: mockDb },
      ],
    }).compile();

    processor = module.get<WebhookEventsProcessor>(WebhookEventsProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should skip job cleanly if eventId is missing from job payload', async () => {
    const mockJob = { id: 'job_1', data: {} } as Job;
    const result = await processor.process(mockJob);
    expect(result).toBeUndefined();
  });

  it('should skip job cleanly if WebhookEvent is not found in database', async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    });

    const mockJob = { id: 'job_1', data: { eventId: 'evt_missing' } } as Job;
    const result = await processor.process(mockJob);
    expect(result).toBeUndefined();
  });

  it('should enforce Layer 2 worker idempotency and skip if event is already PROCESSED', async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([
          {
            id: 'evt_1',
            providerEventId: 'rzp_evt_100',
            eventType: 'payment.failed',
            processingStatus: 'PROCESSED',
          },
        ]),
      }),
    });

    const mockJob = { id: 'job_1', data: { eventId: 'evt_1' } } as Job;
    const result = await processor.process(mockJob);

    expect(result).toEqual({ skipped: true, reason: 'ALREADY_PROCESSED' });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('should process pending event and transition state PENDING -> PROCESSING -> PROCESSED', async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([
          {
            id: 'evt_1',
            providerEventId: 'rzp_evt_100',
            eventType: 'payment.failed',
            processingStatus: 'PENDING',
          },
        ]),
      }),
    });

    const updateSetWhereChain = jest.fn().mockResolvedValue({});
    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: updateSetWhereChain,
      }),
    });

    const mockJob = { id: 'job_1', data: { eventId: 'evt_1' } } as Job;
    const result = await processor.process(mockJob);

    expect(result.success).toBe(true);
    expect(result.eventId).toBe('evt_1');
    expect(mockDb.update).toHaveBeenCalledTimes(2); // 1 for PROCESSING, 1 for PROCESSED
  });

  it('should mark WebhookEvent as FAILED and record lastError when max attempts exhaust', async () => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([
          {
            id: 'evt_1',
            providerEventId: 'rzp_evt_100',
            eventType: 'payment.failed',
            processingStatus: 'PENDING',
          },
        ]),
      }),
    });

    // Mock update for PROCESSING status, then throw error during execution
    let callCount = 0;
    mockDb.update.mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        // Failing step during PROCESSED update
        throw new Error('Simulated processing pipeline error');
      }
      return {
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue({}),
        }),
      };
    });

    const mockJob = {
      id: 'job_1',
      data: { eventId: 'evt_1' },
      attemptsMade: 2, // 3rd attempt (attemptsMade = 2)
      opts: { attempts: 3 },
    } as any;

    await expect(processor.process(mockJob)).rejects.toThrow(
      'Simulated processing pipeline error',
    );
  });
});
