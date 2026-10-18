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
  Calendar,
  Send
} from 'lucide-react';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { formatDate, formatDateTime, formatCurrency } from '../utils/dateFormatter';
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

  const printZReport = () => {
    if (window.require && selectedReportForPrint) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('print-z-report', selectedReportForPrint);
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

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            type="button"
            className="btn-secondary"
            onClick={fetchShiftData} 
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 18px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
            نوێکردنەوە
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
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem', boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)', transition: 'all 0.15s ease' }}
          >
            <Printer size={20} /> 🖨️ چاپکردنی ڕاپۆرتی ئەمڕۆ (Print Day)
          </button>

          {/* 1-Click Close & Reset Day (No modal interrogation) */}
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
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'all 0.15s ease' }}
          >
            <Lock size={18} /> داخستنی ڕۆژ و نوێکردنەوە
          </button>
        </div>
      </div>

      {/* Active Shift / Day Status Section - Always visible, 0 restrictions */}
      <div className="glass-panel mb-8" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, var(--bg-secondary) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 'bold', fontSize: '0.9rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
              ڕاپۆرتی دارایی ئەمڕۆ: #{currentShift?.id || 'TODAY'}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              کاشێر: <strong style={{ color: 'var(--text-primary)' }}>{currentShift?.cashier_name || 'کاشێری سەرەکی'}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <Calendar size={16} />
            دەستپێکردن: {currentShift?.opened_at ? formatDateTime(currentShift.opened_at) : formatDateTime(new Date())}
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
            <div className="sub-text">{stats?.sale_count || 0} پسووڵەی فرۆشراو لەمڕۆدا</div>
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
              <h3>خەرجی و تێچووی دراو</h3>
              <Wallet size={20} color="#fb7185" />
            </div>
            <div className="value" style={{ color: '#fb7185' }}>
              {Number(stats?.expenses_paid || 0).toLocaleString()} دینار
            </div>
            <div className="sub-text">پارەی دراو لە قاسەوە بۆ خەرجی</div>
          </div>

          {/* Expected Cash in Drawer */}
          <div className="stat-card glass-panel" style={{ gridColumn: 'span 2', background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(2, 132, 199, 0.15))', borderColor: 'rgba(2, 132, 199, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--accent-hover)', fontWeight: 'bold' }}>کۆی گشتی پێشبینیکراوی ناو قاسە</h3>
              <ShieldCheck size={28} color="var(--accent-hover)" />
            </div>
            <div className="value" style={{ color: 'var(--text-primary)', fontSize: '2.2rem', marginTop: '4px', fontWeight: 900 }}>
              {Number(stats?.expected_cash || 0).toLocaleString()} دینار
            </div>
            <div className="sub-text" style={{ color: '#cbd5e1' }}>
              هاوکێشە: سەرمایەی سەرەتا + فرۆشتنی نەقد + قیستی وەرگیراو - خەرجییەکان
            </div>
          </div>
        </div>
      </div>

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
            style={{ padding: '10px 16px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '320px', outline: 'none' }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
            <thead style={{ background: 'var(--bg-tertiary)' }}>
              <tr>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>#</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>کاشێر</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>کاتی کردنەوە</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>کاتی داخستن</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>فرۆشتنی نەقد</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>پێشبینیکراو</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>ژمێردراو</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>جیاوازی</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>دۆخ</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>کردارەکان</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                    هیچ شیفتێک لە مێژوودا نەدۆزرایەوە
                  </td>
                </tr>
              ) : (
                filteredHistory.map((shift) => {
                  const isClosed = shift.status === 'CLOSED';
                  const diff = Number(shift.difference) || 0;

                  return (
                    <tr key={shift.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>#{shift.id}</td>
                      <td style={{ padding: '14px 18px', color: 'var(--text-primary)' }}>{shift.cashier_name}</td>
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {formatDateTime(shift.opened_at)}
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {shift.closed_at ? formatDateTime(shift.closed_at) : (
                          <span style={{ color: '#34d399' }}>چالاکە...</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#34d399', fontWeight: 'bold' }}>
                        {Number(shift.cash_sales || 0).toLocaleString()} د.ع
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                        {Number(shift.expected_cash || 0).toLocaleString()} د.ع
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {isClosed ? `${Number(shift.actual_cash || 0).toLocaleString()} د.ع` : '-'}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {!isClosed ? (
                          <span style={{ color: 'var(--text-secondary)' }}>-</span>
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
                          color: isClosed ? 'var(--text-secondary)' : '#34d399'
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



      {/* Modal: View & Print Z-Report */}
      {selectedReportForPrint && (
        <div className="pos-modal-overlay" onClick={() => setSelectedReportForPrint(null)}>
          <div className="pos-modal-card pos-modal-sm" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', margin: 0, color: '#38bdf8', fontWeight: 800 }}>
                <Printer size={20} /> ڕاپۆرتی داخستنی ڕۆژ (Z-Report)
              </h2>
              <button onClick={() => setSelectedReportForPrint(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
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
                <div>دەستپێکردن: {formatDateTime(selectedReportForPrint.opened_at)}</div>
                <div>کۆتایی هاتن: {selectedReportForPrint.closed_at ? formatDateTime(selectedReportForPrint.closed_at) : 'چالاک'}</div>
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
                  <span>خەرجی و تێچووەکان:</span>
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
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
              <button 
                onClick={printZReport}
                style={{ flex: 1, minWidth: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #38bdf8, #0284c7)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                <Printer size={18} /> چاپکردنی Z-Report
              </button>
              <button 
                onClick={handleSendTelegramZReport}
                disabled={telegramSending}
                style={{ flex: 1, minWidth: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: 'white', border: 'none', cursor: telegramSending ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
              >
                <Send size={18} /> {telegramSending ? 'دەستپێکردنی ناردن...' : '📱 ناردن بۆ تێلیگرام'}
              </button>
              <button 
                onClick={() => setSelectedReportForPrint(null)}
                className="btn-secondary"
                style={{ padding: '12px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}
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
