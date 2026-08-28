import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetTodaysDailyQuestProvider } from './getTodaysDailyQuest.provider';
import { DailyQuest } from '../entities/daily-quest.entity';
import { DailyQuestPuzzle } from '../entities/daily-quest-puzzle.entity';
import { Puzzle } from '../../puzzles/entities/puzzle.entity';
import { Category } from '../../categories/entities/category.entity';
import { UserProgress } from '../../progress/entities/progress.entity';
import { User } from '../../users/user.entity';
import { PuzzleDifficulty } from '../../puzzles/enums/puzzle-difficulty.enum';
import { ChallengeLevel } from '../../users/enums/challengeLevel.enum';
import { getDateString } from '../../shared/utils/date.util';

jest.mock('../../shared/utils/date.util', () => ({
  getDateString: jest.fn(),
}));

const TODAY = '2026-08-28';
const USER_ID = 'user-1';
const TIMEZONE = 'America/New_York';

function makePuzzle(overrides?: Partial<Puzzle>): Puzzle {
  return {
    id: 'puzzle-1',
    question: 'Q?',
    options: ['a', 'b'],
    correctAnswer: 'a',
    points: 10,
    timeLimit: 60,
    difficulty: PuzzleDifficulty.BEGINNER,
    categoryId: 'cat-1',
    category: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    progressRecords: [],
    ...overrides,
  };
}

function makeQuestPuzzle(
  orderIndex: number,
  puzzle: Puzzle,
): DailyQuestPuzzle {
  return {
    id: orderIndex + 1,
    dailyQuestId: 1,
    puzzleId: puzzle.id,
    orderIndex,
    puzzle,
    dailyQuest: null as any,
  };
}

function makeDailyQuest(overrides?: Partial<DailyQuest>): DailyQuest {
  const puzzles = [
    makePuzzle({ id: 'puzzle-1' }),
    makePuzzle({ id: 'puzzle-2' }),
  ];
  return {
    id: 1,
    userId: USER_ID,
    questDate: TODAY,
    totalQuestions: 2,
    completedQuestions: 0,
    isCompleted: false,
    pointsEarned: 0,
    createdAt: new Date('2026-08-28T00:00:00Z'),
    completedAt: undefined,
    user: null as any,
    questPuzzles: puzzles.map((p, i) => makeQuestPuzzle(i, p)),
    progressRecords: [],
    ...overrides,
  };
}

