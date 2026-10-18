import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  RefreshCw, 
  Calendar, 
  User, 
  Tag, 
  Trash2, 
  Layers, 
  TrendingUp, 
  Lock, 
  RotateCcw, 
  Percent,
  CheckCircle2,
  AlertTriangle,
  Clock,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { formatDate, formatDateTime, formatCurrency } from '../utils/dateFormatter';
import './Dashboard.css';

const ACTION_LABELS = {
  ALL: 'هەموو کردارەکان',
  PRICE_CHANGE: 'گۆڕینی نرخ 🏷️',
  STOCK_ADJUSTMENT: 'دەستکاری مەوجود 📦',
  PRODUCT_EDIT: 'دەستکاری کاڵا ✏️',
  PRODUCT_DELETE: 'سڕینەوەی کاڵا 🗑️',
  SALE_DELETE: 'سڕینەوەی فرۆشتن ❌',
  REFUND_RETURN: 'گەڕاندنەوەی کاڵا ↩️',
  EXPENSE_CREATE: 'تۆمارکردنی خەرجی 💸',
  EXPENSE_DELETE: 'سڕینەوەی خەرجی 🗑️',
  SHIFT_OPEN: 'کردنەوەی شیفت 🔓',
  SHIFT_CLOSE: 'داخستنی شیفت 🔒',
  DISCOUNT_APPLIED: 'داشکاندنی دەستی %',
  LOGIN_SUCCESS: 'چوونەژوورەوەی سەرکەوتوو 🟢',
  LOGIN_FAILED: 'هەوڵی چوونەژوورەوەی هەڵە 🔴',
  USER_CREATE: 'دروستکردنی کاشێر 👤',
  USER_UPDATE: 'دەستکاری کاشێر ✏️',
  USER_DELETE: 'سڕینەوەی کاشێر 🗑️',
  PERMISSIONS_UPDATE: 'دەستکاری دەسەڵاتەکان 🛡️'
};

const DATE_PRESETS = [
  { key: 'ALL', label: 'هەموو بەروارەکان' },
  { key: 'today', label: 'ئەمڕۆ' },
  { key: 'yesterday', label: 'دوێنێ' },
  { key: 'last_7_days', label: '٧ ڕۆژی ڕابردوو' },
  { key: 'last_30_days', label: '٣٠ ڕۆژی ڕابردوو' },
  { key: 'this_month', label: 'ئەم مانگە' },
];

