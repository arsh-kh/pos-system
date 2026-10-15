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
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
  DISCOUNT_APPLIED: 'داشکاندنی دەستی %'
};

const AuditLogs = () => {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [actionFilter, setActionFilter] = useState('ALL');
  const [userFilter, setUserFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {};
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
  }, [actionFilter, userFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  if (!isAdmin) {
    return (
      <div className="dashboard-page p-8" style={{ textAlign: 'center', paddingTop: '80px' }}>
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
    <div className="dashboard-page p-8">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.8rem', margin: 0 }}>
            <ShieldCheck color="#a855f7" size={32} /> تۆماری چاودێری و چالاکییەکان (Audit Logs)
          </h1>
          <p className="text-secondary" style={{ marginTop: '6px' }}>
            چاودێریکردنی هەموو دەستکارییەکان: کێ چی گۆڕیوە، کەی، و بەراوردی نرخی پێشوو بەرامبەر نوێ.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: 'white',
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
        <div className="stat-card glass-panel" style={{ background: 'rgba(168, 85, 247, 0.08)', borderColor: 'rgba(168, 85, 247, 0.25)' }}>
          <h3>کۆی گشتی چالاکییەکان</h3>
          <div className="value" style={{ color: '#c084fc' }}>
            {stats.total_logs || 0} کردار
          </div>
          <div className="sub-text">تۆمارکراو لە داتابەیسدا</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
          <h3>گۆڕانکارییەکانی نرخ</h3>
          <div className="value" style={{ color: '#38bdf8' }}>
            {stats.price_changes || 0} دەستکاری
          </div>
          <div className="sub-text">نرخی کڕین یان فرۆشتن</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
          <h3>سڕینەوەی تۆمارەکان</h3>
          <div className="value" style={{ color: '#f87171' }}>
            {stats.deletions || 0} سڕینەوە
          </div>
          <div className="sub-text">کاڵا، فرۆشتن یان خەرجی</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(244, 63, 94, 0.08)', borderColor: 'rgba(244, 63, 94, 0.25)' }}>
          <h3>گەڕاندنەوە لە کڕیار</h3>
          <div className="value" style={{ color: '#fb7185' }}>
            {stats.returns_count || 0} گەڕاندنەوە
          </div>
          <div className="sub-text">بڕی پارەی دراوەتەوە</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '16px', marginBottom: '1.5rem', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Search */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: '1 1 280px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', right: '12px', top: '12px' }} />
            <input 
              type="text" 
              placeholder="گەڕان بەپێی کاڵا، بارکۆد، بەکارهێنەر یان وردەکاری..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: 'white', outline: 'none', fontSize: '0.9rem' }}
            />
          </div>
          <button 
            type="submit" 
            style={{ padding: '0 16px', borderRadius: '10px', background: '#38bdf8', color: '#0f172a', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
            گەڕان
          </button>
        </form>

        {/* Action Type Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>جۆری کردار:</span>
          <select 
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '10px', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
          >
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* User Filter Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>بەکارهێنەر:</span>
          <select 
            value={userFilter}
            onChange={e => setUserFilter(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '10px', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)', color: 'white', outline: 'none', fontSize: '0.85rem' }}
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
          <thead style={{ background: 'rgba(0, 0, 0, 0.2)' }}>
            <tr>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>#</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>کات و بەروار</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>بەکارهێنەر (کێ کردی)</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>جۆری کردار</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>بەشی سیستەم</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>وردەکاری و بەراوردی نرخ/مەوجود</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>باردەکرێت...</td></tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  هیچ چالاکییەکی تۆمارکراو بەپێی ئەم فلتەرە نەدۆزرایەوە.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const isPriceChange = log.action_type === 'PRICE_CHANGE';
                const isStockAdjust = log.action_type === 'STOCK_ADJUSTMENT';
                const isDelete = log.action_type.includes('DELETE');
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
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.85rem' }}>
                      #{log.id}
                    </td>

                    <td style={{ padding: '16px 20px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} color="#94a3b8" />
                        <span>{new Date(log.created_at).toLocaleDateString('ku-IQ')}</span>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                          {new Date(log.created_at).toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>

                    {/* User Identity with Role Badge */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '8px', background: isCashierUser ? 'rgba(16, 185, 129, 0.15)' : 'rgba(168, 85, 247, 0.15)', color: isCashierUser ? '#34d399' : '#c084fc', fontWeight: 'bold', fontSize: '0.82rem' }}>
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
                                ? 'rgba(139, 92, 246, 0.2)' 
                                : 'rgba(255, 255, 255, 0.08)',
                          color: isDelete 
                            ? '#f87171' 
                            : isPriceChange 
                              ? '#38bdf8' 
                              : isStockAdjust 
                                ? '#c084fc' 
                                : '#e2e8f0'
                        }}
                      >
                        {ACTION_LABELS[log.action_type] || log.action_type}
                      </span>
                    </td>

                    {/* Entity */}
                    <td style={{ padding: '16px 20px', color: '#94a3b8', fontSize: '0.85rem' }}>
                      {log.entity_name} {log.entity_id ? `(#${log.entity_id})` : ''}
                    </td>

                    {/* Details and Comparison */}
                    <td style={{ padding: '16px 20px', fontSize: '0.9rem' }}>
                      <div style={{ fontWeight: 500, color: 'white', marginBottom: (isPriceChange || isStockAdjust) ? '4px' : '0' }}>
                        {log.details || '-'}
                      </div>

                      {/* Visual Diff Tag for Price Change */}
                      {isPriceChange && oldValObj && newValObj && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '6px' }}>
                          <span style={{ color: '#94a3b8', textDecoration: 'line-through' }}>
                            {Number(oldValObj.selling_price || 0).toLocaleString()} د.ع
                          </span>
                          <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>➔</span>
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                            {Number(newValObj.selling_price || 0).toLocaleString()} د.ع
                          </span>
                        </div>
                      )}

                      {/* Visual Diff Tag for Stock Adjustment */}
                      {isStockAdjust && oldValObj && newValObj && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '6px' }}>
                          <span style={{ color: '#94a3b8' }}>
                            کۆن: {oldValObj.stock}
                          </span>
                          <span style={{ color: '#c084fc', fontWeight: 'bold' }}>➔</span>
                          <span style={{ color: '#34d399', fontWeight: 'bold' }}>
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