describe('GetTodaysDailyQuestProvider', () => {
  let provider: GetTodaysDailyQuestProvider;
  let dailyQuestRepo: jest.Mocked<Repository<DailyQuest>>;
  let dailyQuestPuzzleRepo: jest.Mocked<Repository<DailyQuestPuzzle>>;
  let puzzleRepo: jest.Mocked<Repository<Puzzle>>;
  let categoryRepo: jest.Mocked<Repository<Category>>;
  let userProgressRepo: jest.Mocked<Repository<UserProgress>>;
  let userRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    (getDateString as jest.Mock).mockReturnValue(TODAY);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTodaysDailyQuestProvider,
        {
          provide: getRepositoryToken(DailyQuest),
          useValue: { findOne: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(DailyQuestPuzzle),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Puzzle),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(UserProgress),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    provider = module.get(GetTodaysDailyQuestProvider);
    dailyQuestRepo = module.get(getRepositoryToken(DailyQuest));
    dailyQuestPuzzleRepo = module.get(getRepositoryToken(DailyQuestPuzzle));
    puzzleRepo = module.get(getRepositoryToken(Puzzle));
    categoryRepo = module.get(getRepositoryToken(Category));
    userProgressRepo = module.get(getRepositoryToken(UserProgress));
    userRepo = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('looks up today\'s quest with a timezone-derived day key and reuses it', async () => {
    const existing = makeDailyQuest();
    dailyQuestRepo.findOne.mockResolvedValue(existing);
    userProgressRepo.find.mockResolvedValue([]);

    const result = await provider.execute(USER_ID, TIMEZONE);

    expect(getDateString).toHaveBeenCalledWith(TIMEZONE, 0);
    expect(dailyQuestRepo.findOne).toHaveBeenCalledWith({
      where: { userId: USER_ID, questDate: TODAY },
      relations: ['questPuzzles', 'questPuzzles.puzzle'],
    });
    expect(userRepo.findOne).not.toHaveBeenCalled();
    expect(dailyQuestRepo.save).not.toHaveBeenCalled();
    expect(result.id).toBe(1);
    expect(result.questDate).toBe(TODAY);
    expect(result.puzzles).toHaveLength(2);
    expect(result.puzzles[0].isCompleted).toBe(false);
  });

  it('marks puzzles completed from user-progress rows for this quest', async () => {
    const existing = makeDailyQuest();
    dailyQuestRepo.findOne.mockResolvedValue(existing);
    userProgressRepo.find.mockResolvedValue([
      { puzzleId: 'puzzle-1' } as UserProgress,
    ]);

    const result = await provider.execute(USER_ID, TIMEZONE);

    expect(userProgressRepo.find).toHaveBeenCalledWith({
      where: { dailyQuestId: 1 },
      select: ['puzzleId'],
    });
    expect(result.puzzles.find((p) => p.id === 'puzzle-1')?.isCompleted).toBe(
      true,
    );
    expect(result.puzzles.find((p) => p.id === 'puzzle-2')?.isCompleted).toBe(
      false,
    );
  });

  it('generates a new quest keyed to today when none exists', async () => {
    const puzzles = Array.from({ length: 10 }, (_, i) =>
      makePuzzle({ id: `puzzle-${i}` }),
    );
    const savedQuest = makeDailyQuest({
      totalQuestions: 10,
      questPuzzles: puzzles.map((p, i) => makeQuestPuzzle(i, p)),
    });

    dailyQuestRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(savedQuest);
    userRepo.findOne.mockResolvedValue({
      id: USER_ID,
      challengeLevel: ChallengeLevel.BEGINNER,
    } as unknown as User);
    categoryRepo.find.mockResolvedValue([
      { id: 'cat-1', isActive: true } as Category,
    ]);
    puzzleRepo.find.mockResolvedValue(puzzles);
    (dailyQuestRepo.create as jest.Mock).mockImplementation((payload) => payload);
    dailyQuestRepo.save.mockResolvedValue({ ...savedQuest, id: 1 });
    (dailyQuestPuzzleRepo.create as jest.Mock).mockImplementation(
      (payload) => payload,
    );
    dailyQuestPuzzleRepo.save.mockResolvedValue([] as any);
    userProgressRepo.find.mockResolvedValue([]);

    const result = await provider.execute(USER_ID, TIMEZONE);

    expect(dailyQuestRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        questDate: TODAY,
        totalQuestions: 10,
        completedQuestions: 0,
        isCompleted: false,
        pointsEarned: 0,
      }),
    );
    expect(puzzleRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({
        difficulty: PuzzleDifficulty.BEGINNER,
      }),
    });
    expect(dailyQuestPuzzleRepo.save).toHaveBeenCalled();
    expect(result.questDate).toBe(TODAY);
    expect(result.totalQuestions).toBe(10);
  });

  it('maps challengeLevel to the matching PuzzleDifficulty when generating', async () => {
    dailyQuestRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeDailyQuest());
    userRepo.findOne.mockResolvedValue({
      id: USER_ID,
      challengeLevel: ChallengeLevel.EXPERT,
    } as unknown as User);
    categoryRepo.find.mockResolvedValue([
      { id: 'cat-1', isActive: true } as Category,
    ]);
    puzzleRepo.find.mockResolvedValue([makePuzzle()]);
    (dailyQuestRepo.create as jest.Mock).mockImplementation((payload) => payload);
    dailyQuestRepo.save.mockResolvedValue(makeDailyQuest());
    (dailyQuestPuzzleRepo.create as jest.Mock).mockImplementation(
      (payload) => payload,
    );
    dailyQuestPuzzleRepo.save.mockResolvedValue([] as any);
    userProgressRepo.find.mockResolvedValue([]);

    await provider.execute(USER_ID, TIMEZONE);

    expect(puzzleRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({
        difficulty: PuzzleDifficulty.EXPERT,
      }),
    });
  });

  it('uses a different day key when the timezone date changes', async () => {
    (getDateString as jest.Mock).mockReturnValue('2026-08-29');
    dailyQuestRepo.findOne.mockResolvedValue(
      makeDailyQuest({ questDate: '2026-08-29' }),
    );
    userProgressRepo.find.mockResolvedValue([]);

    const result = await provider.execute(USER_ID, 'Pacific/Auckland');

    expect(getDateString).toHaveBeenCalledWith('Pacific/Auckland', 0);
    expect(dailyQuestRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, questDate: '2026-08-29' },
      }),
    );
    expect(result.questDate).toBe('2026-08-29');
  });

  it('throws when the user does not exist during generation', async () => {
    dailyQuestRepo.findOne.mockResolvedValue(null);
    userRepo.findOne.mockResolvedValue(null);

    await expect(provider.execute(USER_ID, TIMEZONE)).rejects.toThrow(
      `User with ID ${USER_ID} not found`,
    );
  });

  it('throws when there are no active categories', async () => {
    dailyQuestRepo.findOne.mockResolvedValue(null);
    userRepo.findOne.mockResolvedValue({
      id: USER_ID,
      challengeLevel: ChallengeLevel.BEGINNER,
    } as unknown as User);
    categoryRepo.find.mockResolvedValue([]);

    await expect(provider.execute(USER_ID, TIMEZONE)).rejects.toThrow(
      'No active categories available for quest generation',
    );
  });
});
