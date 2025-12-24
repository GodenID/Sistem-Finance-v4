import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, login as apiLogin, logout as apiLogout } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage dan validate session saat aplikasi pertama kali dimuat
    const checkAuth = async () => {
      const authStatus = localStorage.getItem('isAuthenticated');
      const storedUserId = localStorage.getItem('userId');

      if (authStatus === 'true' && storedUserId) {
        try {
          // Fetch user data from Supabase to validate session
          const user = await getCurrentUser();
          if (user) {
            setIsAuthenticated(true);
            setUserName(user.name);
            setUserRole(user.role);
            setUserId(user.id);
          } else {
            // User not found - clear auth
            clearAuth();
          }
        } catch (error) {
          console.error('Error validating session:', error);
          // Try to use cached data if Supabase is unreachable
          const storedUserName = localStorage.getItem('userName');
          const storedUserRole = localStorage.getItem('userRole');

          if (storedUserName && storedUserRole) {
            setIsAuthenticated(true);
            setUserName(storedUserName);
            setUserRole(storedUserRole);
            setUserId(storedUserId);
          } else {
            clearAuth();
          }
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const clearAuth = () => {
    setIsAuthenticated(false);
    setUserName('');
    setUserRole('');
    setUserId(null);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
  };

  const login = async (credentials) => {
    try {
      // If credentials contain username and password, call API
      if (credentials.username && credentials.password) {
        const response = await apiLogin(credentials.username, credentials.password);
        const user = response.user;

        setIsAuthenticated(true);
        setUserName(user.name);
        setUserRole(user.role);
        setUserId(user.id);

        // localStorage is already set by apiLogin

        return { success: true, user };
      } else {
        // Direct login with user data (e.g., from userData object)
        setIsAuthenticated(true);
        setUserName(credentials.name || credentials.username);
        setUserRole(credentials.role);
        if (credentials.id) {
          setUserId(credentials.id);
          localStorage.setItem('userId', credentials.id);
        }
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userName', credentials.name || credentials.username);
        localStorage.setItem('userRole', credentials.role);

        return { success: true };
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
    }
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      userName,
      userRole,
      userId,
      login,
      logout,
      isLoading
    }}>
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
