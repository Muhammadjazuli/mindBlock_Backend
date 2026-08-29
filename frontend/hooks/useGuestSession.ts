import { useState, useEffect, useCallback } from "react";
import {
  createGuestSession,
  getGuestSessionStatus,
  type GuestSessionResponse,
} from "../lib/api/authApi";
import { GUEST_SESSION_KEY } from "../lib/api/config";

export type GuestSessionData = GuestSessionResponse;

export function useGuestSession() {
  const [session, setSession] = useState<GuestSessionData | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem(GUEST_SESSION_KEY);
    if (!stored) return;

    try {
      const parsed: GuestSessionData = JSON.parse(stored);
      void getGuestSessionStatus(parsed.sessionId)
        .then((status: { valid?: boolean; expired?: boolean; session?: GuestSessionData }) => {
          if (status.expired || !status.valid) {
            setIsExpired(true);
            setShowSignupModal(true);
            return;
          }
          const live = status.session ?? parsed;
          setSession(live);
          setTimeLeft(Math.max(0, Math.floor((live.expiresAt - Date.now()) / 1000)));
        })
        .catch(() => {
          localStorage.removeItem(GUEST_SESSION_KEY);
        });
    } catch {
      localStorage.removeItem(GUEST_SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (!session || isExpired) return;

    const timer = setInterval(() => {
      const remaining = Math.floor((session.expiresAt - Date.now()) / 1000);
      if (remaining <= 0) {
        setTimeLeft(0);
        setIsExpired(true);
        setShowSignupModal(true);
        clearInterval(timer);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [session, isExpired]);

  const startGuestSession = useCallback(async () => {
    setIsStarting(true);
    try {
      const created = await createGuestSession();
      localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(created));
      setSession(created);
      setIsExpired(false);
      setTimeLeft(Math.max(0, Math.floor((created.expiresAt - Date.now()) / 1000)));
      return created;
    } finally {
      setIsStarting(false);
    }
  }, []);

  const useHint = useCallback((): boolean => {
    if (!session || isExpired) return false;
    if (session.hintsUsed >= session.maxHints) {
      setShowSignupModal(true);
      return false;
    }
    const updated = { ...session, hintsUsed: session.hintsUsed + 1 };
    setSession(updated);
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(updated));
    return true;
  }, [session, isExpired]);

  const clearGuestSession = useCallback(() => {
    localStorage.removeItem(GUEST_SESSION_KEY);
    setSession(null);
    setIsExpired(false);
    setTimeLeft(0);
  }, []);

  return {
    session,
    timeLeft,
    isExpired,
    isStarting,
    showSignupModal,
    setShowSignupModal,
    startGuestSession,
    useHint,
    clearGuestSession,
  };
}
