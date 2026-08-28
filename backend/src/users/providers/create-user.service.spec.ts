import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreateUserService } from './create-user.service';
import { User } from '../user.entity';
import { HashingProvider } from '../../auth/providers/hashing.provider';
import { CreateUserDto } from '../dtos/createUserDto';
import { AuthProvider } from '../../auth/enum/authProvider.enum';

function makeDto(overrides?: Partial<CreateUserDto>): CreateUserDto {
  return {
    email: 'player@example.com',
    username: 'player',
    fullname: 'Player One',
    password: '@Password123',
    ...overrides,
  };
}

describe('CreateUserService', () => {
  let service: CreateUserService;
  let userRepo: jest.Mocked<Repository<User>>;
  let hashingProvider: { hashPassword: jest.Mock };

  beforeEach(async () => {
    hashingProvider = { hashPassword: jest.fn() };
    const mockUserRepo = {
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateUserService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: HashingProvider, useValue: hashingProvider },
      ],
    }).compile();

    service = module.get(CreateUserService);
    userRepo = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a duplicate email with BadRequestException', async () => {
    userRepo.findOneBy.mockResolvedValue({ id: 'existing' } as User);

    await expect(service.execute(makeDto())).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.execute(makeDto())).rejects.toThrow(
      'Email already in use',
    );
    expect(userRepo.create).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('rejects an invalid email', async () => {
    await expect(
      service.execute(makeDto({ email: 'not-an-email' })),
    ).rejects.toThrow(BadRequestException);
    expect(userRepo.findOneBy).not.toHaveBeenCalled();
  });

  it('creates a local user after hashing the password', async () => {
    const dto = makeDto();
    const saved = { id: 'user-1', email: dto.email } as User;
    userRepo.findOneBy.mockResolvedValue(null);
    hashingProvider.hashPassword.mockResolvedValue('hashed-secret');
    (userRepo.create as jest.Mock).mockImplementation((payload) => payload);
    userRepo.save.mockResolvedValue(saved);

    const result = await service.execute(dto);

    expect(userRepo.findOneBy).toHaveBeenCalledWith({ email: dto.email });
    expect(hashingProvider.hashPassword).toHaveBeenCalledWith('@Password123');
    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'player@example.com',
        password: 'hashed-secret',
        fullname: 'Player One',
      }),
    );
    expect(result).toBe(saved);
  });

  it('skips email uniqueness for wallet signups', async () => {
    const dto = makeDto({
      provider: AuthProvider.WALLET,
      email: undefined,
      password: undefined,
    });
    const saved = { id: 'user-wallet' } as User;
    (userRepo.create as jest.Mock).mockImplementation((payload) => payload);
    userRepo.save.mockResolvedValue(saved);

    const result = await service.execute(dto);

    expect(userRepo.findOneBy).not.toHaveBeenCalled();
    expect(hashingProvider.hashPassword).not.toHaveBeenCalled();
    expect(result).toBe(saved);
  });

  it('defaults fullname from username when omitted', async () => {
    const dto = makeDto({ fullname: undefined, username: 'solo' });
    userRepo.findOneBy.mockResolvedValue(null);
    hashingProvider.hashPassword.mockResolvedValue('hashed');
    (userRepo.create as jest.Mock).mockImplementation((payload) => payload);
    userRepo.save.mockResolvedValue({ id: 'user-1' } as User);

    await service.execute(dto);

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ fullname: 'solo' }),
    );
  });
});
