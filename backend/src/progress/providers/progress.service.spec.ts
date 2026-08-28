import { Test, TestingModule } from '@nestjs/testing';
import { ProgressService } from '../progress.service';
import { ProgressCalculationProvider } from './progress-calculation.provider';
import { SubmitAnswerDto } from '../dtos/submit-answer.dto';

describe('ProgressService', () => {
  let service: ProgressService;
  let calculation: {
    processAnswerSubmission: jest.Mock;
    getUserProgressStats: jest.Mock;
    validateAnswer: jest.Mock;
  };

  beforeEach(async () => {
    calculation = {
      processAnswerSubmission: jest.fn(),
      getUserProgressStats: jest.fn(),
      validateAnswer: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: ProgressCalculationProvider, useValue: calculation },
      ],
    }).compile();

    service = module.get(ProgressService);
  });

  it('delegates submitAnswer to processAnswerSubmission', async () => {
    const dto = { userId: 'user-1' } as SubmitAnswerDto;
    const payload = { validation: { isCorrect: true } };
    calculation.processAnswerSubmission.mockResolvedValue(payload);

    await expect(service.submitAnswer(dto)).resolves.toBe(payload);
    expect(calculation.processAnswerSubmission).toHaveBeenCalledWith(dto);
  });

  it('delegates getUserStats', async () => {
    const stats = { totalAttempts: 1 };
    calculation.getUserProgressStats.mockResolvedValue(stats);

    await expect(service.getUserStats('user-1', 'cat-1')).resolves.toBe(stats);
    expect(calculation.getUserProgressStats).toHaveBeenCalledWith(
      'user-1',
      'cat-1',
    );
  });

  it('delegates validateAnswer', () => {
    calculation.validateAnswer.mockReturnValue({ isCorrect: true });

    expect(service.validateAnswer('a', 'A')).toEqual({ isCorrect: true });
    expect(calculation.validateAnswer).toHaveBeenCalledWith('a', 'A');
  });
});
