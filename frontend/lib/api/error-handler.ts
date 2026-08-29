import { ApiError } from "./types";

export class NormalizedApiError extends Error implements ApiError {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "NormalizedApiError";
    this.code = code;
    this.status = status;
  }
}

export function handleApiError(error: unknown): NormalizedApiError {
  const axiosError = error as {
    response?: { data?: { message?: string; code?: string }; status?: number };
    message?: string;
  };
  const response = axiosError.response || {};
  const message =
    (Array.isArray(response.data?.message)
      ? response.data?.message[0]
      : response.data?.message) ||
    axiosError.message ||
    "Unexpected error occurred";

  return new NormalizedApiError(
    message,
    response.data?.code || "UNKNOWN_ERROR",
    response.status || 500,
  );
}
