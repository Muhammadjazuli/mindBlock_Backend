import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { CategoriesService } from './categories.service';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from '../dtos/create-category.dto';

function makeCategory(overrides?: Partial<Category>): Category {
  return {
    id: 'cat-1',
    name: 'Logic',
    description: 'Logic puzzles',
    isActive: true,
    createdAt: new Date(),
    puzzles: [],
    ...overrides,
  };
}

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoryRepo: jest.Mocked<Repository<Category>>;

  beforeEach(async () => {
    const mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getRepositoryToken(Category), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(CategoriesService);
    categoryRepo = module.get(getRepositoryToken(Category));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists categories ordered by name ASC', async () => {
    const rows = [makeCategory()];
    categoryRepo.find.mockResolvedValue(rows);

    const result = await service.findAll();

    expect(categoryRepo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
    expect(result).toBe(rows);
  });

  it('finds a category by id and returns null when missing', async () => {
    categoryRepo.findOne.mockResolvedValueOnce(makeCategory());
    await expect(service.findOne('cat-1')).resolves.toMatchObject({
      id: 'cat-1',
    });

    categoryRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.findOne('missing')).resolves.toBeNull();
  });

  it('returns only active categories', async () => {
    const active = [makeCategory()];
    categoryRepo.find.mockResolvedValue(active);

    await expect(service.findActive()).resolves.toBe(active);
    expect(categoryRepo.find).toHaveBeenCalledWith({
      where: { isActive: true },
    });
  });

  describe('create', () => {
    const dto: CreateCategoryDto = { name: 'Logic', description: 'puzzles' };

    it('creates and saves a new category', async () => {
      const created = makeCategory();
      categoryRepo.findOne.mockResolvedValue(null);
      categoryRepo.create.mockReturnValue(created);
      categoryRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(categoryRepo.findOne).toHaveBeenCalledWith({
        where: { name: 'Logic' },
      });
      expect(categoryRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(created);
    });

    it('throws ConflictException when the name already exists', async () => {
      categoryRepo.findOne.mockResolvedValue(makeCategory());

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(categoryRepo.create).not.toHaveBeenCalled();
    });

    it('maps a unique-constraint race (Postgres 23505) to ConflictException', async () => {
      categoryRepo.findOne.mockResolvedValue(null);
      categoryRepo.create.mockReturnValue(makeCategory());
      const uniqueError = Object.assign(new Error('duplicate'), {
        code: '23505',
      });
      categoryRepo.save.mockRejectedValue(uniqueError);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('throws InternalServerErrorException for other save failures', async () => {
      categoryRepo.findOne.mockResolvedValue(null);
      categoryRepo.create.mockReturnValue(makeCategory());
      categoryRepo.save.mockRejectedValue(new Error('disk full'));

      await expect(service.create(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  it('updates a category and returns the refreshed row', async () => {
    const updated = makeCategory({ name: 'Reasoning' });
    categoryRepo.update.mockResolvedValue({} as any);
    categoryRepo.findOne.mockResolvedValue(updated);

    const result = await service.update('cat-1', { name: 'Reasoning' });

    expect(categoryRepo.update).toHaveBeenCalledWith('cat-1', {
      name: 'Reasoning',
    });
    expect(result).toBe(updated);
  });

  it('deletes a category by id', async () => {
    categoryRepo.delete.mockResolvedValue({} as any);

    await service.remove('cat-1');

    expect(categoryRepo.delete).toHaveBeenCalledWith('cat-1');
  });
});
