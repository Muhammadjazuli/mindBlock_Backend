"use client";

import { useCallback, useRef } from "react";
import { authenticateWithGoogle } from "../lib/api/authApi";
import { useAuth } from "./useAuth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function loadGoogleScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is browser-only"));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Identity")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity"));
    document.head.appendChild(script);
  });
}

export function useGoogleAuth() {
  const { loginSuccess } = useAuth();
  const pending = useRef<Promise<void> | null>(null);

  const signInWithGoogle = useCallback(async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        "Google sign-in is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID.",
      );
    }

    await loadGoogleScript();
    if (!window.google?.accounts?.id) {
      throw new Error("Google Identity is unavailable");
    }

    if (pending.current) {
      return pending.current;
    }

    pending.current = new Promise<void>((resolve, reject) => {
      window.google!.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            const tokens = await authenticateWithGoogle(credential);
            const user = tokens.user ?? {
              id: "google-user",
              email: undefined,
            };
            loginSuccess(user, tokens.accessToken, tokens.refreshToken);
            resolve();
          } catch (error) {
            reject(error);
          } finally {
            pending.current = null;
          }
        },
      });
      window.google!.accounts.id.prompt();
    });

    return pending.current;
  }, [loginSuccess]);

  return { signInWithGoogle };
}
