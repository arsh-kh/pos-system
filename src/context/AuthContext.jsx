import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Session user state: null on fresh startup, requiring mandatory username & password
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = sessionStorage.getItem('pos_user') || localStorage.getItem('pos_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role && parsed.username) return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Cashier Permissions State
  const [cashierPermissions, setCashierPermissions] = useState({
    permissions: [],
    map: {}
  });
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // Fetch cashier permissions from backend
  const fetchPermissions = async () => {
    try {
      setPermissionsLoading(true);
      const res = await axios.get('http://localhost:3001/api/permissions/cashier');
      if (res.data?.status === 'SUCCESS' && res.data?.data) {
        setCashierPermissions(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch cashier permissions:', err.message);
    } finally {
      setPermissionsLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  // Sync axios headers whenever currentUser changes
  useEffect(() => {
    if (currentUser) {
      sessionStorage.setItem('pos_user', JSON.stringify(currentUser));
      localStorage.setItem('pos_user', JSON.stringify(currentUser));
      axios.defaults.headers.common['x-user-name'] = currentUser.username;
      axios.defaults.headers.common['x-user-role'] = currentUser.role;
      const token = localStorage.getItem('token');
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } else {
        delete axios.defaults.headers.common['Authorization'];
      }
    } else {
      sessionStorage.removeItem('pos_user');
      localStorage.removeItem('pos_user');
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      delete axios.defaults.headers.common['x-user-name'];
      delete axios.defaults.headers.common['x-user-role'];
    }
  }, [currentUser]);

  // Update permissions handler (Admin only)
  const updatePermissions = async (updates) => {
    try {
      const res = await axios.put('http://localhost:3001/api/permissions/cashier', { updates });
      if (res.data?.status === 'SUCCESS' && res.data?.data) {
        setCashierPermissions(res.data.data);
        return { success: true, message: res.data.message };
      }
      return { success: false, message: res.data?.message || 'هەڵە لە نوێکردنەوە' };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'هەڵە لە نوێکردنەوەی دەسەڵاتەکان';
      return { success: false, message: msg };
    }
  };

  // Check if Cashier has permission for a specific key
  // Admins always have permission for everything
  const canCashier = (permissionKey) => {
    if (currentUser?.role === 'ADMIN') return true;
    if (!cashierPermissions?.map || Object.keys(cashierPermissions.map).length === 0) {
      return true;
    }
    return Boolean(cashierPermissions.map[permissionKey]);
  };

  // Mandatory Login handler (Username + Password)
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
        sessionStorage.setItem('pos_user', JSON.stringify(user));
        setCurrentUser(user);
        setIsSwitchModalOpen(false);
        fetchPermissions();
        return { success: true, user };
      }
      return { success: false, message: res.data?.message || 'ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە' };
    } catch (err) {
      const msg = err.response?.data?.message || 'ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە';
      setLoginError(msg);
      return { success: false, message: msg };
    } finally {
      setIsSubmitting(false);
    }
  };

  // Change Password & Username handler
  const changePassword = async (oldPassword, newPassword, newUsername) => {
    setIsSubmitting(true);
    setLoginError('');
    try {
      const res = await axios.post('http://localhost:3001/api/auth/change-password', {
        username: currentUser?.username || 'admin',
        oldPassword,
        newPassword,
        newUsername
      });
      if (res.data?.status === 'SUCCESS' && res.data?.data) {
        const updated = { ...currentUser, ...res.data.data };
        setCurrentUser(updated);
        try {
          sessionStorage.setItem('pos_user', JSON.stringify(updated));
          localStorage.setItem('pos_user', JSON.stringify(updated));
        } catch (_) {}
      }
      return { success: res.data?.status === 'SUCCESS', message: res.data?.message, user: res.data?.data };
    } catch (err) {
      const msg = err.response?.data?.message || 'هەڵە لە کاتی نوێکردنەوەی هەژمار';
      return { success: false, message: msg };
    } finally {
      setIsSubmitting(false);
    }
  };

  // Switch User / Logout: prompts for username & password
  const logout = () => {
    sessionStorage.removeItem('pos_user');
    localStorage.removeItem('pos_user');
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    delete axios.defaults.headers.common['x-user-name'];
    delete axios.defaults.headers.common['x-user-role'];
    setCurrentUser(null);
    setIsSwitchModalOpen(false);
  };

  const lockToCashier = () => {
    logout();
  };

  const switchUserFast = () => {
    logout();
  };

  const isAdmin = currentUser?.role === 'ADMIN';
  const isCashier = currentUser?.role === 'CASHIER';
  const isAuthenticated = Boolean(currentUser);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin,
        isCashier,
        isAuthenticated,
        login,
        logout,
        lockToCashier,
        changePassword,
        switchUserFast,
        isSwitchModalOpen,
        setIsSwitchModalOpen,
        loginError,
        setLoginError,
        isSubmitting,
        cashierPermissions,
        permissionsLoading,
        fetchPermissions,
        updatePermissions,
        canCashier
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