const AuditLogs = () => {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [datePreset, setDatePreset] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [userFilter, setUserFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (datePreset !== 'ALL') params.preset = datePreset;
      if (actionFilter !== 'ALL') params.action_type = actionFilter;
      if (userFilter !== 'ALL') params.username = userFilter;
      if (searchQuery) params.search = searchQuery;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await axios.get('http://localhost:3001/api/audit-logs', { params });
      if (res.data.status === 'SUCCESS') {
        setLogs(res.data.data || []);
        setStats(res.data.stats || {});
        setUsers(res.data.users || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [datePreset, actionFilter, userFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const handlePresetSelect = (presetKey) => {
    setDatePreset(presetKey);
    setStartDate('');
    setEndDate('');
  };

  const handleCustomDateChange = (start, end) => {
    setDatePreset('CUSTOM');
    if (start !== undefined) setStartDate(start);
    if (end !== undefined) setEndDate(end);
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    return kurdishSearchMatch([
      log.details, 
      log.username, 
      log.entity_id, 
      ACTION_LABELS[log.action_type] || log.action_type,
      log.entity_name
    ], searchQuery);
  });

  if (!isAdmin) {
    return (
      <div className="dashboard-page p-8" style={{ textAlign: 'center', paddingTop: '80px', direction: 'rtl' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <AlertTriangle size={40} color="#f87171" />
        </div>
        <h2 style={{ fontSize: '1.6rem', color: '#f87171', marginBottom: '10px' }}>دەسەڵاتی بینینی ئەم بەشەت نییە</h2>
        <p style={{ color: '#94a3b8', maxWidth: '500px', margin: '0 auto' }}>
          ئەم پەڕەیە (تۆماری چاودێری و لۆگەکان) تایبەتە بە بەڕێوەبەر (Admin). تکایە لە شریتی سەرەوە بە هەژماری ئەدمین بچۆ ژوورەوە.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-page p-8" style={{ direction: 'rtl' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.8rem', margin: 0 }}>
            <ShieldCheck color="#2563eb" size={32} /> تۆماری چاودێری و چالاکییەکان (Audit Logs)
          </h1>
          <p className="text-secondary" style={{ marginTop: '6px' }}>
            چاودێریکردنی تەواوی هەنگاوەکان: کێ چی گۆڕیوە، کەی، چوونەژوورەوەی کاشێرەکان و بەراوردی نرخی پێشوو بەرامبەر نوێ.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.9rem'
          }}
        >
          <RefreshCw size={16} /> نوێکردنەوە
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid mb-8">
        <div className="stat-card glass-panel" style={{ background: 'rgba(37, 99, 235, 0.08)', borderColor: 'rgba(37, 99, 235, 0.25)' }}>
          <h3>کۆی گشتی چالاکییەکان</h3>
          <div className="value" style={{ color: '#2563eb' }}>
            {stats.total_logs || 0} کردار
          </div>
          <div className="sub-text">تۆمارکراو لە داتابەیسدا</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(2, 132, 199, 0.08)', borderColor: 'rgba(2, 132, 199, 0.25)' }}>
          <h3>گۆڕانکارییەکانی نرخ</h3>
          <div className="value" style={{ color: '#0284c7' }}>
            {stats.price_changes || 0} دەستکاری
          </div>
          <div className="sub-text">نرخی کڕین یان فرۆشتن</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
          <h3>سڕینەوەی تۆمارەکان</h3>
          <div className="value" style={{ color: '#ef4444' }}>
            {stats.deletions || 0} سڕینەوە
          </div>
          <div className="sub-text">کاڵا، فرۆشتن یان کاشێر</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
          <h3>گەڕاندنەوە لە کڕیار</h3>
          <div className="value" style={{ color: '#10b981' }}>
            {stats.returns_count || 0} گەڕاندنەوە
          </div>
          <div className="sub-text">بڕی پارەی دراوەتەوە</div>
        </div>
      </div>

      {/* Date Presets Toolbar (ئەمڕۆ، دوێنێ، ٧ ڕۆژ، ئەم مانگە) */}
      <div className="glass-panel" style={{ padding: '12px 18px', borderRadius: '16px', marginBottom: '1rem', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', marginLeft: '10px' }}>
          <Clock size={16} color="var(--accent-color)" /> فلتەری کات:
        </div>
        
        {DATE_PRESETS.map((p) => {
          const isSelected = datePreset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => handlePresetSelect(p.key)}
              style={{
                padding: '6px 14px',
                borderRadius: '10px',
                border: isSelected ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                background: isSelected ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)',
                fontWeight: isSelected ? 800 : 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {p.label}
            </button>
          );
        })}

        {/* Custom Date Pickers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>لە:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleCustomDateChange(e.target.value, undefined)}
            style={{ padding: '5px 8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>تا:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleCustomDateChange(undefined, e.target.value)}
            style={{ padding: '5px 8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
          />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '16px', marginBottom: '1.5rem', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Search */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: '1 1 280px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', right: '12px', top: '12px' }} />
            <input 
              type="text" 
              placeholder="گەڕان بەپێی کاڵا، بارکۆد، بەکارهێنەر یان وردەکاری..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem' }}
            />
          </div>
          <button 
            type="submit" 
            style={{ padding: '0 16px', borderRadius: '10px', background: '#2563eb', color: '#ffffff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
            گەڕان
          </button>
        </form>

        {/* Action Type Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>جۆری کردار:</span>
          <select 
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }}
          >
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* User Filter Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>بەکارهێنەر (کاشێر/ئەدمین):</span>
          <select 
            value={userFilter}
            onChange={e => setUserFilter(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }}
          >
            <option value="ALL">هەموو بەکارهێنەران</option>
            {users.map(u => (
              <option key={u.username} value={u.username}>
                {u.username} ({u.user_role === 'ADMIN' ? 'ئەدمین' : 'کاشێر'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-panel" style={{ padding: '1px', borderRadius: '16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '1050px', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <thead style={{ background: 'var(--bg-tertiary)' }}>
            <tr>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>#</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>کات و بەروار</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>بەکارهێنەر (کێ کردی)</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>جۆری کردار</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>بەشی سیستەم</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>وردەکاری و بەراوردی نرخ/مەوجود</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>باردەکرێت...</td></tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  هیچ چالاکییەکی تۆمارکراو بەپێی ئەم فلتەرە نەدۆزرایەوە.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isPriceChange = log.action_type === 'PRICE_CHANGE';
                const isStockAdjust = log.action_type === 'STOCK_ADJUSTMENT';
                const isDelete = log.action_type.includes('DELETE');
                const isAuth = log.action_type.startsWith('LOGIN');
                const isCashierUser = log.user_role === 'CASHIER';

                let oldValObj = null;
                let newValObj = null;
                try {
                  oldValObj = typeof log.old_value === 'string' ? JSON.parse(log.old_value) : log.old_value;
                  newValObj = typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value;
                } catch (_) {}

                return (
                  <tr 
                    key={log.id} 
                    style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      #{log.id}
                    </td>

                    <td style={{ padding: '16px 20px', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} color="var(--text-secondary)" />
                        <span>{formatDateTime(log.created_at)}</span>
                      </div>
                    </td>

                    {/* User Identity with Role Badge */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '8px', background: isCashierUser ? 'rgba(16, 185, 129, 0.15)' : 'rgba(37, 99, 235, 0.15)', color: isCashierUser ? '#10b981' : '#2563eb', fontWeight: 'bold', fontSize: '0.82rem' }}>
                        <User size={14} />
                        <span>{log.username}</span>
                        <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>({isCashierUser ? 'کاشێر' : 'ئەدمین'})</span>
                      </div>
                    </td>

                    {/* Action Type Badge */}
                    <td style={{ padding: '16px 20px' }}>
                      <span 
                        style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: 'bold',
                          background: isDelete 
                            ? 'rgba(239, 68, 68, 0.2)' 
                            : isPriceChange 
                              ? 'rgba(56, 189, 248, 0.2)' 
                              : isStockAdjust 
                                ? 'rgba(217, 119, 6, 0.18)' 
                                : isAuth
                                  ? 'rgba(99, 102, 241, 0.18)'
                                  : 'var(--bg-tertiary)',
                          color: isDelete 
                            ? '#f87171' 
                            : isPriceChange 
                              ? '#0284c7' 
                              : isStockAdjust 
                                ? '#d97706' 
                                : isAuth
                                  ? '#6366f1'
                                  : 'var(--text-primary)',
                          border: '1px solid var(--border-color)'
                        }}
                      >
                        {ACTION_LABELS[log.action_type] || log.action_type}
                      </span>
                    </td>

                    {/* Entity */}
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {log.entity_name} {log.entity_id ? `(#${log.entity_id})` : ''}
                    </td>

                    {/* Details and Comparison */}
                    <td style={{ padding: '16px 20px', fontSize: '0.9rem' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: (isPriceChange || isStockAdjust) ? '4px' : '0' }}>
                        {log.details || '-'}
                      </div>

                      {/* Visual Diff Tag for Price Change */}
                      {isPriceChange && oldValObj && newValObj && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                            {Number(oldValObj.selling_price || 0).toLocaleString()} د.ع
                          </span>
                          <span style={{ color: '#0284c7', fontWeight: 'bold' }}>➔</span>
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                            {Number(newValObj.selling_price || 0).toLocaleString()} د.ع
                          </span>
                        </div>
                      )}

                      {/* Visual Diff Tag for Stock Adjustment */}
                      {isStockAdjust && oldValObj && newValObj && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            کۆن: {oldValObj.stock}
                          </span>
                          <span style={{ color: '#0284c7', fontWeight: 'bold' }}>➔</span>
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                            نوێ: {newValObj.stock}
                          </span>
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogs;
