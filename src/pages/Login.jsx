import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  User, 
  ShieldCheck, 
  LogIn, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Sun,
  Moon,
  Store,
  Users
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login, isSubmitting } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [cashiersList, setCashiersList] = useState([]);
  const [loadingCashiers, setLoadingCashiers] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('pos_theme') || 'light');

  // Toggle Theme
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('pos_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    if (newTheme === 'light') {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    } else {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    }
  };

  // Fetch available cashiers for quick-select profile chips
  useEffect(() => {
    const fetchCashiers = async () => {
      try {
        setLoadingCashiers(true);
        const res = await axios.get('http://localhost:3001/api/users/cashiers');
        if (res.data?.status === 'SUCCESS' && Array.isArray(res.data.data)) {
          setCashiersList(res.data.data);
        }
      } catch (err) {
        console.warn('Could not load cashiers for quick selection:', err.message);
      } finally {
        setLoadingCashiers(false);
      }
    };
    fetchCashiers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('تکایە ناوی بەکارهێنەر و وشەی نهێنی بنووسە');
      return;
    }

    setError('');
    const result = await login(username.trim(), password);
    if (!result.success) {
      setError(result.message || 'ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە');
    }
  };

  const selectUser = (uName) => {
    setUsername(uName);
    setError('');
    // Automatically focus password input
    const pwInput = document.getElementById('pos-login-password');
    if (pwInput) pwInput.focus();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-primary)',
      padding: '20px',
      direction: 'rtl',
      fontFamily: 'inherit',
      position: 'relative'
    }}>
      {/* Theme Toggle Top-Left */}
      <button
        onClick={toggleTheme}
        type="button"
        title="گۆڕینی ڕەنگی سیستەم"
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '8px 12px',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.82rem',
          fontWeight: 600
        }}
      >
        {theme === 'dark' ? <Sun size={16} color="#f59e0b" /> : <Moon size={16} color="#6366f1" />}
        <span>{theme === 'dark' ? 'دۆخی ڕۆژ' : 'دۆخی شەو'}</span>
      </button>

      {/* Main Card */}
      <div style={{
        width: '100%',
        maxWidth: '450px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '20px',
        padding: '32px 28px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
        boxSizing: 'border-box'
      }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, var(--accent-color) 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px auto',
            boxShadow: '0 6px 16px rgba(37, 99, 235, 0.3)'
          }}>
            <Store size={32} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            {localStorage.getItem('pos_store_name') || 'مارکێتی حاجی ئاکۆ'}
          </h1>
          <div style={{ fontSize: '0.9rem', color: '#10b981', fontWeight: 700, direction: 'ltr', marginBottom: '8px' }}>
            {localStorage.getItem('pos_store_phone') || '0772 979 0421'}
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
            تکایە ناوی بەکارهێنەر و وشەی نهێنی بنووسە بۆ چوونەژوورەوە
          </p>
        </div>

        {/* Quick User Selection Chips */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <Users size={14} /> هەڵبژاردنی خێرای هەژمار:
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {/* Admin Chip */}
            <button
              type="button"
              onClick={() => selectUser('admin')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: username === 'admin' ? '1.5px solid #6366f1' : '1px solid var(--border-color)',
                background: username === 'admin' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-tertiary)',
                color: username === 'admin' ? '#6366f1' : 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease'
              }}
            >
              <ShieldCheck size={14} /> بەڕێوەبەر (Admin)
            </button>

            {/* Cashiers Chips */}
            {cashiersList.map((c) => {
              const isSelected = username === c.username;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectUser(c.username)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: isSelected ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                    background: isSelected ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                    color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <User size={13} /> {c.full_name || c.username}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#dc2626',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '18px',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Username Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              ناوی بەکارهێنەر (Username)
            </label>
            <div style={{ position: 'relative' }}>
              <User size={17} color="var(--text-muted)" style={{ position: 'absolute', right: '12px', top: '12px' }} />
              <input
                id="pos-login-username"
                type="text"
                required
                autoFocus
                placeholder="بۆ نموونە: admin یان cashier"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 38px 11px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.92rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>

          {/* Password Input */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              وشەی نهێنی (Password)
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={17} color="var(--text-muted)" style={{ position: 'absolute', right: '12px', top: '12px' }} />
              <input
                id="pos-login-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="وشەی نهێنی بنووسە..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 38px 11px 40px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.92rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '10px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              height: '46px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, var(--accent-color) 0%, #1d4ed8 100%)',
              color: '#ffffff',
              fontSize: '0.98rem',
              fontWeight: 800,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              opacity: isSubmitting ? 0.7 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            <LogIn size={18} />
            <span>{isSubmitting ? 'پشکنین...' : 'چوونەژوورەوە'}</span>
          </button>
        </form>

        {/* Security Notice Footer */}
        <div style={{ marginTop: '22px', textAlign: 'center', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          هەموو چوونەژوورەوەیەک لە تۆماری چاودێری (Audit Logs) پارێزراوە.
        </div>
      </div>
    </div>
  );
};

export default Login;
