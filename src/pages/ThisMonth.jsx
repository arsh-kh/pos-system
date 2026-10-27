import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { 
  TrendingUp, 
  Calendar, 
  Award, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  PackageX,
  Wallet,
  AlertCircle,
  Filter,
  Printer,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Receipt,
  ShoppingBag,
  DollarSign,
  ArrowDownLeft,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateTime, formatCurrency } from '../utils/dateFormatter';
import './Dashboard.css';

// Safe Electron IPC Detection for Hardware Thermal Printing
let ipcRenderer = null;
if (typeof window !== 'undefined' && typeof window.require === 'function') {
  try {
    const electron = window.require('electron');
    ipcRenderer = electron?.ipcRenderer || null;
  } catch (_) {}
}

const RANGES = [
  { id: 'today', label: 'ئەمڕۆ (ڕۆژانە)', icon: <Clock size={16} />, desc: 'شیکاری ٢٤ کاتژمێری' },
  { id: 'week', label: 'ئەم هەفتەیە', icon: <Calendar size={16} />, desc: '٧ ڕۆژی ڕابردوو' },
  { id: 'month', label: 'ئەم مانگە', icon: <BarChart3 size={16} />, desc: 'مانگی کارپێکراو' },
  { id: 'year', label: 'ئەمساڵ (ساڵانە)', icon: <TrendingUp size={16} />, desc: '١٢ مانگی ساڵ' },
  { id: 'custom', label: 'ماوەی دەستی', icon: <Filter size={16} />, desc: 'بەرواری دیاریکراو' }
];

const formatProductQty = (qty, isWeighted = false) => {
  if (qty === undefined || qty === null || qty === '') return '0';
  const num = parseFloat(qty);
  if (isNaN(num)) return '0';
  if (isWeighted) {
    return parseFloat(num.toFixed(2)).toLocaleString('en-US');
  }
  return Math.round(num).toLocaleString('en-US');
};

