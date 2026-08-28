import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UpdateStreakProvider } from './update-streak.provider';
import { Streak } from '../entities/streak.entity';
import { getDateString } from '../../shared/utils/date.util';

jest.mock('../../shared/utils/date.util', () => ({
  getDateString: jest.fn(),
}));

const TODAY = '2026-08-28';
const YESTERDAY = '2026-08-27';
const TWO_DAYS_AGO = '2026-08-26';
const USER_ID = '42';
const TIMEZONE = 'UTC';

function makeStreak(overrides?: Partial<Streak>): Streak {
  return {
    id: 1,
    userId: 42,
    currentStreak: 3,
    longestStreak: 5,
    lastActivityDate: YESTERDAY,
    streakDates: [TWO_DAYS_AGO, YESTERDAY],
    updatedAt: new Date('2026-08-27T12:00:00Z'),
    user: null as any,
    ...overrides,
  };
}

describe('UpdateStreakProvider', () => {
  let provider: UpdateStreakProvider;
  let streakRepo: jest.Mocked<Repository<Streak>>;

  beforeEach(async () => {
    (getDateString as jest.Mock).mockImplementation(
      (_tz: string, offsetDays = 0) => {
        if (offsetDays === 0) return TODAY;
        if (offsetDays === -1) return YESTERDAY;
        return TODAY;
      },
    );

    const mockStreakRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateStreakProvider,
        {
          provide: getRepositoryToken(Streak),
          useValue: mockStreakRepo,
        },
      ],
    }).compile();

    provider = module.get(UpdateStreakProvider);
    streakRepo = module.get(getRepositoryToken(Streak));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateStreak', () => {
    it('creates a new streak at 1/1 for a first-time user', async () => {
      const created = makeStreak({
        id: undefined as any,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: TODAY,
        streakDates: [TODAY],
      });
      streakRepo.findOne.mockResolvedValue(null);
      streakRepo.create.mockReturnValue(created);
      streakRepo.save.mockResolvedValue({ ...created, id: 1 });

      const result = await provider.updateStreak(USER_ID, TIMEZONE);

      expect(getDateString).toHaveBeenCalledWith(TIMEZONE, 0);
      expect(streakRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 42 },
      });
      expect(streakRepo.create).toHaveBeenCalledWith({
        userId: 42,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: TODAY,
        streakDates: [TODAY],
      });
      expect(streakRepo.save).toHaveBeenCalledWith(created);
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
    });

    it('is idempotent: same-day repeat returns the existing streak without saving', async () => {
      const existing = makeStreak({
        lastActivityDate: TODAY,
        currentStreak: 4,
        longestStreak: 5,
        streakDates: [TWO_DAYS_AGO, YESTERDAY, TODAY],
      });
      streakRepo.findOne.mockResolvedValue(existing);

      const result = await provider.updateStreak(USER_ID, TIMEZONE);

      expect(result).toBe(existing);
      expect(result.currentStreak).toBe(4);
      expect(streakRepo.save).not.toHaveBeenCalled();
      expect(streakRepo.create).not.toHaveBeenCalled();
    });

    it('increments currentStreak when last activity was yesterday', async () => {
      const existing = makeStreak({
        lastActivityDate: YESTERDAY,
        currentStreak: 3,
        longestStreak: 5,
      });
      streakRepo.findOne.mockResolvedValue(existing);
      (streakRepo.save as jest.Mock).mockImplementation((row: Streak) =>
        Promise.resolve(row),
      );

      const result = await provider.updateStreak(USER_ID, TIMEZONE);

      expect(getDateString).toHaveBeenCalledWith(TIMEZONE, -1);
      expect(result.currentStreak).toBe(4);
      expect(result.longestStreak).toBe(5);
      expect(result.lastActivityDate).toBe(TODAY);
      expect(result.streakDates).toContain(TODAY);
      expect(streakRepo.save).toHaveBeenCalledWith(existing);
    });

    it('promotes longestStreak when the continued streak exceeds it', async () => {
      const existing = makeStreak({
        lastActivityDate: YESTERDAY,
        currentStreak: 5,
        longestStreak: 5,
      });
      streakRepo.findOne.mockResolvedValue(existing);
      (streakRepo.save as jest.Mock).mockImplementation((row: Streak) =>
        Promise.resolve(row),
      );

      const result = await provider.updateStreak(USER_ID, TIMEZONE);

      expect(result.currentStreak).toBe(6);
      expect(result.longestStreak).toBe(6);
    });

    it('resets currentStreak to 1 on a date-boundary gap (missed a day)', async () => {
      const existing = makeStreak({
        lastActivityDate: TWO_DAYS_AGO,
        currentStreak: 8,
        longestStreak: 8,
        streakDates: [TWO_DAYS_AGO],
      });
      streakRepo.findOne.mockResolvedValue(existing);
      (streakRepo.save as jest.Mock).mockImplementation((row: Streak) =>
        Promise.resolve(row),
      );

      const result = await provider.updateStreak(USER_ID, TIMEZONE);

      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(8);
      expect(result.lastActivityDate).toBe(TODAY);
      expect(result.streakDates).toEqual([TWO_DAYS_AGO, TODAY]);
    });

    it('does not duplicate today in streakDates when it is already recorded', async () => {
      const existing = makeStreak({
        lastActivityDate: YESTERDAY,
        currentStreak: 2,
        longestStreak: 2,
        streakDates: [YESTERDAY, TODAY],
      });
      streakRepo.findOne.mockResolvedValue(existing);
      (streakRepo.save as jest.Mock).mockImplementation((row: Streak) =>
        Promise.resolve(row),
      );

      const result = await provider.updateStreak(USER_ID, TIMEZONE);

      expect(result.streakDates.filter((d) => d === TODAY)).toHaveLength(1);
    });

    it('throws NotFoundException when userId is empty', async () => {
      await expect(provider.updateStreak('', TIMEZONE)).rejects.toThrow(
        NotFoundException,
      );
      expect(streakRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getStreak', () => {
    it('returns the streak row for the parsed numeric userId', async () => {
      const existing = makeStreak();
      streakRepo.findOne.mockResolvedValue(existing);

      const result = await provider.getStreak(USER_ID);

      expect(streakRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 42 },
      });
      expect(result).toBe(existing);
    });

    it('returns null when the user has no streak row', async () => {
      streakRepo.findOne.mockResolvedValue(null);

      await expect(provider.getStreak(USER_ID)).resolves.toBeNull();
    });
  });
});
