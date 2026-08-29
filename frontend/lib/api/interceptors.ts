import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { getAccessToken } from "./config";
import { handleApiError } from "./error-handler";

type RetryConfig = InternalAxiosRequestConfig & { __retryCount?: number };

export function setupInterceptors(api: AxiosInstance) {
  api.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error.response?.status as number | undefined;
      const config = (error.config ?? {}) as RetryConfig;
      const method = (config.method ?? "get").toLowerCase();

      if (status === 401 && typeof window !== "undefined") {
        if (!window.location.pathname.startsWith("/auth")) {
          window.location.href = "/auth/signin";
        }
        return Promise.reject(handleApiError(error));
      }

      const retryable =
        method === "get" &&
        status !== undefined &&
        status >= 500 &&
        (config.__retryCount ?? 0) < 2;

      if (retryable) {
        config.__retryCount = (config.__retryCount ?? 0) + 1;
        return api.request(config);
      }

      return Promise.reject(handleApiError(error));
    },
  );
}
