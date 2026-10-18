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
  EyeOff
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
    isSubmitting
  } = useAuth();

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('pos_theme') || 'light');

  // Live Sync & Connectivity State
  const [syncData, setSyncData] = useState(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

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

  const handleTriggerSyncNow = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/sync/trigger', {
        method: 'POST'
      });
      const json = await res.json();
      if (json.status === 'SUCCESS') {
        fetchSyncStatus();
      } else {
        alert(json.message || 'هەڵە لە هاوکاتکردن');
      }
    } catch (err) {
      alert('هەڵە لە پەیوەندی: ' + err.message);
    } finally {
      setSyncLoading(false);
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
              مارکێتی سەرەکی
            </span>
          </div>

          <div style={{ height: '18px', width: '1px', background: 'var(--border-color)' }} />

          {/* User Badge */}
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '4px 12px', 
              borderRadius: '8px', 
              background: isAdmin ? 'rgba(37, 99, 235, 0.12)' : 'var(--accent-light)',
              border: isAdmin ? '1px solid rgba(37, 99, 235, 0.35)' : '1px solid rgba(14, 165, 233, 0.3)',
              color: isAdmin ? '#1d4ed8' : 'var(--accent-color)',
              fontWeight: 700,
              fontSize: '0.8rem'
            }}
          >
            {isAdmin ? <Crown size={14} /> : <User size={14} />}
            <span>{isAdmin ? 'بەڕێوەبەر' : 'کاشێر'}:</span>
            <span style={{ color: 'var(--text-primary)' }}>{currentUser?.username || 'کاشێری سەرەکی'}</span>
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

        {/* Right / End: Actions, Sync, Theme Toggle & Login/Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Live Internet Connectivity Badge */}
          {syncData && (
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '9999px',
                background: syncData.isOnline ? 'var(--success-light)' : 'var(--danger-light)',
                border: syncData.isOnline ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                color: syncData.isOnline ? 'var(--success-color)' : 'var(--danger-color)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setIsSyncModalOpen(true)}
              title={syncData.isOnline ? 'ئینتەرنێت هەیە و بەستراوەتەوە' : 'سیستەم بە شێوازی دەرەوەی هێڵ کار دەکات'}
            >
              {syncData.isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>{syncData.isOnline ? 'سەرهێڵ' : 'دەرەوەی هێڵ'}</span>
            </div>
          )}

          {/* Sync Queue Badge for Admin */}
          {isAdmin && syncData && (
            <button
              onClick={() => setIsSyncModalOpen(true)}
              title="دۆخی هاوکاتکردنی کلاود"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '9999px',
                background: syncData.pendingCount > 0 ? 'var(--warning-light)' : 'var(--accent-light)',
                border: syncData.pendingCount > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(14, 165, 233, 0.3)',
                color: syncData.pendingCount > 0 ? 'var(--warning-color)' : 'var(--accent-color)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Cloud size={14} />
              {syncData.pendingCount > 0 ? (
                <span>{syncData.pendingCount} چاوەڕوان</span>
              ) : (
                <span>هاوکاتە</span>
              )}
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => navigate('/settings')}
              title="بەڕێوەبردنی باکئەپ و پاراستنی داتابەیس"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '9999px',
                background: 'var(--accent-light)',
                color: 'var(--accent-hover)',
                border: '1px solid rgba(14, 165, 233, 0.3)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.82rem'
              }}
            >
              <ShieldCheck size={15} /> باکئەپ
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

          {/* Login / Logout Button */}
          {isAdmin ? (
            <button
              onClick={handleLogoutToCashier}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                borderRadius: '9999px',
                background: 'var(--danger-light)',
                color: 'var(--danger-color)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.82rem'
              }}
            >
              <LogOut size={14} /> دەرچوون لە ئەدمین
            </button>
          ) : (
            <button
              onClick={() => {
                setLoginError('');
                setIsSwitchModalOpen(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                borderRadius: '9999px',
                background: 'var(--accent-gradient)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.82rem',
                boxShadow: 'var(--btn-shadow)'
              }}
            >
              <KeyRound size={14} /> چوونەژوورەوەی ئەدمین
            </button>
          )}
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

      {/* Cloud & Offline Sync Inspector Modal */}
      {isSyncModalOpen && (
        <div 
          className="pos-modal-overlay"
          onClick={() => setIsSyncModalOpen(false)}
        >
          <div 
            className="pos-modal-card pos-modal-lg"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '12px', background: 'var(--accent-light)', color: 'var(--accent-color)' }}>
                  <Cloud size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)', fontWeight: 800 }}>دۆخی هاوکاتکردنی ناوخۆیی و کلاود</h2>
                  <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    چاودێری ڕاستەوخۆی ئینتەرنێت، داتاکانی فرۆشتن و ڕیزبەندی کلاود
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsSyncModalOpen(false)}
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
                <X size={20} />
              </button>
            </div>

            {/* Network Banner */}
            <div 
              style={{
                padding: '12px 16px',
                borderRadius: '14px',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: syncData?.isOnline ? 'var(--success-light)' : 'var(--warning-light)',
                border: syncData?.isOnline ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                color: syncData?.isOnline ? 'var(--success-color)' : '#b45309'
              }}
            >
              {syncData?.isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
              <div style={{ fontSize: '0.88rem', lineHeight: '1.4' }}>
                {syncData?.isOnline ? (
                  <span><b>ئینتەرنێت چالاکە و بەستراوەتەوە:</b> هەموو فرۆشتن و گۆڕانکارییەکان بە ئۆتۆماتیک لە باکگراونددا دەنێردرێنە سەر کلاود.</span>
                ) : (
                  <span><b>دۆخی دەرەوەی هێڵ (Offline Mode):</b> سیستەم بە تەواوی و بەبێ وەستان لەسەر کۆمپیوتەرەکەت کار دەکات. گۆڕانکارییەکان لەناو ڕیزبەندی ناوخۆییدا پارێزراون و دەستبەجێ بە گەڕانەوەی ئینتەرنێت هاوکات دەکرێن.</span>
                )}
              </div>
            </div>

            {/* Stats Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: 'var(--warning-light)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>لە چاوەڕوانیدایە</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--warning-color)', marginTop: '4px' }}>
                  {syncData?.pendingCount || 0}
                </div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--success-light)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>هاوکاتکراوەکان</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success-color)', marginTop: '4px' }}>
                  {syncData?.syncedCount || 0}
                </div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--accent-light)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>دوایین هاوکاتکردن</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-color)', marginTop: '8px' }}>
                  {syncData?.lastSuccessfulSync ? new Date(syncData.lastSuccessfulSync).toLocaleTimeString('en-GB') : 'هێشتا نەکراوە'}
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
              <button
                onClick={handleTriggerSyncNow}
                disabled={syncLoading}
                className="btn-primary"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  cursor: syncLoading ? 'not-allowed' : 'pointer'
                }}
              >
                <RefreshCw size={16} className={syncLoading ? 'animate-spin' : ''} />
                {syncLoading ? 'هاوکات دەکرێت...' : 'هاوکاتکردنی دەستبەجێ (Sync Now)'}
              </button>

              <button
                onClick={() => {
                  setIsSyncModalOpen(false);
                  navigate('/settings');
                }}
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 18px',
                  fontWeight: 700
                }}
              >
                ڕێکخستنی کلاود <ArrowUpRight size={16} />
              </button>
            </div>

            {/* Recent Queue Table */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>دواین تۆمارەکانی ڕیزبەندی (Sync Queue):</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>کۆی گشتی: {syncData?.totalQueueCount || 0}</span>
              </div>

              {(!syncData?.recentQueue || syncData.recentQueue.length === 0) ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', borderRadius: '14px', fontSize: '0.88rem' }}>
                  هیچ تۆمارێک لە ڕیزبەندی هاوکاتکردندا نییە
                </div>
              ) : (
                <div style={{ maxHeight: '220px', overflowY: 'auto', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.84rem' }}>
                    <thead style={{ background: 'var(--bg-tertiary)', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>جۆر</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>ناسنامە</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>دۆخ</th>
                        <th style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>کات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncData.recentQueue.map((item, idx) => {
                        const typeLabels = {
                          SALE: 'فرۆشتن',
                          RETURN: 'گەڕاندنەوە',
                          DAMAGE: 'زیانەکان',
                          INVENTORY_AUDIT: 'جەردی کۆگا',
                          VENDOR_RETURN: 'گەڕاندنەوە بۆ کۆمپانیا',
                          PRODUCT: 'کاڵا'
                        };
                        const statusColors = {
                          PENDING: { bg: 'var(--warning-light)', text: 'var(--warning-color)', label: 'چاوەڕوان' },
                          SYNCED: { bg: 'var(--success-light)', text: 'var(--success-color)', label: 'هاوکاتە' },
                          SYNCING: { bg: 'var(--accent-light)', text: 'var(--accent-color)', label: 'دەنێردرێت' },
                          FAILED: { bg: 'var(--danger-light)', text: 'var(--danger-color)', label: 'شکست' }
                        };
                        const s = statusColors[item.status] || statusColors.PENDING;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {typeLabels[item.entity_type] || item.entity_type}
                            </td>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                              #{item.entity_id}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ padding: '3px 10px', borderRadius: '9999px', background: s.bg, color: s.text, fontWeight: 700, fontSize: '0.75rem' }}>
                                {s.label}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              {new Date(item.created_at).toLocaleTimeString('en-GB')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default UserBar;
