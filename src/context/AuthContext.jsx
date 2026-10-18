import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Default user state stored in localStorage; defaults safely to CASHIER
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('pos_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role) return parsed;
      } catch {
        return { username: 'کاشێری گشتی', role: 'CASHIER' };
      }
    }
    return { username: 'کاشێری گشتی', role: 'CASHIER' };
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
      localStorage.setItem('pos_user', JSON.stringify(currentUser));
      axios.defaults.headers.common['x-user-name'] = currentUser.username;
      axios.defaults.headers.common['x-user-role'] = currentUser.role;
      const token = localStorage.getItem('token');
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } else {
        delete axios.defaults.headers.common['Authorization'];
      }
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
      // Safe fallback while loading
      return true;
    }
    return Boolean(cashierPermissions.map[permissionKey]);
  };

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

  // Change Password handler
  const changePassword = async (oldPassword, newPassword) => {
    setIsSubmitting(true);
    setLoginError('');
    try {
      const res = await axios.post('http://localhost:3001/api/auth/change-password', {
        username: currentUser?.username || 'admin',
        oldPassword,
        newPassword
      });
      return { success: res.data?.status === 'SUCCESS', message: res.data?.message };
    } catch (err) {
      const msg = err.response?.data?.message || 'هەڵە لە کاتی گۆڕینی وشەی نهێنی';
      return { success: false, message: msg };
    } finally {
      setIsSubmitting(false);
    }
  };

  // Switch role: only CASHIER shifts can switch fast without password
  const switchUserFast = (role, customName = null) => {
    if (role === 'ADMIN') {
      setIsSwitchModalOpen(true);
      return;
    }
    const newName = customName || 'کاشێری سەرەکی';
    const newUser = { username: newName, role: 'CASHIER' };
    setCurrentUser(newUser);
    localStorage.setItem('pos_user', JSON.stringify(newUser));
    setIsSwitchModalOpen(false);
  };

  // Lock admin session and revert to cashier
  const lockToCashier = () => {
    localStorage.removeItem('token');
    const cashierUser = { username: 'کاشێری گشتی', role: 'CASHIER' };
    setCurrentUser(cashierUser);
    localStorage.setItem('pos_user', JSON.stringify(cashierUser));
    setIsSwitchModalOpen(false);
  };

  const logout = () => {
    lockToCashier();
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
