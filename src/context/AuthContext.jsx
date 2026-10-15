import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Default user state stored in localStorage
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('pos_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { username: 'admin', role: 'ADMIN' };
      }
    }
    return { username: 'admin', role: 'ADMIN' };
  });

  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync axios headers whenever currentUser changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('pos_user', JSON.stringify(currentUser));
      axios.defaults.headers.common['x-user-name'] = currentUser.username;
      axios.defaults.headers.common['x-user-role'] = currentUser.role;
      const token = localStorage.getItem('token');
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
    }
  }, [currentUser]);

  // Login handler
  const login = async (username, password) => {
    setIsSubmitting(true);
    setLoginError('');
    try {
      const res = await axios.post('http://localhost:3001/api/auth/login', {
        username: username.trim(),
        password: password.trim()
      });

      if (res.data.status === 'SUCCESS') {
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        setCurrentUser(user);
        setIsSwitchModalOpen(false);
        return { success: true };
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'ناو یان وشەی نهێنی هەڵەیە';
      setLoginError(msg);
      return { success: false, message: msg };
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick switch role (e.g. for testing or fast cashier shift switch)
  const switchUserFast = (role, customName = null) => {
    const newName = customName || (role === 'ADMIN' ? 'admin' : 'کاشێری سەرەکی');
    const newUser = { username: newName, role };
    setCurrentUser(newUser);
    localStorage.setItem('pos_user', JSON.stringify(newUser));
    setIsSwitchModalOpen(false);
  };

  const logout = () => {
    localStorage.removeItem('token');
    switchUserFast('CASHIER', 'کاشێری گشتی');
  };

  const isAdmin = currentUser?.role === 'ADMIN';
  const isCashier = currentUser?.role === 'CASHIER';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin,
        isCashier,
        login,
        logout,
        switchUserFast,
        isSwitchModalOpen,
        setIsSwitchModalOpen,
        loginError,
        setLoginError,
        isSubmitting
      }}
    >
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
