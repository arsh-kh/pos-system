import React, { useState } from 'react';
import { Moon, Sun, Database, Shield, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const Settings = () => {
  const { isAdmin } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('pos_theme') || 'dark');
  const [savedNotice, setSavedNotice] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  // Apply theme immediately
  const applyTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('pos_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    if (newTheme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/backup');
      if (!response.ok) throw new Error('Backup failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pos_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      alert('باکئەپی داتابەیس بە سەرکەوتوویی دابەزێنرا!');
    } catch (err) {
      alert('هەڵەیەک ڕوویدا لە کاتی وەرگرتنی باکئەپ');
    } finally {
      setBackupLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="dashboard-page p-8" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <AlertTriangle size={40} color="#f87171" />
        </div>
        <h2 style={{ fontSize: '1.6rem', color: '#f87171', marginBottom: '10px' }}>دەسەڵاتی بینینی ئەم بەشەت نییە</h2>
        <p style={{ color: '#94a3b8', maxWidth: '500px', margin: '0 auto' }}>
          بەشی ڕێکخستنی سیستەم و باکئەپ تایبەتە بە بەڕێوەبەر (Admin). تکایە لە شریتی سەرەوە بە هەژماری ئەدمین بچۆ ژوورەوە.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-page p-8" style={{ position: 'relative' }}>
      <div className="header mb-8" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'}}>
        <div>
            <h1>ڕێکخستنەکان</h1>
            <p className="text-secondary">بەڕێوەبردنی ڕووکار و پاراستنی داتابەیس</p>
        </div>
        {savedNotice && (
          <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981', padding: '8px 16px', borderRadius: '12px'}}>
            <CheckCircle2 size={18} />
            گۆڕانکارییەکان پاشەکەوت کران
          </div>
        )}
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '2rem'}}>
        
        {/* Appearance Settings */}
        <div className="glass-panel" style={{padding: '2rem', borderRadius: '24px'}}>
            <h3 style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', color: '#60a5fa'}}>
                <Moon size={24} /> ڕووکاری سیستەم
            </h3>
            
            <p style={{color: '#94a3b8', fontSize: '0.95rem', marginBottom: '1.5rem'}}>
                هەڵبژاردنی شێوازی بینینی سیستەم (تاریک یان ڕووناک)
            </p>

            <div style={{display: 'flex', gap: '1rem'}}>
                <button 
                    onClick={() => applyTheme('dark')}
                    style={{flex: 1, padding: '1.25rem', borderRadius: '16px', background: theme === 'dark' ? 'rgba(59,130,246,0.25)' : 'rgba(0,0,0,0.2)', border: `2px solid ${theme === 'dark' ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`, color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s'}}
                >
                    <Moon size={32} color={theme === 'dark' ? '#60a5fa' : '#94a3b8'} />
                    <span style={{fontWeight: 'bold'}}>تاریک</span>
                </button>
                <button 
                    onClick={() => applyTheme('light')}
                    style={{flex: 1, padding: '1.25rem', borderRadius: '16px', background: theme === 'light' ? 'rgba(59,130,246,0.15)' : 'rgba(0,0,0,0.2)', border: `2px solid ${theme === 'light' ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`, color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s'}}
                >
                    <Sun size={32} color={theme === 'light' ? '#f59e0b' : '#94a3b8'} />
                    <span style={{fontWeight: 'bold'}}>ڕووناک</span>
                </button>
            </div>
        </div>

        {/* System Management */}
        <div className="glass-panel" style={{padding: '2rem', borderRadius: '24px'}}>
            <h3 style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', color: '#10b981'}}>
                <Shield size={24} /> بەڕێوەبردنی سیستەم و باکئەپ
            </h3>
            
            <p style={{color: '#94a3b8', fontSize: '0.95rem', marginBottom: '1.5rem'}}>
                داگرتنی کۆپییەکی یەدەگی تەواوی داتابەیس بۆ پاراستنی هەموو داتاکانی فرۆشتن، کاڵاکان و قەرزەکان
            </p>

            <button 
                onClick={handleBackup} 
                disabled={backupLoading}
                style={{width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '1.25rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'}}
            >
                <Database size={24} /> {backupLoading ? 'چاوەڕوان بە...' : 'داگرتنی باکئەپی داتابەیس'}
            </button>
        </div>

      </div>
    </div>
  );
};

export default Settings;
