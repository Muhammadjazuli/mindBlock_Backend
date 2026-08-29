import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetAllPuzzlesProvider } from './getAll-puzzle.provider';
import { Puzzle } from '../entities/puzzle.entity';
import { PuzzleDifficulty } from '../enums/puzzle-difficulty.enum';
import { PuzzleQueryDto } from '../dtos/puzzle-query.dto';

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
    category: { id: 'cat-1', name: 'Logic' } as Puzzle['category'],
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    progressRecords: [],
    ...overrides,
  };
}

describe('GetAllPuzzlesProvider', () => {
  let provider: GetAllPuzzlesProvider;
  let puzzleRepo: jest.Mocked<Repository<Puzzle>>;

  beforeEach(async () => {
    const mockPuzzleRepo = {
      findAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAllPuzzlesProvider,
        { provide: getRepositoryToken(Puzzle), useValue: mockPuzzleRepo },
      ],
    }).compile();

    provider = module.get(GetAllPuzzlesProvider);
    puzzleRepo = module.get(getRepositoryToken(Puzzle));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns paginated puzzles with default page=1 and limit=10', async () => {
    const puzzles = [makePuzzle()];
    puzzleRepo.findAndCount.mockResolvedValue([puzzles, 1]);

    const result = await provider.findAll({} as PuzzleQueryDto);

    expect(puzzleRepo.findAndCount).toHaveBeenCalledWith({
      where: {},
      relations: ['category'],
      order: { createdAt: 'DESC' },
      skip: 0,
      take: 10,
    });
    expect(result).toEqual({
      data: puzzles,
      meta: { page: 1, limit: 10, total: 1 },
    });
  });

  it('filters by categoryId and difficulty when provided', async () => {
    puzzleRepo.findAndCount.mockResolvedValue([[], 0]);
    const query: PuzzleQueryDto = {
      categoryId: 'cat-9',
      difficulty: PuzzleDifficulty.EXPERT,
      page: 2,
      limit: 5,
    };

    await provider.findAll(query);

    expect(puzzleRepo.findAndCount).toHaveBeenCalledWith({
      where: {
        categoryId: 'cat-9',
        difficulty: PuzzleDifficulty.EXPERT,
      },
      relations: ['category'],
      order: { createdAt: 'DESC' },
      skip: 5,
      take: 5,
    });
  });

  it('computes skip from page and limit', async () => {
    puzzleRepo.findAndCount.mockResolvedValue([[makePuzzle()], 21]);

    const result = await provider.findAll({ page: 3, limit: 7 });

    expect(puzzleRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 14, take: 7 }),
    );
    expect(result.meta).toEqual({ page: 3, limit: 7, total: 21 });
  });
});
