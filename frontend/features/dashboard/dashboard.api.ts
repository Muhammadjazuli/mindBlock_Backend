import { fetchCurrentUser } from "@/lib/api/authApi";
import { API_BASE_URL, authHeaders } from "@/lib/api/config";
import { fetchStreak } from "@/lib/api/streakApi";

export interface DashboardStats {
  streak: number;
  points: number;
  dailyQuestProgress: {
    completed: number;
    total: number;
  };
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CategoriesResponse {
  success: boolean;
  data: Category[];
  count: number;
  message?: string;
  error?: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("Content-Type");
  const isJson = contentType && contentType.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      (data && (data.message as string | undefined)) ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [streak, user, questStatus] = await Promise.all([
    fetchStreak().catch(() => null),
    fetchCurrentUser().catch(() => null),
    fetch(`${API_BASE_URL}/daily-quest/status`, {
      headers: authHeaders(),
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null),
  ]);

  return {
    streak: streak?.currentStreak ?? 0,
    points: user?.xp ?? 0,
    dailyQuestProgress: {
      completed: questStatus?.completedQuestions ?? 0,
      total: questStatus?.totalQuestions ?? 10,
    },
  };
}

export async function fetchCategories(): Promise<CategoriesResponse> {
  const response = await fetch(`${API_BASE_URL}/categories`, {
    method: "GET",
    headers: authHeaders(),
  });

  return handleResponse<CategoriesResponse>(response);
}
