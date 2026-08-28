import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProgressCalculationProvider } from './progress-calculation.provider';
import { Puzzle } from '../../puzzles/entities/puzzle.entity';
import { UserProgress } from '../entities/progress.entity';
import { User } from '../../users/user.entity';
import { DailyQuest } from '../../quests/entities/daily-quest.entity';
import { XpLevelService } from '../../users/providers/xp-level.service';
import { ScoreService } from '../../score/providers/score.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { PuzzleDifficulty } from '../../puzzles/enums/puzzle-difficulty.enum';
import { SubmitAnswerDto } from '../dtos/submit-answer.dto';

function makePuzzle(overrides?: Partial<Puzzle>): Puzzle {
  return {
    id: 'puzzle-1',
    question: 'What is 2+2?',
    options: ['3', '4'],
    correctAnswer: '4',
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

describe('ProgressCalculationProvider', () => {
  let provider: ProgressCalculationProvider;
  let puzzleRepo: jest.Mocked<Repository<Puzzle>>;
  let progressRepo: jest.Mocked<Repository<UserProgress>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let dailyQuestRepo: jest.Mocked<Repository<DailyQuest>>;
  let xpLevelService: { addXp: jest.Mock };
  let idempotencyService: { execute: jest.Mock };

  beforeEach(async () => {
    xpLevelService = { addXp: jest.fn() };
    idempotencyService = {
      execute: jest.fn(async (_key: string, fn: () => Promise<unknown>) => ({
        duplicate: false,
        data: await fn(),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressCalculationProvider,
        ScoreService,
        { provide: XpLevelService, useValue: xpLevelService },
        { provide: IdempotencyService, useValue: idempotencyService },
        { provide: getRepositoryToken(Puzzle), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(UserProgress),
          useValue: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(DailyQuest),
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
      ],
    }).compile();

    provider = module.get(ProgressCalculationProvider);
    puzzleRepo = module.get(getRepositoryToken(Puzzle));
    progressRepo = module.get(getRepositoryToken(UserProgress));
    userRepo = module.get(getRepositoryToken(User));
    dailyQuestRepo = module.get(getRepositoryToken(DailyQuest));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAnswer', () => {
    it('trims whitespace and compares case-insensitively', () => {
      const result = provider.validateAnswer('  Four  ', 'FOUR');

      expect(result.isCorrect).toBe(true);
      expect(result.normalizedAnswer).toBe('four');
    });

    it('returns isCorrect=false for a mismatched answer', () => {
      const result = provider.validateAnswer('three', 'four');

      expect(result.isCorrect).toBe(false);
      expect(result.normalizedAnswer).toBe('three');
    });
  });

  describe('calculatePoints', () => {
    it('returns 0 for an incorrect answer', () => {
      expect(provider.calculatePoints(makePuzzle(), 10, false)).toBe(0);
    });

    it('applies a time bonus when the answer is under the limit', () => {
      // BEGINNER base 10, timeSpent 0, timeLimit 60 → 10 * (1 + 0.5) = 15
      expect(provider.calculatePoints(makePuzzle(), 0, true)).toBe(15);
    });

    it('awards only base points when timeSpent meets the limit', () => {
      expect(provider.calculatePoints(makePuzzle(), 60, true)).toBe(10);
    });

    it('uses difficulty-based base points for EXPERT', () => {
      const puzzle = makePuzzle({
        difficulty: PuzzleDifficulty.EXPERT,
        timeLimit: 30,
      });
      // EXPERT 100, no time bonus at timeSpent === timeLimit
      expect(provider.calculatePoints(puzzle, 30, true)).toBe(100);
    });
  });

  describe('processAnswerSubmission', () => {
    const dto: SubmitAnswerDto = {
      userId: 'user-1',
      puzzleId: 'puzzle-1',
      categoryId: 'cat-1',
      userAnswer: '4',
      timeSpent: 60,
    };

    it('throws NotFoundException when the puzzle does not exist', async () => {
      puzzleRepo.findOne.mockResolvedValue(null);

      await expect(provider.processAnswerSubmission(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('awards XP and records progress for a correct answer', async () => {
      const puzzle = makePuzzle();
      const progress = { id: 1, isCorrect: true, pointsEarned: 10 } as UserProgress;
      puzzleRepo.findOne.mockResolvedValue(puzzle);
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        streak: null,
      } as unknown as User);
      dailyQuestRepo.findOne.mockResolvedValue(null);
      progressRepo.create.mockReturnValue(progress);
      progressRepo.save.mockResolvedValue(progress);
      xpLevelService.addXp.mockResolvedValue({
        levelUp: false,
        currentLevel: 1,
        currentXp: 10,
        previousLevel: 1,
      });

      const result = await provider.processAnswerSubmission(dto);

      expect(result.validation.isCorrect).toBe(true);
      expect(result.validation.pointsEarned).toBe(10);
      expect(xpLevelService.addXp).toHaveBeenCalledWith('user-1', 10);
      expect(progressRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          puzzleId: 'puzzle-1',
          isCorrect: true,
          pointsEarned: 10,
        }),
      );
    });

    it('applies a 10% streak bonus at 3 days and 25% at 7 days', async () => {
      const puzzle = makePuzzle();
      puzzleRepo.findOne.mockResolvedValue(puzzle);
      dailyQuestRepo.findOne.mockResolvedValue(null);
      (progressRepo.create as jest.Mock).mockImplementation((row) => row);
      (progressRepo.save as jest.Mock).mockImplementation((row) =>
        Promise.resolve(row),
      );
      xpLevelService.addXp.mockResolvedValue({});

      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        streak: { currentStreak: 3 },
      } as unknown as User);
      const threeDay = await provider.processAnswerSubmission(dto);
      expect(threeDay.validation.pointsEarned).toBe(11); // round(10 * 1.1)

      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        streak: { currentStreak: 7 },
      } as unknown as User);
      const sevenDay = await provider.processAnswerSubmission(dto);
      expect(sevenDay.validation.pointsEarned).toBe(13); // round(10 * 1.25)
    });

    it('does not award XP for an incorrect answer', async () => {
      puzzleRepo.findOne.mockResolvedValue(makePuzzle());
      userRepo.findOne.mockResolvedValue({ id: 'user-1' } as unknown as User);
      dailyQuestRepo.findOne.mockResolvedValue(null);
      (progressRepo.create as jest.Mock).mockImplementation((row) => row);
      (progressRepo.save as jest.Mock).mockImplementation((row) =>
        Promise.resolve(row),
      );

      const result = await provider.processAnswerSubmission({
        ...dto,
        userAnswer: 'wrong',
      });

      expect(result.validation.isCorrect).toBe(false);
      expect(result.validation.pointsEarned).toBe(0);
      expect(xpLevelService.addXp).not.toHaveBeenCalled();
    });

    it('increments daily-quest progress for a correct quest puzzle', async () => {
      const quest = {
        id: 9,
        isCompleted: false,
        completedQuestions: 9,
        totalQuestions: 10,
        questPuzzles: [{ puzzleId: 'puzzle-1' }],
      } as DailyQuest;
      puzzleRepo.findOne.mockResolvedValue(makePuzzle());
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        streak: null,
      } as unknown as User);
      dailyQuestRepo.findOne.mockResolvedValue(quest);
      progressRepo.findOne.mockResolvedValue(null);
      (progressRepo.create as jest.Mock).mockImplementation((row) => row);
      (progressRepo.save as jest.Mock).mockImplementation((row) =>
        Promise.resolve(row),
      );
      dailyQuestRepo.save.mockResolvedValue(quest);
      xpLevelService.addXp.mockResolvedValue({});

      await provider.processAnswerSubmission(dto);

      expect(quest.completedQuestions).toBe(10);
      expect(quest.isCompleted).toBe(true);
      expect(xpLevelService.addXp).toHaveBeenCalledWith('user-1', 50);
      expect(dailyQuestRepo.save).toHaveBeenCalledWith(quest);
    });

    it('returns the cached result on a duplicate idempotency key without re-processing', async () => {
      const cached = {
        userProgress: { id: 1 } as UserProgress,
        validation: { isCorrect: true, pointsEarned: 10, normalizedAnswer: '4' },
      };
      idempotencyService.execute.mockResolvedValue({
        duplicate: true,
        data: cached,
      });

      const result = await provider.processAnswerSubmission({
        ...dto,
        idempotencyKey: 'client-key',
      });

      expect(result).toBe(cached);
      expect(puzzleRepo.findOne).not.toHaveBeenCalled();
      expect(xpLevelService.addXp).not.toHaveBeenCalled();
    });
  });

  describe('getUserProgressStats', () => {
    it('returns zeros when the user has no attempts in the category', async () => {
      progressRepo.find.mockResolvedValue([]);

      await expect(
        provider.getUserProgressStats('user-1', 'cat-1'),
      ).resolves.toEqual({
        totalAttempts: 0,
        correctAttempts: 0,
        totalPoints: 0,
        averageTimeSpent: 0,
        accuracy: 0,
      });
    });

    it('aggregates attempts, points, time, and accuracy', async () => {
      progressRepo.find.mockResolvedValue([
        { isCorrect: true, pointsEarned: 10, timeSpent: 20 },
        { isCorrect: false, pointsEarned: 0, timeSpent: 40 },
      ] as UserProgress[]);

      const stats = await provider.getUserProgressStats('user-1', 'cat-1');

      expect(progressRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', categoryId: 'cat-1' },
      });
      expect(stats).toEqual({
        totalAttempts: 2,
        correctAttempts: 1,
        totalPoints: 10,
        averageTimeSpent: 30,
        accuracy: 50,
      });
    });
  });
});
