import React, { useState, useEffect } from 'react';
import { 
  Moon, Sun, Database, Shield, CheckCircle2, AlertTriangle, 
  Download, Upload, RefreshCw, HardDrive, FileJson, Clock, Check, X, 
  AlertCircle, PlusCircle, Trash2, FolderOpen, Save,
  Wifi, WifiOff, Cloud, Globe, Filter, Send, Eye, EyeOff, HelpCircle, Key, Lock,
  Copy, ExternalLink, Edit2, Printer, ScanBarcode, Volume2, Zap, HelpCircle as HelpIcon,
  Bot, Info, BookOpen, FileText, Folder
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
  const { isAdmin, currentUser, changePassword, lockToCashier, cashierPermissions, updatePermissions } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('pos_theme') || 'dark');
  const [savedNotice, setSavedNotice] = useState(false);

  // -------------------------------------------------------------
  // Hardware Management: Thermal Printer & Barcode Scanner State
  // -------------------------------------------------------------
  const [printersList, setPrintersList] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(() => localStorage.getItem('pos_selected_printer') || '');
  const [paperWidth, setPaperWidth] = useState(() => localStorage.getItem('pos_paper_width') || '80mm');
  const [silentPrint, setSilentPrint] = useState(() => localStorage.getItem('pos_silent_print') === 'true');
  const [hardwareNotice, setHardwareNotice] = useState('');
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [isDrawerTesting, setIsDrawerTesting] = useState(false);

  // Live Barcode Scanner Test Pad State
  const [scannerTestInput, setScannerTestInput] = useState('');
  const [lastScannedItem, setLastScannedItem] = useState(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  // Fetch installed Windows printers on mount
  useEffect(() => {
    const fetchPrinters = async () => {
      if (ipcRenderer) {
        try {
          const res = await ipcRenderer.invoke('get-printers');
          if (res?.success && Array.isArray(res.printers)) {
            setPrintersList(res.printers);
            if (!selectedPrinter) {
              const def = res.printers.find(p => p.isDefault);
              if (def) setSelectedPrinter(def.name);
            }
          }
        } catch (_) {}
      }
    };
    fetchPrinters();
  }, [selectedPrinter]);

  const handleSaveHardwareSettings = () => {
    localStorage.setItem('pos_selected_printer', selectedPrinter);
    localStorage.setItem('pos_paper_width', paperWidth);
    localStorage.setItem('pos_silent_print', silentPrint ? 'true' : 'false');
    setHardwareNotice('ڕێکخستنەکانی چاپکەر و ئامێرەکان بە سەرکەوتوویی پاشەکەوت کران');
    setTimeout(() => setHardwareNotice(''), 3500);
  };

  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    setHardwareNotice('');
    try {
      if (ipcRenderer) {
        const storeName = localStorage.getItem('pos_store_name') || 'مارکێتی نموونەیی';
        const res = await ipcRenderer.invoke('print-test-receipt', {
          printerName: selectedPrinter,
          storeName,
          paperWidth
        });
        if (res?.success) {
          setHardwareNotice('پسووڵەی تاقیکردنەوە ڕەوانەی چاپکەر کرا');
        } else {
          setHardwareNotice(res?.error || 'کێشەیەک لە ناردن بۆ چاپکەر ڕوویدا');
        }
      } else {
        window.print();
        setHardwareNotice('پەنجەرەی چاپکردنی تاقیکردنەوە کرایەوە');
      }
    } catch (err) {
      setHardwareNotice('هەڵە لە چاپکردن: ' + (err.message || ''));
    } finally {
      setIsTestPrinting(false);
      setTimeout(() => setHardwareNotice(''), 4000);
    }
  };

  const handleTestDrawer = async () => {
    setIsDrawerTesting(true);
    setHardwareNotice('');
    try {
      if (ipcRenderer) {
        await ipcRenderer.invoke('test-cash-drawer');
        ipcRenderer.send('open-cash-drawer');
      }
      setHardwareNotice('فەرمانی کردنەوەی قاسەی پارە (RJ11 Pulse) نێردرا');
    } catch (_) {
      setHardwareNotice('قاسەی پارە کرایەوە');
    } finally {
      setIsDrawerTesting(false);
      setTimeout(() => setHardwareNotice(''), 3000);
    }
  };

  const playScanBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (_) {}
  };

  const handleScannerTestSubmit = (e) => {
    e.preventDefault();
    if (!scannerTestInput.trim()) return;
    playScanBeep();
    const cleanCode = scannerTestInput.trim();
    setLastScannedItem({
      code: cleanCode,
      length: cleanCode.length,
      time: new Date().toLocaleTimeString('en-GB'),
      isScale: cleanCode.length === 13 && (cleanCode.startsWith('20') || cleanCode.startsWith('21') || cleanCode.startsWith('22'))
    });
    setScannerTestInput('');
  };

  // Cashier Selected Fields & Permissions State
  const [permDraft, setPermDraft] = useState({});
  const [permSaving, setPermSaving] = useState(false);
  const [permNotice, setPermNotice] = useState('');

  useEffect(() => {
    if (cashierPermissions?.map) {
      setPermDraft(cashierPermissions.map);
    }
  }, [cashierPermissions]);

  const handleTogglePerm = (key) => {
    setPermDraft(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSavePermissions = async () => {
    setPermSaving(true);
    setPermNotice('');
    const res = await updatePermissions(permDraft);
    setPermSaving(false);
    if (res?.success) {
      setPermNotice('دەسەڵاتەکان بە سەرکەوتوویی پاشەکەوت کران');
      setTimeout(() => setPermNotice(''), 3000);
    } else {
      alert(res?.message || 'هەڵە لە نوێکردنەوەی دەسەڵاتەکان');
    }
  };

  // Admin Security & Password Change State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');
  
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

  // Telegram Cloud Backup State (Multiple Recipients Support)
  const [telegramSettings, setTelegramSettings] = useState(null);
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramSending, setTelegramSending] = useState(false);
  const [telegramSendSnapLoading, setTelegramSendSnapLoading] = useState(null);
  const [telegramNotice, setTelegramNotice] = useState(null);
  const [telegramCheckingPair, setTelegramCheckingPair] = useState(false);
  const [editingRecipientId, setEditingRecipientId] = useState(null);
  const [editingRecipientName, setEditingRecipientName] = useState('');
  const [copiedBotLink, setCopiedBotLink] = useState(false);

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
      const interval = setInterval(() => {
        fetchBackupData();
      }, 7000);
      return () => clearInterval(interval);
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

  // Toggle Recipient Active Checkbox
  const handleToggleRecipient = async (id) => {
    try {
      const res = await fetch(`http://localhost:3001/api/backup/telegram/recipients/${id}/toggle`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        fetchBackupData();
      }
    } catch (err) {
      alert('هەڵە لە گۆڕینی دۆخ: ' + err.message);
    }
  };

  // Copy Telegram Bot Invite Link
  const handleCopyBotLink = () => {
    const link = `https://t.me/${telegramSettings?.bot_username || 'cashier_system_bot'}`;
    navigator.clipboard.writeText(link);
    setCopiedBotLink(true);
    setTimeout(() => setCopiedBotLink(false), 3000);
  };

  // Start Editing Recipient Name
  const handleStartEditRecipient = (r) => {
    setEditingRecipientId(r.id);
    setEditingRecipientName(r.recipient_name);
  };

  // Save Recipient Name
  const handleSaveRecipientName = async (id) => {
    if (!editingRecipientName.trim()) return;
    try {
      const res = await fetch(`http://localhost:3001/api/backup/telegram/recipients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_name: editingRecipientName.trim() })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setEditingRecipientId(null);
        fetchBackupData();
        setTelegramNotice({ type: 'success', message: 'ناوی وەرگر بە سەرکەوتوویی نوێکرایەوە' });
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('هەڵە لە نوێکردنەوەی ناو: ' + err.message);
    }
  };

  // Delete Recipient
  const handleDeleteRecipient = async (id, name) => {
    if (!window.confirm(`ئایا دڵنیایت لە سڕینەوەی وەرگر: ${name}؟`)) return;
    try {
      const res = await fetch(`http://localhost:3001/api/backup/telegram/recipients/${id}`, { method: 'DELETE' });
      const data = await res.json();
      fetchBackupData();
      setTelegramNotice({ type: 'success', message: data.message });
    } catch (err) {
      alert('هەڵە لە سڕینەوە: ' + err.message);
    }
  };

  // Test Specific Recipient Ping
  const handleTestRecipient = async (id) => {
    setTelegramNotice(null);
    try {
      const res = await fetch(`http://localhost:3001/api/backup/telegram/recipients/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setTelegramNotice({ type: 'success', message: data.message });
      } else {
        setTelegramNotice({ type: 'error', message: data.message || 'ناردن سەرکەوتوو نەبوو' });
      }
    } catch (err) {
      setTelegramNotice({ type: 'error', message: 'پەیوەندی سەرکەوتوو نەبوو: ' + err.message });
    }
  };

  // Toggle Auto-Backup
  const handleToggleTelegramAuto = async (enabled) => {
    try {
      const res = await fetch('http://localhost:3001/api/backup/telegram/toggle-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        fetchBackupData();
      }
    } catch (err) {
      alert('هەڵە لە گۆڕینی دۆخ: ' + err.message);
    }
  };

  // Check Pairing Status
  const handleCheckPairing = async () => {
    setTelegramCheckingPair(true);
    setTelegramNotice(null);
    try {
      const res = await fetch('http://localhost:3001/api/backup/telegram/auto-detect', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setTelegramNotice({ type: 'success', message: data.message });
        fetchBackupData();
      } else {
        setTelegramNotice({ type: 'error', message: data.message });
      }
    } catch (err) {
      setTelegramNotice({ type: 'error', message: 'پەیوەندی سەرکەوتوو نەبوو: ' + err.message });
    } finally {
      setTelegramCheckingPair(false);
    }
  };

  // Handle Telegram Test Connection Ping
  const handleTestTelegramConnection = async () => {
    setTelegramTesting(true);
    setTelegramNotice(null);
    try {
      const res = await fetch('http://localhost:3001/api/backup/telegram/test', {
        method: 'POST'
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
          message: data.message 
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        
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
              style={{ flex: 1, padding: '1.25rem', borderRadius: '16px', background: theme === 'dark' ? 'var(--primary-light)' : 'var(--bg-tertiary)', border: `2px solid ${theme === 'dark' ? 'var(--accent-color)' : 'var(--border-color)'}`, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <Moon size={32} color={theme === 'dark' ? 'var(--accent-color)' : 'var(--text-muted)'} />
              <span style={{ fontWeight: 'bold' }}>تاریک</span>
            </button>
            <button 
              onClick={() => applyTheme('light')}
              style={{ flex: 1, padding: '1.25rem', borderRadius: '16px', background: theme === 'light' ? 'var(--primary-light)' : 'var(--bg-tertiary)', border: `2px solid ${theme === 'light' ? 'var(--accent-color)' : 'var(--border-color)'}`, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <Sun size={32} color={theme === 'light' ? '#f59e0b' : 'var(--text-muted)'} />
              <span style={{ fontWeight: 'bold' }}>ڕووناک</span>
            </button>
          </div>
        </div>

        {/* Security & Admin Password Management Card */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: '#f59e0b' }}>
                <Key size={24} /> ئاسایش و وشەی نهێنی
              </h3>
              <span style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 600 }}>
                هەژمار: {currentUser?.username || 'admin'}
              </span>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              وشەی نهێنی بەڕێوەبەر نوێ بکەرەوە بۆ پاراستنی دارایی و قازانجەکان لە بەکارهێنەرانی تر.
            </p>

            {passwordChangeError && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} /> {passwordChangeError}
              </div>
            )}

            {passwordChangeSuccess && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> {passwordChangeSuccess}
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              setPasswordChangeError('');
              setPasswordChangeSuccess('');

              if (!oldPassword || !newPassword || !confirmPassword) {
                setPasswordChangeError('تکایە هەموو خانەکان پڕبکەرەوە');
                return;
              }

              if (newPassword.length < 4) {
                setPasswordChangeError('وشەی نهێنی نوێ نابێت لە ٤ پیت کەمتر بێت');
                return;
              }

              if (newPassword !== confirmPassword) {
                setPasswordChangeError('وشەی نهێنی نوێ و دووبارەکردنەوەکەی وەک یەک نین');
                return;
              }

              setPasswordChangeLoading(true);
              try {
                const res = await changePassword(oldPassword, newPassword);
                if (res?.success) {
                  setPasswordChangeSuccess('وشەی نهێنی بە سەرکەوتوویی نوێکرایەوە!');
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                } else {
                  setPasswordChangeError(res?.message || 'هەڵە لە کاتی گۆڕینی وشەی نهێنی');
                }
              } catch (err) {
                setPasswordChangeError(err.message || 'هەڵەیەک ڕوویدا');
              } finally {
                setPasswordChangeLoading(false);
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '4px' }}>
                  وشەی نهێنی ئێستا (کۆن)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type={showOldPass ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    placeholder="وشەی نهێنی کۆن بنووسە..."
                    required
                    style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    tabIndex="-1"
                    style={{ position: 'absolute', left: '10px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    {showOldPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '4px' }}>
                  وشەی نهێنی نوێ
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="لانیکەم ٤ پیت یان ژمارە..."
                    required
                    style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    tabIndex="-1"
                    style={{ position: 'absolute', left: '10px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '4px' }}>
                  دووبارەکردنەوەی وشەی نهێنی نوێ
                </label>
                <input 
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="دووبارە وشەی نهێنی نوێ بنووسەوە..."
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={passwordChangeLoading}
                  style={{ flex: 1, padding: '11px', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff', border: 'none', fontWeight: 'bold', fontSize: '0.92rem', cursor: passwordChangeLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s' }}
                >
                  <Key size={16} />
                  {passwordChangeLoading ? 'نوێ دەکرێتەوە...' : 'نوێکردنەوەی وشەی نهێنی'}
                </button>

                <button
                  type="button"
                  onClick={() => lockToCashier()}
                  title="قفڵکردنی بەڕێوەبەر و گەڕانەوە بۆ کاشێر"
                  style={{ padding: '11px 16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 'bold', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Lock size={15} /> قوفڵکردن
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Section 1.5: Cashier Selected Fields & Permissions Management (دەسەڵاتەکانی کاشێر و دیاریکردنی خانەکان) */}
      <div style={{ marginTop: '2.5rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={22} color="#10b981" /> دەسەڵاتەکانی کاشێر و دیاریکردنی خانەکان (Cashier Permissions & Fields)
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              وەک بەڕێوەبەر، دەتوانیت دیاری بکەیت کاشێر دەستی بە کام بەش و کام کردار و خانەی سیستەمەکە ڕابگات، بۆ ڕێگریکردن لە دەستکاری نەخوازراو.
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {permNotice && (
              <span style={{ fontSize: '0.85rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600 }}>
                {permNotice}
              </span>
            )}
            <button
              type="button"
              onClick={handleSavePermissions}
              disabled={permSaving}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff', border: 'none', fontWeight: 'bold',
                cursor: permSaving ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s ease'
              }}
            >
              <Save size={18} />
              {permSaving ? 'پاشەکەوت دەکرێت...' : 'پاشەکەوتکردنی دەسەڵاتەکان'}
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', marginBottom: '2.5rem' }}>
        {/* Sub-section A: POS Actions & Selected Fields inside Cashier Screen */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2563eb' }}></span>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              کردار و خانەکانی ناو شاشەی فرۆشتن (POS Actions & Inputs)
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
              ڕێگەپێدان یان قفڵکردنی نرخ، داشکاندن و سڕینەوە بۆ کاشێر
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {[
              { key: 'allow_manual_discount', label: 'داشکاندنی دەستی', desc: 'ڕێگەدان بە کاشێر داشکاندن لەسەر پسوولە بکات', color: '#f59e0b' },
              { key: 'allow_custom_price', label: 'دەستکاری نرخی فرۆشتن', desc: 'ڕێگەدان بە کاشێر نرخی تاکەکەسی کاڵا لە سەبەتە بگۆڕێت', color: '#ef4444' },
              { key: 'allow_delete_item', label: 'سڕینەوەی کاڵا لە سەبەتە', desc: 'ڕێگەدان بە کاشێر کاڵا لە سەبەتەی کڕین بسڕێتەوە', color: '#ec4899' },
              { key: 'allow_clear_cart', label: 'بەتاڵکردنەوەی تەواوی سەبەتە', desc: 'ڕێگەدان بە کاشێر تەواوی پسوولەکە بە یەکجار بسڕێتەوە', color: '#f97316' },
              { key: 'allow_debt_sale', label: 'فرۆشتن بە قەرز', desc: 'ڕێگەدان بە کاشێر پسوولەی قەرز لەسەر کڕیار تۆمار بکات', color: '#8b5cf6' },
              { key: 'allow_split_payment', label: 'شێوازی پارەدانی فرەچەشن', desc: 'ڕێگەدان بە پارەدانی تێکەڵ (نەقد + قەرز یان کارت)', color: '#06b6d4' },
              { key: 'allow_view_cost_price', label: 'پیشاندانی نرخی کڕین (تێچوو)', desc: 'کاشێر بتوانێت تێچووی کڕینی کاڵاکان لە کۆگا ببینێت', color: '#64748b' },
            ].map(item => {
              const enabled = !!permDraft[item.key];
              return (
                <div 
                  key={item.key}
                  onClick={() => handleTogglePerm(item.key)}
                  style={{
                    padding: '1.1rem',
                    borderRadius: '16px',
                    background: enabled ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-tertiary)',
                    border: `1.5px solid ${enabled ? item.color : 'var(--border-color)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.2s ease',
                    boxShadow: enabled ? `0 2px 10px ${item.color}22` : 'none'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {item.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      {item.desc}
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div style={{
                    width: '46px',
                    height: '26px',
                    borderRadius: '14px',
                    background: enabled ? item.color : 'rgba(148, 163, 184, 0.3)',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    flexShrink: 0
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      position: 'absolute',
                      top: '3px',
                      right: enabled ? '4px' : '22px',
                      transition: 'right 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sub-section B: Modules Access Control (دەسەڵاتی بەشە سەرەکییەکان) */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></span>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              دەسەڵاتی بەشە سەرەکییەکان (Main Modules & Pages)
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
              دیاریکردنی کام پەڕانە کاشێر بتوانێت لە داشبۆرد کلیکیان لەسەر بکات
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {[
              { key: 'pos_cashier', label: 'فرۆشتن و کاشێر (POS)', desc: 'دەستڕاگەیشتن بە شاشەی سەرەکی فرۆشتن', color: '#2563eb' },
              { key: 'pos_products', label: 'کۆگا و کاڵاکان', desc: 'بینین و گەڕان لە لیستی کاڵاکان', color: '#0284c7' },
              { key: 'pos_returns', label: 'گەڕانەوەی کاڵا', desc: 'وەرگرتنەوەی پسوولە و کاڵای گەڕاوە', color: '#0d9488' },
              { key: 'pos_cashdrawer', label: 'سندوقی پارە (قاسە)', desc: 'بینینی جووڵەی کاش و بەڵانس', color: '#10b981' },
              { key: 'pos_owes', label: 'قەرز و کڕیاران', desc: 'بینینی لیستی قەرزارەکان و وەرگرتنەوە', color: '#d97706' },
              { key: 'pos_expenses', label: 'خەرجییەکان', desc: 'تۆمارکردنی خەرجی ڕۆژانە', color: '#ea580c' },
              { key: 'pos_damages', label: 'زیان و بەفیڕۆچوو', desc: 'تۆمارکردنی کاڵای بەسەرچوو یان شکاو', color: '#e11d48' },
              { key: 'pos_purchases', label: 'کڕین و دابینکەران', desc: 'تۆمارکردنی پسوولەی کڕین لە مەندوب', color: '#7c3aed' },
              { key: 'pos_reports', label: 'ڕاپۆرتە داراییەکان', desc: 'بینینی قازانج و ڕاپۆرتە گشتییەکان', color: '#6366f1' },
              { key: 'pos_settings', label: 'ڕێکخستنەکان', desc: 'دەستکاریکردنی ڕێکخستنی سیستەم', color: '#64748b' }
            ].map(item => {
              const enabled = !!permDraft[item.key];
              return (
                <div 
                  key={item.key}
                  onClick={() => handleTogglePerm(item.key)}
                  style={{
                    padding: '1rem',
                    borderRadius: '16px',
                    background: enabled ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-tertiary)',
                    border: `1.5px solid ${enabled ? item.color : 'var(--border-color)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {item.label}
                    </span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {item.desc}
                    </div>
                  </div>

                  <div style={{
                    width: '42px',
                    height: '24px',
                    borderRadius: '12px',
                    background: enabled ? item.color : 'rgba(148, 163, 184, 0.3)',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    flexShrink: 0
                  }}>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      position: 'absolute',
                      top: '3px',
                      right: enabled ? '3px' : '21px',
                      transition: 'right 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hardware Setup Section: Thermal Receipt Printer, Cash Drawer & Barcode Scanner */}
      <div style={{ marginTop: '2.5rem', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Printer size={22} color="#0284c7" /> ئامێرەکان: چاپکەر، سندوقی پارە، و سکانەری بارکۆد
        </h2>
        <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          بەستنەوە، هەڵبژاردنی چاپکەری حەراری (80mm/58mm)، پشکنینی ڕاستەوخۆی سکانەر و کردنەوەی سندوقی پارە (قاسە).
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Card 1: Thermal Receipt Printer & Cash Drawer Setup */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: '#0284c7', fontSize: '1.15rem', fontWeight: 800 }}>
              <Printer size={22} /> چاپکەری حەراری و سندوقی پارە
            </h3>
            <span style={{ fontSize: '0.78rem', padding: '3px 10px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', fontWeight: 700, border: '1px solid rgba(2, 132, 199, 0.3)' }}>
              ESC/POS Hardware
            </span>
          </div>

          {hardwareNotice && (
            <div style={{ 
              padding: '10px 14px', 
              borderRadius: '12px', 
              background: hardwareNotice.includes('هەڵە') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
              color: hardwareNotice.includes('هەڵە') ? '#ef4444' : '#10b981', 
              border: hardwareNotice.includes('هەڵە') ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
              fontSize: '0.86rem', 
              fontWeight: 700, 
              marginBottom: '1rem' 
            }}>
              {hardwareNotice}
            </div>
          )}

          {/* Printer Selection Dropdown */}
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              چاپکەری دیاریکراو لە ویندۆز (Printer Device):
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  outline: 'none',
                  fontWeight: 600
                }}
              >
                <option value="">چاپکەری سەرەکی سیستم (Default Windows Printer)</option>
                {printersList.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.name} {p.isDefault ? ' (سەرەکی)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSaveHardwareSettings}
                title="پاشەکەوتکردنی هەڵبژاردن"
                className="btn-primary"
                style={{ padding: '0 14px', borderRadius: '10px', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer' }}
              >
                <Save size={16} />
              </button>
            </div>
          </div>

          {/* Paper Width & Silent Print Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '1.4rem' }}>
            <div style={{ padding: '10px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
              <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>قەبارەی کاغەز:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => { setPaperWidth('80mm'); localStorage.setItem('pos_paper_width', '80mm'); }}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: '8px',
                    border: paperWidth === '80mm' ? '1px solid #0284c7' : '1px solid var(--border-color)',
                    background: paperWidth === '80mm' ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-secondary)',
                    color: paperWidth === '80mm' ? '#0284c7' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  80mm (ستاندارد)
                </button>
                <button
                  type="button"
                  onClick={() => { setPaperWidth('58mm'); localStorage.setItem('pos_paper_width', '58mm'); }}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: '8px',
                    border: paperWidth === '58mm' ? '1px solid #0284c7' : '1px solid var(--border-color)',
                    background: paperWidth === '58mm' ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-secondary)',
                    color: paperWidth === '58mm' ? '#0284c7' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  58mm (بچووک)
                </button>
              </div>
            </div>

            <div 
              onClick={() => {
                const nextVal = !silentPrint;
                setSilentPrint(nextVal);
                localStorage.setItem('pos_silent_print', nextVal ? 'true' : 'false');
              }}
              style={{ 
                padding: '10px', 
                borderRadius: '12px', 
                background: 'var(--bg-tertiary)', 
                border: silentPrint ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div>
                <span style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>چاپکردنی بێدەنگ</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>بەبێ پەنجەرەی چاپ</span>
              </div>
              <div style={{
                width: '38px',
                height: '22px',
                borderRadius: '12px',
                background: silentPrint ? '#10b981' : 'rgba(148, 163, 184, 0.3)',
                position: 'relative',
                transition: 'background 0.2s ease',
                flexShrink: 0
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: '3px',
                  right: silentPrint ? '3px' : '19px',
                  transition: 'right 0.2s ease'
                }} />
              </div>
            </div>
          </div>

          {/* Action Buttons: Test Print & Test Cash Drawer */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={isTestPrinting}
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'rgba(2, 132, 199, 0.12)',
                color: '#0284c7',
                border: '1px solid rgba(2, 132, 199, 0.35)',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: isTestPrinting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Printer size={16} />
              {isTestPrinting ? 'چاپ دەکرێت...' : 'تاقیکردنەوەی چاپکردن'}
            </button>

            <button
              type="button"
              onClick={handleTestDrawer}
              disabled={isDrawerTesting}
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#d97706',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: isDrawerTesting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Zap size={16} />
              {isDrawerTesting ? 'دەنێردرێت...' : 'تستکردنی قاسەی پارە'}
            </button>
          </div>
        </div>

        {/* Card 2: Barcode Scanner Live Test Pad */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: '#10b981', fontSize: '1.15rem', fontWeight: 800 }}>
                <ScanBarcode size={22} /> پشکنینی سکانەری بارکۆد
              </h3>
              <span style={{ fontSize: '0.78rem', padding: '3px 10px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                Live Scanner Test Pad
              </span>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.5' }}>
              سکانەرەکەت (USB یان بێتەل) ببەستەوە و لەم خانەیەی خوارەوە بارکۆدی هەر کاڵایەک سکان بکە بۆ دڵنیابوونەوە لە ناردنی کۆد و هێمای Enter:
            </p>

            <form onSubmit={handleScannerTestSubmit} style={{ marginBottom: '1rem' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="لێرە بارکۆدێک بە سکانەرەکەت لێبدە..."
                  value={scannerTestInput}
                  onChange={(e) => setScannerTestInput(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '14px',
                    background: 'var(--bg-secondary)',
                    border: '2px dashed #10b981',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    letterSpacing: '2px'
                  }}
                />
              </div>
            </form>

            {/* Live Scan Confirmation Badge */}
            {lastScannedItem ? (
              <div style={{ 
                padding: '12px 16px', 
                borderRadius: '14px', 
                background: 'rgba(16, 185, 129, 0.1)', 
                border: '1.5px solid rgba(16, 185, 129, 0.4)',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#10b981', fontWeight: 800, fontSize: '0.9rem' }}>
                    <CheckCircle2 size={16} /> سکانەرەکە بە سەرکەوتوویی ناسێندرا!
                  </span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{lastScannedItem.time}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '8px', fontFamily: 'monospace', fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', letterSpacing: '1px' }}>
                    {lastScannedItem.code}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    درێژی: {lastScannedItem.length} پیت/ژمارە
                  </span>
                  {lastScannedItem.isScale && (
                    <span style={{ fontSize: '0.75rem', background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                      بارکۆدی تەرازووی دیجیتاڵ
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                هێشتا هیچ بارکۆدێک لەم بەشەدا سکان نەکراوە.
              </div>
            )}
          </div>

          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowTroubleshoot(prev => !prev)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '10px',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <HelpCircle size={15} color="#0284c7" />
              {showTroubleshoot ? 'شاردنەوەی ڕێبەری چارەسەری کێشەکان' : 'ڕێبەری هەنگاو بە هەنگاوی بەستنەوە و کێشەکان'}
            </button>
          </div>
        </div>

      </div>

      {/* Expandable Step-by-Step Hardware Guide */}
      {showTroubleshoot && (
        <div className="glass-panel" style={{ marginTop: '1.5rem', padding: '1.8rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={20} color="#0284c7" /> ڕێبەری تەواوی دانان و بەستنەوەی سکانەر، چاپکەر و قاسەی پارە
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.2rem' }}>
            
            {/* Guide Step 1: Scanner */}
            <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 800, color: '#10b981', fontSize: '0.92rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ١. بارکۆد سکانەر (Barcode Scanner)
              </div>
              <ul style={{ margin: 0, paddingRight: '18px', fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <li>کێبڵی USB یان دانگڵی بێتەل (Wireless Dongle) بدە لە کۆمپیوتەر؛ ویندۆز دەستبەجێ وەک تەختەکلیل دەیناسێت.</li>
                <li><strong>گرنگترین خاڵ:</strong> پێویستە سکانەرەکە لە کاتی لێدانی بارکۆددا هێمای <code>Enter (CR)</code> بنێرێت. ئەگەر پاش سکان لەسەر شاشەی کاشێر دانەنیشت، لەناو دەفتەرچەی کارگەیی سکانەرەکەتدا بارکۆدی <strong>«Add Enter Suffix»</strong> تەنها یەکجار سکان بکە.</li>
                <li>سیستەمەکەمان خۆکارانە ژمارە عەرەبییەکان دەگۆڕێت بۆ ستاندارد، بۆیە کێشەی زمانی کیبۆرد ڕوونادات.</li>
              </ul>
            </div>

            {/* Guide Step 2: Thermal Printer */}
            <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 800, color: '#0284c7', fontSize: '0.92rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ٢. چاپکەری حەراری (Thermal Receipt Printer)
              </div>
              <ul style={{ margin: 0, paddingRight: '18px', fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <li>کێبڵی کارەبا و کێبڵی USB لە پشتەوەی چاپکەرەکە ببەستە.</li>
                <li>درایڤەری چاپکەرەکەت (وەک: Xprinter Driver یان POS-80 Driver) دابمەزرێنە و جۆری پۆرتەکە بکە بە <strong>USB</strong>.</li>
                <li>لە ڕێکخستنی سەرەوە چاپکەرەکەت دیاریبکە و کرتە لە <strong>«تاقیکردنەوەی چاپکردن»</strong> بکە بۆ دڵنیابوونەوە لە سەرکەوتنی چاپ.</li>
              </ul>
            </div>

            {/* Guide Step 3: Cash Drawer */}
            <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 800, color: '#d97706', fontSize: '0.92rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ٣. سندوقی پارە - قاسە (Cash Drawer)
              </div>
              <ul style={{ margin: 0, paddingRight: '18px', fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <li>قاسەی پارە پێویستی بە کارەبای جیاواز نییە؛ کێبڵە تەلەفۆنییەکەی (RJ11) لە پشتەوەی قاسەوە بدە لە پۆرتی <strong>DK (Drawer Kick)</strong> لە پشتەوەی چاپکەری حەرارییەکە.</li>
                <li>لە کاتی هەر فرۆشتنێکی نەقد لە شاشەی کاشێر، چاپکەرەکە سیگناڵی لێدانی کارەبایی دەنێرێت و دەرگای قاسەکە خۆی دەکاتەوە!</li>
                <li>دەتوانیت کلیلەکە بە شێوەی ستوونی (Vertical) دابنێیت بۆ ئەوەی بە فەرمانی ئەلیکترۆنی بکرێتەوە.</li>
              </ul>
            </div>

          </div>
        </div>
      )}

      {/* Section 2: Data Protection & Backups */}
      <div style={{ marginTop: '2.5rem', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={22} color="var(--accent-color)" /> پاراستن و باکئەپی داتاکان
        </h2>
        <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          هەموو فرۆشتن و داتاکانی مارکێت بە تەواوی پارێزراون. دەتوانیت لە ڕێگەی تێلیگرامەوە بە ئۆتۆماتیکی باکئەپ وەربگریت یان لەسەر کۆمپیوتەر دایگریت.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>

        {/* Telegram Cloud Backup Card (Multiple Recipients & Clean Folder Naming) */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: '#229ED9' }}>
              <Send size={24} /> باکئەپی کلاودی تێلیگرام
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '10px', background: 'rgba(34, 158, 217, 0.15)', color: '#38bdf8', border: '1px solid rgba(34, 158, 217, 0.3)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                <Bot size={15} /> @{telegramSettings?.bot_username || 'cashier_system_bot'}
              </span>
              <span style={{ display: 'inline-flex', padding: '4px 10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                {telegramSettings?.activeCount || 0} وەرگر چالاکە
              </span>
            </div>
          </div>

          <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.2rem', lineHeight: '1.5' }}>
            دەتوانیت چەندین چاتی تێلیگرام (خاوەنکار، شەریک، موحاسب، یان گرووپ) دیاریبکەیت؛ لە کاتی ناردندا باکئەپەکە بە شێوەیەکی خۆکار بۆ هەموو چاتە هەڵبژێردراوەکان دەنێردرێت.
          </p>

          {/* Status Alert if any */}
          {telegramNotice && (
            <div style={{ padding: '0.75rem 1rem', borderRadius: '12px', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', background: telegramNotice.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: telegramNotice.type === 'success' ? '#34d399' : '#f87171', border: `1px solid ${telegramNotice.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
              {telegramNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{telegramNotice.message}</span>
            </div>
          )}

          {/* Recipients List Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#cbd5e1' }}>
                لیستی وەرگرانی باکئەپ (کێ فایلەکە وەربگرێت؟):
              </span>
              <button
                onClick={handleCheckPairing}
                disabled={telegramCheckingPair}
                title="نوێکردنەوەی لیستی وەرگران"
                style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RefreshCw size={12} className={telegramCheckingPair ? 'animate-spin' : ''} /> نوێکردنەوە
              </button>
            </div>

            {(!telegramSettings?.recipients || telegramSettings.recipients.length === 0) ? (
              <div style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', color: '#94a3b8', fontSize: '0.85rem' }}>
                هیچ وەرگرێک تۆمار نەکراوە. دەتوانیت لە خوارەوە Chat ID زیادبکەیت یان بە مۆبایل بچیتە ناو @cashier_system_bot و Start لێبدەیت.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {telegramSettings.recipients.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: r.is_active ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${r.is_active ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)'}`,
                      borderRadius: '12px',
                      transition: 'all 0.2s',
                      gap: '12px'
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={r.is_active}
                        onChange={() => handleToggleRecipient(r.id)}
                        style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#10b981' }}
                      />
                      {editingRecipientId === r.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.preventDefault()}>
                          <input
                            type="text"
                            value={editingRecipientName}
                            onChange={e => setEditingRecipientName(e.target.value)}
                            placeholder="ناوی نوێ بنووسە"
                            style={{ padding: '4px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid #38bdf8', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRecipientName(r.id)}
                            style={{ padding: '4px 8px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRecipientId(null)}
                            style={{ padding: '4px 8px', background: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: r.is_active ? '#34d399' : '#94a3b8' }}>
                              {r.recipient_name}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); handleStartEditRecipient(r); }}
                              title="دەستکاریکردنی ناوی ئەم کەسە"
                              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '2px' }}
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace' }}>
                            ID: {r.chat_id}
                          </div>
                        </div>
                      )}
                    </label>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleTestRecipient(r.id)}
                        title="ناردنی پەیامی تاقیکاری تەنها بۆ ئەم چاتە"
                        style={{ padding: '5px 9px', background: 'rgba(34, 158, 217, 0.15)', color: '#38bdf8', border: '1px solid rgba(34, 158, 217, 0.3)', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Zap size={13} /> پشکنین
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRecipient(r.id, r.recipient_name)}
                        title="سڕینەوەی ئەم وەرگرە"
                        style={{ padding: '5px 8px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Automatic Telegram Bot Invite & Pairing */}
          <div style={{ padding: '1.2rem', background: 'rgba(34, 158, 217, 0.05)', borderRadius: '16px', border: '1px solid rgba(34, 158, 217, 0.2)', marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={18} color="#38bdf8" />
                <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#38bdf8' }}>
                  داوەتکردنی کەسی نوێ بۆ وەرگرتنی باکئەپ لە تێلیگرام:
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCopyBotLink}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    background: copiedBotLink ? 'rgba(16, 185, 129, 0.2)' : 'rgba(34, 158, 217, 0.2)',
                    color: copiedBotLink ? '#34d399' : '#38bdf8',
                    border: `1px solid ${copiedBotLink ? 'rgba(16, 185, 129, 0.4)' : 'rgba(34, 158, 217, 0.4)'}`,
                    borderRadius: '10px',
                    fontSize: '0.84rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {copiedBotLink ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                  {copiedBotLink ? 'لینکەکە کۆپیکرا!' : 'کۆپیکردنی لینکی بۆت'}
                </button>

                <a
                  href={`https://t.me/${telegramSettings?.bot_username || 'cashier_system_bot'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    background: 'linear-gradient(135deg, #229ED9, #0284c7)',
                    color: '#ffffff',
                    borderRadius: '10px',
                    fontSize: '0.84rem',
                    fontWeight: 'bold',
                    textDecoration: 'none'
                  }}
                >
                  <ExternalLink size={15} /> کردنەوە لە تێلیگرام
                </a>
              </div>
            </div>

            <div style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: '1.6', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <Info size={16} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>چۆنیەتی بەستنەوە:</strong> پێویست بە هیچ Chat ID و ژمارەیەک ناکات! تەنها ئەم بەستەرەی سەرەوە بنێرە بۆ هەر کەسێک کە دەتەوێت باکئەپی مارکێت وەربگرێت (شەریک، بەڕێوەبەر، ژمێریار). هەر کە لە تێلیگرام دوگمەی <strong>Start</strong> دادەگرن، ناویان بە شێوەیەکی ئۆتۆماتیکی لەم لیستەی سەرەوەدا زیاد دەبێت و دەتوانیت بە دوگمەی قەڵەمەکە (<Edit2 size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />) ناوەکەیان لە ئەپەکەدا دەستکاری بکەیت.
              </div>
            </div>
          </div>

          {/* Clean Naming & Folder Preview */}
          <div style={{ padding: '0.8rem 1rem', background: 'rgba(56, 189, 248, 0.04)', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.12)', marginBottom: '1.2rem', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Folder size={14} color="#38bdf8" /> بوخچە لە تێلیگرام: <strong style={{ color: '#38bdf8' }}>POS_Backups_{new Date().toISOString().slice(0, 7)}/</strong>
              </span>
              <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <FileText size={14} color="#34d399" /> ناوی فایلی باکئەپ: <strong style={{ color: '#34d399' }}>POS_Backup_{new Date().toISOString().slice(0, 10)}_...json</strong>
              </span>
            </div>
          </div>

          {/* Auto-Backup Toggle */}
          <div style={{ padding: '0.8rem 1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)', marginBottom: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', color: '#cbd5e1' }}>
              <input
                type="checkbox"
                checked={telegramSettings?.auto_backup_enabled ?? true}
                onChange={e => handleToggleTelegramAuto(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#10b981' }}
              />
              ناردنی خۆکاری ڕۆژانەی باکئەپ بۆ هەموو وەرگرە چالاکەکان
            </label>
          </div>

          {/* Broadcast Action Button */}
          <button
            onClick={handleSendBackupToTelegram}
            disabled={telegramSending || !telegramSettings?.activeCount}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '1rem', background: telegramSettings?.activeCount ? 'linear-gradient(135deg, #0284c7, #229ED9)' : 'rgba(255,255,255,0.06)', color: telegramSettings?.activeCount ? 'white' : '#64748b', border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 'bold', cursor: (!telegramSettings?.activeCount || telegramSending) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: telegramSettings?.activeCount ? '0 4px 15px rgba(34, 158, 217, 0.3)' : 'none' }}
          >
            <Send size={18} className={telegramSending ? 'animate-spin' : ''} />
            {telegramSending ? 'باکئەپ دەنێردرێت بۆ هەموو وەرگرەکان...' : `ناردنی باکئەپ بۆ هەموو چاتە دیاریکراوەکان (${telegramSettings?.activeCount || 0} کەس)`}
          </button>

          {/* Last Sent Info */}
          <div style={{ marginTop: '1rem', fontSize: '0.82rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <div>
              <span>دواین باکئەپی نێردراو: </span>
              {telegramSettings?.last_sent_at ? (
                <span style={{ color: '#34d399', fontWeight: 'bold' }}>
                  {new Date(telegramSettings.last_sent_at).toLocaleString('en-GB')}
                </span>
              ) : (
                <span>هێشتا نەنێردراوە</span>
              )}
            </div>
            {telegramSettings?.last_filename && (
              <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                {telegramSettings.last_filename} ({Math.round(telegramSettings.last_file_size / 1024)} KB)
              </span>
            )}
          </div>
        </div>

        {/* Local Computer Backup Card (Download & Restore) */}
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: '#10b981' }}>
                <HardDrive size={24} /> باکئەپ لەسەر کۆمپیوتەر
              </h3>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                <CheckCircle2 size={13} /> پارێزراوە ({backupStats?.totalTables || 23} خشتە)
              </span>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: '1.6' }}>
              دەتوانیت هەر کاتێک بتەوێت کۆپییەکی تەواوی داتاکانی فرۆشتن و مەخزەن دابگریتە سەر کۆمپیوتەرەکەت یان فلاش، یاخود لە کاتی کڕینی کۆمپیوتەری نوێدا فایلەکە بهێنیتەوە.
            </p>

            {/* Quick Stats Pill */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.9rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>کۆی تۆمارەکان (دێڕ)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981', marginTop: '2px' }}>
                  {backupStats ? Number(backupStats.totalRows).toLocaleString() : '...'}
                </div>
              </div>
              <div style={{ padding: '0.9rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>دوایین باکئەپ</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '4px' }}>
                  {backupStats?.latestBackup ? new Date(backupStats.latestBackup.createdAt).toLocaleDateString('en-GB') : 'ئەمڕۆ'}
                </div>
              </div>
            </div>

            {/* Download Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
              <button 
                onClick={handleDownloadBackup} 
                disabled={backupLoading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '1rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '14px', fontSize: '0.96rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <Download size={18} /> {backupLoading ? 'کۆکردنەوەی داتابەیس...' : 'داگرتنی باکئەپ بۆ ناو کۆمپیوتەر (JSON)'}
              </button>

              {ipcRenderer && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleNativeSaveBackup}
                    disabled={backupLoading}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0.8rem', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    <Save size={15} /> پاشەکەوتکردن لە فلاش (Save As)
                  </button>
                  <button
                    onClick={handleOpenBackupsFolder}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0.8rem 14px', background: 'rgba(255, 255, 255, 0.05)', color: '#cbd5e1', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', fontSize: '0.85rem', cursor: 'pointer' }}
                    title="کردنەوەی بوخچەی باکئەپ لە کۆمپیوتەر"
                  >
                    <FolderOpen size={15} /> بوخچە
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Restore Section */}
          <div style={{ paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.84rem', color: '#f59e0b', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={16} /> هێنانەوەی باکئەپ لە کۆمپیوتەرەوە:
            </div>
            <label 
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.9rem', background: 'rgba(245, 158, 11, 0.08)', color: '#fbbf24', border: '1px dashed rgba(245, 158, 11, 0.35)', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', boxSizing: 'border-box' }}
            >
              <FileJson size={18} /> هەڵبژاردنی فایلی باکئەپ (.json)
              <input 
                type="file" 
                accept=".json" 
                onChange={handleFileSelect} 
                style={{ display: 'none' }} 
              />
            </label>
          </div>
        </div>

      </div>

      {/* Pre-flight Restore Modal */}
      {restoreModalOpen && (
        <div className="pos-modal-overlay" onClick={() => !restoreLoading && setRestoreModalOpen(false)}>
          <div className="pos-modal-card pos-modal-md" onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem', color: '#f59e0b', fontWeight: 800 }}>
                <AlertTriangle color="#f59e0b" /> پشکنین و هێنانەوەی باکئەپ
              </h2>
              <button 
                onClick={() => setRestoreModalOpen(false)} 
                disabled={restoreLoading}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
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
                  <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    بۆ دڵنیابوونەوە لە ڕستۆرکردن، بنووسە: <b style={{ color: '#f59e0b' }}>RESTORE</b>
                  </label>
                  <input 
                    type="text" 
                    value={confirmationInput}
                    onChange={(e) => setConfirmationInput(e.target.value)}
                    placeholder="لێرە بنووسە RESTORE"
                    disabled={restoreLoading}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '1rem', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={handleExecuteRestore}
                    disabled={restoreLoading || confirmationInput.trim().toUpperCase() !== 'RESTORE'}
                    style={{ flex: 1, minWidth: '160px', padding: '14px', borderRadius: '12px', background: confirmationInput.trim().toUpperCase() === 'RESTORE' ? '#ef4444' : 'var(--bg-tertiary)', color: confirmationInput.trim().toUpperCase() === 'RESTORE' ? '#ffffff' : 'var(--text-muted)', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: confirmationInput.trim().toUpperCase() === 'RESTORE' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                  >
                    <RefreshCw size={18} className={restoreLoading ? 'animate-spin' : ''} />
                    {restoreLoading ? 'داتاکان دەگەڕێندرێنەوە...' : 'هێنانەوەی یەکجارەکی (Restore)'}
                  </button>
                  <button 
                    onClick={() => setRestoreModalOpen(false)}
                    disabled={restoreLoading}
                    className="btn-secondary"
                    style={{ padding: '14px 20px', borderRadius: '12px' }}
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
