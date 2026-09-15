import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { getCurrentUser, login as apiLogin, logout as apiLogout, isBackendAuthEnabled, getAuthToken } from '../lib/api';

const AuthContext = createContext(null);

// Sesi persistent: tidak ada idle-timeout maupun batas absolut.
// Logout hanya saat user klik logout, akun suspended/dihapus, atau token
// backend ditolak server (mis. JWT kedaluwarsa / secret dirotasi).

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [userStatus, setUserStatus] = useState('active');
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage dan validate session saat aplikasi pertama kali dimuat
    // (tanpa batas waktu — sesi berlaku selamanya sampai logout eksplisit).
    const checkAuth = async () => {
      // No.3: mode backend tanpa JWT = tidak ada sesi (fail-closed, bukan flag)
      if (isBackendAuthEnabled() && !getAuthToken()) {
        clearAuth();
        setIsLoading(false);
        return;
      }

      const authStatus = localStorage.getItem('isAuthenticated');
      const storedUserId = localStorage.getItem('userId');

      if (authStatus === 'true' && (storedUserId || isBackendAuthEnabled())) {
        try {
          // No.3: getCurrentUser() mode backend memverifikasi JWT ke server
          // (/api/auth/me) + menolak akun suspended — bukan sekadar baca flag.
          const user = await getCurrentUser();
          if (user) {
            if ((user.status || 'active') === 'suspended') {
              clearAuth();
              setIsLoading(false);
              return;
            }

            setIsAuthenticated(true);
            setUserName(user.name);
            setUserRole(user.role);
            setUserId(user.id);
            setUserEmail(user.email || '');
            setUserStatus(user.status || 'active');
            setEmailNotificationsEnabled(user.email_notifications_enabled !== false);
            localStorage.setItem('userStatus', user.status || 'active');
            localStorage.setItem('emailNotificationsEnabled', user.email_notifications_enabled === false ? 'false' : 'true');
          } else {
            // User not found - clear auth
            clearAuth();
          }
        } catch (error) {
          console.error('Error validating session:', error);
          // No.3: mode backend fail-closed — sesi tidak valid tanpa verifikasi
          // server (tidak fallback ke cache localStorage yang bisa dipalsukan).
          if (isBackendAuthEnabled()) {
            clearAuth();
            setIsLoading(false);
            return;
          }
          // Try to use cached data if Supabase is unreachable
          const storedUserName = localStorage.getItem('userName');
          const storedUserRole = localStorage.getItem('userRole');
          const storedUserEmail = localStorage.getItem('userEmail');
          const storedUserStatus = localStorage.getItem('userStatus') || 'active';
          const storedEmailNotificationsEnabled = localStorage.getItem('emailNotificationsEnabled') !== 'false';

          if (storedUserName && storedUserRole) {
            if (storedUserStatus === 'suspended') {
              clearAuth();
              setIsLoading(false);
              return;
            }

            setIsAuthenticated(true);
            setUserName(storedUserName);
            setUserRole(storedUserRole);
            setUserId(storedUserId);
            setUserEmail(storedUserEmail || '');
            setUserStatus(storedUserStatus);
            setEmailNotificationsEnabled(storedEmailNotificationsEnabled);
          } else {
            clearAuth();
          }
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // FIX: useCallback agar identitas fungsi stabil untuk value yang di-memo.
  const clearAuth = useCallback(() => {
    setIsAuthenticated(false);
    setUserName('');
    setUserRole('');
    setUserId(null);
    setUserEmail('');
    setUserStatus('active');
    setEmailNotificationsEnabled(true);
    localStorage.removeItem('authToken');
    // Bersihkan sisa key sesi lama (migrasi dari versi idle/absolute timeout)
    localStorage.removeItem('sessionStartedAt');
    sessionStorage.removeItem('session_expired');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userStatus');
    localStorage.removeItem('emailNotificationsEnabled');
  }, []);

  const login = useCallback(async (credentials) => {
    try {
      // If credentials contain username and password, call API
      if (credentials.username && credentials.password) {
        const response = await apiLogin(credentials.username, credentials.password);
        const user = response.user;

        setIsAuthenticated(true);
        setUserName(user.name);
        setUserRole(user.role);
        setUserId(user.id);
        setUserEmail(user.email || '');
        setUserStatus(user.status || 'active');
        setEmailNotificationsEnabled(user.email_notifications_enabled !== false);

        // localStorage is already set by apiLogin

        return { success: true, user };
      } else {
        // Direct login with user data (e.g., from userData object)
        if ((credentials.status || 'active') === 'suspended') {
          clearAuth();
          throw new Error('Akun Anda sedang suspended. Hubungi administrator.');
        }

        setIsAuthenticated(true);
        setUserName(credentials.name || credentials.username);
        setUserRole(credentials.role);
        setUserEmail(credentials.email || '');
        setUserStatus(credentials.status || 'active');
        setEmailNotificationsEnabled(credentials.email_notifications_enabled !== false);
        if (credentials.id) {
          setUserId(credentials.id);
          localStorage.setItem('userId', credentials.id);
        }
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userName', credentials.name || credentials.username);
        localStorage.setItem('userRole', credentials.role);
        localStorage.setItem('userEmail', credentials.email || '');
        localStorage.setItem('userStatus', credentials.status || 'active');
        localStorage.setItem('emailNotificationsEnabled', credentials.email_notifications_enabled === false ? 'false' : 'true');

        return { success: true };
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, [clearAuth]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  // Sesi persistent — tidak ada idle-timeout / batas absolut.
  // (Blok auto-logout sebelumnya sudah dihapus sesuai permintaan.)

  // FIX #1: value di-memo agar konsumen context tidak render ulang setiap
  // AuthProvider render (sebelumnya object literal baru tiap render).
  const value = useMemo(() => ({
    isAuthenticated,
    userName,
    userRole,
    userId,
    userEmail,
    userStatus,
    emailNotificationsEnabled,
    isSuspended: userStatus === 'suspended',
    login,
    logout,
    isLoading
  }), [isAuthenticated, userName, userRole, userId, userEmail, userStatus, emailNotificationsEnabled, login, logout, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
