import React, { useState, useEffect } from 'react';
import { 
  Moon, Sun, Shield, CheckCircle2, AlertTriangle, 
  Download, Upload, RefreshCw, HardDrive, FileJson, Check, X, 
  AlertCircle, Trash2, FolderOpen, Save,
  Send, Eye, EyeOff, Key, Lock,
  Copy, ExternalLink, Edit2, Printer, Zap,
  User, Users, UserPlus
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

// Safe Electron IPC Detection
const getIpc = () => {
  if (typeof window !== 'undefined' && typeof window.require === 'function') {
    try {
      return window.require('electron')?.ipcRenderer || null;
    } catch (_) {
      return null;
    }
  }
  return null;
};
let ipcRenderer = getIpc();

const POS_ACTION_PERMISSIONS = [
  { key: 'allow_manual_discount', label: 'داشکاندنی دەستی لەسەر پسووڵە' },
  { key: 'allow_custom_price', label: 'دەستکاریکردنی نرخی فرۆشتن' },
  { key: 'allow_delete_item', label: 'سڕینەوەی کاڵا لە سەبەتە' },
  { key: 'allow_clear_cart', label: 'بەتاڵکردنەوەی تەواوی سەبەتە' },
  { key: 'allow_debt_sale', label: 'فرۆشتن بە شێوازی قەرز' },
  { key: 'allow_split_payment', label: 'پارەدانی تێکەڵ (نەقد + قەرز)' },
  { key: 'allow_view_cost_price', label: 'بینینی نرخی کڕین (تێچوو)' }
];

const MODULE_PERMISSIONS = [
  { key: 'pos_cashier', label: 'شاشەی کاشێر و فرۆشتن' },
  { key: 'pos_shifts', label: 'قاسە و شیفتەکان' },
  { key: 'pos_returns', label: 'گەڕاندنەوەی کاڵا' },
  { key: 'pos_owes', label: 'قەرزی کڕیاران و وەرگرتنەوە' },
  { key: 'inv_products', label: 'کاڵاکان و مەخزەن' },
  { key: 'inv_needs', label: 'پێداویستییە کەمبووەکان' },
  { key: 'inv_promotions', label: 'ئۆفەر و داشکاندن' },
  { key: 'inv_purchases', label: 'پسووڵەی کڕین لە کۆمپانیا' },
  { key: 'inv_audit', label: 'جەردکردنی کۆگا' },
  { key: 'inv_wastage', label: 'زیان و فەوتانی کاڵا' },
  { key: 'inv_vendor_returns', label: 'گەڕاندنەوە بۆ کۆمپانیا (RTV)' },
  { key: 'mgmt_expenses', label: 'خەرجییەکانی مارکێت' },
  { key: 'mgmt_history', label: 'مێژووی فرۆشتنە کۆنەکان' }
];

const DEFAULT_CASHIER_PERMISSIONS = {
  pos_cashier: true,
  pos_shifts: true,
  pos_returns: true,
  pos_owes: true,
  inv_products: true,
  inv_needs: true,
  inv_promotions: false,
  inv_purchases: false,
  inv_audit: false,
  inv_wastage: false,
  inv_vendor_returns: false,
  mgmt_expenses: false,
  mgmt_history: false,
  allow_manual_discount: true,
  allow_custom_price: false,
  allow_delete_item: true,
  allow_clear_cart: true,
  allow_debt_sale: true,
  allow_split_payment: true,
  allow_view_cost_price: false
};

const Settings = () => {
  const { isAdmin, currentUser, changePassword, lockToCashier } = useAuth();
  const [activeTab, setActiveTab] = useState('CASHIERS'); // 'CASHIERS' | 'HARDWARE' | 'BACKUP' | 'SECURITY'
  const [theme, setTheme] = useState(() => localStorage.getItem('pos_theme') || 'dark');
  const [savedNotice, setSavedNotice] = useState(false);

  // Hardware Management: Thermal Printer State
  const [printersList, setPrintersList] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(() => localStorage.getItem('pos_selected_printer') || '');
  const [paperWidth, setPaperWidth] = useState(() => localStorage.getItem('pos_paper_width') || '80mm');
  const [silentPrint, setSilentPrint] = useState(() => localStorage.getItem('pos_silent_print') === 'true');
  const [hardwareNotice, setHardwareNotice] = useState('');
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [isDrawerTesting, setIsDrawerTesting] = useState(false);

  const fetchPrinters = async () => {
    const ipc = getIpc();
    if (ipc) {
      try {
        const res = await ipc.invoke('get-printers');
        if (res?.success && Array.isArray(res.printers)) {
          setPrintersList(res.printers);
          const savedPrinter = localStorage.getItem('pos_selected_printer');
          if (!savedPrinter) {
            const xp = res.printers.find(p => 
              p.name.toLowerCase().includes('xp-') || 
              p.name.toLowerCase().includes('pos') || 
              p.name.toLowerCase().includes('thermal') ||
              p.name.toLowerCase().includes('80c')
            );
            if (xp) {
              setSelectedPrinter(xp.name);
              localStorage.setItem('pos_selected_printer', xp.name);
            } else {
              const def = res.printers.find(p => p.isDefault);
              if (def) setSelectedPrinter(def.name);
            }
          }
        }
      } catch (err) {
        console.error('Failed to get printers:', err);
      }
    }
  };

  useEffect(() => {
    fetchPrinters();
  }, []);

  const handleSaveHardwareSettings = () => {
    localStorage.setItem('pos_selected_printer', selectedPrinter);
    localStorage.setItem('pos_paper_width', paperWidth);
    localStorage.setItem('pos_silent_print', silentPrint ? 'true' : 'false');
    setHardwareNotice('ڕێکخستنەکانی چاپکەر پاشەکەوت کران');
    setTimeout(() => setHardwareNotice(''), 3500);
  };

  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    setHardwareNotice('');
    try {
      const ipc = getIpc();
      if (ipc) {
        const storeName = (localStorage.getItem('pos_store_name') && localStorage.getItem('pos_store_name') !== 'مارکێتی حاجی ئاکۆ') ? localStorage.getItem('pos_store_name') : 'مارکێتی شارەکەم';
        const res = await ipc.invoke('print-test-receipt', {
          printerName: selectedPrinter,
          storeName,
          paperWidth,
          silent: silentPrint
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
      setHardwareNotice('فەرمانی کردنەوەی قاسەی پارە نێردرا');
    } catch (_) {
      setHardwareNotice('قاسەی پارە کرایەوە');
    } finally {
      setIsDrawerTesting(false);
      setTimeout(() => setHardwareNotice(''), 3000);
    }
  };

  // Multi-Cashier Accounts Management State
  const [cashiersList, setCashiersList] = useState([]);
  const [loadingCashiers, setLoadingCashiers] = useState(false);
  const [showAddCashierModal, setShowAddCashierModal] = useState(false);
  const [showEditCashierModal, setShowEditCashierModal] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState(null);
  const [newCashierForm, setNewCashierForm] = useState({ username: '', full_name: '', password: '' });
  const [newCashierPermissions, setNewCashierPermissions] = useState(DEFAULT_CASHIER_PERMISSIONS);
  const [editCashierPassword, setEditCashierPassword] = useState('');
  const [editCashierFullName, setEditCashierFullName] = useState('');
  const [editCashierPermissions, setEditCashierPermissions] = useState(DEFAULT_CASHIER_PERMISSIONS);
  const [cashierNotice, setCashierNotice] = useState('');
  const [cashierError, setCashierError] = useState('');
  const [cashierSubmitting, setCashierSubmitting] = useState(false);

  const fetchCashiersList = async () => {
    try {
      setLoadingCashiers(true);
      const res = await axios.get('http://localhost:3001/api/users/cashiers');
      if (res.data?.status === 'SUCCESS' && Array.isArray(res.data.data)) {
        setCashiersList(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch cashiers:', err.message);
    } finally {
      setLoadingCashiers(false);
    }
  };

  useEffect(() => {
    fetchCashiersList();
  }, []);

  const handleOpenAddCashierModal = () => {
    setNewCashierForm({ username: '', full_name: '', password: '' });
    setNewCashierPermissions(DEFAULT_CASHIER_PERMISSIONS);
    setCashierError('');
    setShowAddCashierModal(true);
  };

  const handleOpenEditCashierModal = (cashier) => {
    setSelectedCashier(cashier);
    setEditCashierFullName(cashier.full_name || cashier.username);
    setEditCashierPassword('');
    const perms = (cashier.permissions && typeof cashier.permissions === 'object' && Object.keys(cashier.permissions).length > 0)
      ? { ...DEFAULT_CASHIER_PERMISSIONS, ...cashier.permissions }
      : DEFAULT_CASHIER_PERMISSIONS;
    setEditCashierPermissions(perms);
    setCashierError('');
    setShowEditCashierModal(true);
  };

  const handleCreateCashier = async (e) => {
    e.preventDefault();
    if (!newCashierForm.username.trim() || !newCashierForm.password) {
      setCashierError('تکایە ناوی بەکارهێنەر و وشەی نهێنی بنووسە');
      return;
    }
    setCashierSubmitting(true);
    setCashierError('');
    try {
      const res = await axios.post('http://localhost:3001/api/users/cashiers', {
        username: newCashierForm.username.trim(),
        full_name: newCashierForm.full_name.trim() || newCashierForm.username.trim(),
        password: newCashierForm.password,
        permissions: newCashierPermissions
      });
      if (res.data?.status === 'SUCCESS') {
        setShowAddCashierModal(false);
        setNewCashierForm({ username: '', full_name: '', password: '' });
        setNewCashierPermissions(DEFAULT_CASHIER_PERMISSIONS);
        setCashierNotice('کاشێری نوێ بە سەرکەوتوویی زیادکرا');
        setTimeout(() => setCashierNotice(''), 3500);
        fetchCashiersList();
      }
    } catch (err) {
      setCashierError(err.response?.data?.message || 'هەڵە لە دروستکردنی کاشێر');
    } finally {
      setCashierSubmitting(false);
    }
  };

  const handleUpdateCashier = async (e) => {
    e.preventDefault();
    if (!selectedCashier) return;
    setCashierSubmitting(true);
    setCashierError('');
    try {
      const body = { 
        full_name: editCashierFullName,
        permissions: editCashierPermissions
      };
      if (editCashierPassword.trim()) {
        body.password = editCashierPassword.trim();
      }
      const res = await axios.put(`http://localhost:3001/api/users/cashiers/${selectedCashier.id}`, body);
      if (res.data?.status === 'SUCCESS') {
        setShowEditCashierModal(false);
        setSelectedCashier(null);
        setEditCashierPassword('');
        setCashierNotice('زانیاری و دەسەڵاتەکانی کاشێر نوێکرانەوە');
        setTimeout(() => setCashierNotice(''), 3500);
        fetchCashiersList();
        if (currentUser && currentUser.id === selectedCashier.id) {
          const updatedUser = { ...currentUser, full_name: editCashierFullName, permissions: editCashierPermissions };
          sessionStorage.setItem('pos_user', JSON.stringify(updatedUser));
        }
      }
    } catch (err) {
      setCashierError(err.response?.data?.message || 'هەڵە لە نوێکردنەوەی کاشێر');
    } finally {
      setCashierSubmitting(false);
    }
  };

  const handleToggleCashierActive = async (cashier) => {
    try {
      const newActive = cashier.is_active === 1 ? 0 : 1;
      const res = await axios.put(`http://localhost:3001/api/users/cashiers/${cashier.id}`, {
        is_active: newActive
      });
      if (res.data?.status === 'SUCCESS') {
        fetchCashiersList();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵە لە گۆڕینی دۆخی کاشێر');
    }
  };

  const handleDeleteCashier = async (cashier) => {
    if (!window.confirm(`ئایا دڵنیایت لە سڕینەوەی هەژماری کاشێر: ${cashier.full_name || cashier.username}؟`)) {
      return;
    }
    try {
      const res = await axios.delete(`http://localhost:3001/api/users/cashiers/${cashier.id}`);
      if (res.data?.status === 'SUCCESS') {
        setCashierNotice('هەژماری کاشێر سڕایەوە');
        setTimeout(() => setCashierNotice(''), 3500);
        fetchCashiersList();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵە لە کاتی سڕینەوەی کاشێر');
    }
  };

  // Admin Security & Credentials
  const [adminUsername, setAdminUsername] = useState(currentUser?.username || 'admin');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');

  useEffect(() => {
    if (currentUser?.username) {
      setAdminUsername(currentUser.username);
    }
  }, [currentUser]);

  // Backup & Restore State
  const [backupStats, setBackupStats] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [telegramSettings, setTelegramSettings] = useState(null);
  const [telegramSending, setTelegramSending] = useState(false);
  const [telegramNotice, setTelegramNotice] = useState(null);
  const [telegramCheckingPair, setTelegramCheckingPair] = useState(false);
  const [editingRecipientId, setEditingRecipientId] = useState(null);
  const [editingRecipientName, setEditingRecipientName] = useState('');
  const [copiedBotLink, setCopiedBotLink] = useState(false);

  // Restore Modal State
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState(null);
  const [pendingFileName, setPendingFileName] = useState('');
  const [pendingSource, setPendingSource] = useState('UPLOAD');
  const [confirmationInput, setConfirmationInput] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);

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
    try {
      const [statsRes, tgRes] = await Promise.all([
        fetch('http://localhost:3001/api/backup/stats'),
        fetch('http://localhost:3001/api/backup/telegram/settings')
      ]);
      const statsJson = await statsRes.json();
      const tgJson = await tgRes.json();
      if (statsJson.status === 'SUCCESS') setBackupStats(statsJson.data);
      if (tgJson.status === 'SUCCESS' && tgJson.data) {
        setTelegramSettings(tgJson.data);
      }
    } catch (err) {
      console.error('Error fetching backup info:', err);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchBackupData();
      const interval = setInterval(() => {
        fetchBackupData();
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

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
      fetchBackupData();
      alert('باکئەپی تەواوی داتابەیس بە سەرکەوتوویی داگیرا!');
    } catch (err) {
      alert('هەڵەیەک ڕوویدا لە کاتی باکئەپ: ' + err.message);
    } finally {
      setBackupLoading(false);
    }
  };

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
        alert(`باکئەپ بە سەرکەوتوویی پاشەکەوت کرا:\n${saveRes.filePath}`);
        fetchBackupData();
      }
    } catch (err) {
      alert('هەڵە لە پاشەکەوتکردن: ' + err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleOpenBackupsFolder = async () => {
    if (ipcRenderer) {
      const res = await ipcRenderer.invoke('open-backups-folder');
      if (!res.success) {
        alert('نەتوانرا بوخچەکە بکرێتەوە: ' + res.error);
      }
    }
  };

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

  const handleCopyBotLink = () => {
    const link = telegramSettings?.bot_link || `https://t.me/${telegramSettings?.bot_username || 'cashier_system_bot'}${telegramSettings?.security_pin ? `?start=${telegramSettings.security_pin}` : ''}`;
    navigator.clipboard.writeText(link);
    setCopiedBotLink(true);
    setTimeout(() => setCopiedBotLink(false), 3000);
  };

  const handleRegeneratePin = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/backup/telegram/regenerate-pin', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setTelegramNotice({ type: 'success', message: 'کۆدی نهێنی (PIN) بە سەرکەوتوویی نوێکرایەوە' });
        fetchBackupData();
      }
    } catch (err) {
      setTelegramNotice({ type: 'error', message: err.message });
    }
  };

  const handleStartEditRecipient = (r) => {
    setEditingRecipientId(r.id);
    setEditingRecipientName(r.recipient_name);
  };

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

  const handleSendBackupToTelegram = async () => {
    setTelegramSending(true);
    setTelegramNotice(null);
    try {
      const res = await fetch('http://localhost:3001/api/backup/telegram/send', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setTelegramNotice({ type: 'success', message: data.message });
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
    e.target.value = '';
  };

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
      {/* Top Header */}
      <div className="header mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>ڕێکخستنەکان</h1>
        </div>
        {savedNotice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', padding: '6px 14px', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 700 }}>
            <CheckCircle2 size={16} />
            گۆڕانکارییەکان پاشەکەوت کران
          </div>
        )}
      </div>

      {/* Clean 4-Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '1.75rem',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '12px',
        overflowX: 'auto'
      }}>
        {[
          { id: 'CASHIERS', label: 'کاشێرەکان', icon: Users },
          { id: 'HARDWARE', label: 'چاپکەر و ئامێرەکان', icon: Printer },
          { id: 'BACKUP', label: 'باکئەپ و پاراستن', icon: Shield },
          { id: 'SECURITY', label: 'ئاسایش و سیستەم', icon: Key }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '12px',
                border: isActive ? '1.5px solid var(--accent-color)' : '1px solid transparent',
                background: isActive ? 'var(--primary-light)' : 'transparent',
                color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={17} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: CASHIERS */}
      {activeTab === 'CASHIERS' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                هەژمارەکانی کاشێر
              </h2>
              {cashierNotice && (
                <span style={{ fontSize: '0.82rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 700 }}>
                  {cashierNotice}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleOpenAddCashierModal}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '9px 16px', borderRadius: '10px',
                background: 'var(--primary-color, #2563eb)',
                color: '#ffffff', border: 'none', fontWeight: 700,
                cursor: 'pointer', fontSize: '0.88rem'
              }}
            >
              <UserPlus size={16} /> زیادکردنی کاشێری نوێ
            </button>
          </div>

          {loadingCashiers ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              کاشێرەکان باردەکرێن...
            </div>
          ) : cashiersList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              هیچ کاشێرێک تۆمار نەکراوە
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              {cashiersList.map((cashier) => {
                const isActive = cashier.is_active === 1;
                const activePermsCount = Object.values(cashier.permissions || {}).filter(Boolean).length;
                return (
                  <div
                    key={cashier.id}
                    style={{
                      padding: '1.2rem',
                      borderRadius: '16px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                      opacity: isActive ? 1 : 0.65
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: isActive ? 'rgba(37, 99, 235, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isActive ? '#2563eb' : '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Users size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
                            {cashier.full_name || cashier.username}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            ناوی بەکارهێنەر: <strong style={{ color: 'var(--text-primary)' }}>{cashier.username}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 7px',
                          borderRadius: '6px',
                          background: 'rgba(37, 99, 235, 0.1)',
                          color: '#2563eb',
                          border: '1px solid rgba(37, 99, 235, 0.25)'
                        }}>
                          {activePermsCount} دەسەڵات
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 7px',
                          borderRadius: '6px',
                          background: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: isActive ? '#10b981' : '#ef4444',
                          border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          {isActive ? 'چالاک' : 'ناچالاک'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--border-color)', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditCashierModal(cashier)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(37, 99, 235, 0.3)',
                            background: 'rgba(37, 99, 235, 0.08)',
                            color: '#2563eb',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <Shield size={14} /> دەستکاریکردن و دەسەڵاتەکان
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCashier(cashier)}
                          style={{
                            padding: '5px 8px',
                            borderRadius: '8px',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#ef4444',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                          title="سڕینەوەی کاشێر"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleCashierActive(cashier)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: isActive ? '#dc2626' : '#10b981',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {isActive ? 'ناچالاککردن' : 'چالاککردنەوە'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HARDWARE / PRINTER */}
      {activeTab === 'HARDWARE' && (
        <div style={{ maxWidth: '680px' }}>
          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '18px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Printer size={20} color="#0284c7" /> چاپکەری پسووڵە و سندوقی پارە
            </h2>

            {hardwareNotice && (
              <div style={{ 
                padding: '10px 14px', 
                borderRadius: '10px', 
                background: hardwareNotice.includes('هەڵە') ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', 
                color: hardwareNotice.includes('هەڵە') ? '#ef4444' : '#10b981', 
                border: hardwareNotice.includes('هەڵە') ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '0.86rem', 
                fontWeight: 700, 
                marginBottom: '1.25rem' 
              }}>
                {hardwareNotice}
              </div>
            )}

            {/* Printer Selection */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                چاپکەری دیاریکراو
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
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
                  onClick={fetchPrinters}
                  title="نوێکردنەوەی لیستی چاپکەرەکان"
                  style={{
                    padding: '0 12px',
                    borderRadius: '10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <RefreshCw size={16} />
                </button>

                <button
                  type="button"
                  onClick={handleSaveHardwareSettings}
                  title="پاشەکەوتکردن"
                  className="btn-primary"
                  style={{ padding: '0 14px', borderRadius: '10px', cursor: 'pointer' }}
                >
                  <Save size={16} />
                </button>
              </div>
            </div>

            {/* Paper Size & Silent Print */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1.5rem' }}>
              <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700 }}>
                  قەبارەی کاغەز
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => { setPaperWidth('80mm'); localStorage.setItem('pos_paper_width', '80mm'); }}
                    style={{
                      flex: 1,
                      padding: '7px 8px',
                      borderRadius: '8px',
                      border: paperWidth === '80mm' ? '1px solid #0284c7' : '1px solid var(--border-color)',
                      background: paperWidth === '80mm' ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-secondary)',
                      color: paperWidth === '80mm' ? '#0284c7' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    80mm
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaperWidth('58mm'); localStorage.setItem('pos_paper_width', '58mm'); }}
                    style={{
                      flex: 1,
                      padding: '7px 8px',
                      borderRadius: '8px',
                      border: paperWidth === '58mm' ? '1px solid #0284c7' : '1px solid var(--border-color)',
                      background: paperWidth === '58mm' ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-secondary)',
                      color: paperWidth === '58mm' ? '#0284c7' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    58mm
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
                  padding: '10px 12px', 
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

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={handleTestPrint}
                disabled={isTestPrinting}
                style={{
                  padding: '11px 14px',
                  borderRadius: '10px',
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
                  padding: '11px 14px',
                  borderRadius: '10px',
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
        </div>
      )}

      {/* TAB 3: BACKUP & RESTORE */}
      {activeTab === 'BACKUP' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          {/* Local Computer Backup */}
          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '18px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={20} color="#10b981" /> باکئەپ لەسەر کۆمپیوتەر
            </h2>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>دوایین باکئەپ:</span>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#38bdf8' }}>
                {backupStats?.latestBackup ? new Date(backupStats.latestBackup.createdAt).toLocaleDateString('en-GB') : 'ئەمڕۆ'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
              <button 
                onClick={ipcRenderer ? handleNativeSaveBackup : handleDownloadBackup} 
                disabled={backupLoading}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '12px', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer' }}
              >
                <Download size={17} /> {backupLoading ? 'کۆکردنەوەی داتابەیس...' : 'دروستکردنی باکئەپ (Download Backup)'}
              </button>

              {ipcRenderer && (
                <button
                  onClick={handleOpenBackupsFolder}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  <FolderOpen size={15} /> کردنەوەی بوخچەی باکئەپەکان
                </button>
              )}
            </div>

            {/* Restore Section */}
            <div style={{ paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#f59e0b', marginBottom: '8px' }}>
                هێنانەوەی باکئەپ لە کۆمپیوتەرەوە
              </label>
              <label 
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px', background: 'rgba(245, 158, 11, 0.08)', color: '#fbbf24', border: '1px dashed rgba(245, 158, 11, 0.35)', borderRadius: '12px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', boxSizing: 'border-box' }}
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

          {/* Telegram Cloud Backup */}
          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={20} color="#229ED9" /> باکئەپی تێلیگرام
              </h2>
              <span style={{ fontSize: '0.78rem', padding: '3px 8px', borderRadius: '8px', background: 'rgba(34, 158, 217, 0.12)', color: '#38bdf8', border: '1px solid rgba(34, 158, 217, 0.3)', fontWeight: 700 }}>
                @{telegramSettings?.bot_username || 'cashier_system_bot'}
              </span>
            </div>

            {telegramNotice && (
              <div style={{ padding: '8px 12px', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '8px', background: telegramNotice.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: telegramNotice.type === 'success' ? '#34d399' : '#f87171', border: `1px solid ${telegramNotice.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
                {telegramNotice.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{telegramNotice.message}</span>
              </div>
            )}

            {/* Recipients List */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  لیستی وەرگران ({telegramSettings?.activeCount || 0} چالاک)
                </span>
                <button
                  onClick={handleCheckPairing}
                  disabled={telegramCheckingPair}
                  title="نوێکردنەوە"
                  style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw size={12} className={telegramCheckingPair ? 'animate-spin' : ''} /> نوێکردنەوە
                </button>
              </div>

              {(!telegramSettings?.recipients || telegramSettings.recipients.length === 0) ? (
                <div style={{ padding: '1rem', textAlign: 'center', background: 'var(--bg-tertiary)', borderRadius: '10px', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  هیچ وەرگرێک تۆمار نەکراوە
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {telegramSettings.recipients.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: r.is_active ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-tertiary)',
                        border: `1px solid ${r.is_active ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-color)'}`,
                        borderRadius: '10px',
                        gap: '8px'
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}>
                        <input
                          type="checkbox"
                          checked={r.is_active}
                          onChange={() => handleToggleRecipient(r.id)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#10b981' }}
                        />
                        {editingRecipientId === r.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.preventDefault()}>
                            <input
                              type="text"
                              value={editingRecipientName}
                              onChange={e => setEditingRecipientName(e.target.value)}
                              style={{ padding: '3px 6px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid #38bdf8', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRecipientName(r.id)}
                              style={{ padding: '3px 6px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRecipientId(null)}
                              style={{ padding: '3px 6px', background: 'rgba(255, 255, 255, 0.1)', color: '#94a3b8', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.86rem', color: r.is_active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                {r.recipient_name}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); handleStartEditRecipient(r); }}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px' }}
                              >
                                <Edit2 size={11} />
                              </button>
                            </div>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              ID: {r.chat_id}
                            </span>
                          </div>
                        )}
                      </label>

                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleTestRecipient(r.id)}
                          title="تاقیکردنەوە"
                          style={{ padding: '4px 8px', background: 'rgba(34, 158, 217, 0.12)', color: '#38bdf8', border: '1px solid rgba(34, 158, 217, 0.3)', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          پشکنین
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecipient(r.id, r.recipient_name)}
                          title="سڕینەوە"
                          style={{ padding: '4px 6px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Strict Pairing PIN Security Box */}
            <div style={{
              padding: '10px 14px',
              background: 'rgba(34, 158, 217, 0.06)',
              borderRadius: '12px',
              border: '1px solid rgba(34, 158, 217, 0.25)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={16} color="#0284c7" />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  کۆدی نهێنی بەستنەوە (PIN):
                </span>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  letterSpacing: '2px',
                  background: 'var(--bg-secondary)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  color: '#0284c7',
                  fontWeight: 900
                }}>
                  {telegramSettings?.security_pin || '------'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleRegeneratePin}
                title="دروستکردنی کۆدێکی نوێ"
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={11} /> نوێکردنەوەی کۆد
              </button>
            </div>

            {/* Invite Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleCopyBotLink}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  background: 'var(--bg-tertiary)',
                  color: copiedBotLink ? '#10b981' : 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {copiedBotLink ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                {copiedBotLink ? 'کۆپیکرا!' : 'کۆپیکردنی لینک'}
              </button>

              <a
                href={telegramSettings?.bot_link || `https://t.me/${telegramSettings?.bot_username || 'cashier_system_bot'}${telegramSettings?.security_pin ? `?start=${telegramSettings.security_pin}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  background: 'rgba(34, 158, 217, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(34, 158, 217, 0.3)',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  textDecoration: 'none'
                }}
              >
                <ExternalLink size={14} /> کردنەوە لە تێلیگرام
              </a>
            </div>

            {/* Auto Backup Toggle */}
            <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={telegramSettings?.auto_backup_enabled ?? true}
                  onChange={e => handleToggleTelegramAuto(e.target.checked)}
                  style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#10b981' }}
                />
                ناردنی خۆکاری ڕۆژانەی باکئەپ
              </label>
            </div>

            {/* Send Now Button */}
            <button
              onClick={handleSendBackupToTelegram}
              disabled={telegramSending || !telegramSettings?.activeCount}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '11px',
                background: telegramSettings?.activeCount ? 'linear-gradient(135deg, #0284c7, #229ED9)' : 'var(--bg-tertiary)',
                color: telegramSettings?.activeCount ? '#ffffff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '12px',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: (!telegramSettings?.activeCount || telegramSending) ? 'not-allowed' : 'pointer'
              }}
            >
              <Send size={16} className={telegramSending ? 'animate-spin' : ''} />
              {telegramSending ? 'باکئەپ دەنێردرێت...' : 'ناردنی باکئەپ ئێستا'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: SECURITY & THEME */}
      {activeTab === 'SECURITY' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          {/* Admin Credentials */}
          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '18px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={20} color="#f59e0b" /> ئاسایش و هەژماری بەڕێوەبەر
            </h2>

            {passwordChangeError && (
              <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.84rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={15} /> {passwordChangeError}
              </div>
            )}

            {passwordChangeSuccess && (
              <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: '0.84rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} /> {passwordChangeSuccess}
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              setPasswordChangeError('');
              setPasswordChangeSuccess('');

              if (!adminUsername.trim()) {
                setPasswordChangeError('تکایە ناوی بەکارهێنەر بنووسە');
                return;
              }

              if (!oldPassword) {
                setPasswordChangeError('تکایە وشەی نهێنی ئێستا بنووسە');
                return;
              }

              if (newPassword && newPassword.length < 4) {
                setPasswordChangeError('وشەی نهێنی نوێ نابێت لە ٤ پیت کەمتر بێت');
                return;
              }

              if (newPassword && newPassword !== confirmPassword) {
                setPasswordChangeError('وشەی نهێنی نوێ و دووبارەکردنەوەکەی وەک یەک نین');
                return;
              }

              setPasswordChangeLoading(true);
              try {
                const res = await changePassword(oldPassword, newPassword || undefined, adminUsername.trim());
                if (res?.success) {
                  localStorage.setItem('pos_admin_username', adminUsername.trim());
                  localStorage.setItem('pos_last_username', adminUsername.trim());
                  setPasswordChangeSuccess('زانیارییەکانی هەژمار بە سەرکەوتوویی نوێکرانەوە!');
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                } else {
                  setPasswordChangeError(res?.message || 'هەڵە لە کاتی نوێکردنەوەی هەژمار');
                }
              } catch (err) {
                setPasswordChangeError(err.message || 'هەڵەیەک ڕوویدا');
              } finally {
                setPasswordChangeLoading(false);
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>
                  ناوی بەکارهێنەر (یوزەرنەیم)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="text"
                    value={adminUsername}
                    onChange={e => setAdminUsername(e.target.value)}
                    required
                    style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                  <User size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>
                  وشەی نهێنی ئێستا
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type={showOldPass ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    placeholder="وشەی نهێنی ئێستا..."
                    required
                    style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    tabIndex="-1"
                    style={{ position: 'absolute', left: '10px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    {showOldPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>
                  وشەی نهێنی نوێ
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="لانیکەم ٤ پیت یان ژمارە..."
                    style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    tabIndex="-1"
                    style={{ position: 'absolute', left: '10px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>
                  دووبارەکردنەوەی وشەی نهێنی نوێ
                </label>
                <input 
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="دووبارەکردنەوە..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={passwordChangeLoading}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '0.88rem', cursor: passwordChangeLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Key size={15} />
                  {passwordChangeLoading ? 'نوێ دەکرێتەوە...' : 'نوێکردنەوەی هەژمار'}
                </button>

                <button
                  type="button"
                  onClick={() => lockToCashier()}
                  title="قفڵکردنی بەڕێوەبەر و گەڕانەوە بۆ کاشێر"
                  style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Lock size={14} /> قوفڵکردن
                </button>
              </div>
            </form>
          </div>

          {/* Appearance Settings */}
          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '18px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Moon size={20} color="#60a5fa" /> ڕووکاری سیستەم
            </h2>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => applyTheme('dark')}
                style={{ flex: 1, padding: '1.25rem', borderRadius: '14px', background: theme === 'dark' ? 'var(--primary-light)' : 'var(--bg-tertiary)', border: `2px solid ${theme === 'dark' ? 'var(--accent-color)' : 'var(--border-color)'}`, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <Moon size={28} color={theme === 'dark' ? 'var(--accent-color)' : 'var(--text-muted)'} />
                <span style={{ fontWeight: 'bold' }}>تاریک</span>
              </button>
              <button 
                onClick={() => applyTheme('light')}
                style={{ flex: 1, padding: '1.25rem', borderRadius: '14px', background: theme === 'light' ? 'var(--primary-light)' : 'var(--bg-tertiary)', border: `2px solid ${theme === 'light' ? 'var(--accent-color)' : 'var(--border-color)'}`, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <Sun size={28} color={theme === 'light' ? '#f59e0b' : 'var(--text-muted)'} />
                <span style={{ fontWeight: 'bold' }}>ڕووناک</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Cashier Modal */}
            {showAddCashierModal && (
        <div className="pos-modal-overlay" onClick={() => setShowAddCashierModal(false)}>
          <div className="pos-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px', width: '94%', direction: 'rtl', padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>زیادکردنی کاشێری نوێ</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddCashierModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {cashierError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#dc2626', padding: '8px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.84rem' }}>
                {cashierError}
              </div>
            )}

            <form onSubmit={handleCreateCashier}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    ناوی تەواو
                  </label>
                  <input
                    type="text"
                    placeholder="بۆ نموونە: ئاراس کەریم"
                    value={newCashierForm.full_name}
                    onChange={e => setNewCashierForm({ ...newCashierForm, full_name: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    ناوی بەکارهێنەر (Username) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="بۆ نموونە: cashier3"
                    value={newCashierForm.username}
                    onChange={e => setNewCashierForm({ ...newCashierForm, username: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>
                  وشەی نهێنی (Password) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="وشەی نهێنی بۆ کاشێر دیاری بکە..."
                  value={newCashierForm.password}
                  onChange={e => setNewCashierForm({ ...newCashierForm, password: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontSize: '0.88rem' }}
                />
              </div>

              {/* Per-Cashier Permissions Selector */}
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} color="#10b981" /> دیاریکردنی دەسەڵاتەکان ({Object.values(newCashierPermissions || {}).filter(Boolean).length} لە {POS_ACTION_PERMISSIONS.length + MODULE_PERMISSIONS.length})
                  </span>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const allTrue = {};
                        POS_ACTION_PERMISSIONS.forEach(p => { allTrue[p.key] = true; });
                        MODULE_PERMISSIONS.forEach(p => { allTrue[p.key] = true; });
                        setNewCashierPermissions(allTrue);
                      }}
                      style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700 }}
                    >
                      هەمووی
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCashierPermissions(DEFAULT_CASHIER_PERMISSIONS)}
                      style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '6px', border: '1px solid rgba(37, 99, 235, 0.4)', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', cursor: 'pointer', fontWeight: 700 }}
                    >
                      ستاندارد
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allFalse = {};
                        POS_ACTION_PERMISSIONS.forEach(p => { allFalse[p.key] = false; });
                        MODULE_PERMISSIONS.forEach(p => { allFalse[p.key] = false; });
                        setNewCashierPermissions(allFalse);
                      }}
                      style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 700 }}
                    >
                      لابردنی هەمووی
                    </button>
                  </div>
                </div>

                <div style={{ maxHeight: '230px', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#2563eb', marginBottom: '6px' }}>
                      • کردار و دەسەڵاتەکانی فرۆشتن لە کاشێر
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                      {POS_ACTION_PERMISSIONS.map(p => {
                        const checked = Boolean(newCashierPermissions?.[p.key]);
                        return (
                          <label
                            key={p.key}
                            onClick={(e) => {
                              e.preventDefault();
                              setNewCashierPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }));
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '7px',
                              padding: '6px 9px',
                              borderRadius: '8px',
                              background: checked ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-primary)',
                              border: checked ? '1px solid #2563eb' : '1px solid var(--border-color)',
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              fontWeight: checked ? 700 : 500,
                              color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                              transition: 'all 0.12s ease',
                              userSelect: 'none'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#2563eb' }}
                            />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10b981', marginBottom: '6px' }}>
                      • لاپەڕە و بەشە سەرەکییەکان
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                      {MODULE_PERMISSIONS.map(p => {
                        const checked = Boolean(newCashierPermissions?.[p.key]);
                        return (
                          <label
                            key={p.key}
                            onClick={(e) => {
                              e.preventDefault();
                              setNewCashierPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }));
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '7px',
                              padding: '6px 9px',
                              borderRadius: '8px',
                              background: checked ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-primary)',
                              border: checked ? '1px solid #10b981' : '1px solid var(--border-color)',
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              fontWeight: checked ? 700 : 500,
                              color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                              transition: 'all 0.12s ease',
                              userSelect: 'none'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#10b981' }}
                            />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                <button
                  type="submit"
                  disabled={cashierSubmitting}
                  style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 700, cursor: cashierSubmitting ? 'not-allowed' : 'pointer', fontSize: '0.92rem' }}
                >
                  {cashierSubmitting ? 'تکایە چاوەڕوان بە...' : 'زیادکردنی کاشێر'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCashierModal(false)}
                  style={{ padding: '11px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.92rem' }}
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Cashier Modal */}
            {showEditCashierModal && selectedCashier && (
        <div className="pos-modal-overlay" onClick={() => setShowEditCashierModal(false)}>
          <div className="pos-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px', width: '94%', direction: 'rtl', padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>دەستکاریکردنی کاشێر: {selectedCashier.username}</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowEditCashierModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {cashierError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#dc2626', padding: '8px 12px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.84rem' }}>
                {cashierError}
              </div>
            )}

            <form onSubmit={handleUpdateCashier}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    ناوی تەواو
                  </label>
                  <input
                    type="text"
                    value={editCashierFullName}
                    onChange={e => setEditCashierFullName(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>
                    وشەی نهێنی نوێ (ئارەزوومەندانە)
                  </label>
                  <input
                    type="password"
                    placeholder="ئەگەر بەتاڵ بێت، ناگۆڕدرێت"
                    value={editCashierPassword}
                    onChange={e => setEditCashierPassword(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              {/* Per-Cashier Permissions Selector */}
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} color="#10b981" /> دەسەڵاتەکان ({Object.values(editCashierPermissions || {}).filter(Boolean).length} لە {POS_ACTION_PERMISSIONS.length + MODULE_PERMISSIONS.length})
                  </span>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const allTrue = {};
                        POS_ACTION_PERMISSIONS.forEach(p => { allTrue[p.key] = true; });
                        MODULE_PERMISSIONS.forEach(p => { allTrue[p.key] = true; });
                        setEditCashierPermissions(allTrue);
                      }}
                      style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 700 }}
                    >
                      هەمووی
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCashierPermissions(DEFAULT_CASHIER_PERMISSIONS)}
                      style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '6px', border: '1px solid rgba(37, 99, 235, 0.4)', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', cursor: 'pointer', fontWeight: 700 }}
                    >
                      ستاندارد
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allFalse = {};
                        POS_ACTION_PERMISSIONS.forEach(p => { allFalse[p.key] = false; });
                        MODULE_PERMISSIONS.forEach(p => { allFalse[p.key] = false; });
                        setEditCashierPermissions(allFalse);
                      }}
                      style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 700 }}
                    >
                      لابردنی هەمووی
                    </button>
                  </div>
                </div>

                <div style={{ maxHeight: '230px', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#2563eb', marginBottom: '6px' }}>
                      • کردار و دەسەڵاتەکانی فرۆشتن لە کاشێر
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                      {POS_ACTION_PERMISSIONS.map(p => {
                        const checked = Boolean(editCashierPermissions?.[p.key]);
                        return (
                          <label
                            key={p.key}
                            onClick={(e) => {
                              e.preventDefault();
                              setEditCashierPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }));
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '7px',
                              padding: '6px 9px',
                              borderRadius: '8px',
                              background: checked ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-primary)',
                              border: checked ? '1px solid #2563eb' : '1px solid var(--border-color)',
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              fontWeight: checked ? 700 : 500,
                              color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                              transition: 'all 0.12s ease',
                              userSelect: 'none'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#2563eb' }}
                            />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10b981', marginBottom: '6px' }}>
                      • لاپەڕە و بەشە سەرەکییەکان
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                      {MODULE_PERMISSIONS.map(p => {
                        const checked = Boolean(editCashierPermissions?.[p.key]);
                        return (
                          <label
                            key={p.key}
                            onClick={(e) => {
                              e.preventDefault();
                              setEditCashierPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }));
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '7px',
                              padding: '6px 9px',
                              borderRadius: '8px',
                              background: checked ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-primary)',
                              border: checked ? '1px solid #10b981' : '1px solid var(--border-color)',
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              fontWeight: checked ? 700 : 500,
                              color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                              transition: 'all 0.12s ease',
                              userSelect: 'none'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#10b981' }}
                            />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                <button
                  type="submit"
                  disabled={cashierSubmitting}
                  style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: 700, cursor: cashierSubmitting ? 'not-allowed' : 'pointer', fontSize: '0.92rem' }}
                >
                  {cashierSubmitting ? 'تکایە چاوەڕوان بە...' : 'پاشەکەوتکردن'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditCashierModal(false)}
                  style={{ padding: '11px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.92rem' }}
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
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
