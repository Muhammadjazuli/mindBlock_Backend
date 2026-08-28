import { Test, TestingModule } from '@nestjs/testing';
import { DailyQuestService } from './daily-quest.service';
import { GetTodaysDailyQuestProvider } from './getTodaysDailyQuest.provider';
import { GetTodaysDailyQuestStatusProvider } from './getTodaysDailyQuestStatus.provider';
import { CompleteDailyQuestProvider } from './complete-daily-quest.provider';

describe('DailyQuestService', () => {
  let service: DailyQuestService;
  let getTodays: { execute: jest.Mock };
  let getStatus: { execute: jest.Mock };
  let complete: { execute: jest.Mock };

  beforeEach(async () => {
    getTodays = { execute: jest.fn() };
    getStatus = { execute: jest.fn() };
    complete = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyQuestService,
        { provide: GetTodaysDailyQuestProvider, useValue: getTodays },
        { provide: GetTodaysDailyQuestStatusProvider, useValue: getStatus },
        { provide: CompleteDailyQuestProvider, useValue: complete },
      ],
    }).compile();

    service = module.get(DailyQuestService);
  });

  it('delegates getTodaysDailyQuest', async () => {
    const payload = { id: 1, questDate: '2026-08-28' };
    getTodays.execute.mockResolvedValue(payload);

    const result = await service.getTodaysDailyQuest('user-1', 'UTC');

    expect(getTodays.execute).toHaveBeenCalledWith('user-1', 'UTC');
    expect(result).toBe(payload);
  });

  it('delegates getTodaysDailyQuestStatus', async () => {
    const payload = { totalQuestions: 10, completedQuestions: 0, isCompleted: false };
    getStatus.execute.mockResolvedValue(payload);

    const result = await service.getTodaysDailyQuestStatus('user-1', 'UTC');

    expect(getStatus.execute).toHaveBeenCalledWith('user-1', 'UTC');
    expect(result).toBe(payload);
  });

  it('delegates completeDailyQuest', async () => {
    const payload = { success: true };
    complete.execute.mockResolvedValue(payload);

    const result = await service.completeDailyQuest('user-1', 'UTC');

    expect(complete.execute).toHaveBeenCalledWith('user-1', 'UTC');
    expect(result).toBe(payload);
  });
});
