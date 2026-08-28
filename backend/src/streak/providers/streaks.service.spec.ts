import { Test, TestingModule } from '@nestjs/testing';
import { StreaksService } from './streaks.service';
import { UpdateStreakProvider } from './update-streak.provider';
import { Streak } from '../entities/streak.entity';

describe('StreaksService', () => {
  let service: StreaksService;
  let updateStreakProvider: {
    getStreak: jest.Mock;
    updateStreak: jest.Mock;
  };

  const streak = {
    id: 1,
    userId: 42,
    currentStreak: 3,
    longestStreak: 5,
    lastActivityDate: '2026-08-28',
    streakDates: ['2026-08-26', '2026-08-27', '2026-08-28'],
  } as Streak;

  beforeEach(async () => {
    updateStreakProvider = {
      getStreak: jest.fn(),
      updateStreak: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreaksService,
        { provide: UpdateStreakProvider, useValue: updateStreakProvider },
      ],
    }).compile();

    service = module.get(StreaksService);
  });

  it('delegates getStreak to UpdateStreakProvider', async () => {
    updateStreakProvider.getStreak.mockResolvedValue(streak);

    const result = await service.getStreak('42');

    expect(updateStreakProvider.getStreak).toHaveBeenCalledWith('42');
    expect(result).toBe(streak);
  });

  it('delegates updateStreak with userId and timezone', async () => {
    updateStreakProvider.updateStreak.mockResolvedValue(streak);

    const result = await service.updateStreak('42', 'America/New_York');

    expect(updateStreakProvider.updateStreak).toHaveBeenCalledWith(
      '42',
      'America/New_York',
    );
    expect(result).toBe(streak);
  });
});
