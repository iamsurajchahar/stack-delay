import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { getMe, logout as apiLogout } from '../api/auth';

export function useAuth() {
  const { user, token, isAuthenticated, setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      getMe()
        .then((u) => setAuth(u, token))
        .catch(() => clearAuth());
    }
  }, [token, user, setAuth, clearAuth]);

  const logout = async () => {
    try {
      await apiLogout();
    } catch {
      // ignore
    }
    clearAuth();
  };

  return {
    user,
    token,
    isAuthenticated,
    isLoading: isAuthenticated && !user,
    logout,
  };
}
