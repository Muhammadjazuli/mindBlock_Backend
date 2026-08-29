import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetTodaysDailyQuestStatusProvider } from './getTodaysDailyQuestStatus.provider';
import { GetTodaysDailyQuestProvider } from './getTodaysDailyQuest.provider';
import { DailyQuest } from '../entities/daily-quest.entity';
import { getDateString } from '../../shared/utils/date.util';

jest.mock('../../shared/utils/date.util', () => ({
  getDateString: jest.fn(),
}));

const TODAY = '2026-08-28';

describe('GetTodaysDailyQuestStatusProvider', () => {
  let provider: GetTodaysDailyQuestStatusProvider;
  let dailyQuestRepo: jest.Mocked<Repository<DailyQuest>>;
  let getTodaysDailyQuestProvider: { execute: jest.Mock };

  beforeEach(async () => {
    (getDateString as jest.Mock).mockReturnValue(TODAY);
    getTodaysDailyQuestProvider = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTodaysDailyQuestStatusProvider,
        {
          provide: getRepositoryToken(DailyQuest),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: GetTodaysDailyQuestProvider,
          useValue: getTodaysDailyQuestProvider,
        },
      ],
    }).compile();

    provider = module.get(GetTodaysDailyQuestStatusProvider);
    dailyQuestRepo = module.get(getRepositoryToken(DailyQuest));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns status for an existing quest without generating a new one', async () => {
    dailyQuestRepo.findOne.mockResolvedValue({
      id: 1,
      totalQuestions: 10,
      completedQuestions: 3,
      isCompleted: false,
    } as DailyQuest);

    const result = await provider.execute('user-1', 'UTC');

    expect(getDateString).toHaveBeenCalledWith('UTC', 0);
    expect(dailyQuestRepo.findOne).toHaveBeenCalledWith({
      where: { userId: 'user-1', questDate: TODAY },
      select: ['id', 'totalQuestions', 'completedQuestions', 'isCompleted'],
    });
    expect(getTodaysDailyQuestProvider.execute).not.toHaveBeenCalled();
    expect(result).toEqual({
      totalQuestions: 10,
      completedQuestions: 3,
      isCompleted: false,
    });
  });

  it('auto-generates today\'s quest when none exists, then returns its status', async () => {
    const generated = {
      id: 2,
      totalQuestions: 10,
      completedQuestions: 0,
      isCompleted: false,
    } as DailyQuest;
    dailyQuestRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(generated);
    getTodaysDailyQuestProvider.execute.mockResolvedValue({});

    const result = await provider.execute('user-1', 'UTC');

    expect(getTodaysDailyQuestProvider.execute).toHaveBeenCalledWith(
      'user-1',
      'UTC',
    );
    expect(result).toEqual({
      totalQuestions: 10,
      completedQuestions: 0,
      isCompleted: false,
    });
  });

  it('throws when generation fails to persist a quest row', async () => {
    dailyQuestRepo.findOne.mockResolvedValue(null);
    getTodaysDailyQuestProvider.execute.mockResolvedValue({});

    await expect(provider.execute('user-1', 'UTC')).rejects.toThrow(
      'Failed to retrieve created daily quest for user user-1',
    );
  });
});
