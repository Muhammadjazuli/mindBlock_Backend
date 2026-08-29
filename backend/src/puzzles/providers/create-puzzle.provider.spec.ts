import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreatePuzzleProvider } from './create-puzzle.provider';
import { Puzzle } from '../entities/puzzle.entity';
import { Category } from '../../categories/entities/category.entity';
import { CreatePuzzleDto } from '../dtos/create-puzzle.dto';
import {
  PuzzleDifficulty,
  getPointsByDifficulty,
} from '../enums/puzzle-difficulty.enum';

function makeDto(overrides?: Partial<CreatePuzzleDto>): CreatePuzzleDto {
  const dto = new CreatePuzzleDto();
  dto.question = 'What has keys but cannot open locks?';
  dto.options = ['A piano', 'A map', 'A keyboard', 'A code'];
  dto.correctAnswer = 'A piano';
  dto.difficulty = PuzzleDifficulty.BEGINNER;
  dto.categoryId = 'cat-uuid-1';
  dto.timeLimit = 60;
  Object.assign(dto, overrides);
  return dto;
}

function makeCategory(overrides?: Partial<Category>): Category {
  return {
    id: 'cat-uuid-1',
    name: 'Logic',
    isActive: true,
    createdAt: new Date(),
    puzzles: [],
    ...overrides,
  };
}

describe('CreatePuzzleProvider', () => {
  let provider: CreatePuzzleProvider;
  let puzzleRepo: jest.Mocked<Repository<Puzzle>>;
  let categoryRepo: jest.Mocked<Repository<Category>>;

  beforeEach(async () => {
    const mockPuzzleRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    const mockCategoryRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePuzzleProvider,
        { provide: getRepositoryToken(Puzzle), useValue: mockPuzzleRepo },
        { provide: getRepositoryToken(Category), useValue: mockCategoryRepo },
      ],
    }).compile();

    provider = module.get(CreatePuzzleProvider);
    puzzleRepo = module.get(getRepositoryToken(Puzzle));
    categoryRepo = module.get(getRepositoryToken(Category));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps the DTO onto a puzzle entity and persists it', async () => {
    const dto = makeDto({
      explanation: 'A piano has keys but cannot open locks.',
    });
    const category = makeCategory();
    const created = { ...dto, id: 'puzzle-1' } as unknown as Puzzle;

    categoryRepo.findOne.mockResolvedValue(category);
    puzzleRepo.create.mockReturnValue(created);
    puzzleRepo.save.mockResolvedValue(created);

    const result = await provider.execute(dto);

    expect(categoryRepo.findOne).toHaveBeenCalledWith({
      where: { id: dto.categoryId },
    });
    expect(puzzleRepo.create).toHaveBeenCalledWith(dto);
    expect(puzzleRepo.save).toHaveBeenCalledWith(created);
    expect(result).toBe(created);
  });

  it.each([
    [PuzzleDifficulty.BEGINNER, 10],
    [PuzzleDifficulty.INTERMEDIATE, 25],
    [PuzzleDifficulty.ADVANCED, 50],
    [PuzzleDifficulty.EXPERT, 100],
  ] as const)(
    'sets default points for %s difficulty when points are omitted',
    async (difficulty, expectedPoints) => {
      const dto = makeDto({ difficulty });
      categoryRepo.findOne.mockResolvedValue(makeCategory());
      (puzzleRepo.create as jest.Mock).mockImplementation((payload) => payload);
      (puzzleRepo.save as jest.Mock).mockImplementation((puzzle) =>
        Promise.resolve(puzzle),
      );

      await provider.execute(dto);

      expect(dto.points).toBe(expectedPoints);
      expect(dto.points).toBe(getPointsByDifficulty(difficulty));
      expect(puzzleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ points: expectedPoints, difficulty }),
      );
    },
  );

  it('preserves an explicit points value instead of overwriting from difficulty', async () => {
    const dto = makeDto({
      difficulty: PuzzleDifficulty.BEGINNER,
      points: 250,
    });
    categoryRepo.findOne.mockResolvedValue(makeCategory());
    (puzzleRepo.create as jest.Mock).mockImplementation((payload) => payload);
    (puzzleRepo.save as jest.Mock).mockImplementation((puzzle) =>
      Promise.resolve(puzzle),
    );

    await provider.execute(dto);

    expect(dto.points).toBe(250);
    expect(puzzleRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ points: 250 }),
    );
  });

  it('throws BadRequestException when the category does not exist', async () => {
    const dto = makeDto();
    categoryRepo.findOne.mockResolvedValue(null);

    await expect(provider.execute(dto)).rejects.toThrow(BadRequestException);
    expect(puzzleRepo.create).not.toHaveBeenCalled();
    expect(puzzleRepo.save).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the category is inactive', async () => {
    const dto = makeDto();
    categoryRepo.findOne.mockResolvedValue(makeCategory({ isActive: false }));

    await expect(provider.execute(dto)).rejects.toThrow(BadRequestException);
    expect(puzzleRepo.create).not.toHaveBeenCalled();
  });

  it('throws InternalServerErrorException when save fails', async () => {
    const dto = makeDto();
    categoryRepo.findOne.mockResolvedValue(makeCategory());
    puzzleRepo.create.mockReturnValue(dto as unknown as Puzzle);
    puzzleRepo.save.mockRejectedValue(new Error('db down'));

    await expect(provider.execute(dto)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