const ThisMonth = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const printAreaRef = useRef(null);

  const storeName = (localStorage.getItem('pos_store_name') && localStorage.getItem('pos_store_name') !== 'مارکێتی حاجی ئاکۆ') ? localStorage.getItem('pos_store_name') : 'مارکێتی شارەکەم';
  const storePhone = localStorage.getItem('pos_store_phone') || '0772 979 0421';

  // Time-Range State
  const [selectedRange, setSelectedRange] = useState('month');
  
  // Custom Date Range State (Defaults to past 7 days)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);
  const [customStartDate, setCustomStartDate] = useState(sevenDaysAgoStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  // Report Data State
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch Report Data from Unified Analytics Endpoint
  const fetchReport = async (rangeKey = selectedRange, start = customStartDate, end = customEndDate) => {
    setLoading(true);
    setErrorMessage('');
    try {
      let url = `http://localhost:3001/api/analytics/report?range=${rangeKey}`;
      if (rangeKey === 'custom') {
        url += `&startDate=${start}&endDate=${end}`;
      }
      const res = await axios.get(url);
      if (res.data?.status === 'SUCCESS') {
        setReportData(res.data.data);
      } else {
        setErrorMessage(res.data?.message || 'هەڵە لە وەرگرتنی ڕاپۆرت');
      }
    } catch (err) {
      console.error('Fetch report error:', err);
      setErrorMessage(err.response?.data?.message || 'نەتوانرا پەیوەندی بە سێرڤەرەوە بکرێت');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(selectedRange, customStartDate, customEndDate);
  }, [selectedRange]);

  const handleApplyCustomFilter = (e) => {
    e.preventDefault();
    if (!customStartDate || !customEndDate) return;
    fetchReport('custom', customStartDate, customEndDate);
  };

  // Metrics Shorthands
  const metrics = reportData?.metrics || {};
  const totalSales = Number(metrics.total_sales || 0);
  const rawSales = Number(metrics.raw_sales || 0);
  const netProfit = Number(metrics.net_profit || 0);
  const grossProfit = Number(metrics.gross_profit || 0);
  const profitMargin = Number(metrics.profit_margin || 0);
  const totalInvoices = Number(metrics.total_invoices || 0);
  const avgInvoice = Number(metrics.avg_invoice || 0);
  const totalDiscounts = Number(metrics.total_discounts || 0);
  const cashCollected = Number(metrics.cash_collected || 0);
  const debtIssued = Number(metrics.debt_issued || 0);
  const totalRefunded = Number(metrics.total_refunded || 0);
  const returnsCount = Number(metrics.returns_count || 0);
  const totalExpenses = Number(metrics.total_expenses || 0);
  const expensesCount = Number(metrics.expenses_count || 0);
  const totalDamagesLoss = Number(metrics.total_damages_loss || 0);
  const topProducts = reportData?.top_products || [];
  const chartData = reportData?.chart_data || [];

  // Print Report Handler (Thermal or Standard)
  const handlePrintReport = () => {
    setIsPrinting(true);
    try {
      window.print();
    } catch (_) {}
    setTimeout(() => setIsPrinting(false), 800);
  };

  return (
    <div className="dashboard-page" style={{ padding: '20px 24px', position: 'relative' }}>
      
      {/* Top Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          ڕاپۆرتە گشتییەکان و شیکاری دارایی
        </h1>
      </div>

      {/* Range Selection Bar & Print Action in Same Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px'
      }}>
        {/* Date Filter Buttons (Icons & Heavy Gradients Removed) */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {RANGES.map(r => {
            const isActive = selectedRange === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedRange(r.id)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: isActive ? '1.5px solid #3b82f6' : '1px solid var(--border-color, #334155)',
                  background: isActive ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-secondary, #1e293b)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Print Button (Far left of row in RTL) */}
        <button
          onClick={handlePrintReport}
          style={{
            padding: '7px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border-color, #334155)',
            background: 'var(--bg-secondary, #1e293b)',
            color: 'var(--text-primary)',
            fontSize: '0.86rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          چاپکردنی وەسڵی دارایی
        </button>
      </div>

      {/* Custom Date Range Filter Inputs */}
      {selectedRange === 'custom' && (
        <form onSubmit={handleApplyCustomFilter} className="glass-panel" style={{ padding: '1rem', borderRadius: '12px', marginBottom: '1.25rem', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color, #334155)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-secondary)' }}>لە بەروار:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                fontWeight: 700,
                outline: 'none'
              }}
              required
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-secondary)' }}>تا بەروار:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                fontWeight: 700,
                outline: 'none'
              }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{
              padding: '7px 18px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            پشکنینی ماوە
          </button>
        </form>
      )}

      {/* Error Notice */}
      {errorMessage && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '1.25rem', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} /> {errorMessage}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div className="spinner mb-4" style={{ width: '36px', height: '36px', border: '3px solid var(--border-color)', borderTopColor: '#6366f1', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.8s linear infinite' }} />
          <span>ئامار و ڕاپۆرتەکان ئامادە دەکرێن...</span>
        </div>
      ) : (
        <>
          {/* Section 1: Minimalist Flat 4-Column Summary Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            marginBottom: '24px'
          }}>
            
            {/* Block 1: Total Sales */}
            <div style={{
              background: 'var(--bg-secondary, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>
                کۆی فرۆشتن
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {totalSales.toLocaleString()} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)' }}>دینار</span>
              </div>
            </div>

            {/* Block 2: Net Profit */}
            <div style={{
              background: 'var(--bg-secondary, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>
                صافی قازانج
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {netProfit.toLocaleString()} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)' }}>دینار</span>
              </div>
            </div>

            {/* Block 3: Cash & Debt */}
            <div style={{
              background: 'var(--bg-secondary, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>
                نەقد و قەرز
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>نەقد:</span>
                  <span style={{ fontWeight: 700 }}>{cashCollected.toLocaleString()} د.ع</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>قەرز:</span>
                  <span style={{ fontWeight: 700 }}>{debtIssued.toLocaleString()} د.ع</span>
                </div>
              </div>
            </div>

            {/* Block 4: Expenses & Loss */}
            <div style={{
              background: 'var(--bg-secondary, #1e293b)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>
                خەرجی و زیان
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>خەرجی:</span>
                  <span style={{ fontWeight: 700 }}>{totalExpenses > 0 ? `${totalExpenses.toLocaleString()} د.ع` : '0'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>زیان:</span>
                  <span style={{ fontWeight: 700 }}>{totalDamagesLoss > 0 ? `${totalDamagesLoss.toLocaleString()} د.ع` : '0'}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Section 2: Interactive Timeline Area Chart */}
          <div style={{
            background: 'var(--bg-secondary, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                هێڵی کاتیی فرۆشتن و قازانج
              </h2>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '0.82rem', fontWeight: 600 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#2563eb' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#2563eb' }} /> فرۆشتن
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#10b981' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }} /> قازانج
                </span>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
                هیچ داتایەکی فرۆشتن لەم ماوە دیاریکراوەدا بوونی نییە.
              </div>
            ) : (
              <div style={{ width: '100%', height: 320 }} dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      stroke="var(--text-secondary)" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="var(--text-secondary)" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(val) => val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-secondary)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '12px',
                        direction: 'rtl',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                      }}
                      formatter={(val, name) => [
                        `${Number(val).toLocaleString()} دینار`, 
                        name === 'sales' ? 'فرۆشتن' : name === 'profit' ? 'قازانج' : name
                      ]}
                      labelFormatter={(lbl) => `کات / بەروار: ${lbl}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="#2563eb" 
                      strokeWidth={2.5} 
                      fillOpacity={1} 
                      fill="url(#salesGrad)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="profit" 
                      stroke="#10b981" 
                      strokeWidth={2.5} 
                      fillOpacity={1} 
                      fill="url(#profitGrad)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Section 3: Top 5 Best Selling Products in This Period */}
          <div style={{
            background: 'var(--bg-secondary, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: '12px',
            padding: '16px 20px'
          }}>
            <div style={{ marginBottom: '14px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                پڕفرۆشترین کاڵاکان لەم ماوەیەدا
              </h2>
            </div>

            {topProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                هیچ کاڵایەک لەم ماوەیەدا فرۆشی تۆمارنەکراوە.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                      <th style={{ width: '50px', padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>#</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600 }}>ناوی کاڵا</th>
                      <th style={{ width: '220px', padding: '10px 14px', fontWeight: 600 }}>بارکۆد</th>
                      <th style={{ width: '140px', padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>بڕی فرۆشراو</th>
                      <th style={{ width: '160px', padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>کۆی داهات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, idx) => {
                      const isWeighted = Boolean(p.is_weighted || p.unit === 'کگم');
                      const qtyFormatted = formatProductQty(p.total_quantity, isWeighted);
                      return (
                        <tr key={p.id || idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.88rem' }}>
                          <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {p.name}
                          </td>
                          <td style={{ padding: '11px 14px', fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {p.barcode || '—'}
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                            {qtyFormatted}
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                            {Number(p.total_revenue).toLocaleString('en-US')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Hidden Thermal Financial Report Slip (Targeted by @media print) */}
      <div id="financial-report-slip">
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>{storeName}</div>
        <div style={{ textAlign: 'center', fontSize: '11px', color: '#333' }}>پەیوەندی: {storePhone}</div>
        <div className="receipt-divider" style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', margin: '4px 0' }}>وەسڵی پوختەی دارایی و فرۆشتن</div>
        <div style={{ textAlign: 'center', fontSize: '11px', color: '#444' }}>ماوە: {reportData?.range_label || 'دیارینەکراو'}</div>
        <div className="receipt-divider" style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
        
        <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
          <span>بەروار و کات:</span>
          <span>{formatDateTime(new Date(), { twelveHour: true })}</span>
        </div>
        <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
          <span>دەرکەر:</span>
          <span>{user?.username || 'خاوەنکار'}</span>
        </div>

        <div className="receipt-divider" style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
        
        {/* Main Financial Metrics */}
        <div style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', margin: '3px 0' }}>
          <span>کۆی فرۆشتنی پوخت:</span>
          <span>{totalSales.toLocaleString()} دینار</span>
        </div>
        <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
          <span>ژمارەی پسووڵەکان:</span>
          <span>{totalInvoices.toLocaleString()} پسووڵە</span>
        </div>
        <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
          <span>تێکڕای پسووڵە:</span>
          <span>{avgInvoice.toLocaleString()} دینار</span>
        </div>
        {totalDiscounts > 0 && (
          <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', margin: '2px 0', color: '#444' }}>
            <span>کۆی داشکاندن:</span>
            <span>{totalDiscounts.toLocaleString()} دینار</span>
          </div>
        )}

        <div className="receipt-divider" style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>

        {/* Payment Methods */}
        <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
          <span>نەقد (کاش):</span>
          <span>{cashCollected.toLocaleString()} دینار</span>
        </div>
        <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
          <span>فرۆش بە قەرز:</span>
          <span>{debtIssued.toLocaleString()} دینار</span>
        </div>

        <div className="receipt-divider" style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>

        {/* Expenses & Losses */}
        <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
          <span>خەرجییە گشتییەکان:</span>
          <span>-{totalExpenses.toLocaleString()} دینار</span>
        </div>
        <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
          <span>زیان و فەوتانی کاڵا:</span>
          <span>-{totalDamagesLoss.toLocaleString()} دینار</span>
        </div>
        {totalRefunded > 0 && (
          <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
            <span>گەڕاوەی کڕیاران:</span>
            <span>-{totalRefunded.toLocaleString()} دینار</span>
          </div>
        )}

        <div className="receipt-divider" style={{ borderBottom: '2px dashed #000', margin: '6px 0' }}></div>

        {/* Net Profit Final */}
        <div style={{ fontSize: '13px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
          <span>قازانجی پوختەی خاوێن:</span>
          <span>{netProfit.toLocaleString()} دینار</span>
        </div>
        <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
          <span>ڕێژەی قازانج:</span>
          <span>{profitMargin}%</span>
        </div>

        {/* Top 5 Products */}
        {topProducts.length > 0 && (
          <>
            <div className="receipt-divider" style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', margin: '4px 0', textAlign: 'center' }}>پڕفرۆشترین کاڵاکان</div>
            {topProducts.slice(0, 5).map((p, idx) => (
              <div key={idx} style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                <span>{idx + 1}. {p.name}</span>
                <span>{p.total_quantity} دانە ({p.total_revenue.toLocaleString()} د.ع)</span>
              </div>
            ))}
          </>
        )}

        <div className="receipt-divider" style={{ borderBottom: '1px dashed #000', margin: '8px 0' }}></div>
        <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '6px', color: '#555' }}>
          وەسڵی فەرمیی دارایی • چاپکرا لە ڕێگەی سیستەمی مارکێت
        </div>
      </div>

      {/* Scoped Thermal Print Style */}
      <style>{`
        #financial-report-slip {
          display: none;
        }
        @media print {
          @page {
            margin: 0;
            size: 80mm auto;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          /* Hide EVERYTHING on the entire page */
          body * {
            visibility: hidden !important;
          }
          /* Only display the financial report slip */
          #financial-report-slip, #financial-report-slip * {
            visibility: visible !important;
          }
          #financial-report-slip {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            margin: 0 !important;
            padding: 8px 10px !important;
            font-size: 12px !important;
            color: #000000 !important;
            background: #ffffff !important;
            direction: rtl !important;
            text-align: right !important;
            font-family: monospace, Tahoma, sans-serif !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

    </div>
  );
};

export default ThisMonth;
