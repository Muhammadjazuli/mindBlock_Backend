import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PuzzlesService } from './puzzles.service';
import { CreatePuzzleProvider } from './create-puzzle.provider';
import { GetAllPuzzlesProvider } from './getAll-puzzle.provider';
import { Puzzle } from '../entities/puzzle.entity';
import { CreatePuzzleDto } from '../dtos/create-puzzle.dto';
import { PuzzleQueryDto } from '../dtos/puzzle-query.dto';
import { PuzzleDifficulty } from '../enums/puzzle-difficulty.enum';

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
    category: { id: 'cat-1', name: 'Logic', isActive: true } as Puzzle['category'],
    createdAt: new Date(),
    updatedAt: new Date(),
    progressRecords: [],
    ...overrides,
  };
}

describe('PuzzlesService', () => {
  let service: PuzzlesService;
  let puzzleRepo: jest.Mocked<Repository<Puzzle>>;
  let createPuzzleProvider: { execute: jest.Mock };
  let allPuzzlesProvider: { findAll: jest.Mock };

  beforeEach(async () => {
    createPuzzleProvider = { execute: jest.fn() };
    allPuzzlesProvider = { findAll: jest.fn() };
    const mockPuzzleRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PuzzlesService,
        { provide: CreatePuzzleProvider, useValue: createPuzzleProvider },
        { provide: GetAllPuzzlesProvider, useValue: allPuzzlesProvider },
        { provide: getRepositoryToken(Puzzle), useValue: mockPuzzleRepo },
      ],
    }).compile();

    service = module.get(PuzzlesService);
    puzzleRepo = module.get(getRepositoryToken(Puzzle));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates create to CreatePuzzleProvider', async () => {
    const dto = { question: 'q' } as CreatePuzzleDto;
    const puzzle = makePuzzle();
    createPuzzleProvider.execute.mockResolvedValue(puzzle);

    const result = await service.create(dto);

    expect(createPuzzleProvider.execute).toHaveBeenCalledWith(dto);
    expect(result).toBe(puzzle);
  });

  it('delegates findAll to GetAllPuzzlesProvider', async () => {
    const query: PuzzleQueryDto = { page: 1, limit: 10 };
    const payload = { data: [], meta: { page: 1, limit: 10, total: 0 } };
    allPuzzlesProvider.findAll.mockResolvedValue(payload);

    const result = await service.findAll(query);

    expect(allPuzzlesProvider.findAll).toHaveBeenCalledWith(query);
    expect(result).toBe(payload);
  });

  describe('getPuzzleById', () => {
    it('returns the puzzle with its category relation', async () => {
      const puzzle = makePuzzle();
      puzzleRepo.findOne.mockResolvedValue(puzzle);

      const result = await service.getPuzzleById('puzzle-1');

      expect(puzzleRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'puzzle-1' },
        relations: ['category'],
      });
      expect(result).toBe(puzzle);
    });

    it('throws NotFoundException when the puzzle does not exist', async () => {
      puzzleRepo.findOne.mockResolvedValue(null);

      await expect(service.getPuzzleById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDailyQuestPuzzles', () => {
    it('returns at most 5 puzzles from active categories', async () => {
      const puzzles = Array.from({ length: 7 }, (_, i) =>
        makePuzzle({ id: `puzzle-${i}` }),
      );
      puzzleRepo.find.mockResolvedValue(puzzles);

      const result = await service.getDailyQuestPuzzles();

      expect(puzzleRepo.find).toHaveBeenCalledWith({
        where: { category: { isActive: true } },
        relations: ['category'],
      });
      expect(result).toHaveLength(5);
    });

    it('returns all puzzles when fewer than 5 exist', async () => {
      const puzzles = [makePuzzle(), makePuzzle({ id: 'puzzle-2' })];
      puzzleRepo.find.mockResolvedValue(puzzles);

      const result = await service.getDailyQuestPuzzles();

      expect(result).toHaveLength(2);
    });
  });
});
