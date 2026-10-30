import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Lock, 
  RefreshCw, 
  Printer, 
  CheckCircle2, 
  X,
  Send
} from 'lucide-react';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { formatDateTime } from '../utils/dateFormatter';
import './Dashboard.css';

const CashDrawer = () => {
  const [currentShiftData, setCurrentShiftData] = useState(null);
  const [shiftHistory, setShiftHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historySearch, setHistorySearch] = useState('');

  // Z-Report Print Modal
  const [selectedReportForPrint, setSelectedReportForPrint] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [telegramSending, setTelegramSending] = useState(false);

  // Opening Cash (پارەی ناو داخیلە) Modal State
  const [isOpeningCashModalOpen, setIsOpeningCashModalOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [isSubmittingOpeningCash, setIsSubmittingOpeningCash] = useState(false);

  const handleSaveOpeningCash = async (e) => {
    e.preventDefault();
    const amt = Math.max(0, Math.round(Number(openingCashInput) || 0));
    setIsSubmittingOpeningCash(true);
    try {
      const res = await axios.post('http://localhost:3001/api/shifts/opening-cash', { amount: amt });
      if (res.data?.status === 'SUCCESS') {
        setIsOpeningCashModalOpen(false);
        fetchShiftData();
      } else {
        alert(res.data?.message || 'هەڵەیەک ڕوویدا');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'شکستی هێنا لە تۆمارکردنی پارەی ناو داخیلە');
    } finally {
      setIsSubmittingOpeningCash(false);
    }
  };

  const printZReport = async () => {
    if (window.require && selectedReportForPrint) {
      try {
        const { ipcRenderer } = window.require('electron');
        const res = await ipcRenderer.invoke('print-z-report', selectedReportForPrint);
        if (res && res.success) return;
      } catch (_) {}
    }
    window.print();
  };

  const handleSendTelegramZReport = async () => {
    if (!selectedReportForPrint) return;
    setTelegramSending(true);
    try {
      const shiftId = selectedReportForPrint.id || 'current';
      const res = await axios.post(`http://localhost:3001/api/shifts/z-report/${shiftId}/telegram`);
      if (res.data.status === 'SUCCESS') {
        alert('ڕاپۆرتی Z بە سەرکەوتوویی بۆ تێلیگرام نێردرا ✅');
      } else {
        alert(res.data.message || 'هەڵە لە کاتی ناردن');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'شکستی هێنا');
    } finally {
      setTelegramSending(false);
    }
  };

  const fetchShiftData = async () => {
    try {
      setLoading(true);
      const [currentRes, historyRes] = await Promise.all([
        axios.get('http://localhost:3001/api/shifts/current'),
        axios.get('http://localhost:3001/api/shifts/all')
      ]);

      if (currentRes.data.status === 'SUCCESS') {
        setCurrentShiftData(currentRes.data.data);
      }
      if (historyRes.data.status === 'SUCCESS') {
        setShiftHistory(historyRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load shift data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShiftData();
  }, []);

  const currentShift = currentShiftData?.shift;
  const stats = currentShiftData?.stats;

  const filteredHistory = shiftHistory.filter(shift => 
    kurdishSearchMatch([shift.cashier_name, shift.id, shift.notes], historySearch)
  );

  return (
    <div className="dashboard-page p-6" dir="rtl" style={{ background: '#f8fafc', minHeight: '100vh' }}>
      
      {/* 1. Clean Top Header Bar */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '12px 18px',
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
            قاسە و داخستنی شیفت (Z-Report)
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            type="button"
            onClick={fetchShiftData} 
            disabled={loading}
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '6px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.84rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            نوێکردنەوە
          </button>

          {/* Button to Record / Edit Opening Cash (پارەی ناو داخیلە) */}
          <button 
            type="button"
            onClick={() => {
              setOpeningCashInput(String(stats?.opening_cash || ''));
              setIsOpeningCashModalOpen(true);
            }}
            style={{
              height: '36px',
              padding: '0 16px',
              borderRadius: '6px',
              background: '#ffffff',
              border: '1.5px solid #0284c7',
              color: '#0284c7',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.84rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            + پارەی ناو داخیلە
          </button>

          {/* Direct 1-Click Print Day Summary */}
          <button 
            type="button"
            onClick={() => {
              setSelectedReportForPrint({
                id: currentShift?.id || 'TODAY',
                cashier_name: currentShift?.cashier_name || 'کاشێری سەرەکی',
                opened_at: currentShift?.opened_at || new Date().toISOString(),
                closed_at: new Date().toISOString(),
                opening_cash: stats?.opening_cash || 0,
                cash_sales: stats?.cash_sales || 0,
                debt_sales: stats?.debt_sales || 0,
                debt_repaid_cash: stats?.debt_repaid_cash || 0,
                expenses_paid: stats?.expenses_paid || 0,
                cash_refunds: stats?.cash_refunds || 0,
                expected_cash: stats?.expected_cash || 0,
                actual_cash: stats?.expected_cash || 0,
                difference: 0
              });
            }}
            style={{
              height: '36px',
              padding: '0 16px',
              borderRadius: '6px',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.84rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Printer size={16} /> چاپکردنی ڕاپۆرتی ئەمڕۆ
          </button>

          {/* 1-Click Close & Reset Day */}
          <button 
            type="button"
            disabled={isSubmitting}
            onClick={async () => {
              if (!window.confirm('ئایا دڵنیایت لە داخستنی ڕۆژ و تۆمارکردنی پسووڵەی Z-Report؟')) return;
              setIsSubmitting(true);
              try {
                const shiftId = currentShift?.id || 'TODAY';
                const res = await axios.post(`http://localhost:3001/api/shifts/close/${shiftId}`, {
                  actual_cash: stats?.expected_cash || 0,
                  notes: 'داخستنی خودکاری کۆتایی ڕۆژ'
                });
                if (res.data.status === 'SUCCESS') {
                  setSelectedReportForPrint(res.data.data);
                  fetchShiftData();
                }
              } catch (err) {
                alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا');
              } finally {
                setIsSubmitting(false);
              }
            }}
            style={{
              height: '36px',
              padding: '0 16px',
              borderRadius: '6px',
              background: '#fef2f2',
              color: '#ef4444',
              border: '1px solid #fecaca',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.84rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Lock size={15} /> داخستنی ڕۆژ و نوێکردنەوە
          </button>
        </div>
      </div>

      {/* 2. Active Shift Status & Real-time Financial Breakdown */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '16px'
      }}>
        {/* Compact Status Metadata Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          paddingBottom: '12px',
          marginBottom: '14px',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: '#f0fdf4',
              color: '#16a34a',
              border: '1px solid #bbf7d0',
              fontWeight: 700,
              fontSize: '0.82rem'
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }}></span>
              ڕاپۆرتی دارایی: #{currentShift?.id || 'TODAY'}
            </span>
            <span style={{ fontSize: '0.84rem', color: '#64748b' }}>
              کاشێر: <strong style={{ color: '#0f172a' }}>{currentShift?.cashier_name || 'کاشێری سەرەکی'}</strong>
            </span>
          </div>

          <div style={{ fontSize: '0.82rem', color: '#64748b', fontFamily: 'monospace' }}>
            دەستپێکردن: {currentShift?.opened_at ? formatDateTime(currentShift.opened_at) : formatDateTime(new Date())}
          </div>
        </div>

        {/* 6 Clean Financial Flow Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '10px',
          marginBottom: '14px'
        }}>
          {/* 1. Opening Cash (پارەی ناو داخیلە) */}
          <div 
            onClick={() => {
              setOpeningCashInput(String(stats?.opening_cash || ''));
              setIsOpeningCashModalOpen(true);
            }}
            style={{ 
              background: '#f8fafc', 
              border: '1px solid #cbd5e1', 
              borderRadius: '8px', 
              padding: '10px 14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="کلیک بکە بۆ گۆڕین یان تۆمارکردنی پارەی ناو داخیلە"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 700 }}>پارەی ناو داخیلە</div>
              <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700 }}>دەستکاری ✏️</span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
              {Number(stats?.opening_cash || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>د.ع</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>پارەی سەرەتایی دانراو لە داخیلە</div>
          </div>

          {/* 2. Cash Sales (+) */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 700, marginBottom: '4px' }}>فرۆشتنی نەقد (کاش)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#16a34a', fontFamily: 'monospace' }}>
              +{Number(stats?.cash_sales || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>د.ع</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: '2px' }}>{stats?.sale_count || 0} پسووڵەی فرۆشراو</div>
          </div>

          {/* 3. Debt Collections (+) */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 700, marginBottom: '4px' }}>وەرگرتنەوەی قەرز (نەقد)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' }}>
              +{Number(stats?.debt_repaid_cash || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>د.ع</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#3b82f6', marginTop: '2px' }}>دانەوەی قەرزی کڕیاران بە کاش</div>
          </div>

          {/* 4. Cash Refunds (-) */}
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '0.78rem', color: '#9a3412', fontWeight: 700, marginBottom: '4px' }}>گەڕاندنەوەی نەقد (-)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ea580c', fontFamily: 'monospace' }}>
              -{Number(stats?.cash_refunds || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>د.ع</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#c2410c', marginTop: '2px' }}>{stats?.refund_count || 0} کاڵای گەڕاوە لە قاسە</div>
          </div>

          {/* 5. Expenses (-) */}
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '0.78rem', color: '#991b1b', fontWeight: 700, marginBottom: '4px' }}>خەرجی و تێچوو (-)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ef4444', fontFamily: 'monospace' }}>
              -{Number(stats?.expenses_paid || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>د.ع</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#b91c1c', marginTop: '2px' }}>پارەی دراو لە قاسە</div>
          </div>

          {/* 6. Debt Sales (Record only) */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>فرۆشتنی قەرز</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#d97706', fontFamily: 'monospace' }}>
              {Number(stats?.debt_sales || 0).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>د.ع</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>ناچێتە ناو قاسەی نەقد</div>
          </div>
        </div>

        {/* Net Expected Cash Highlight Box with Full Equation */}
        <div style={{
          background: '#f8fafc',
          border: '1.5px solid #cbd5e1',
          borderRadius: '8px',
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '0.88rem', color: '#1e293b', fontWeight: 800 }}>
              کۆی گشتی پێشبینیکراوی ناو قاسە (پارەی نەقدی ماوە)
            </div>
            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px', direction: 'ltr', textAlign: 'right' }}>
              <span>داخیلە ({Number(stats?.opening_cash || 0).toLocaleString()})</span> + 
              <span> نەقد ({Number(stats?.cash_sales || 0).toLocaleString()})</span> + 
              <span> وەرگرتنەوەی قەرز ({Number(stats?.debt_repaid_cash || 0).toLocaleString()})</span> - 
              <span> گەڕاندنەوە ({Number(stats?.cash_refunds || 0).toLocaleString()})</span> - 
              <span> خەرجی ({Number(stats?.expenses_paid || 0).toLocaleString()})</span> = 
              <strong style={{ color: '#0284c7' }}> {Number(stats?.expected_cash || 0).toLocaleString()} د.ع</strong>
            </div>
          </div>

          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0284c7', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            {Number(stats?.expected_cash || 0).toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b' }}>دینار</span>
          </div>
        </div>
      </div>

      {/* 3. Shift History Section */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            مێژووی شیفتەکانی ڕابردوو و Z-Report
          </h2>

          <input 
            type="text" 
            placeholder="گەڕان بەپێی کاشێر، تێبینی یان ژمارەی شیفت..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            style={{
              padding: '0 12px',
              height: '36px',
              borderRadius: '6px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              width: '280px',
              outline: 'none',
              fontSize: '0.84rem',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ height: '36px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0 12px', textAlign: 'center', width: '40px' }}>#</th>
                <th style={{ padding: '0 12px', textAlign: 'right' }}>کاشێر</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>کاتی کردنەوە</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>کاتی داخستن</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>فرۆشتنی نەقد</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>گەڕاندنەوەی نەقد</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>پێشبینیکراو</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>ژمێردراو</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>جیاوازی</th>
                <th style={{ padding: '0 10px', textAlign: 'center', width: '70px' }}>دۆخ</th>
                <th style={{ padding: '0 12px', textAlign: 'center', width: '90px' }}>کردارەکان</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ height: '40px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                    هیچ شیفتێک لە مێژوودا نەدۆزرایەوە
                  </td>
                </tr>
              ) : (
                filteredHistory.map((shift) => {
                  const isClosed = shift.status === 'CLOSED';
                  const diff = Number(shift.difference) || 0;

                  return (
                    <tr 
                      key={shift.id} 
                      style={{ height: '38px', borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s ease' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0 12px', textAlign: 'center', color: '#64748b', fontSize: '0.80rem' }}>
                        #{shift.id}
                      </td>
                      <td style={{ padding: '0 12px', fontWeight: 700, color: '#1e293b', fontSize: '0.86rem' }}>
                        {shift.cashier_name}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', color: '#64748b', fontSize: '0.80rem', fontFamily: 'monospace' }}>
                        {formatDateTime(shift.opened_at)}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', color: '#64748b', fontSize: '0.80rem', fontFamily: 'monospace' }}>
                        {shift.closed_at ? formatDateTime(shift.closed_at) : (
                          <span style={{ color: '#16a34a', fontWeight: 700 }}>چالاکە...</span>
                        )}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', color: '#16a34a', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.84rem' }}>
                        {Number(shift.cash_sales || 0).toLocaleString()} د.ع
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', color: Number(shift.cash_refunds || 0) > 0 ? '#ea580c' : '#64748b', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.84rem' }}>
                        {Number(shift.cash_refunds || 0) > 0 ? `-${Number(shift.cash_refunds).toLocaleString()}` : '0'} د.ع
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', color: '#0f172a', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.84rem' }}>
                        {Number(shift.expected_cash || 0).toLocaleString()} د.ع
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', fontSize: '0.84rem' }}>
                        {isClosed ? `${Number(shift.actual_cash || 0).toLocaleString()} د.ع` : '-'}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center' }}>
                        {!isClosed ? (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        ) : diff === 0 ? (
                          <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.80rem', fontWeight: 700 }}>
                            <CheckCircle2 size={14} /> تەواو (٠)
                          </span>
                        ) : diff > 0 ? (
                          <span style={{ color: '#2563eb', fontWeight: 700, fontSize: '0.80rem', fontFamily: 'monospace' }}>
                            +{diff.toLocaleString()} (زیادە)
                          </span>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.80rem', fontFamily: 'monospace' }}>
                            {diff.toLocaleString()} (کورتهێنان)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center' }}>
                        <span style={{ 
                          padding: '3px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.76rem', 
                          fontWeight: 700,
                          background: isClosed ? '#f1f5f9' : '#f0fdf4',
                          color: isClosed ? '#64748b' : '#16a34a',
                          border: isClosed ? '1px solid #cbd5e1' : '1px solid #bbf7d0'
                        }}>
                          {isClosed ? 'داخراو' : 'کراوە'}
                        </span>
                      </td>
                      <td style={{ padding: '0 12px', textAlign: 'center' }}>
                        {isClosed && (
                          <button 
                            type="button"
                            onClick={() => setSelectedReportForPrint(shift)}
                            style={{
                              padding: '3px 10px',
                              borderRadius: '4px',
                              background: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                              fontWeight: 700
                            }}
                          >
                            چاپکردنی Z
                          </button>
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

      {/* 4. Modal: View & Print Z-Report */}
      {selectedReportForPrint && (
        <div className="pos-modal-overlay" onClick={() => setSelectedReportForPrint(null)}>
          <div className="pos-modal-card pos-modal-sm" onClick={e => e.stopPropagation()} style={{ background: '#ffffff', borderRadius: '12px', padding: '18px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '10px' }}>
              <button 
                type="button"
                onClick={() => setSelectedReportForPrint(null)} 
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#64748b', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Thermal Printable Slip Area */}
            <div id="z-report-printable-area" style={{ background: '#ffffff', color: '#000000', padding: '16px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontFamily: 'monospace, Tahoma', fontSize: '12px', lineHeight: '1.45', direction: 'rtl' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '10px' }}>
                <h3 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: 'bold' }}>
                  {(localStorage.getItem('pos_store_name') && localStorage.getItem('pos_store_name') !== 'مارکێتی حاجی ئاکۆ') ? localStorage.getItem('pos_store_name') : 'مارکێتی شارەکەم'}
                </h3>
                <div style={{ fontSize: '13px', fontWeight: 'bold', margin: '4px 0 2px 0' }}>وەسڵی داخستنی شیفت و قاسە (Z)</div>
                <div style={{ fontSize: '11px' }}>ژمارەی شیفت: #{selectedReportForPrint.id || selectedReportForPrint.shift_id}</div>
                <div style={{ fontSize: '11px' }}>کاشێر: {selectedReportForPrint.cashier_name}</div>
              </div>

              <div style={{ fontSize: '11px', marginBottom: '8px', borderBottom: '1px solid #ddd', paddingBottom: '6px' }}>
                <div>دەستپێکردن: {formatDateTime(selectedReportForPrint.opened_at)}</div>
                <div>کۆتایی هاتن: {selectedReportForPrint.closed_at ? formatDateTime(selectedReportForPrint.closed_at) : 'چالاک'}</div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span>پارەی ناو داخیلە:</span>
                  <span>{Number(selectedReportForPrint.opening_cash || 0).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span>فرۆشتنی نەقد (کاش):</span>
                  <span>+{Number(selectedReportForPrint.cash_sales || 0).toLocaleString()} دینار</span>
                </div>
                {Number(selectedReportForPrint.debt_repaid_cash || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span>وەرگرتنەوەی قەرز (نەقد):</span>
                    <span>+{Number(selectedReportForPrint.debt_repaid_cash).toLocaleString()} دینار</span>
                  </div>
                )}
                {Number(selectedReportForPrint.cash_refunds || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span>گەڕاندنەوەی نەقد (لە قاسە):</span>
                    <span>-{Number(selectedReportForPrint.cash_refunds).toLocaleString()} دینار</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span>خەرجی و تێچووەکان:</span>
                  <span>-{Number(selectedReportForPrint.expenses_paid || 0).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: '#555' }}>
                  <span>فرۆشتنی قەرز (تۆمار):</span>
                  <span>{Number(selectedReportForPrint.debt_sales || 0).toLocaleString()} دینار</span>
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontWeight: 'bold', fontSize: '13px' }}>
                  <span>پێشبینیکراوی قاسە:</span>
                  <span>{Number(selectedReportForPrint.expected_cash || 0).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontWeight: 'bold' }}>
                  <span>ژمێردراوی ڕاستەقینە:</span>
                  <span>{Number(selectedReportForPrint.actual_cash || 0).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontWeight: 'bold', fontSize: '12.5px' }}>
                  <span>جیاوازی / هاوسەنگی:</span>
                  <span>
                    {Number(selectedReportForPrint.difference || 0) === 0 
                      ? '٠ (تەواو)' 
                      : Number(selectedReportForPrint.difference || 0) > 0 
                        ? `+${Number(selectedReportForPrint.difference).toLocaleString()} (زیادە)` 
                        : `${Number(selectedReportForPrint.difference).toLocaleString()} (کورتهێنان)`}
                  </span>
                </div>
              </div>

              {selectedReportForPrint.notes && (
                <div style={{ fontSize: '11px', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>
                  <strong>تێبینی:</strong> {selectedReportForPrint.notes}
                </div>
              )}

            </div>

            {/* Modal Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
              <button 
                type="button"
                onClick={printZReport}
                style={{ flex: 1, minWidth: '130px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '6px', background: '#0284c7', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.86rem' }}
              >
                <Printer size={16} /> چاپکردنی پسووڵە
              </button>
              <button 
                type="button"
                onClick={handleSendTelegramZReport}
                disabled={telegramSending}
                style={{ flex: 1, minWidth: '130px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '6px', background: '#0ea5e9', color: '#ffffff', border: 'none', cursor: telegramSending ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.86rem' }}
              >
                <Send size={15} /> {telegramSending ? 'دەستپێکردنی ناردن...' : 'ناردن بۆ تێلیگرام'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Record Opening Cash (پارەی ناو داخیلە) */}
      {isOpeningCashModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsOpeningCashModalOpen(false)}>
          <div className="pos-modal-card pos-modal-sm" onClick={e => e.stopPropagation()} style={{ background: '#ffffff', borderRadius: '12px', padding: '18px', border: '1px solid #cbd5e1', maxWidth: '420px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h2 style={{ fontSize: '1.05rem', margin: 0, color: '#0f172a', fontWeight: 800 }}>
                تۆمارکردنی پارەی ناو داخیلە
              </h2>
              <button 
                type="button"
                onClick={() => setIsOpeningCashModalOpen(false)} 
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#64748b', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveOpeningCash} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
                  بڕی پارەی ناو داخیلە (سەرمایەی سەرەتا):
                </label>
                <input 
                  type="number"
                  step="any"
                  min="0"
                  autoFocus
                  placeholder="بڕی پارە بە دینار بنووسە..."
                  value={openingCashInput}
                  onChange={e => setOpeningCashInput(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #0284c7',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: '1rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              {/* Quick shortcut amounts */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[0, 25000, 50000, 100000, 250000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setOpeningCashInput(String(amt))}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600
                    }}
                  >
                    {amt === 0 ? 'سفر' : `${amt.toLocaleString()} د.ع`}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="submit"
                  disabled={isSubmittingOpeningCash}
                  style={{
                    flex: 1,
                    height: '38px',
                    borderRadius: '6px',
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    cursor: isSubmittingOpeningCash ? 'wait' : 'pointer',
                    fontWeight: 700,
                    fontSize: '0.88rem'
                  }}
                >
                  {isSubmittingOpeningCash ? 'تۆمار دەکرێت...' : 'تۆمارکردن'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpeningCashModalOpen(false)}
                  style={{
                    height: '38px',
                    padding: '0 16px',
                    borderRadius: '6px',
                    background: '#ffffff',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.84rem'
                  }}
                >
                  داخستن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Thermal Print CSS for Z-Report */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          #z-report-printable-area, #z-report-printable-area * {
            visibility: visible !important;
          }
          #z-report-printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            margin: 0 !important;
            padding: 8px 10px !important;
            font-size: 12px !important;
            color: #000 !important;
            background: #fff !important;
            direction: rtl !important;
            text-align: right !important;
            font-family: monospace, Tahoma, 'Noto Kufi Arabic', sans-serif !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CashDrawer;
