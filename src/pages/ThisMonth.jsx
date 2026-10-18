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

const ThisMonth = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const printAreaRef = useRef(null);

  const storeName = localStorage.getItem('pos_store_name') || 'مارکێتی حاجی ئاکۆ';
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
    <div className="dashboard-page p-8" style={{ position: 'relative' }}>
      
      {/* Top Header */}
      <div className="header mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            <TrendingUp color="#6366f1" size={32} />
            ڕاپۆرتە گشتییەکان و شیکاری دارایی
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: '0.9rem' }}>
            شیکاری فرۆشتن، قازانجی پوخت، خەرجی و کڕیاران بەپێی ڕۆژ، هەفتە، مانگ، ساڵ یان ماوەی دیاریکراو.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handlePrintReport}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '12px',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Printer size={16} /> چاپکردنی وەسڵی دارایی
          </button>
        </div>
      </div>

      {/* Range Selection Pills Bar */}
      <div className="glass-panel" style={{ padding: '8px', borderRadius: '16px', marginBottom: '1.5rem', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {RANGES.map(r => {
            const isActive = selectedRange === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedRange(r.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '12px',
                  border: isActive ? '1px solid #6366f1' : '1px solid var(--border-color)',
                  background: isActive ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'var(--bg-tertiary)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {r.icon}
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Current Active Period Badge */}
        {reportData && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', fontSize: '0.82rem', fontWeight: 700 }}>
            <Calendar size={14} />
            <span>{reportData.range_label}</span>
          </div>
        )}
      </div>

      {/* Custom Date Range Filter Inputs */}
      {selectedRange === 'custom' && (
        <form onSubmit={handleApplyCustomFilter} className="glass-panel" style={{ padding: '1.2rem', borderRadius: '16px', marginBottom: '1.5rem', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid #6366f1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-secondary)' }}>لە بەروار:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
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
                padding: '8px 12px',
                borderRadius: '10px',
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
              padding: '8px 18px',
              borderRadius: '10px',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Filter size={15} /> پشکنینی ماوە
          </button>
        </form>
      )}

      {/* Error Notice */}
      {errorMessage && (
        <div style={{ padding: '12px 16px', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '1.5rem', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          {/* Section 1: Four Master KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            
            {/* Card 1: Net Sales */}
            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', borderTop: '4px solid #2563eb', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>کۆی گشتی فرۆشتن (پوخت)</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingBag size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {totalSales.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 600 }}>دینار</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span>{totalInvoices.toLocaleString()} پسووڵە</span>
                <span>•</span>
                <span>تێکڕا: {avgInvoice.toLocaleString()} د.ع</span>
              </div>
              {totalDiscounts > 0 && (
                <div style={{ fontSize: '0.74rem', color: '#f59e0b', marginTop: '6px' }}>
                  داشکاندن: {totalDiscounts.toLocaleString()} د.ع
                </div>
              )}
            </div>

            {/* Card 2: Net Profit (FIFO Engine) */}
            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', borderTop: '4px solid #10b981', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>قازانجی پوختەی خاوێن</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: netProfit >= 0 ? '#10b981' : '#ef4444', marginBottom: '6px' }}>
                {netProfit.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 600 }}>دینار</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: '6px', background: profitMargin >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: profitMargin >= 0 ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                  ڕێژەی قازانج: {profitMargin}%
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>تێچووی کۆگا و گەیشتن</span>
              </div>
            </div>

            {/* Card 3: Payment Breakdown (Cash vs Debt) */}
            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', borderTop: '4px solid #d97706', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>شێوازی کۆکردنەوە</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(217, 119, 6, 0.12)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={18} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>نەقد (کاش):</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{cashCollected.toLocaleString()} د.ع</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: '#ea580c', fontWeight: 700 }}>فرۆش بە قەرز:</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{debtIssued.toLocaleString()} د.ع</span>
                </div>
              </div>
              {totalRefunded > 0 && (
                <div style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
                  گەڕاوەی کڕیار: -{totalRefunded.toLocaleString()} د.ع ({returnsCount} جار)
                </div>
              )}
            </div>

            {/* Card 4: Expenses & Damages Loss */}
            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', borderTop: '4px solid #b91c1c', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>خەرجی و فەوتانی کاڵا</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(185, 28, 28, 0.12)', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PackageX size={18} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>خەرجییەکان:</span>
                  <span style={{ fontWeight: 800, color: '#ef4444' }}>-{totalExpenses.toLocaleString()} د.ع</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>فەوتان و زیان:</span>
                  <span style={{ fontWeight: 800, color: '#ef4444' }}>-{totalDamagesLoss.toLocaleString()} د.ع</span>
                </div>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
                کۆی کەمکراوە: -{(totalExpenses + totalDamagesLoss).toLocaleString()} د.ع
              </div>
            </div>

          </div>

          {/* Section 2: Interactive Timeline Area Chart */}
          <div className="glass-panel mb-8" style={{ padding: '1.75rem', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} color="#6366f1" /> هێڵی کاتیی فرۆشتن و قازانج ({reportData?.range_label})
              </h2>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '0.82rem', fontWeight: 700 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#2563eb' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#2563eb' }} /> فرۆشتن
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#10b981' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981' }} /> قازانج
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
          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={20} color="#f59e0b" /> پڕفرۆشترین کاڵاکان لەم ماوەیەدا
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                بەپێی زۆرترین دانەی فرۆشراو
              </span>
            </div>

            {topProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                هیچ کاڵایەک لەم ماوەیەدا فرۆشی تۆمارنەکراوە.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                      <th style={{ padding: '10px 14px' }}>پلە</th>
                      <th style={{ padding: '10px 14px' }}>ناوی کاڵا</th>
                      <th style={{ padding: '10px 14px' }}>بارکۆد</th>
                      <th style={{ padding: '10px 14px' }}>دانەی فرۆشراو</th>
                      <th style={{ padding: '10px 14px' }}>کۆی داهات (دینار)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, idx) => {
                      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
                      return (
                        <tr key={p.id || idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                          <td style={{ padding: '12px 14px', fontWeight: 900, fontSize: '1.1rem' }}>{medal}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</td>
                          <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.barcode}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0284c7' }}>{p.total_quantity.toLocaleString()} دانە</td>
                          <td style={{ padding: '12px 14px', fontWeight: 800, color: '#10b981' }}>{p.total_revenue.toLocaleString()} د.ع</td>
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
