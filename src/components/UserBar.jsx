import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ArrowUpRight
} from 'lucide-react';

const UserBar = () => {
  const navigate = useNavigate();
  const { 
    currentUser, 
    isAdmin, 
    login, 
    switchUserFast, 
    isSwitchModalOpen, 
    setIsSwitchModalOpen,
    loginError,
    setLoginError,
    isSubmitting
  } = useAuth();

  const [activeTab, setActiveTab] = useState('QUICK'); // 'QUICK' or 'LOGIN'
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

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
    }
  };

  return (
    <>
      {/* Top Floating User Status Bar */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '8px 24px',
          fontSize: '0.88rem',
          zIndex: 999,
          position: 'sticky',
          top: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>بەکارهێنەری چالاک:</span>
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '4px 12px', 
              borderRadius: '20px', 
              background: isAdmin ? 'rgba(168, 85, 247, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: isAdmin ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
              color: isAdmin ? '#c084fc' : '#34d399',
              fontWeight: 'bold',
              fontSize: '0.85rem'
            }}
          >
            {isAdmin ? <Crown size={15} /> : <User size={15} />}
            <span>{isAdmin ? 'بەڕێوەبەر (Admin)' : 'کاشێر (Cashier)'}:</span>
            <span style={{ color: 'white' }}>{currentUser?.username || 'کاشێری سەرەکی'}</span>
          </div>

          {!isAdmin && (
            <span style={{ color: '#f59e0b', fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
              🔒 دەسەڵاتی کاشێر (سڕینەوە و قازانج قوفڵکراون)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Live Internet Connectivity Badge */}
          {syncData && (
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '12px',
                background: syncData.isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: syncData.isOnline ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                color: syncData.isOnline ? '#34d399' : '#f87171',
                fontSize: '0.78rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
              onClick={() => setIsSyncModalOpen(true)}
              title={syncData.isOnline ? 'ئینتەرنێت هەیە و بەستراوەتەوە' : 'سیستەم بە شێوازی ئۆفلاین کار دەکات'}
            >
              {syncData.isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
              <span>{syncData.isOnline ? 'ئۆنلاین' : 'ئۆفلاین'}</span>
            </div>
          )}

          {/* Sync Queue Badge for Admin */}
          {isAdmin && syncData && (
            <button
              onClick={() => setIsSyncModalOpen(true)}
              title="دۆخی هاوکاتکردنی کلاود (کلیک بکە بۆ وردەکاری)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '12px',
                background: syncData.pendingCount > 0 ? 'rgba(245, 158, 11, 0.18)' : 'rgba(56, 189, 248, 0.12)',
                border: syncData.pendingCount > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(56, 189, 248, 0.3)',
                color: syncData.pendingCount > 0 ? '#fbbf24' : '#38bdf8',
                fontSize: '0.78rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Cloud size={13} />
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
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '10px',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.82rem',
                transition: 'all 0.2s'
              }}
            >
              <ShieldCheck size={14} /> باکئەپ و پاراستن
            </button>
          )}

          <button
            onClick={() => {
              setLoginError('');
              setIsSwitchModalOpen(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 14px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#cbd5e1',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.82rem',
              transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          >
            <RefreshCw size={14} /> گۆڕینی بەکارهێنەر / چوونەژوورەوە
          </button>
        </div>
      </div>

      {/* Switch User & Login Modal */}
      {isSwitchModalOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '16px'
          }}
        >
          <div 
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '24px',
              padding: '24px',
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', margin: 0, color: '#38bdf8' }}>
                <KeyRound size={22} /> گۆڕینی بەکارهێنەر و دەسەڵاتەکان
              </h2>
              <button 
                onClick={() => setIsSwitchModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs Toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('QUICK')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  background: activeTab === 'QUICK' ? '#38bdf8' : 'transparent',
                  color: activeTab === 'QUICK' ? '#0f172a' : '#94a3b8'
                }}
              >
                ⚡ گۆڕینی خێرا (Quick Role)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('LOGIN')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  background: activeTab === 'LOGIN' ? '#38bdf8' : 'transparent',
                  color: activeTab === 'LOGIN' ? '#0f172a' : '#94a3b8'
                }}
              >
                🔑 چوونەژوورەوە بە وشەی نهێنی
              </button>
            </div>

            {activeTab === 'QUICK' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
                  بۆ تاقیکردنەوەی دەسەڵاتەکان و کارکردنی خێرا، کلیک لەسەر یەکێک لەم هەژمارانە بکە:
                </p>

                {/* Select Admin */}
                <button
                  type="button"
                  onClick={() => switchUserFast('ADMIN', 'admin')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderRadius: '14px',
                    background: isAdmin ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: isAdmin ? '2px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'right'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc' }}>
                      <Crown size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>بەڕێوەبەر (Admin)</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>دەسەڵاتی تەواو: بینینی قازانج، سڕینەوە، ڕاپۆرت و چاودێری</div>
                    </div>
                  </div>
                  {isAdmin && <CheckCircle2 size={20} color="#c084fc" />}
                </button>

                {/* Select Cashier */}
                <button
                  type="button"
                  onClick={() => switchUserFast('CASHIER', 'کاشێری سەرەکی')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderRadius: '14px',
                    background: !isAdmin ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: !isAdmin ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'right'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
                      <User size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>کاشێر (Cashier)</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>فرۆشتن، کۆگا و گەڕاندنەوە (سڕینەوە و قازانج قوفڵکراون)</div>
                    </div>
                  </div>
                  {!isAdmin && <CheckCircle2 size={20} color="#34d399" />}
                </button>
              </div>
            ) : (
              <form onSubmit={handleLoginFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {loginError && (
                  <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={18} /> {loginError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                    ناوی بەکارهێنەر (Username)
                  </label>
                  <input 
                    type="text" 
                    required 
                    placeholder="بۆ نموونە: admin یان cashier"
                    value={usernameInput}
                    onChange={e => setUsernameInput(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                    وشەی نهێنی (Password)
                  </label>
                  <input 
                    type="password" 
                    required 
                    placeholder="وشەی نهێنی بنووسە..."
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', outline: 'none' }}
                  />
                  <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                    ئەدمینی سەرەتا: admin / admin123 | کاشێر: cashier / 1234
                  </small>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                    color: '#0f172a',
                    border: 'none',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    marginTop: '8px'
                  }}
                >
                  {isSubmitting ? 'کەمێک بوەستە...' : 'چوونەژوورەوە 🚀'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Cloud & Offline Sync Inspector Modal */}
      {isSyncModalOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem'
          }}
          onClick={() => setIsSyncModalOpen(false)}
        >
          <div 
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '680px',
              borderRadius: '24px',
              padding: '2rem',
              animation: 'fadeIn 0.25s ease',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                  <Cloud size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'white' }}>دۆخی هاوکاتکردنی ئۆفلاین و کلاود</h2>
                  <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                    چاودێری ڕاستەوخۆی ئینتەرنێت، داتاکانی فرۆشتن و ڕیزبەندی کلاود
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsSyncModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={24} />
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
                background: syncData?.isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                border: syncData?.isOnline ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                color: syncData?.isOnline ? '#34d399' : '#fbbf24'
              }}
            >
              {syncData?.isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
              <div style={{ fontSize: '0.88rem', lineHeight: '1.4' }}>
                {syncData?.isOnline ? (
                  <span><b>ئینتەرنێت چالاکە و بەستراوەتەوە:</b> هەموو فرۆشتن و گۆڕانکارییەکان بە ئۆتۆماتیک لە باکگراونددا دەنێردرێنە سەر کلاود.</span>
                ) : (
                  <span><b>دۆخی ئۆفلاین (Offline Mode):</b> سیستەم بە تەواوی و بەبێ وەستان لەسەر کۆمپیوتەرەکەت کار دەکات. گۆڕانکارییەکان لەناو ڕیزبەندی لۆکاڵدا پارێزراون و دەستبەجێ بە گەڕانەوەی ئینتەرنێت هاوکات دەکرێن.</span>
                )}
              </div>
            </div>

            {/* Stats Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>لە چاوەڕوانیدایە</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#fbbf24', marginTop: '4px' }}>
                  {syncData?.pendingCount || 0}
                </div>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>هاوکاتکراوەکان</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#34d399', marginTop: '4px' }}>
                  {syncData?.syncedCount || 0}
                </div>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>دوایین هاوکاتکردن</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '8px' }}>
                  {syncData?.lastSuccessfulSync ? new Date(syncData.lastSuccessfulSync).toLocaleTimeString('en-GB') : 'هێشتا نەکراوە'}
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
              <button
                onClick={handleTriggerSyncNow}
                disabled={syncLoading}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
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
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 18px',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                ڕێکخستنی کلاود <ArrowUpRight size={16} />
              </button>
            </div>

            {/* Recent Queue Table */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#cbd5e1' }}>دواین تۆمارەکانی ڕیزبەندی (Sync Queue):</span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>کۆی گشتی: {syncData?.totalQueueCount || 0}</span>
              </div>

              {(!syncData?.recentQueue || syncData.recentQueue.length === 0) ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', fontSize: '0.88rem' }}>
                  هیچ تۆمارێک لە ڕیزبەندی هاوکاتکردندا نییە
                </div>
              ) : (
                <div style={{ maxHeight: '220px', overflowY: 'auto', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.84rem' }}>
                    <thead style={{ background: 'rgba(0,0,0,0.3)', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ padding: '8px 12px', color: '#94a3b8' }}>جۆر</th>
                        <th style={{ padding: '8px 12px', color: '#94a3b8' }}>ناسنامە</th>
                        <th style={{ padding: '8px 12px', color: '#94a3b8' }}>دۆخ</th>
                        <th style={{ padding: '8px 12px', color: '#94a3b8' }}>کات</th>
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
                          PENDING: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', label: 'چاوەڕوان' },
                          SYNCED: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', label: 'هاوکاتە' },
                          SYNCING: { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', label: 'دەنێردرێت' },
                          FAILED: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', label: 'شکست' }
                        };
                        const s = statusColors[item.status] || statusColors.PENDING;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 'bold', color: '#f1f5f9' }}>
                              {typeLabels[item.entity_type] || item.entity_type}
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#94a3b8' }}>
                              #{item.entity_id}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '6px', background: s.bg, color: s.text, fontWeight: 'bold', fontSize: '0.75rem' }}>
                                {s.label}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', color: '#64748b', fontSize: '0.78rem' }}>
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

