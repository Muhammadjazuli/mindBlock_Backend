import api from "./client";
import {
  Puzzle,
  PuzzleListResponse,
  PuzzleQueryParams,
} from "../types/puzzles";

function normalizePuzzle(raw: Puzzle): Puzzle {
  return {
    ...raw,
    title: raw.title || raw.question,
    description: raw.description || raw.explanation || raw.question,
    type: raw.type ?? "logic",
    points: raw.points ?? 0,
    timeLimit: raw.timeLimit ?? 60,
  };
}

export async function getPuzzles(
  query: PuzzleQueryParams,
): Promise<Puzzle[]> {
  const response = await api.get<Puzzle[] | PuzzleListResponse>("/puzzles", {
    params: query,
  });
  const body = response.data;
  const rows = Array.isArray(body) ? body : (body?.data ?? []);
  return rows.map(normalizePuzzle);
}

export async function getPuzzleById(id: string): Promise<Puzzle> {
  const response = await api.get<Puzzle>(`/puzzles/${id}`);
  return normalizePuzzle(response.data);
}

export async function getDailyQuestPuzzles(): Promise<Puzzle[]> {
  const response = await api.get<Puzzle[]>("/puzzles/daily-quest");
  return (response.data ?? []).map(normalizePuzzle);
}
