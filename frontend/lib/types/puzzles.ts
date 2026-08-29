export type PuzzleDifficulty =
  | "ALL"
  | "BEGINNER"
  | "INTERMEDIATE"
  | "ADVANCED"
  | "EXPERT";

export interface Category {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  isActive?: boolean;
}

export interface Puzzle {
  id: string;
  question: string;
  options?: string[];
  correctAnswer?: string;
  difficulty: PuzzleDifficulty;
  categoryId: string;
  category?: Category;
  points: number;
  timeLimit: number;
  explanation?: string;
  createdAt?: string;
  /** Legacy UI fields — derived from `question` when the API omits them. */
  title?: string;
  description?: string;
  type?: "logic" | "coding" | "blockchain";
}

export interface PuzzleQueryParams {
  categoryId?: string;
  difficulty?: string;
  page?: number;
  limit?: number;
}

export interface PuzzleListResponse {
  data: Puzzle[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface PuzzleFilters {
  categoryId: string;
  difficulty: PuzzleDifficulty;
}

export function puzzleTitle(puzzle: Puzzle): string {
  return puzzle.title || puzzle.question || "Untitled puzzle";
}

export function puzzleDescription(puzzle: Puzzle): string {
  return puzzle.description || puzzle.explanation || puzzle.question || "";
}
