import api from "./client";
import { API_BASE_URL, authHeaders } from "./config";
import type { User } from "../features/auth/authSlice";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user?: User;
}

export interface GuestSessionResponse {
  sessionId: string;
  role: string;
  createdAt: number;
  expiresAt: number;
  hintsUsed: number;
  maxHints: number;
  isConverted: boolean;
}

export async function signIn(
  email: string,
  password: string,
): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>("/auth/signIn", {
    email,
    password,
  });
  return data;
}

export async function register(payload: {
  email: string;
  username: string;
  password: string;
  passwordConfirm: string;
  fullname?: string;
}): Promise<unknown> {
  const { data } = await api.post("/auth/register", payload);
  return data;
}

export async function authenticateWithGoogle(
  idToken: string,
): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>("/auth/google-authentication", {
    token: idToken,
  });
  return data;
}

export async function createGuestSession(): Promise<GuestSessionResponse> {
  const { data } = await api.post<GuestSessionResponse>("/auth/guest-session");
  return data;
}

export async function getGuestSessionStatus(sessionId: string) {
  const { data } = await api.get(`/auth/guest-session/${sessionId}/status`);
  return data;
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await api.get<User>("/auth/me");
  return data;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>("/auth/refreshToken", {
    refreshToken,
  });
  return data;
}

export async function logoutSession(refreshToken: string): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refreshToken }),
  });
}
