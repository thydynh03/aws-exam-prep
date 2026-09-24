import React, { useState, useEffect, useCallback } from 'react';
import {
  authApi,
  getStoredToken,
  getStoredUser,
  setStoredUser,
  hydrateLearnerData,
  backupLearnerData,
  type UserProfile
} from '../core/api';
import { storage } from '../core/storage';
import { liveTracker } from '../core/liveTracker';
import { AuthContext, type AuthContextType } from './authContextDef';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const token = getStoredToken();
    if (!token) return null;
    return getStoredUser();
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const token = getStoredToken();
    const stored = getStoredUser();
    return Boolean(token && !stored);
  });

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setStoredUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await authApi.getCurrentUser();
      setUser(res.user);
      setStoredUser(res.user);
      void hydrateLearnerData(res.user.id);
    } catch {
      // Do not clear user immediately on network hiccup
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      const token = getStoredToken();
      if (!token) {
        if (isMounted) {
          setUser(null);
          setStoredUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const res = await authApi.getCurrentUser();
        if (isMounted) {
          setUser(res.user);
          setStoredUser(res.user);
          void hydrateLearnerData(res.user.id);
        }
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.includes('401') || msg.includes('hết hạn') || msg.includes('xác thực')) {
          if (isMounted) {
            setUser(null);
            setStoredUser(null);
          }
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Listen to cross-tab authentication changes via BroadcastChannel and localStorage events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('aws_prep_auth_bus');
        bc.onmessage = (event) => {
          if (event.data?.type === 'LOGIN' && event.data.user) {
            setUser(event.data.user);
            setStoredUser(event.data.user);
            liveTracker.syncWithUser(event.data.user);
          } else if (event.data?.type === 'LOGOUT') {
            setUser(null);
            setStoredUser(null);
            liveTracker.syncWithUser(null);
          }
        };
      } catch {
        // Ignore BroadcastChannel errors
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'aws_prep_user_profile' || e.key === 'aws_prep_auth_token') {
        const stored = getStoredUser();
        setUser(stored);
        liveTracker.syncWithUser(stored);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (bc) {
        bc.close();
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = async (username: string, adminPasscode?: string) => {
    setIsLoading(true);
    try {
      // Clear leftover unauthenticated/previous session data before logging in
      storage.clearActiveUserData();

      const res = await authApi.login(username, adminPasscode);
      setUser(res.user);

      // Automatically restore and hydrate all past questions, notes, exams, and bookmarks for all roles (including Admin)
      await hydrateLearnerData(res.user.id);

      // Immediately synchronize live tracker identity AFTER storage is properly hydrated
      liveTracker.syncWithUser(res.user);

      // Broadcast login event to other open tabs and windows
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('aws_prep_auth_bus');
          bc.postMessage({ type: 'LOGIN', user: res.user });
          bc.close();
        } catch {
          // Ignore broadcast errors
        }
      }

      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      if (user) {
        // 1. Snapshot user study data to their user-scoped backup in localStorage
        backupLearnerData(user.id);
      }
      // 2. Clear active session data so another user doesn't see old progress
      storage.clearActiveUserData();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('aws_storage_updated'));
      }
      await authApi.logout();

      // Immediately synchronize live tracker to guest mode
      liveTracker.syncWithUser(null);

      // Broadcast logout event to other open tabs and windows
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('aws_prep_auth_bus');
          bc.postMessage({ type: 'LOGOUT' });
          bc.close();
        } catch {
          // Ignore broadcast errors
        }
      }
    } finally {
      setUser(null);
      setStoredUser(null);
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'ADMIN',
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
