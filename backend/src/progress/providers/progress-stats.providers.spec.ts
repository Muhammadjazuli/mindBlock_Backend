import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetOverallStatsProvider } from './get-overall-stats.provider';
import { GetCategoryStatsProvider } from './get-category-stats.provider';
import { GetProgressHistoryProvider } from './get-progress-history.provider';
import { UserProgress } from '../entities/progress.entity';

function makeProgress(overrides?: Partial<UserProgress>): UserProgress {
  return {
    id: 1,
    userId: 'user-1',
    puzzleId: 'puzzle-1',
    categoryId: 'cat-1',
    isCorrect: true,
    pointsEarned: 10,
    timeSpent: 20,
    attemptedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  } as UserProgress;
}

describe('GetOverallStatsProvider', () => {
  let provider: GetOverallStatsProvider;
  let progressRepo: jest.Mocked<Repository<UserProgress>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetOverallStatsProvider,
        { provide: getRepositoryToken(UserProgress), useValue: { find: jest.fn() } },
      ],
    }).compile();
    provider = module.get(GetOverallStatsProvider);
    progressRepo = module.get(getRepositoryToken(UserProgress));
  });

  afterEach(() => jest.clearAllMocks());

  it('returns zeroed stats when the user has no progress', async () => {
    progressRepo.find.mockResolvedValue([]);

    await expect(provider.getOverallStats('user-1')).resolves.toEqual({
      totalAttempts: 0,
      totalCorrect: 0,
      accuracy: 0,
      totalPointsEarned: 0,
      totalTimeSpent: 0,
    });
  });

  it('aggregates attempts and rounds accuracy to an integer percent', async () => {
    progressRepo.find.mockResolvedValue([
      makeProgress({ isCorrect: true, pointsEarned: 10, timeSpent: 15 }),
      makeProgress({ isCorrect: true, pointsEarned: 25, timeSpent: 20 }),
      makeProgress({ isCorrect: false, pointsEarned: 0, timeSpent: 40 }),
    ]);

    const stats = await provider.getOverallStats('user-1');

    expect(progressRepo.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(stats).toEqual({
      totalAttempts: 3,
      totalCorrect: 2,
      accuracy: 67,
      totalPointsEarned: 35,
      totalTimeSpent: 75,
    });
  });
});

describe('GetCategoryStatsProvider', () => {
  let provider: GetCategoryStatsProvider;
  let progressRepo: jest.Mocked<Repository<UserProgress>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetCategoryStatsProvider,
        { provide: getRepositoryToken(UserProgress), useValue: { find: jest.fn() } },
      ],
    }).compile();
    provider = module.get(GetCategoryStatsProvider);
    progressRepo = module.get(getRepositoryToken(UserProgress));
  });

  afterEach(() => jest.clearAllMocks());

  it('returns an empty category name and zeros when there are no records', async () => {
    progressRepo.find.mockResolvedValue([]);

    await expect(provider.getCategoryStats('user-1', 'cat-1')).resolves.toEqual({
      categoryId: 'cat-1',
      categoryName: '',
      totalAttempts: 0,
      correctAnswers: 0,
      accuracy: 0,
    });
  });

  it('computes per-category accuracy and name from the first record', async () => {
    progressRepo.find.mockResolvedValue([
      makeProgress({
        isCorrect: true,
        category: { name: 'Logic' } as UserProgress['category'],
      }),
      makeProgress({ isCorrect: false }),
    ]);

    const stats = await provider.getCategoryStats('user-1', 'cat-1');

    expect(progressRepo.find).toHaveBeenCalledWith({
      where: { userId: 'user-1', categoryId: 'cat-1' },
      relations: ['category'],
    });
    expect(stats).toEqual({
      categoryId: 'cat-1',
      categoryName: 'Logic',
      totalAttempts: 2,
      correctAnswers: 1,
      accuracy: 50,
    });
  });
});

describe('GetProgressHistoryProvider', () => {
  let provider: GetProgressHistoryProvider;
  let progressRepo: jest.Mocked<Repository<UserProgress>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetProgressHistoryProvider,
        {
          provide: getRepositoryToken(UserProgress),
          useValue: { findAndCount: jest.fn() },
        },
      ],
    }).compile();
    provider = module.get(GetProgressHistoryProvider);
    progressRepo = module.get(getRepositoryToken(UserProgress));
  });

  afterEach(() => jest.clearAllMocks());

  it('returns paginated history ordered by attemptedAt DESC', async () => {
    const rows = [makeProgress()];
    progressRepo.findAndCount.mockResolvedValue([rows, 1]);

    const result = await provider.getProgressHistory('user-1', 2, 5);

    expect(progressRepo.findAndCount).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      relations: ['puzzle'],
      order: { attemptedAt: 'DESC' },
      skip: 5,
      take: 5,
    });
    expect(result).toEqual({
      data: rows,
      meta: { page: 2, limit: 5, total: 1 },
    });
  });

  it('defaults to page 1 and limit 10', async () => {
    progressRepo.findAndCount.mockResolvedValue([[], 0]);

    const result = await provider.getProgressHistory('user-1');

    expect(progressRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
    expect(result.meta).toEqual({ page: 1, limit: 10, total: 0 });
  });
});
