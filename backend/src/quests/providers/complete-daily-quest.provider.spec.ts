import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CompleteDailyQuestProvider } from './complete-daily-quest.provider';
import { DailyQuest } from '../entities/daily-quest.entity';
import { User } from '../../users/user.entity';
import { UpdateStreakProvider } from '../../streak/providers/update-streak.provider';
import { Streak } from '../../streak/entities/streak.entity';
import { getDateString } from '../../shared/utils/date.util';

jest.mock('../../shared/utils/date.util', () => ({
  getDateString: jest.fn(),
}));

const TODAY = '2026-08-28';
const USER_ID = 'user-1';
const TIMEZONE = 'UTC';

function makeQuest(overrides?: Partial<DailyQuest>): DailyQuest {
  return {
    id: 1,
    userId: USER_ID,
    questDate: TODAY,
    totalQuestions: 10,
    completedQuestions: 10,
    isCompleted: false,
    pointsEarned: 200,
    createdAt: new Date(),
    completedAt: undefined,
    user: null as any,
    questPuzzles: [],
    progressRecords: [],
    ...overrides,
  };
}

function makeStreak(overrides?: Partial<Streak>): Streak {
  return {
    id: 1,
    userId: 1,
    currentStreak: 4,
    longestStreak: 7,
    lastActivityDate: TODAY,
    streakDates: [TODAY],
    updatedAt: new Date(),
    user: null as any,
    ...overrides,
  };
}

describe('CompleteDailyQuestProvider', () => {
  let provider: CompleteDailyQuestProvider;
  let updateStreakProvider: {
    getStreak: jest.Mock;
    updateStreak: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    (getDateString as jest.Mock).mockReturnValue(TODAY);
    updateStreakProvider = {
      getStreak: jest.fn(),
      updateStreak: jest.fn(),
    };
    dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompleteDailyQuestProvider,
        { provide: UpdateStreakProvider, useValue: updateStreakProvider },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    provider = module.get(CompleteDailyQuestProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function mockTransaction(manager: {
    findOne: jest.Mock;
    save: jest.Mock;
  }) {
    dataSource.transaction.mockImplementation((cb: any) => cb(manager));
  }

  it('awards bonus XP, levels the user, and updates the streak on first completion', async () => {
    const quest = makeQuest();
    const user = { id: USER_ID, xp: 50, level: 1 } as User;
    const manager = {
      findOne: jest.fn((entity: unknown) => {
        if (entity === DailyQuest) return Promise.resolve(quest);
        if (entity === User) return Promise.resolve(user);
        return Promise.resolve(null);
      }),
      save: jest.fn((...args: any[]) => Promise.resolve(args[1])),
    };
    mockTransaction(manager);
    updateStreakProvider.updateStreak.mockResolvedValue(makeStreak());

    const result = await provider.execute(USER_ID, TIMEZONE);

    expect(getDateString).toHaveBeenCalledWith(TIMEZONE, 0);
    expect(quest.isCompleted).toBe(true);
    expect(quest.completedAt).toBeInstanceOf(Date);
    expect(quest.pointsEarned).toBe(300);
    expect(user.xp).toBe(150);
    expect(user.level).toBe(2);
    expect(updateStreakProvider.updateStreak).toHaveBeenCalledWith(
      USER_ID,
      TIMEZONE,
    );
    expect(result.success).toBe(true);
    expect(result.bonusXp).toBe(100);
    expect(result.totalXp).toBe(300);
    expect(result.streakInfo.currentStreak).toBe(4);
    expect(result.message).toMatch(/completed successfully/i);
  });

  it('is idempotent: already-completed quests skip XP and streak mutation', async () => {
    const completedAt = new Date('2026-08-28T12:00:00Z');
    const quest = makeQuest({
      isCompleted: true,
      completedAt,
      pointsEarned: 300,
    });
    const manager = {
      findOne: jest.fn(() => Promise.resolve(quest)),
      save: jest.fn(),
    };
    mockTransaction(manager);
    updateStreakProvider.getStreak.mockResolvedValue(makeStreak());

    const result = await provider.execute(USER_ID, TIMEZONE);

    expect(manager.save).not.toHaveBeenCalled();
    expect(updateStreakProvider.updateStreak).not.toHaveBeenCalled();
    expect(updateStreakProvider.getStreak).toHaveBeenCalledWith(USER_ID);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Daily quest already completed');
    expect(result.bonusXp).toBe(100);
    expect(result.totalXp).toBe(300);
    expect(result.completedAt).toBe(completedAt);
  });

  it('throws NotFoundException when today\'s quest does not exist', async () => {
    const manager = {
      findOne: jest.fn(() => Promise.resolve(null)),
      save: jest.fn(),
    };
    mockTransaction(manager);

    await expect(provider.execute(USER_ID, TIMEZONE)).rejects.toThrow(
      NotFoundException,
    );
    expect(updateStreakProvider.updateStreak).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when not every question is completed', async () => {
    const quest = makeQuest({ completedQuestions: 7, totalQuestions: 10 });
    const manager = {
      findOne: jest.fn(() => Promise.resolve(quest)),
      save: jest.fn(),
    };
    mockTransaction(manager);

    await expect(provider.execute(USER_ID, TIMEZONE)).rejects.toThrow(
      BadRequestException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the user row is missing during completion', async () => {
    const quest = makeQuest();
    const manager = {
      findOne: jest.fn((entity: unknown) => {
        if (entity === DailyQuest) return Promise.resolve(quest);
        return Promise.resolve(null);
      }),
      save: jest.fn((...args: any[]) => Promise.resolve(args[1])),
    };
    mockTransaction(manager);

    await expect(provider.execute(USER_ID, TIMEZONE)).rejects.toThrow(
      NotFoundException,
    );
  });
});
