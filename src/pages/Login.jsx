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
  Users,
  ChevronDown
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
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
            مارکێتی شارەکەم
          </h1>

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
          {/* Username Dropdown Option Selector */}
          <div style={{ marginBottom: '18px' }}>
            <label htmlFor="pos-login-username" style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              ناوی بەکارهێنەر (Username)
            </label>
            <div style={{ position: 'relative' }}>
              <User size={17} color="var(--text-muted)" style={{ position: 'absolute', right: '12px', top: '13px', pointerEvents: 'none' }} />
              <select
                id="pos-login-username"
                required
                autoFocus
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                  const pwInput = document.getElementById('pos-login-password');
                  if (pwInput) pwInput.focus();
                }}
                style={{
                  width: '100%',
                  padding: '11px 38px 11px 36px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: username ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: '0.92rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none'
                }}
              >
                <option value="" disabled style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                  ناوی بەکارهێنەر هەڵبژێرە...
                </option>
                <option value="admin" style={{ color: 'var(--text-primary)', background: 'var(--bg-secondary)' }}>
                  بەڕێوەبەر (Admin)
                </option>
                {cashiersList.map((c) => (
                  <option key={c.id || c.username} value={c.username} style={{ color: 'var(--text-primary)', background: 'var(--bg-secondary)' }}>
                    {c.full_name ? `${c.full_name} (${c.username})` : c.username}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '14px', pointerEvents: 'none' }} />
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


      </div>
    </div>
  );
};

export default Login;
