import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { FindOneByEmail } from './find-one-by-email.provider';
import { FindOneByWallet } from './find-one-by-wallet.provider';
import { FindAll } from './find-all.service';
import { CreateUserService } from './create-user.service';
import { DeleteUserService } from './delete-user.service';
import { FindOneByGoogleIdProvider } from './find-one-by-googleId';
import { CreateGoogleUserProvider } from './googleUserProvider';
import { UpdateUserService } from './update-user.service';
import { User } from '../user.entity';
import { CreateUserDto } from '../dtos/createUserDto';
import { EditUserDto } from '../dtos/editUserDto.dto';
import { BadRequestException } from '@nestjs/common';

function makeUser(overrides?: Partial<User>): User {
  return {
    id: 'user-1',
    email: 'player@example.com',
    username: 'player',
    fullname: 'Player One',
    xp: 0,
    level: 1,
    ...overrides,
  } as User;
}

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: jest.Mocked<Repository<User>>;
  let createUserService: { execute: jest.Mock };
  let findOneByEmail: { findOneByEmail: jest.Mock };
  let findOneByWallet: { findOneByWallet: jest.Mock };
  let findAll: { findAll: jest.Mock };
  let deleteUserService: { execute: jest.Mock };
  let findOneByGoogleIdProvider: { findOneByGoogleId: jest.Mock };
  let createGoogleUserProvider: { createGoogleUser: jest.Mock };

  beforeEach(async () => {
    createUserService = { execute: jest.fn() };
    findOneByEmail = { findOneByEmail: jest.fn() };
    findOneByWallet = { findOneByWallet: jest.fn() };
    findAll = { findAll: jest.fn() };
    deleteUserService = { execute: jest.fn() };
    findOneByGoogleIdProvider = { findOneByGoogleId: jest.fn() };
    createGoogleUserProvider = { createGoogleUser: jest.fn() };

    const mockUserRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        // Real UpdateUserService so findOneById matches the JWT middleware contract.
        UpdateUserService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: FindOneByEmail, useValue: findOneByEmail },
        { provide: FindOneByWallet, useValue: findOneByWallet },
        { provide: FindAll, useValue: findAll },
        { provide: CreateUserService, useValue: createUserService },
        { provide: DeleteUserService, useValue: deleteUserService },
        {
          provide: FindOneByGoogleIdProvider,
          useValue: findOneByGoogleIdProvider,
        },
        {
          provide: CreateGoogleUserProvider,
          useValue: createGoogleUserProvider,
        },
      ],
    }).compile();

    service = module.get(UsersService);
    userRepo = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOneById (JWT middleware contract)', () => {
    it('returns the user when the id exists', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.findOneById('user-1');

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toBe(user);
      expect(result).not.toBeNull();
    });

    it('returns null when the user does not exist (middleware must reject the token)', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.findOneById('missing');

      expect(result).toBeNull();
    });
  });

  describe('create — uniqueness conflicts', () => {
    it('propagates uniqueness conflicts from CreateUserService', async () => {
      const dto = {
        email: 'taken@example.com',
        password: '@Password123',
      } as CreateUserDto;
      createUserService.execute.mockRejectedValue(
        new BadRequestException('Email already in use'),
      );

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow('Email already in use');
      expect(createUserService.execute).toHaveBeenCalledWith(dto);
    });

    it('returns the created user on success', async () => {
      const dto = {
        email: 'new@example.com',
        password: '@Password123',
      } as CreateUserDto;
      const user = makeUser({ email: dto.email });
      createUserService.execute.mockResolvedValue(user);

      await expect(service.create(dto)).resolves.toBe(user);
    });
  });

  it('delegates GetOneByEmail', async () => {
    const user = makeUser();
    findOneByEmail.findOneByEmail.mockResolvedValue(user);

    await expect(service.GetOneByEmail('player@example.com')).resolves.toBe(
      user,
    );
    expect(findOneByEmail.findOneByEmail).toHaveBeenCalledWith(
      'player@example.com',
    );
  });

  it('delegates update and delete', async () => {
    const user = makeUser({ username: 'renamed' });
    userRepo.findOne.mockResolvedValue(makeUser());
    userRepo.save.mockResolvedValue(user);
    deleteUserService.execute.mockResolvedValue(undefined);

    const edited = await service.update('user-1', {
      username: 'renamed',
    } as EditUserDto);
    expect(edited.username).toBe('renamed');

    await service.delete('user-1');
    expect(deleteUserService.execute).toHaveBeenCalledWith('user-1');
  });
});
