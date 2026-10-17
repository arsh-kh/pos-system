import React, { useState, useEffect } from 'react';
import { 
  Moon, Sun, Database, Shield, CheckCircle2, AlertTriangle, 
  Download, Upload, RefreshCw, HardDrive, FileJson, Clock, Check, X, 
  AlertCircle, PlusCircle, Trash2, FolderOpen, Save,
  Wifi, WifiOff, Cloud, Globe, Filter, Send, Eye, EyeOff, HelpCircle, Key
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

// Safe Electron IPC Detection
let ipcRenderer = null;
if (typeof window !== 'undefined' && typeof window.require === 'function') {
  try {
    const electron = window.require('electron');
    ipcRenderer = electron?.ipcRenderer || null;
  } catch (_) {}
}

const Settings = () => {
  const { isAdmin } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('pos_theme') || 'dark');
  const [savedNotice, setSavedNotice] = useState(false);
  
  // Backup & Stats State
  const [backupStats, setBackupStats] = useState(null);
  const [localSnapshots, setLocalSnapshots] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [snapshotCreating, setSnapshotCreating] = useState(false);

  // Sync & Cloud State
  const [syncData, setSyncData] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncSaving, setSyncSaving] = useState(false);
  const [cloudUrlInput, setCloudUrlInput] = useState('http://localhost:3001/api/cloud-sync');
  const [autoSyncToggle, setAutoSyncToggle] = useState(true);
  const [syncFilter, setSyncFilter] = useState('ALL'); // 'ALL', 'PENDING', 'SYNCED', 'FAILED'

  // Telegram Cloud Backup State
  const [telegramSettings, setTelegramSettings] = useState(null);
  const [telegramTokenInput, setTelegramTokenInput] = useState('');
  const [telegramChatIdInput, setTelegramChatIdInput] = useState('');
  const [telegramAutoBackup, setTelegramAutoBackup] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramSending, setTelegramSending] = useState(false);
  const [telegramSendSnapLoading, setTelegramSendSnapLoading] = useState(null);
  const [telegramNotice, setTelegramNotice] = useState(null);
  const [showTelegramHelp, setShowTelegramHelp] = useState(false);

  // Restore Modal State
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState(null);
  const [pendingFileName, setPendingFileName] = useState('');
  const [pendingSource, setPendingSource] = useState('UPLOAD'); // 'UPLOAD' or 'LOCAL'
  const [confirmationInput, setConfirmationInput] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);

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

  const fetchBackupData = async () => {
    setStatsLoading(true);
    try {
      const [statsRes, snapsRes, syncRes, tgRes] = await Promise.all([
        fetch('http://localhost:3001/api/backup/stats'),
        fetch('http://localhost:3001/api/backup/local-snapshots'),
        fetch('http://localhost:3001/api/sync/status'),
        fetch('http://localhost:3001/api/backup/telegram/settings')
      ]);
      const statsJson = await statsRes.json();
      const snapsJson = await snapsRes.json();
      const syncJson = await syncRes.json();
      const tgJson = await tgRes.json();
      if (statsJson.status === 'SUCCESS') setBackupStats(statsJson.data);
      if (snapsJson.status === 'SUCCESS') setLocalSnapshots(snapsJson.data);
      if (syncJson.status === 'SUCCESS') {
        setSyncData(syncJson.data);
        if (syncJson.data.settings) {
          setCloudUrlInput(syncJson.data.settings.cloud_url || 'http://localhost:3001/api/cloud-sync');
          setAutoSyncToggle(syncJson.data.settings.auto_sync_enabled);
        }
      }
      if (tgJson.status === 'SUCCESS' && tgJson.data) {
        setTelegramSettings(tgJson.data);
        setTelegramTokenInput(tgJson.data.bot_token || '');
        setTelegramChatIdInput(tgJson.data.chat_id || '');
        setTelegramAutoBackup(Boolean(tgJson.data.auto_backup_enabled));
      }
    } catch (err) {
      console.error('Error fetching backup & sync info:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchBackupData();
    }
  }, [isAdmin]);


  // Handle Full Backup Download
  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/backup');
      if (!response.ok) throw new Error('Backup failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `pos_full_backup_${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Refresh local snapshots list since server saves a copy
      fetchBackupData();
      alert('باکئەپی تەواوی داتابەیس بە سەرکەوتوویی داگیرا و کۆپییەکی لەسەر سێرڤەریش پاشەکەوت کرا!');
    } catch (err) {
      alert('هەڵەیەک ڕوویدا لە کاتی وەرگرتنی باکئەپ: ' + err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  // Handle Native Save Backup via Electron Dialog
  const handleNativeSaveBackup = async () => {
    if (!ipcRenderer) {
      handleDownloadBackup();
      return;
    }
    setBackupLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/backup');
      if (!response.ok) throw new Error('Backup failed');
      const backupJson = await response.json();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultFileName = `pos_full_backup_${timestamp}.json`;
      
      const saveRes = await ipcRenderer.invoke('save-backup-dialog', {
        defaultFileName,
        content: backupJson
      });

      if (saveRes.success) {
        alert(`باکئەپ بە سەرکەوتوویی لە شوێنی دیاریکراو پاشەکەوت کرا:\n${saveRes.filePath}`);
        fetchBackupData();
      }
    } catch (err) {
      alert('هەڵە لە پاشەکەوتکردن: ' + err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  // Handle Create Manual Snapshot on Server
  const handleCreateManualSnapshot = async () => {
    const note = window.prompt('تێبینییەک بۆ ئەم باکئەپە بنووسە (ئارەزوومەندانە):', 'کۆپی دەستی پێش گۆڕانکاری');
    if (note === null) return;

    setSnapshotCreating(true);
    try {
      const response = await fetch('http://localhost:3001/api/backup/create-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note })
      });
      const data = await response.json();
      if (data.status === 'SUCCESS') {
        alert('کۆپی یەدەگ بە سەرکەوتوویی لەسەر سێرڤەر دروستکرا!');
        fetchBackupData();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      alert('هەڵە لە دروستکردنی باکئەپ: ' + err.message);
    } finally {
      setSnapshotCreating(false);
    }
  };

  // Handle Delete Snapshot from Server
  const handleDeleteSnapshot = async (filename) => {
    if (!window.confirm(`ئایا دڵنیایت لە سڕینەوەی ئەم کۆپییە لەسەر سێرڤەر؟\n${filename}`)) {
      return;
    }
    try {
      const response = await fetch(`http://localhost:3001/api/backup/snapshots/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.status === 'SUCCESS') {
        fetchBackupData();
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      alert('هەڵە لە کاتی سڕینەوەی پەڕگە: ' + err.message);
    }
  };

  // Handle Open Backups Folder in Windows Explorer
  const handleOpenBackupsFolder = async () => {
    if (ipcRenderer) {
      const res = await ipcRenderer.invoke('open-backups-folder');
      if (!res.success) {
        alert('نەتوانرا بوخچەکە بکرێتەوە: ' + res.error);
      }
    }
  };

  // Handle Trigger Live Sync
  const handleTriggerSyncNow = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/sync/trigger', { method: 'POST' });
      const json = await res.json();
      if (json.status === 'SUCCESS') {
        alert(json.message);
        fetchBackupData();
      } else {
        alert(json.message || 'هەڵە لە هاوکاتکردن');
      }
    } catch (err) {
      alert('هەڵە لە پەیوەندی: ' + err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  // Handle Save Cloud & Sync Settings
  const handleSaveSyncSettings = async () => {
    setSyncSaving(true);
    try {
      const res = await fetch('http://localhost:3001/api/sync/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloud_url: cloudUrlInput,
          auto_sync_enabled: autoSyncToggle
        })
      });
      const json = await res.json();
      if (json.status === 'SUCCESS') {
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2500);
        fetchBackupData();
      } else {
        alert('هەڵە: ' + json.message);
      }
    } catch (err) {
      alert('هەڵە لە پاشەکەوتکردن: ' + err.message);
    } finally {
      setSyncSaving(false);
    }
  };

  // Handle Cleanup Synced Queue
  const handleCleanupSynced = async () => {
    if (!window.confirm('ئایا دڵنیایت لە سڕینەوەی تۆمارە هاوکاتکراوە کۆنەکان؟')) return;
    try {
      const res = await fetch('http://localhost:3001/api/sync/cleanup', { method: 'POST' });
      const json = await res.json();
      alert(json.message);
      fetchBackupData();
    } catch (err) {
      alert('هەڵە لە پاککردنەوە: ' + err.message);
    }
  };

  // Handle Telegram Settings Save
  const handleSaveTelegramSettings = async () => {
    setTelegramSaving(true);
    setTelegramNotice(null);
    try {
      const res = await fetch('http://localhost:3001/api/backup/telegram/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: telegramTokenInput,
          chat_id: telegramChatIdInput,
          auto_backup_enabled: telegramAutoBackup,
          backup_frequency: 'DAILY'
        })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setTelegramNotice({ type: 'success', message: 'ڕێکخستنەکانی تێلیگرام بە سەرکەوتوویی پاشەکەوت کران' });
        fetchBackupData();
      } else {
        setTelegramNotice({ type: 'error', message: data.message || 'هەڵە لە پاشەکەوتکردن' });
      }
    } catch (err) {
      setTelegramNotice({ type: 'error', message: 'پەیوەندی سەرکەوتوو نەبوو: ' + err.message });
    } finally {
      setTelegramSaving(false);
      setTimeout(() => setTelegramNotice(null), 6000);
    }
  };

  // Handle Telegram Test Connection
  const handleTestTelegramConnection = async () => {
    setTelegramTesting(true);
    setTelegramNotice(null);
    try {
      const res = await fetch('http://localhost:3001/api/backup/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: telegramTokenInput,
          chat_id: telegramChatIdInput
        })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setTelegramNotice({ type: 'success', message: data.message });
      } else {
        setTelegramNotice({ type: 'error', message: data.message || 'پشکنین سەرکەوتوو نەبوو' });
      }
    } catch (err) {
      setTelegramNotice({ type: 'error', message: 'پەیوەندی سەرکەوتوو نەبوو: ' + err.message });
    } finally {
      setTelegramTesting(false);
    }
  };

  // Handle Manual Instant Backup Send to Telegram
  const handleSendBackupToTelegram = async () => {
    setTelegramSending(true);
    setTelegramNotice(null);
    try {
      const res = await fetch('http://localhost:3001/api/backup/telegram/send', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setTelegramNotice({ 
          type: 'success', 
          message: `باکئەپەکە بە سەرکەوتوویی بۆ تێلیگرام نێردرا! (${data.data.filename} - ${Math.round(data.data.sizeBytes / 1024)} KB)` 
        });
        fetchBackupData();
      } else {
        setTelegramNotice({ type: 'error', message: data.message || 'ناردن سەرکەوتوو نەبوو' });
      }
    } catch (err) {
      setTelegramNotice({ type: 'error', message: 'پەیوەندی سەرکەوتوو نەبوو: ' + err.message });
    } finally {
      setTelegramSending(false);
    }
  };

  // Handle Dispatch Specific Snapshot to Telegram
  const handleSendSnapshotToTelegram = async (filename) => {
    setTelegramSendSnapLoading(filename);
    try {
      const res = await fetch(`http://localhost:3001/api/backup/telegram/send-snapshot/${encodeURIComponent(filename)}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        alert(data.message);
        fetchBackupData();
      } else {
        alert('هەڵە لە ناردنی کۆپی بۆ تێلیگرام: ' + (data.message || 'نەزانراو'));
      }
    } catch (err) {
      alert('پەیوەندی سەرکەوتوو نەبوو: ' + err.message);
    } finally {
      setTelegramSendSnapLoading(null);
    }
  };


  // Handle File Upload Selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      alert('تکایە تەنها فایلی باکئەپی جۆری JSON هەڵبژێرە');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed || (typeof parsed !== 'object')) {
          throw new Error('فایلی باکئەپ بەتاڵە یان تێکچووە');
        }
        setPendingBackupData(parsed);
        setPendingFileName(file.name);
        setPendingSource('UPLOAD');
        setConfirmationInput('');
        setRestoreResult(null);
        setRestoreModalOpen(true);
      } catch (err) {
        alert('هەڵە لە خوێندنەوەی فایل: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Handle Select Local Snapshot
  const handleSelectLocalSnapshot = async (snapshot) => {
    setPendingFileName(snapshot.filename);
    setPendingSource('LOCAL');
    setPendingBackupData({
      metadata: snapshot.metadata || { total_tables: '٢٣ خشتە' },
      isLocal: true,
      filename: snapshot.filename
    });
    setConfirmationInput('');
    setRestoreResult(null);
    setRestoreModalOpen(true);
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (confirmationInput.trim().toUpperCase() !== 'RESTORE') {
      alert('تکایە وشەی RESTORE بە پیتی گەورە بنووسە بۆ دڵنیابوونەوە');
      return;
    }

    setRestoreLoading(true);
    try {
      let response;
      if (pendingSource === 'LOCAL') {
        response = await fetch('http://localhost:3001/api/backup/restore-local', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: pendingFileName })
        });
      } else {
        response = await fetch('http://localhost:3001/api/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backupData: pendingBackupData })
        });
      }

      const resData = await response.json();
      if (resData.status !== 'SUCCESS') {
        throw new Error(resData.message || 'هێنانەوە سەرکەوتوو نەبوو');
      }

      setRestoreResult(resData.data);
      fetchBackupData();
    } catch (err) {
      alert('هەڵە لە کاتی هێنانەوەی باکئەپ: ' + err.message);
    } finally {
      setRestoreLoading(false);
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
      <div className="header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>ڕێکخستنەکان</h1>
          <p className="text-secondary">بەڕێوەبردنی ڕووکار، پاراستنی زانیارییەکان، و هێنانەوەی باکئەپ</p>
        </div>
        {savedNotice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981', padding: '8px 16px', borderRadius: '12px' }}>
            <CheckCircle2 size={18} />
            گۆڕانکارییەکان پاشەکەوت کران
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
        
        {/* Appearance Settings */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', color: '#60a5fa' }}>
            <Moon size={24} /> ڕووکاری سیستەم
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            هەڵبژاردنی شێوازی بینینی سیستەم (تاریک یان ڕووناک)
          </p>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={() => applyTheme('dark')}
              style={{ flex: 1, padding: '1.25rem', borderRadius: '16px', background: theme === 'dark' ? 'rgba(59,130,246,0.25)' : 'rgba(0,0,0,0.2)', border: `2px solid ${theme === 'dark' ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`, color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <Moon size={32} color={theme === 'dark' ? '#60a5fa' : '#94a3b8'} />
              <span style={{ fontWeight: 'bold' }}>تاریک</span>
            </button>
            <button 
              onClick={() => applyTheme('light')}
              style={{ flex: 1, padding: '1.25rem', borderRadius: '16px', background: theme === 'light' ? 'rgba(59,130,246,0.15)' : 'rgba(0,0,0,0.2)', border: `2px solid ${theme === 'light' ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`, color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <Sun size={32} color={theme === 'light' ? '#f59e0b' : '#94a3b8'} />
              <span style={{ fontWeight: 'bold' }}>ڕووناک</span>
            </button>
          </div>
        </div>

        {/* Database Health & Stats Card */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: '#38bdf8' }}>
              <HardDrive size={24} /> تەندروستی داتابەیس
            </h3>
            <button 
              onClick={fetchBackupData}
              disabled={statsLoading}
              title="نوێکردنەوەی ئامارەکان"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={statsLoading ? 'animate-spin' : ''} /> نوێکردنەوە
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.2rem' }}>
            <div style={{ padding: '1rem', background: 'rgba(56,189,248,0.05)', borderRadius: '14px', border: '1px solid rgba(56,189,248,0.15)' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>کۆی خشتەکان</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '4px' }}>
                {backupStats ? `${backupStats.totalTables} خشتە` : '...'}
              </div>
            </div>
            <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.05)', borderRadius: '14px', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>کۆی تۆمارەکان (دێڕ)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#10b981', marginTop: '4px' }}>
                {backupStats ? Number(backupStats.totalRows).toLocaleString() : '...'}
              </div>
            </div>
          </div>

          <div style={{ padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', color: '#94a3b8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1', marginBottom: '4px' }}>
              <Clock size={15} color="#38bdf8" /> دوایین باکئەپی سەر سێرڤەر:
            </div>
            {backupStats?.latestBackup ? (
              <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                {new Date(backupStats.latestBackup.createdAt).toLocaleString('en-GB')} ({Math.round(backupStats.latestBackup.sizeBytes / 1024)} KB)
              </span>
            ) : (
              <span>هیچ باکئەپێک هێشتا وەرنەگیراوە</span>
            )}
          </div>
        </div>

        {/* Download Backup Card */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem', color: '#10b981' }}>
            <Download size={24} /> داگرتنی باکئەپی تەواو
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            داگرتنی باکئەپێکی دەستبەجێ بە فۆرماتی JSON کە تەواوی پێکهاتە (Schemas) و داتای ٢٣ خشتەکەی داتابەیس دەگرێتەوە: کاڵاکان، وەجبەکانی FIFO، فرۆشتن، قەرزەکان، مەساریف و هەژمارەکان.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={handleDownloadBackup} 
              disabled={backupLoading}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '1.1rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '16px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(16,185,129,0.1)' }}
            >
              <Download size={20} /> {backupLoading ? 'کۆکردنەوەی داتابەیس... چاوەڕوان بە' : 'داگرتنی باکئەپی داتابەیس (JSON)'}
            </button>

            {ipcRenderer && (
              <button
                onClick={handleNativeSaveBackup}
                disabled={backupLoading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.85rem', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '14px', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                <Save size={18} /> پاشەکەوتکردن لە کۆمپیوتەر یان فلاش (Save Dialog)
              </button>
            )}
          </div>
        </div>

        {/* Restore Backup Card */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem', color: '#f59e0b' }}>
            <Upload size={24} /> هێنانەوەی باکئەپ (Restore)
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            هەڵبژاردنی پەڕگەیەکی باکئەپی کۆن بۆ گەڕاندنەوەی سەرجەم پێکهاتە و داتاکانی فرۆشتن، مەخزەن و قەرزەکان بە شێوازێکی تەواو پارێزراو بە Transaction.
          </p>

          <label 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '1.25rem', background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', border: '1px dashed rgba(245, 158, 11, 0.4)', borderRadius: '16px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', boxSizing: 'border-box' }}
          >
            <FileJson size={22} /> هەڵبژاردنی فایلی باکئەپ (.json)
            <input 
              type="file" 
              accept=".json" 
              onChange={handleFileSelect} 
              style={{ display: 'none' }} 
            />
          </label>
        </div>

        {/* Cloud & Offline Sync Card */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: '#38bdf8' }}>
              <Cloud size={24} /> هاوکاتکردنی کلاود و ئۆفلاین
            </h3>
            {syncData && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '10px', background: syncData.isOnline ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: syncData.isOnline ? '#34d399' : '#f87171', border: `1px solid ${syncData.isOnline ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize: '0.8rem', fontWeight: 'bold' }}>
                {syncData.isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
                {syncData.isOnline ? 'ئۆنلاین' : 'ئۆفلاین'}
              </span>
            )}
          </div>

          <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.2rem', lineHeight: '1.5' }}>
            هاوکاتکردنی خۆکاری فرۆشتن، مەخزەن و داتاکان لەگەڵ سێرڤەری کلاود. لە نەبوونی ئینتەرنێتدا سیستەم ١٠٠٪ بە ئۆفلاین بەردەوام دەبێت.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1.2rem' }}>
            <div style={{ padding: '0.8rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>چاوەڕوانکراوی هاوکات</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#fbbf24', marginTop: '2px' }}>
                {syncData?.pendingCount || 0} پسووڵە
              </div>
            </div>
            <div style={{ padding: '0.8rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>هاوکاتکراوەکان</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#34d399', marginTop: '2px' }}>
                {syncData?.syncedCount || 0} تۆمار
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleTriggerSyncNow}
              disabled={syncLoading}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '1rem', background: 'linear-gradient(135deg, #38bdf8, #0284c7)', color: '#0f172a', border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 'bold', cursor: syncLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
            >
              <RefreshCw size={18} className={syncLoading ? 'animate-spin' : ''} />
              {syncLoading ? 'هاوکات دەکرێت...' : 'هاوکاتکردنی دەستبەجێ (Sync Now)'}
            </button>
          </div>
        </div>

        {/* Telegram Cloud Backup Card */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: '#229ED9' }}>
              <Send size={24} /> باکئەپی کلاودی تێلیگرام
            </h3>
            <button
              onClick={() => setShowTelegramHelp(!showTelegramHelp)}
              style={{ background: 'rgba(34, 158, 217, 0.15)', border: '1px solid rgba(34, 158, 217, 0.3)', color: '#38bdf8', padding: '4px 10px', borderRadius: '10px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <HelpCircle size={14} /> {showTelegramHelp ? 'شاردنەوەی ڕێنمایی' : 'چۆن کار دەکات؟'}
            </button>
          </div>

          <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.2rem', lineHeight: '1.5' }}>
            ناردنی فایلی تەواوی باکئەپی داتابەیس بۆ ناو تێلیگرامی خاوەنکار. ئەگەر کۆمپیوتەر یان هارد دیسک بسووتێت، هەموو داتاکانت لەسەر مۆبایلەکەت پارێزراوە!
          </p>

          {/* Quick Help Box */}
          {showTelegramHelp && (
            <div style={{ padding: '1rem', background: 'rgba(34, 158, 217, 0.08)', borderRadius: '14px', border: '1px solid rgba(34, 158, 217, 0.25)', marginBottom: '1.2rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6' }}>
              <div style={{ fontWeight: 'bold', color: '#38bdf8', marginBottom: '6px' }}>📌 ڕێنمایی بەدەستهێنانی تۆکن و Chat ID:</div>
              <ol style={{ margin: 0, paddingRight: '1.2rem' }}>
                <li>لە تێلیگرام بچۆ ناو <strong>@BotFather</strong> و فەرمانی <code>/newbot</code> لێبدە بۆ دروستکردنی بۆت و کۆپیکردنی Bot Token.</li>
                <li>بچۆ ناو <strong>@userinfobot</strong> و فەرمانی <code>/start</code> لێبدە؛ ژمارەی <code>Id</code>ی خۆت کۆپی بکە بۆ خوارەوە.</li>
                <li><strong>زۆر گرنگ:</strong> پێش ناردن، لەناو تێلیگرام نامەیەک بۆ بۆتەکەت بنێرە (یان Start لێبدە) تاوەکو بۆتەکە مۆڵەتی ناردنی نامەی بۆ تۆ هەبێت!</li>
              </ol>
            </div>
          )}

          {/* Status Alert if any */}
          {telegramNotice && (
            <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', background: telegramNotice.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: telegramNotice.type === 'success' ? '#34d399' : '#f87171', border: `1px solid ${telegramNotice.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
              {telegramNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{telegramNotice.message}</span>
            </div>
          )}

          {/* Last Sent Info */}
          <div style={{ padding: '0.8rem 1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)', marginBottom: '1.2rem', fontSize: '0.82rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <div>
              <span style={{ color: '#cbd5e1' }}>دواین باکئەپی تێلیگرام: </span>
              {telegramSettings?.last_sent_at ? (
                <span style={{ color: '#34d399', fontWeight: 'bold' }}>
                  {new Date(telegramSettings.last_sent_at).toLocaleString('en-GB')}
                </span>
              ) : (
                <span>هێشتا نەنێردراوە</span>
              )}
            </div>
            {telegramSettings?.last_status && telegramSettings.last_status !== 'NONE' && (
              <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', background: telegramSettings.last_status === 'SUCCESS' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: telegramSettings.last_status === 'SUCCESS' ? '#34d399' : '#f87171' }}>
                {telegramSettings.last_status === 'SUCCESS' ? 'سەرکەوتوو' : 'شکستهێناوە'}
              </span>
            )}
          </div>

          {/* Form Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.2rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '4px' }}>
                تۆکنی بۆتی تێلیگرام (Bot Token):
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showToken ? 'text' : 'password'}
                  placeholder={telegramSettings?.masked_token || '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ'}
                  value={telegramTokenInput}
                  onChange={e => setTelegramTokenInput(e.target.value)}
                  style={{ width: '100%', padding: '9px 40px 9px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontSize: '0.88rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '4px' }}>
                ناسنامەی چات (Chat ID / Group ID):
              </label>
              <input
                type="text"
                placeholder="نموونە: 987654321 یان -100123456789"
                value={telegramChatIdInput}
                onChange={e => setTelegramChatIdInput(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontSize: '0.88rem', boxSizing: 'border-box' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', color: '#cbd5e1', marginTop: '2px' }}>
              <input
                type="checkbox"
                checked={telegramAutoBackup}
                onChange={e => setTelegramAutoBackup(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              ناردنی خۆکاری ڕۆژانەی باکئەپ بۆ تێلیگرام (لە کاتی باکئەپی سیستمدا)
            </label>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button
              onClick={handleTestTelegramConnection}
              disabled={telegramTesting}
              style={{ flex: 1, padding: '9px', background: 'rgba(34, 158, 217, 0.15)', color: '#38bdf8', border: '1px solid rgba(34, 158, 217, 0.35)', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.88rem', cursor: telegramTesting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <RefreshCw size={15} className={telegramTesting ? 'animate-spin' : ''} />
              {telegramTesting ? 'پشکنین دەکرێت...' : 'پشکنینی پەیوەندی'}
            </button>
            <button
              onClick={handleSaveTelegramSettings}
              disabled={telegramSaving}
              style={{ flex: 1, padding: '9px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.88rem', cursor: telegramSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Save size={15} />
              {telegramSaving ? 'پاشەکەوت دەکرێت...' : 'پاشەکەوتکردن'}
            </button>
          </div>

          {/* Big Instant Backup to Telegram button */}
          <button
            onClick={handleSendBackupToTelegram}
            disabled={telegramSending}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '1rem', background: 'linear-gradient(135deg, #0284c7, #229ED9)', color: 'white', border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 'bold', cursor: telegramSending ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(34, 158, 217, 0.3)' }}
          >
            <Send size={18} className={telegramSending ? 'animate-spin' : ''} />
            {telegramSending ? 'باکئەپ کۆدەکرێتەوە و دەنێردرێت بۆ تێلیگرام...' : '📤 ناردنی باکئەپی تەواو بۆ تێلیگرام (دەستی)'}
          </button>
        </div>

      </div>

      {/* Local Server Snapshots Section */}
      <div className="glass-panel mt-8" style={{ padding: '2rem', borderRadius: '24px', marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: '#c084fc' }}>
              <Database size={22} /> کۆپییە پارێزراوەکانی سەر سێرڤەر ({localSnapshots.length} کۆپی)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '6px 0 0' }}>
              سیستەم بە بەردەوامی و لەکاتی داگرتنیشدا، کۆپی لەسەر سێرڤەر تۆمار دەکات بۆ پاراستنی هەمیشەیی.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleCreateManualSnapshot}
              disabled={snapshotCreating}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px', background: 'rgba(192, 132, 252, 0.18)', color: '#d8b4fe', border: '1px solid rgba(192, 132, 252, 0.4)', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <PlusCircle size={18} /> {snapshotCreating ? 'دروست دەکرێت...' : 'دروستکردنی کۆپی ئێستا'}
            </button>

            {ipcRenderer && (
              <button
                onClick={handleOpenBackupsFolder}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', background: 'rgba(255, 255, 255, 0.06)', color: '#cbd5e1', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                <FolderOpen size={18} /> کردنەوەی بوخچە لە کۆمپیوتەر
              </button>
            )}
          </div>
        </div>

        {localSnapshots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
            هیچ کۆپییەکی یەدەگ لەسەر سێرڤەر پاشەکەوت نەکراوە. دەتوانیت بە دوگمەی سەرەوە کۆپییەک دروست بکەیت.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead style={{ background: 'rgba(0,0,0,0.3)' }}>
                <tr>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>ناوی پەڕگە</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>جۆر / تێبینی</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>بەروار و کات</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>قەبارە</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>کردار</th>
                </tr>
              </thead>
              <tbody>
                {localSnapshots.map((snap, idx) => {
                  const isAuto = snap.metadata?.type === 'AUTO_DAILY_SNAPSHOT' || snap.filename.includes('_auto_');
                  const isManual = snap.metadata?.type === 'MANUAL_SERVER_SNAPSHOT' || snap.filename.includes('_manual_');
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#38bdf8', fontSize: '0.88rem' }}>
                        {snap.filename}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>
                        {isAuto ? (
                          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                            خۆکار (Auto)
                          </span>
                        ) : isManual ? (
                          <span style={{ background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                            دەستی (Manual)
                          </span>
                        ) : (
                          <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                            داگیراو (Export)
                          </span>
                        )}
                        {snap.metadata?.note && (
                          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '4px' }}>
                            {snap.metadata.note}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.88rem', color: '#cbd5e1' }}>
                        {new Date(snap.createdAt).toLocaleString('en-GB')}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#94a3b8' }}>
                        {Math.round(snap.sizeBytes / 1024)} KB
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          <a 
                            href={`http://localhost:3001/api/backup/download-snapshot/${snap.filename}`}
                            download
                            title="داگرتن بۆ سەر کۆمپیوتەر"
                            style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Download size={14} /> داگرتن
                          </a>
                          <button 
                            onClick={() => handleSelectLocalSnapshot(snap)}
                            title="هێنانەوەی ئەم باکئەپە بۆ ناو داتابەیس"
                            style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc', border: '1px solid rgba(192, 132, 252, 0.3)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold' }}
                          >
                            هێنانەوە
                          </button>
                          <button 
                            onClick={() => handleSendSnapshotToTelegram(snap.filename)}
                            disabled={telegramSendSnapLoading === snap.filename}
                            title="ناردنی ئەم باکئەپە بۆ سەر تێلیگرامی خاوەنکار"
                            style={{ padding: '6px 10px', borderRadius: '8px', background: 'rgba(34, 158, 217, 0.15)', color: '#38bdf8', border: '1px solid rgba(34, 158, 217, 0.3)', cursor: telegramSendSnapLoading === snap.filename ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Send size={13} className={telegramSendSnapLoading === snap.filename ? 'animate-spin' : ''} />
                            {telegramSendSnapLoading === snap.filename ? 'دەچێت...' : 'تێلیگرام'}
                          </button>
                          <button 
                            onClick={() => handleDeleteSnapshot(snap.filename)}
                            title="سڕینەوەی ئەم کۆپییە"
                            style={{ padding: '6px 8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cloud Sync Queue Management Section */}
      <div className="glass-panel mt-8" style={{ padding: '2rem', borderRadius: '24px', marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: '#38bdf8' }}>
              <Cloud size={22} /> ڕیزبەندی هاوکاتکردنی کلاود (Cloud Sync Queue)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '6px 0 0' }}>
              هەموو فرۆشتن، گەڕاندنەوە، زیان، و جەردێک لە کاتی ئۆفلاین لەم ڕیزبەندییەدا کۆدەبنەوە و بە ئۆنلاینبوون دەنێردرێن:
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleCleanupSynced}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <Trash2 size={14} /> پاککردنەوەی کۆنەکان
            </button>
          </div>
        </div>

        {/* Sync Settings Bar */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>ناونیشانی سێرڤەری کلاود (Cloud URL):</label>
            <input 
              type="text" 
              value={cloudUrlInput}
              onChange={e => setCloudUrlInput(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontSize: '0.88rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '18px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', color: '#cbd5e1' }}>
              <input 
                type="checkbox" 
                checked={autoSyncToggle} 
                onChange={e => setAutoSyncToggle(e.target.checked)} 
              />
              هاوکاتکردنی خۆکار لە باکگراوند (Auto-Sync)
            </label>

            <button
              onClick={handleSaveSyncSettings}
              disabled={syncSaving}
              style={{ padding: '8px 16px', borderRadius: '8px', background: '#38bdf8', color: '#0f172a', border: 'none', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              {syncSaving ? 'پاشەکەوت دەکرێت...' : 'پاشەکەوتکردن'}
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
          {['ALL', 'PENDING', 'SYNCED', 'FAILED'].map(f => {
            const labels = { ALL: 'هەمووی', PENDING: 'چاوەڕوان', SYNCED: 'هاوکاتکراو', FAILED: 'شکستهێناو' };
            const isActive = syncFilter === f;
            return (
              <button
                key={f}
                onClick={() => setSyncFilter(f)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '10px',
                  background: isActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.04)',
                  color: isActive ? '#38bdf8' : '#94a3b8',
                  border: `1px solid ${isActive ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>

        {/* Queue Items Table */}
        {(!syncData?.recentQueue || syncData.recentQueue.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
            هیچ تۆمارێک لە ڕیزبەندی هاوکاتکردندا نییە
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead style={{ background: 'rgba(0,0,0,0.3)' }}>
                <tr>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>جۆری کردە</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>ناسنامەی تۆمار</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>دۆخ</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>کات</th>
                </tr>
              </thead>
              <tbody>
                {syncData.recentQueue
                  .filter(item => syncFilter === 'ALL' || item.status === syncFilter)
                  .map((item, idx) => {
                    const typeLabels = {
                      SALE: 'فرۆشتن',
                      RETURN: 'گەڕاندنەوە',
                      DAMAGE: 'زیانەکان',
                      INVENTORY_AUDIT: 'جەردی کۆگا',
                      VENDOR_RETURN: 'گەڕاندنەوە بۆ کۆمپانیا',
                      PRODUCT: 'کاڵا'
                    };
                    const statusColors = {
                      PENDING: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', label: 'لە چاوەڕوانیدایە' },
                      SYNCED: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', label: 'هاوکات کرا' },
                      SYNCING: { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', label: 'دەگوازرێتەوە' },
                      FAILED: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', label: 'شکست' }
                    };
                    const s = statusColors[item.status] || statusColors.PENDING;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#f1f5f9' }}>
                          {typeLabels[item.entity_type] || item.entity_type}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#38bdf8', fontSize: '0.9rem' }}>
                          #{item.entity_id}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '8px', background: s.bg, color: s.text, fontWeight: 'bold', fontSize: '0.82rem' }}>
                            {s.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.88rem', color: '#cbd5e1' }}>
                          {new Date(item.created_at).toLocaleString('en-GB')}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pre-flight Restore Modal */}
      {restoreModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '640px', borderRadius: '24px', padding: '2rem', animation: 'fadeIn 0.3s ease', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b' }}>
                <AlertTriangle color="#f59e0b" /> پشکنین و هێنانەوەی باکئەپ
              </h2>
              <button 
                onClick={() => setRestoreModalOpen(false)} 
                disabled={restoreLoading}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={26} />
              </button>
            </div>

            {restoreResult ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                  <Check size={36} color="#10b981" />
                </div>
                <h3 style={{ fontSize: '1.4rem', color: '#10b981', marginBottom: '0.5rem' }}>
                  باکئەپەکە بە سەرکەوتوویی هێنرایەوە!
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                  سەرجەم {restoreResult.restoredTableCount} خشتە و {Number(restoreResult.restoredRowCount).toLocaleString()} دێڕ داتا بە تەواوی ڕێکخرانەوە.
                </p>
                <button 
                  onClick={() => { setRestoreModalOpen(false); window.location.reload(); }}
                  style={{ padding: '12px 30px', borderRadius: '12px', background: '#10b981', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  نوێکردنەوەی لاپەڕە و بەردەوامبوون
                </button>
              </div>
            ) : (
              <div>
                {/* File info card */}
                <div style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>پەڕگەی هەڵبژێردراو:</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#38bdf8', fontSize: '1rem', wordBreak: 'break-all' }}>
                    {pendingFileName}
                  </div>
                  {pendingBackupData?.metadata?.exported_at && (
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '6px' }}>
                      بەرواری دروستبوون: <b>{new Date(pendingBackupData.metadata.exported_at).toLocaleString('en-GB')}</b>
                    </div>
                  )}
                  {pendingBackupData?.metadata?.total_tables && (
                    <div style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '4px' }}>
                      کۆی خشتەکان: <b>{pendingBackupData.metadata.total_tables} خشتە</b>
                    </div>
                  )}
                </div>

                {/* Critical Danger Alert */}
                <div style={{ padding: '1rem 1.2rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '14px', marginBottom: '1.5rem', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <AlertCircle size={24} color="#f87171" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '0.9rem', color: '#fca5a5', lineHeight: '1.5' }}>
                    <b>ئاگاداری گرنگ:</b> هێنانەوەی ئەم باکئەپە، سەرجەم داتاکانی ئێستای داتابەیس دەسڕێتەوە و دەگەڕێتەوە بۆ کاتی دروستکردنی ئەم باکئەپە. تکایە دڵنیابە لە پەڕگەکەت پێش جێبەجێکردن.
                  </div>
                </div>

                {/* Safety Input Confirmation */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '8px' }}>
                    بۆ دڵنیابوونەوە لە ڕستۆرکردن، بنووسە: <b style={{ color: '#f59e0b' }}>RESTORE</b>
                  </label>
                  <input 
                    type="text" 
                    value={confirmationInput}
                    onChange={(e) => setConfirmationInput(e.target.value)}
                    placeholder="لێرە بنووسە RESTORE"
                    disabled={restoreLoading}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', fontSize: '1rem', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    onClick={handleExecuteRestore}
                    disabled={restoreLoading || confirmationInput.trim().toUpperCase() !== 'RESTORE'}
                    style={{ flex: 1, padding: '14px', borderRadius: '12px', background: confirmationInput.trim().toUpperCase() === 'RESTORE' ? '#ef4444' : 'rgba(255,255,255,0.08)', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: confirmationInput.trim().toUpperCase() === 'RESTORE' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                  >
                    <RefreshCw size={18} className={restoreLoading ? 'animate-spin' : ''} />
                    {restoreLoading ? 'داتاکان دەگەڕێندرێنەوە...' : 'هێنانەوەی یەکجارەکی (Restore)'}
                  </button>
                  <button 
                    onClick={() => setRestoreModalOpen(false)}
                    disabled={restoreLoading}
                    style={{ padding: '14px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: '#94a3b8', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    پەشیمانبوونەوە
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
