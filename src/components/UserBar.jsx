import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  User, 
  KeyRound, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  Crown, 
  AlertCircle,
  Wifi,
  WifiOff,
  Cloud,
  Clock,
  ArrowUpRight,
  Sun,
  Moon,
  LogOut,
  Store,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  ShoppingCart
} from 'lucide-react';

const UserBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    currentUser, 
    isAdmin, 
    login, 
    logout,
    switchUserFast, 
    isSwitchModalOpen, 
    setIsSwitchModalOpen,
    loginError,
    setLoginError,
    isSubmitting,
    canCashier
  } = useAuth();

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('pos_theme') || 'light');

  // Live Connectivity State
  const [syncData, setSyncData] = useState(null);

  // Poll sync status
  const fetchSyncStatus = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/sync/status');
      const json = await res.json();
      if (json.status === 'SUCCESS') {
        setSyncData(json.data);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(nextTheme);
    localStorage.setItem('pos_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    if (nextTheme === 'light') {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    } else {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    }
  };



  const handleLoginFormSubmit = async (e) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) return;
    const res = await login(usernameInput, passwordInput);
    if (res?.success) {
      setUsernameInput('');
      setPasswordInput('');
      setShowPassword(false);
      setIsSwitchModalOpen(false);
    }
  };

  const handleLogoutToCashier = () => {
    if (logout) {
      logout();
    } else {
      switchUserFast('CASHIER', 'کاشێری سەرەکی');
    }
  };

  return (
    <>
      {/* Top Floating User Status Bar */}
      <header 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          padding: '6px 14px',
          fontSize: '0.86rem',
          zIndex: 999,
          position: 'sticky',
          top: 0,
          boxShadow: 'var(--card-shadow)'
        }}
      >
        {/* Left / Start: Brand & Active User Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {location.pathname !== '/' && (
            <button
              onClick={() => navigate('/')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 12px',
                borderRadius: '8px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.8rem',
                transition: 'all 0.15s ease'
              }}
              title="گەڕانەوە بۆ پەڕەی سەرەکی"
            >
              <ArrowRight size={14} />
              <span>سەرەکی</span>
            </button>
          )}

          <div 
            onClick={() => navigate('/')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              cursor: 'pointer',
              padding: '2px 8px',
              borderRadius: '8px',
              transition: 'background 0.2s'
            }}
          >
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'var(--primary-color)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Store size={16} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
              {localStorage.getItem('pos_store_name') && localStorage.getItem('pos_store_name') !== 'مارکێتی حاجی ئاکۆ' ? localStorage.getItem('pos_store_name') : 'مارکێتی شارەکام'}
            </span>
          </div>

          {!isAdmin && (
            <span style={{ 
              color: '#d97706', 
              fontSize: '0.75rem', 
              background: 'var(--warning-light)', 
              padding: '3px 8px', 
              borderRadius: '6px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Lock size={12} /> دەسەڵاتی کاشێر
            </span>
          )}
        </div>

        {/* Right / End: Actions, Cashier Quick Access, Connectivity & Theme */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Quick Cashier Button */}
          {canCashier('pos_cashier') && (
            <button
              onClick={() => navigate('/cashier')}
              title="کردنەوەی شاشەی کاشێر و فرۆشتن"
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '0.84rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(99, 102, 241, 0.25)'
              }}
            >
              <ShoppingCart size={15} /> کاشێر
            </button>
          )}

          {/* Calm Internet Connectivity Pill */}
          {syncData && (
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '9999px',
                background: syncData.isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: syncData.isOnline ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                color: syncData.isOnline ? 'var(--success-color)' : 'var(--danger-color)',
                fontSize: '0.78rem',
                fontWeight: 700,
                userSelect: 'none'
              }}
              title={syncData.isOnline ? 'سیستەم بەستراوەتەوە بە ئینتەرنێت' : 'سیستەم لە دۆخی دەرەوەی هێڵدایە (لۆکاڵ کار دەکات)'}
            >
              {syncData.isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
              <span>{syncData.isOnline ? 'سەرهێڵ' : 'دەرەوەی هێڵ'}</span>
            </div>
          )}

          {isAdmin && (
            <button
              onClick={() => navigate('/settings')}
              title="ڕێکخستنەکان و پاراستنی داتاکان"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '9999px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.82rem'
              }}
            >
              <ShieldCheck size={14} /> ڕێکخستن
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={currentTheme === 'light' ? 'گۆڕین بۆ دۆخی تاریک' : 'گۆڕین بۆ دۆخی ڕووناک'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '9999px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer'
            }}
          >
            {currentTheme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {/* Unified Sign Out Button */}
          <button
            onClick={logout}
            title="دەرچوون لە هەژمار و گەڕانەوە بۆ لاپەڕەی چوونەژوورەوە"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#dc2626',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.82rem',
              transition: 'all 0.15s ease'
            }}
          >
            <LogOut size={14} /> دەرچوون
          </button>
        </div>
      </header>

      {/* Switch User & Login Modal (Strict Password Login - No 1-click bypass) */}
      {isSwitchModalOpen && (
        <div 
          className="pos-modal-overlay"
          onClick={() => setIsSwitchModalOpen(false)}
        >
          <div 
            className="pos-modal-card pos-modal-sm"
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'var(--accent-light)',
                  color: 'var(--accent-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <KeyRound size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)', fontWeight: 800 }}>
                    چوونەژوورەوەی بەڕێوەبەر
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    تکایە ناوی بەکارهێنەر و وشەی نهێنی بنووسە
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsSwitchModalOpen(false)}
                style={{ 
                  background: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)', 
                  color: 'var(--text-secondary)', 
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLoginFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loginError && (
                <div style={{ 
                  padding: '10px 14px', 
                  borderRadius: '12px', 
                  background: 'var(--danger-light)', 
                  border: '1px solid rgba(239, 68, 68, 0.3)', 
                  color: 'var(--danger-color)', 
                  fontSize: '0.85rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px' 
                }}>
                  <AlertCircle size={18} /> {loginError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                  ناوی بەکارهێنەر (Username)
                </label>
                <input 
                  type="text" 
                  required 
                  autoFocus
                  placeholder="بۆ نموونە: admin"
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                  وشەی نهێنی (Password)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    required 
                    placeholder="وشەی نهێنی بنووسە..."
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                    style={{
                      position: 'absolute',
                      left: '10px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px'
                    }}
                    title={showPassword ? 'شاردنەوەی وشەی نهێنی' : 'پیشاندانی وشەی نهێنی'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary"
                style={{
                  padding: '13px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.96rem',
                  marginTop: '6px'
                }}
              >
                {isSubmitting ? 'کەمێک بوەستە...' : 'چوونەژوورەوە 🚀'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default UserBar;
