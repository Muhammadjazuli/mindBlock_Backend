'use client';

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../lib/reduxHooks';
import {
  selectUser,
  selectIsAuthenticated,
  selectAuthLoading,
  selectAuthError,
  selectToken,
  selectRefreshToken,
  selectIsRestoring,
  loginSuccess,
  loginFailure,
  logout,
  clearError,
  setLoading,
  updateUser,
  walletLoginSuccess,
  walletLoginFailure,
  restoreSession,
  refreshToken,
  type User,
} from '../lib/features/auth/authSlice';
import { logoutSession } from '../lib/api/authApi';

// Auth hook that provides auth state and actions
export function useAuth() {
  const dispatch = useAppDispatch();
  
  // Selectors
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectAuthLoading);
  const error = useAppSelector(selectAuthError);
  const token = useAppSelector(selectToken);
  const refreshTokenValue = useAppSelector(selectRefreshToken);
  const isRestoring = useAppSelector(selectIsRestoring);

  // Actions
  const handleLoginSuccess = useCallback((user: User, token: string, refreshToken?: string) => {
    dispatch(loginSuccess({ user, token, refreshToken: refreshToken ?? refreshTokenValue ?? '' }));
  }, [dispatch, refreshTokenValue]);

  const handleLoginFailure = useCallback((error: string) => {
    dispatch(loginFailure(error));
  }, [dispatch]);

  const handleLogout = useCallback(async () => {
    if (refreshTokenValue) {
      try {
        await logoutSession(refreshTokenValue);
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    dispatch(logout());
    window.location.href = '/auth/signin';
  }, [dispatch, refreshTokenValue]);

  const handleClearError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  const handleSetLoading = useCallback((loading: boolean) => {
    dispatch(setLoading(loading));
  }, [dispatch]);

  const handleUpdateUser = useCallback((userData: Partial<User>) => {
    dispatch(updateUser(userData));
  }, [dispatch]);

  const handleWalletLoginSuccess = useCallback((walletAddress: string, token: string) => {
    dispatch(walletLoginSuccess({ walletAddress, token }));
  }, [dispatch]);

  const handleWalletLoginFailure = useCallback((error: string) => {
    dispatch(walletLoginFailure(error));
  }, [dispatch]);

  const handleRestoreSession = useCallback(() => {
    return dispatch(restoreSession());
  }, [dispatch]);

  const handleRefreshToken = useCallback(() => {
    return dispatch(refreshToken());
  }, [dispatch]);

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,
    token,
    refreshTokenValue,
    isRestoring,

    // Actions
    loginSuccess: handleLoginSuccess,
    loginFailure: handleLoginFailure,
    logout: handleLogout,
    clearError: handleClearError,
    setLoading: handleSetLoading,
    updateUser: handleUpdateUser,
    walletLoginSuccess: handleWalletLoginSuccess,
    walletLoginFailure: handleWalletLoginFailure,
    restoreSession: handleRestoreSession,
    refreshToken: handleRefreshToken,
  };
}

// Individual selector hooks for more granular usage
export function useUser() {
  return useAppSelector(selectUser);
}

export function useIsAuthenticated() {
  return useAppSelector(selectIsAuthenticated);
}

export function useAuthLoading() {
  return useAppSelector(selectAuthLoading);
}

export function useAuthError() {
  return useAppSelector(selectAuthError);
}

export function useAuthToken() {
  return useAppSelector(selectToken);
}

export function useRefreshToken() {
  return useAppSelector(selectRefreshToken);
}

export function useIsRestoring() {
  return useAppSelector(selectIsRestoring);
}