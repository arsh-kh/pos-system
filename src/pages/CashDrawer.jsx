import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Lock, 
  Unlock, 
  RefreshCw, 
  Printer, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  Wallet, 
  Coins, 
  CreditCard, 
  X,
  History,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import './Dashboard.css';

const CashDrawer = () => {
  const [currentShiftData, setCurrentShiftData] = useState(null);
  const [shiftHistory, setShiftHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historySearch, setHistorySearch] = useState('');

  // Open Shift Form Modal
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [openShiftForm, setOpenShiftForm] = useState({
    cashier_name: 'کاشێری سەرەکی',
    opening_cash: ''
  });

  // Close Shift Form Modal
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [closeShiftForm, setCloseShiftForm] = useState({
    actual_cash: '',
    notes: ''
  });

  // Z-Report Print Modal
  const [selectedReportForPrint, setSelectedReportForPrint] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleOpenShift = async (e) => {
    e.preventDefault();
    const openingFloat = Math.max(0, parseInt(openShiftForm.opening_cash) || 0);
    setIsSubmitting(true);
    try {
      const res = await axios.post('http://localhost:3001/api/shifts/open', {
        cashier_name: openShiftForm.cashier_name.trim() || 'کاشێری سەرەکی',
        opening_cash: openingFloat
      });
      if (res.data.status === 'SUCCESS') {
        alert('شیفتی نوێ بە سەرکەوتوویی کرایەوە');
        setIsOpenShiftModalOpen(false);
        setOpenShiftForm({ cashier_name: 'کاشێری سەرەکی', opening_cash: '' });
        fetchShiftData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کردنەوەی شیفت');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!currentShiftData?.shift?.id) return;

    const actualCashNum = Math.max(0, parseInt(closeShiftForm.actual_cash) || 0);
    setIsSubmitting(true);
    try {
      const res = await axios.post(`http://localhost:3001/api/shifts/close/${currentShiftData.shift.id}`, {
        actual_cash: actualCashNum,
        notes: closeShiftForm.notes
      });
      if (res.data.status === 'SUCCESS') {
        alert('شیفت بە سەرکەوتوویی داخرا و ڕاپۆرتی Z-Report دروستکرا');
        setIsCloseShiftModalOpen(false);
        setSelectedReportForPrint(res.data.data);
        setCloseShiftForm({ actual_cash: '', notes: '' });
        fetchShiftData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی داخستنی شیفت');
    } finally {
      setIsSubmitting(false);
    }
  };

  const printZReport = () => {
    window.print();
  };

  const currentShift = currentShiftData?.shift;
  const stats = currentShiftData?.stats;

  // Real-time calculation for Close Shift modal
  const enteredActualCash = parseInt(closeShiftForm.actual_cash) || 0;
  const currentExpectedCash = stats?.expected_cash || 0;
  const currentDifference = enteredActualCash - currentExpectedCash;

  const filteredHistory = shiftHistory.filter(shift => 
    shift.cashier_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
    shift.id?.toString().includes(historySearch) ||
    (shift.notes && shift.notes.toLowerCase().includes(historySearch.toLowerCase()))
  );

  return (
    <div className="dashboard-page p-8" dir="rtl">
      {/* Top Header */}
      <div className="page-header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wallet className="text-secondary" size={32} />
            قاسە و داخستنی شیفت (Z-Report)
          </h1>
          <p className="text-secondary">چاودێری ڕاستەوخۆی پارەی ناو قاسە، هاوسەنگی فرۆشتن و دەرکردنی پسووڵەی Z-Report</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            onClick={fetchShiftData} 
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
          >
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
            نوێکردنەوە
          </button>

          {currentShift ? (
            <button 
              onClick={() => setIsCloseShiftModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' }}
            >
              <Lock size={20} /> داخستنی شیفت (Z-Report)
            </button>
          ) : (
            <button 
              onClick={() => setIsOpenShiftModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)' }}
            >
              <Unlock size={20} /> کردنەوەی شیفتی نوێ
            </button>
          )}
        </div>
      </div>

      {/* Active Shift Status Section */}
      {currentShift ? (
        <div className="glass-panel mb-8" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.5) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 'bold', fontSize: '0.9rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                شیفتی کراوەی ئێستا: #{currentShift.id}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                کاشێر: <strong style={{ color: 'white' }}>{currentShift.cashier_name}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.9rem' }}>
              <Calendar size={16} />
              دەستپێکردن: {new Date(currentShift.opened_at).toLocaleDateString('ku-IQ')} - {new Date(currentShift.opened_at).toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* 6 Real-time Metrics Grid */}
          <div className="stats-grid">
            {/* Opening Float */}
            <div className="stat-card glass-panel" style={{ background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>سەرمایەی سەرەتا (قاسە)</h3>
                <Coins size={20} color="#60a5fa" />
              </div>
              <div className="value" style={{ color: '#60a5fa' }}>
                {Number(stats?.opening_cash || 0).toLocaleString()} دینار
              </div>
              <div className="sub-text">پارەی پێشوەختەی دانراو لە قاسەدا</div>
            </div>

            {/* Cash Sales */}
            <div className="stat-card glass-panel" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>فرۆشتنی نەقد (کاش)</h3>
                <TrendingUp size={20} color="#34d399" />
              </div>
              <div className="value" style={{ color: '#34d399' }}>
                {Number(stats?.cash_sales || 0).toLocaleString()} دینار
              </div>
              <div className="sub-text">{stats?.sale_count || 0} پسووڵەی فرۆشراو لەم شیفتەدا</div>
            </div>

            {/* Debt Sales */}
            <div className="stat-card glass-panel" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>فرۆشتنی قەرز</h3>
                <CreditCard size={20} color="#fbbf24" />
              </div>
              <div className="value" style={{ color: '#fbbf24' }}>
                {Number(stats?.debt_sales || 0).toLocaleString()} دینار
              </div>
              <div className="sub-text">ناچێتە ناو ژماردنی نەقدی قاسە</div>
            </div>

            {/* Expenses Paid */}
            <div className="stat-card glass-panel" style={{ background: 'rgba(244, 63, 94, 0.08)', borderColor: 'rgba(244, 63, 94, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>مەساریف و خەرجی دراو</h3>
                <Wallet size={20} color="#fb7185" />
              </div>
              <div className="value" style={{ color: '#fb7185' }}>
                {Number(stats?.expenses_paid || 0).toLocaleString()} دینار
              </div>
              <div className="sub-text">پارەی دراو لە قاسەوە بۆ خەرجی</div>
            </div>

            {/* Expected Cash in Drawer */}
            <div className="stat-card glass-panel" style={{ gridColumn: 'span 2', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))', borderColor: 'rgba(168, 85, 247, 0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.15rem', color: '#c084fc', fontWeight: 'bold' }}>کۆی گشتی پێشبینیکراوی ناو قاسە</h3>
                <ShieldCheck size={28} color="#c084fc" />
              </div>
              <div className="value" style={{ color: '#f3e8ff', fontSize: '2.2rem', marginTop: '4px' }}>
                {Number(stats?.expected_cash || 0).toLocaleString()} دینار
              </div>
              <div className="sub-text" style={{ color: '#cbd5e1' }}>
                هاوکێشە: (سەرمایەی سەرەتا + فرۆشتنی نەقد) - مەساریف و خەرجییەکان
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel mb-8" style={{ padding: '36px', borderRadius: '20px', textAlign: 'center', border: '1px dashed rgba(255, 255, 255, 0.2)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Lock size={32} color="#f87171" />
          </div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>لە ئێستادا هیچ شیفتێکی کراوە بوونی نییە</h2>
          <p style={{ color: '#94a3b8', maxWidth: '500px', margin: '0 auto 24px' }}>
            بۆ دەستپێکردنی فرۆشتن و چاودێریکردنی وردی قاسە، تکایە شیفتی نوێ بکەرەوە و سەرمایەی دەستپێک دیاری بکە.
          </p>
          <button 
            onClick={() => setIsOpenShiftModalOpen(true)}
            style={{ padding: '12px 28px', borderRadius: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
          >
            کردنەوەی شیفتی نوێ ئێستا 🚀
          </button>
        </div>
      )}

      {/* Shift History Section */}
      <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', margin: 0 }}>
            <History size={24} color="#60a5fa" />
            مێژووی شیفتەکانی ڕابردوو و Z-Report
          </h2>

          <input 
            type="text" 
            placeholder="گەڕان بەپێی کاشێر، تێبینی یان ژمارەی شیفت..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', width: '320px', outline: 'none' }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
            <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>#</th>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>کاشێر</th>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>کاتی کردنەوە</th>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>کاتی داخستن</th>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>فرۆشتنی نەقد</th>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>پێشبینیکراو</th>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>ژمێردراو</th>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>جیاوازی</th>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>دۆخ</th>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>کردارەکان</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    هیچ شیفتێک لە مێژوودا نەدۆزرایەوە
                  </td>
                </tr>
              ) : (
                filteredHistory.map((shift) => {
                  const isClosed = shift.status === 'CLOSED';
                  const diff = Number(shift.difference) || 0;

                  return (
                    <tr key={shift.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '14px 18px', fontWeight: 'bold' }}>#{shift.id}</td>
                      <td style={{ padding: '14px 18px' }}>{shift.cashier_name}</td>
                      <td style={{ padding: '14px 18px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                        {new Date(shift.opened_at).toLocaleDateString('ku-IQ')} {new Date(shift.opened_at).toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                        {shift.closed_at ? (
                          `${new Date(shift.closed_at).toLocaleDateString('ku-IQ')} ${new Date(shift.closed_at).toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' })}`
                        ) : (
                          <span style={{ color: '#34d399' }}>چالاکە...</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#34d399', fontWeight: 'bold' }}>
                        {Number(shift.cash_sales || 0).toLocaleString()} د.ع
                      </td>
                      <td style={{ padding: '14px 18px', color: '#94a3b8' }}>
                        {Number(shift.expected_cash || 0).toLocaleString()} د.ع
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 'bold' }}>
                        {isClosed ? `${Number(shift.actual_cash || 0).toLocaleString()} د.ع` : '-'}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {!isClosed ? (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        ) : diff === 0 ? (
                          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                            <CheckCircle2 size={16} /> تەواو (٠)
                          </span>
                        ) : diff > 0 ? (
                          <span style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '0.85rem' }}>
                            +{diff.toLocaleString()} (زیادە)
                          </span>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem' }}>
                            {diff.toLocaleString()} (کورتهێنان)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '8px', 
                          fontSize: '0.8rem', 
                          fontWeight: 'bold',
                          background: isClosed ? 'rgba(100, 116, 139, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: isClosed ? '#94a3b8' : '#34d399'
                        }}>
                          {isClosed ? 'داخراو' : 'کراوە'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {isClosed && (
                          <button 
                            onClick={() => setSelectedReportForPrint(shift)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)', cursor: 'pointer', fontSize: '0.85rem' }}
                          >
                            <Printer size={16} /> Z-Report
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

      {/* Modal: Open Shift */}
      {isOpenShiftModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', padding: '24px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', margin: 0 }}>
                <Unlock size={24} color="#10b981" /> کردنەوەی شیفتی نوێ
              </h2>
              <button onClick={() => setIsOpenShiftModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleOpenShift}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '0.9rem' }}>ناوی کاشێر</label>
                <input 
                  type="text" 
                  value={openShiftForm.cashier_name} 
                  onChange={(e) => setOpenShiftForm({ ...openShiftForm, cashier_name: e.target.value })}
                  placeholder="ناوی کاشێر"
                  required
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '0.9rem' }}>سەرمایەی دەستپێکی قاسە (Opening Float بە دینار)</label>
                <input 
                  type="number" 
                  value={openShiftForm.opening_cash} 
                  onChange={(e) => setOpenShiftForm({ ...openShiftForm, opening_cash: e.target.value })}
                  placeholder="نموونە: 50000"
                  min="0"
                  required
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', fontSize: '1.1rem', fontWeight: 'bold' }}
                />
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px', display: 'block' }}>
                  ئەو بڕە پارەیەی کە لە دەستپێکی ڕۆژدا لەناو قاسەکەدایە بۆ ووردە.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
                >
                  {isSubmitting ? 'کەمێک بوەستە...' : 'دەستپێکردنی شیفت 🚀'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsOpenShiftModalOpen(false)}
                  style={{ padding: '14px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: 'none', cursor: 'pointer' }}
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Close Shift & Count Cash */}
      {isCloseShiftModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', padding: '24px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', margin: 0, color: '#f87171' }}>
                <Lock size={24} /> داخستنی شیفت و دەرکردنی Z-Report
              </h2>
              <button onClick={() => setIsCloseShiftModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCloseShift}>
              {/* Financial Breakdown */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '14px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                  <span>سەرمایەی سەرەتا:</span>
                  <span style={{ fontWeight: 'bold' }}>{Number(stats?.opening_cash || 0).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: '#34d399' }}>
                  <span>فرۆشتنی نەقد:</span>
                  <span style={{ fontWeight: 'bold' }}>+{Number(stats?.cash_sales || 0).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: '#fb7185' }}>
                  <span>مەساریف و خەرجی دراو:</span>
                  <span style={{ fontWeight: 'bold' }}>-{Number(stats?.expenses_paid || 0).toLocaleString()} دینار</span>
                </div>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '10px 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 'bold', color: '#c084fc' }}>
                  <span>کۆی پێشبینیکراوی قاسە:</span>
                  <span>{Number(stats?.expected_cash || 0).toLocaleString()} دینار</span>
                </div>
              </div>

              {/* Input for Actual Counted Cash */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '0.95rem', fontWeight: 'bold' }}>
                  بڕی پارەی ژمێردراوی ڕاستەقینە لە قاسەدا (دینار) *
                </label>
                <input 
                  type="number" 
                  value={closeShiftForm.actual_cash} 
                  onChange={(e) => setCloseShiftForm({ ...closeShiftForm, actual_cash: e.target.value })}
                  placeholder="پارەی ناو قاسە بژمێرە و بڕەکەی بنووسە"
                  min="0"
                  required
                  autoFocus
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(99, 102, 241, 0.4)', color: 'white', outline: 'none', fontSize: '1.25rem', fontWeight: 'bold', textAlign: 'center' }}
                />
              </div>

              {/* Live Discrepancy Indicator */}
              {closeShiftForm.actual_cash !== '' && (
                <div style={{ 
                  padding: '12px 16px', 
                  borderRadius: '12px', 
                  marginBottom: '20px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  background: currentDifference === 0 
                    ? 'rgba(16, 185, 129, 0.15)' 
                    : currentDifference > 0 
                      ? 'rgba(59, 130, 246, 0.15)' 
                      : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${currentDifference === 0 ? '#10b981' : currentDifference > 0 ? '#3b82f6' : '#ef4444'}`
                }}>
                  {currentDifference === 0 ? (
                    <>
                      <CheckCircle2 size={24} color="#10b981" />
                      <div>
                        <strong style={{ color: '#10b981', display: 'block' }}>هاوسەنگی تەواوە (بێ جیاوازی)</strong>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>پارەی ناو قاسە ڕێک هاوتایە لەگەڵ فرۆشتن و خەرجی.</span>
                      </div>
                    </>
                  ) : currentDifference > 0 ? (
                    <>
                      <AlertCircle size={24} color="#3b82f6" />
                      <div>
                        <strong style={{ color: '#60a5fa', display: 'block' }}>زیادە لە قاسەدا: +{currentDifference.toLocaleString()} دینار</strong>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>پارەی ژمێردراو زیاترە لە بڕی پێشبینیکراو.</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={24} color="#ef4444" />
                      <div>
                        <strong style={{ color: '#f87171', display: 'block' }}>کورتهێنان لە قاسەدا: {currentDifference.toLocaleString()} دینار</strong>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>پارەی ژمێردراو کەمترە لە بڕی پێشبینیکراو.</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '0.9rem' }}>تێبینی و هۆکاری جیاوازی (ئەگەر هەبێت)</label>
                <textarea 
                  value={closeShiftForm.notes} 
                  onChange={(e) => setCloseShiftForm({ ...closeShiftForm, notes: e.target.value })}
                  placeholder="تێبینی دەربارەی شیفت یان جیاوازی پارە..."
                  rows="2"
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
                >
                  {isSubmitting ? 'کەمێک بوەستە...' : 'پشتڕاستکردنەوە و داخستنی شیفت 🔒'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsCloseShiftModalOpen(false)}
                  style={{ padding: '14px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: 'none', cursor: 'pointer' }}
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View & Print Z-Report */}
      {selectedReportForPrint && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', padding: '24px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', margin: 0, color: '#38bdf8' }}>
                <Printer size={20} /> ڕاپۆرتی داخستنی ڕۆژ (Z-Report)
              </h2>
              <button onClick={() => setSelectedReportForPrint(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Receipt Preview Box */}
            <div id="z-report-printable-area" style={{ background: '#ffffff', color: '#000000', padding: '24px 20px', borderRadius: '8px', fontFamily: 'monospace, Tahoma', fontSize: '13px', lineHeight: '1.5', direction: 'rtl' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '12px', marginBottom: '12px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', fontWeight: 'bold' }}>مارکێتی زیرەک</h3>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>ڕاپۆرتی داخستنی شیفت (Z-Report)</h4>
                <div style={{ fontSize: '12px' }}>ژمارەی شیفت: #{selectedReportForPrint.id}</div>
                <div style={{ fontSize: '11px' }}>کاشێر: {selectedReportForPrint.cashier_name}</div>
              </div>

              <div style={{ fontSize: '11px', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}>
                <div>دەستپێکردن: {new Date(selectedReportForPrint.opened_at).toLocaleString('ku-IQ')}</div>
                <div>کۆتایی هاتن: {selectedReportForPrint.closed_at ? new Date(selectedReportForPrint.closed_at).toLocaleString('ku-IQ') : 'چالاک'}</div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>سەرمایەی سەرەتا (قاسە):</span>
                  <span>{Number(selectedReportForPrint.opening_cash || 0).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>فرۆشتنی نەقد (کاش):</span>
                  <span>+{Number(selectedReportForPrint.cash_sales || 0).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>فرۆشتنی قەرز:</span>
                  <span>{Number(selectedReportForPrint.debt_sales || 0).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>خەرجی و مەساریف:</span>
                  <span>-{Number(selectedReportForPrint.expenses_paid || 0).toLocaleString()} دینار</span>
                </div>
              </div>

              <div style={{ borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 'bold' }}>
                  <span>پێشبینیکراوی قاسە:</span>
                  <span>{Number(selectedReportForPrint.expected_cash || 0).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 'bold' }}>
                  <span>ژمێردراوی ڕاستەقینە:</span>
                  <span>{Number(selectedReportForPrint.actual_cash || 0).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontWeight: 'bold', fontSize: '14px' }}>
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
                <div style={{ fontSize: '11px', marginBottom: '14px', borderBottom: '1px solid #ddd', paddingBottom: '6px' }}>
                  <strong>تێبینی:</strong> {selectedReportForPrint.notes}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '10px', fontSize: '11px', textAlign: 'center' }}>
                <div style={{ width: '45%' }}>
                  <div>واژۆی کاشێر</div>
                  <div style={{ marginTop: '25px', borderBottom: '1px dotted #000' }}></div>
                </div>
                <div style={{ width: '45%' }}>
                  <div>واژۆی بەڕێوەبەر</div>
                  <div style={{ marginTop: '25px', borderBottom: '1px dotted #000' }}></div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '10px', color: '#555' }}>
                سیستەمی زیرەکی بەڕێوەبردنی مارکێت
              </div>
            </div>

            {/* Print Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button 
                onClick={printZReport}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #38bdf8, #0284c7)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                <Printer size={18} /> چاپکردنی Z-Report
              </button>
              <button 
                onClick={() => setSelectedReportForPrint(null)}
                style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: 'none', cursor: 'pointer' }}
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Thermal Print CSS for Z-Report */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #z-report-printable-area, #z-report-printable-area * {
            visibility: visible;
          }
          #z-report-printable-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 80mm;
            margin: 0;
            padding: 10px;
            font-size: 12px;
            color: #000 !important;
            background: #fff !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CashDrawer;
