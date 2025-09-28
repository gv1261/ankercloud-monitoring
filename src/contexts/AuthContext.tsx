"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, setAuthToken, realtimeConnection } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Connect WebSocket when user is authenticated
  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('authToken');
      if (token) {
        realtimeConnection.connect(token);
      }
    } else {
      realtimeConnection.disconnect();
    }

    return () => {
      realtimeConnection.disconnect();
    };
  }, [user]);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setLoading(false);
        return;
      }

      setAuthToken(token);
      const response = await api.auth.verify();
      setUser(response.user);
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.auth.login(email, password);
      setUser(response.user);
      router.push('/');
      localStorage.setItem('authToken', response.token); // <-- Save token
      setAuthToken(response.token); // apply to axios
    } catch (error: any) {
      setError(error.response?.data?.error || 'Login failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.auth.register(email, password, fullName);
      setUser(response.user);
      router.push('/');
      localStorage.setItem('authToken', response.token); // <-- Save token
      setAuthToken(response.token); // apply to axios
    } catch (error: any) {
      setError(error.response?.data?.error || 'Registration failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setAuthToken(null);
      router.push('/login');
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
