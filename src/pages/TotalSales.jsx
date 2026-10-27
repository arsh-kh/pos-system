import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  BarChart3,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  Award,
  Activity,
  PlusCircle,
  X,
  ChevronLeft,
  Coins
} from 'lucide-react';
import './Dashboard.css';

const TODAY_DATE = new Date().toISOString().split('T')[0];

const TotalSales = () => {
  // Navigation level: 'all_months' | 'month_days' | 'day_hours'
  const [level, setLevel] = useState('all_months');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDay, setSelectedDay] = useState('');

  // Data states
  const [overviewData, setOverviewData] = useState({
    lifetime: { sales: 0, profit: 0, invoices: 0 },
    total_months_count: 0,
    highest_month: null,
    average_month_sales: 0,
    months: []
  });

  const [monthDaysData, setMonthDaysData] = useState({
    month: '',
    month_sales: 0,
    month_profit: 0,
    month_invoices: 0,
    days: []
  });

  const [dayHoursData, setDayHoursData] = useState({
    date: '',
    day_sales: 0,
    day_profit: 0,
    day_invoices: 0,
    hours: []
  });

  const [loading, setLoading] = useState(false);

  // Manual Sale Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    date: TODAY_DATE,
    time: '12:00',
    total_amount: '',
    total_profit: '',
    note: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch Level 1: Overview
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3001/api/analytics/overview');
      if (res.data.status === 'SUCCESS') {
        setOverviewData(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching overview analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Level 2: Month Days
  const fetchMonthDays = useCallback(async (monthStr) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:3001/api/analytics/month-days?month=${monthStr}`);
      if (res.data.status === 'SUCCESS') {
        setMonthDaysData(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching month days:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Level 3: Day Hours
  const fetchDayHours = useCallback(async (dateStr) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:3001/api/analytics/day-hours?date=${dateStr}`);
      if (res.data.status === 'SUCCESS') {
        setDayHoursData(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching day hours:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/analytics/overview');
        if (isMounted && res.data.status === 'SUCCESS') {
          setOverviewData(res.data.data);
        }
      } catch (err) {
        console.error('Error fetching overview analytics:', err);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, []);

  // Drill-down handlers
  const handleSelectMonth = (monthStr) => {
    setSelectedMonth(monthStr);
    setLevel('month_days');
    fetchMonthDays(monthStr);
  };

  const handleSelectDay = (dateStr) => {
    setSelectedDay(dateStr);
    setLevel('day_hours');
    fetchDayHours(dateStr);
  };

  const handleBackToMonths = () => {
    setLevel('all_months');
    setSelectedMonth('');
    setSelectedDay('');
    fetchOverview();
  };

  const handleBackToDays = () => {
    setLevel('month_days');
    setSelectedDay('');
    if (selectedMonth) {
      fetchMonthDays(selectedMonth);
    }
  };

  // Submit manual sale
  const handleManualSaleSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.date || !manualForm.total_amount) {
      alert('تکایە بەروار و بڕی فرۆشتن دیاریبکە');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        date: manualForm.date,
        time: manualForm.time ? `${manualForm.time}:00` : '12:00:00',
        total_amount: Number(manualForm.total_amount),
        total_profit: manualForm.total_profit ? Number(manualForm.total_profit) : 0,
        note: manualForm.note
      };

      const res = await axios.post('http://localhost:3001/api/analytics/manual-sale', payload);
      if (res.data.status === 'SUCCESS') {
        alert('فرۆشتن بە سەرکەوتوویی بۆ بەرواری دیاریکراو تۆمارکرا!');
        setIsModalOpen(false);
        setManualForm({
          date: new Date().toISOString().split('T')[0],
          time: '12:00',
          total_amount: '',
          total_profit: '',
          note: ''
        });

        // Refresh currently active level
        if (level === 'all_months') {
          fetchOverview();
        } else if (level === 'month_days') {
          fetchMonthDays(selectedMonth);
        } else if (level === 'day_hours') {
          fetchDayHours(selectedDay);
        }
      }
    } catch (err) {
      console.error('Error recording manual sale:', err);
      alert('هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی فرۆشتن');
    } finally {
      setSubmitting(false);
    }
  };

  // Peak hour calculation for Level 3
  const peakHour = useMemo(() => {
    if (!dayHoursData.hours || dayHoursData.hours.length === 0) return null;
    return dayHoursData.hours.reduce((max, h) => (h.sales > (max?.sales || 0) ? h : max), dayHoursData.hours[0]);
  }, [dayHoursData.hours]);

  // Active hours list (hours with > 0 sales or invoices)
  const activeHours = useMemo(() => {
    return (dayHoursData.hours || []).filter(h => h.sales > 0 || h.invoice_count > 0);
  }, [dayHoursData.hours]);

  return (
    <div className="dashboard-page p-8" style={{ position: 'relative' }}>
      
      {/* Top Header & Breadcrumbs */}
      <div className="header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '6px' }}>
            <span 
              onClick={handleBackToMonths}
              style={{ cursor: 'pointer', color: level === 'all_months' ? '#38bdf8' : '#94a3b8', fontWeight: level === 'all_months' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <BarChart3 size={16} /> کۆی فرۆشتن (هەموو مانگەکان)
            </span>

            {level !== 'all_months' && (
              <>
                <ChevronLeft size={16} />
                <span 
                  onClick={handleBackToDays}
                  style={{ cursor: 'pointer', color: level === 'month_days' ? '#38bdf8' : '#94a3b8', fontWeight: level === 'month_days' ? 'bold' : 'normal' }}
                >
                  مانگی {selectedMonth}
                </span>
              </>
            )}

            {level === 'day_hours' && (
              <>
                <ChevronLeft size={16} />
                <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                  ڕۆژی {selectedDay} (٢٤ کاتژمێر)
                </span>
              </>
            )}
          </div>

          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 color="#ec4899" size={32} />
            {level === 'all_months' && 'کۆی گشتی فرۆشتن'}
            {level === 'month_days' && `وردەکاری فرۆشتنی مانگی (${selectedMonth})`}
            {level === 'day_hours' && `فرۆشتن بەپێی ٢٤ کاتژمێری ڕۆژی (${selectedDay})`}
          </h1>
          <p className="text-secondary">
            {level === 'all_months' && 'بینینی مێژووی هەموو مانگەکان، زۆرترین فرۆشتن، تێکڕای مانگانە و دابەزین بۆ ڕۆژەکان'}
            {level === 'month_days' && 'فرۆشتن و قازانجی ڕۆژەکانی ئەم مانگە بە هێڵکاری و دابەزین بۆ کاتژمێرەکان'}
            {level === 'day_hours' && 'شیکاری ٢٤ کاتژمێری فرۆشتن و قازانج بە درێژایی ڕۆژ'}
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {level !== 'all_months' && (
            <button 
              onClick={level === 'day_hours' ? handleBackToDays : handleBackToMonths}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}
            >
              <ArrowRight size={18} /> گەڕانەوە بۆ ئاستی پێشوو
            </button>
          )}

          <button 
            className="glass-panel"
            onClick={() => setIsModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(168,85,247,0.2))', border: '1px solid rgba(236,72,153,0.4)', color: '#f472b6', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <PlusCircle size={18} /> زیادکردنی فرۆشتن بۆ ڕۆژێکی تر
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel p-8 text-center" style={{ borderRadius: '16px', color: '#94a3b8' }}>
          خەریکی وەرگرتنی داتایە...
        </div>
      ) : (
        <>
          {/* ================= LEVEL 1: ALL MONTHS ================= */}
          {level === 'all_months' && (
            <>
              {/* Lifetime KPI Cards */}
              <div className="stats-grid mb-8">
                {/* Total Lifetime Sales */}
                <div className="stat-card glass-panel" style={{ background: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
                  <h3>کۆی گشتی هەموو فرۆشتنەکان</h3>
                  <div className="value highlight" style={{ color: '#38bdf8' }}>
                    {overviewData.lifetime.sales.toLocaleString()} دینار
                  </div>
                  <div className="sub-text" style={{ color: '#94a3b8' }}>
                    کۆی {overviewData.lifetime.invoices} پسووڵەی هەموو کاتەکان
                  </div>
                </div>

                {/* Total Lifetime Profit */}
                <div className="stat-card glass-panel" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                  <h3>کۆی گشتی قازانجی هەموو کات</h3>
                  <div className="value success" style={{ color: '#10b981' }}>
                    {overviewData.lifetime.profit.toLocaleString()} دینار
                  </div>
                  <div className="sub-text" style={{ color: '#94a3b8' }}>
                    ڕێژەی قازانج: {overviewData.lifetime.sales > 0 ? ((overviewData.lifetime.profit / overviewData.lifetime.sales) * 100).toFixed(1) : 0}%
                  </div>
                </div>

                {/* Recorded Months Count */}
                <div className="stat-card glass-panel">
                  <h3>ژمارەی مانگە تۆمارکراوەکان</h3>
                  <div className="value" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                    <Calendar size={24} color="#f59e0b" />
                    {overviewData.total_months_count} مانگ
                  </div>
                  <div className="sub-text">مێژووی سیستەمی کۆگا</div>
                </div>

                {/* Highest Monthly Sales */}
                <div className="stat-card glass-panel" style={{ background: 'rgba(236, 72, 153, 0.08)', borderColor: 'rgba(236, 72, 153, 0.25)' }}>
                  <h3>زۆرترین فرۆشتنی مانگانە</h3>
                  <div className="value" style={{ color: '#ec4899' }}>
                    {(overviewData.highest_month?.sales || 0).toLocaleString()} دینار
                  </div>
                  <div className="sub-text" style={{ color: '#f472b6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Award size={14} /> مانگی {overviewData.highest_month?.month || '-'}
                  </div>
                </div>

                {/* Average Monthly Sales */}
                <div className="stat-card glass-panel">
                  <h3>تێکڕای (ناوەندی) فرۆشتنی مانگانە</h3>
                  <div className="value" style={{ color: '#0284c7' }}>
                    {overviewData.average_month_sales.toLocaleString()} دینار
                  </div>
                  <div className="sub-text" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                    <Activity size={14} /> پێوەر بۆ هەر مانگێک
                  </div>
                </div>
              </div>

              {/* Multi-Month Trend Chart */}
              <div className="chart-container glass-panel mb-8" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={20} color="#38bdf8" />
                      هێڵکاری گۆڕانکاری فرۆشتن بەپێی مانگەکان
                    </h3>
                    <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                      بەراوردکاری فرۆشتن و قازانجی سافی لە نێوان مانگە جیاوازەکاندا
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}>
                      <span style={{ width: '12px', height: '12px', background: '#38bdf8', borderRadius: '3px' }}></span> فرۆشتن
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
                      <span style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '3px' }}></span> قازانج
                    </span>
                  </div>
                </div>

                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={[...overviewData.months].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip 
                        contentStyle={{ 
                          background: '#1e293b', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '10px',
                          color: '#fff',
                          textAlign: 'right'
                        }}
                        formatter={(val) => [`${Number(val).toLocaleString()} دینار`]}
                      />
                      <Bar dataKey="sales" name="فرۆشتن" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="profit" name="قازانج" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Month-by-Month Table */}
              <div className="glass-panel" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>لیستی مانگەکان (کلیک بکە بۆ بینینی ڕۆژەکان)</h3>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{overviewData.months.length} مانگ تۆمارکراوە</span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                    <tr>
                      <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>مانگ و ساڵ</th>
                      <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>کۆی فرۆشتن (دینار)</th>
                      <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>کۆی قازانج (دینار)</th>
                      <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>ڕێژەی قازانج</th>
                      <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>ژمارەی پسووڵە</th>
                      <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>کردار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewData.months.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>هیچ فرۆشتنێک تۆمار نەکراوە</td>
                      </tr>
                    ) : (
                      overviewData.months.map((m, idx) => {
                        const margin = m.sales > 0 ? ((m.profit / m.sales) * 100).toFixed(1) : 0;
                        const isHighest = overviewData.highest_month?.month === m.month;

                        return (
                          <tr 
                            key={idx}
                            onClick={() => handleSelectMonth(m.month)}
                            style={{ 
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              cursor: 'pointer',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '14px 18px', fontWeight: 'bold' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={18} color="#ec4899" />
                                {m.month}
                                {isHighest && (
                                  <span style={{ fontSize: '0.75rem', background: 'rgba(236,72,153,0.2)', color: '#f472b6', padding: '2px 8px', borderRadius: '12px' }}>
                                    بەرزترین
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '14px 18px', color: '#38bdf8', fontWeight: 'bold' }}>
                              {m.sales.toLocaleString()} دینار
                            </td>
                            <td style={{ padding: '14px 18px', color: '#10b981', fontWeight: 'bold' }}>
                              {m.profit.toLocaleString()} دینار
                            </td>
                            <td style={{ padding: '14px 18px', color: '#f59e0b' }}>
                              {margin}%
                            </td>
                            <td style={{ padding: '14px 18px', color: '#cbd5e1' }}>
                              {m.invoice_count} پسووڵە
                            </td>
                            <td style={{ padding: '14px 18px' }}>
                              <button 
                                className="glass-panel"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectMonth(m.month);
                                }}
                                style={{ padding: '6px 14px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', cursor: 'pointer', fontSize: '0.85rem' }}
                              >
                                بینینی ڕۆژەکان ⬅️
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ================= LEVEL 2: DAYS OF SELECTED MONTH ================= */}
          {level === 'month_days' && (
            <>
              {/* Month KPI Cards */}
              <div className="stats-grid mb-8">
                <div className="stat-card glass-panel" style={{ background: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
                  <h3>کۆی فرۆشتنی مانگی {selectedMonth}</h3>
                  <div className="value highlight" style={{ color: '#38bdf8' }}>
                    {monthDaysData.month_sales.toLocaleString()} دینار
                  </div>
                  <div className="sub-text">کۆی داهاتی فرۆشتنی مانگ</div>
                </div>

                <div className="stat-card glass-panel" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                  <h3>کۆی قازانجی مانگی {selectedMonth}</h3>
                  <div className="value success" style={{ color: '#10b981' }}>
                    {monthDaysData.month_profit.toLocaleString()} دینار
                  </div>
                  <div className="sub-text">
                    ڕێژەی قازانج: {monthDaysData.month_sales > 0 ? ((monthDaysData.month_profit / monthDaysData.month_sales) * 100).toFixed(1) : 0}%
                  </div>
                </div>

                <div className="stat-card glass-panel">
                  <h3>ژمارەی پسووڵەکانی مانگ</h3>
                  <div className="value" style={{ color: '#cbd5e1' }}>
                    {monthDaysData.month_invoices} پسووڵە
                  </div>
                  <div className="sub-text">کۆی کڕیاران و مامەڵەکان</div>
                </div>

                <div className="stat-card glass-panel">
                  <h3>ڕۆژە تۆمارکراوەکان</h3>
                  <div className="value" style={{ color: '#f59e0b' }}>
                    {monthDaysData.days.length} ڕۆژ
                  </div>
                  <div className="sub-text">ڕۆژانی چالاکی مارکێت</div>
                </div>
              </div>

              {/* Daily Area Chart for this Month */}
              <div className="chart-container glass-panel mb-8" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={20} color="#10b981" />
                      هێڵکاری ڕۆژانەی مانگی {selectedMonth}
                    </h3>
                    <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                      فرۆشتن و قازانج بە درێژایی ڕۆژەکانی مانگ
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}>
                      <span style={{ width: '12px', height: '12px', background: '#38bdf8', borderRadius: '3px' }}></span> فرۆشتن
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
                      <span style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '3px' }}></span> قازانج
                    </span>
                  </div>
                </div>

                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <AreaChart data={monthDaysData.days}>
                      <defs>
                        <linearGradient id="monthSalesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="monthProfitGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip 
                        contentStyle={{ 
                          background: '#1e293b', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '10px',
                          color: '#fff',
                          textAlign: 'right'
                        }}
                        formatter={(val) => [`${Number(val).toLocaleString()} دینار`]}
                      />
                      <Area type="monotone" dataKey="sales" name="فرۆشتن" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#monthSalesGrad)" />
                      <Area type="monotone" dataKey="profit" name="قازانج" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#monthProfitGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Days Table */}
              <div className="glass-panel" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>لیستی ڕۆژەکانی مانگ (کلیک بکە بۆ وردەکاری کاتژمێری)</h3>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{monthDaysData.days.length} ڕۆژ تۆمارکراوە</span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <tr>
                      <th style={{ padding: '14px 18px', color: '#94a3b8' }}>بەرواری ڕۆژ</th>
                      <th style={{ padding: '14px 18px', color: '#94a3b8' }}>کۆی فرۆشتن (دینار)</th>
                      <th style={{ padding: '14px 18px', color: '#94a3b8' }}>قازانجی سافی (دینار)</th>
                      <th style={{ padding: '14px 18px', color: '#94a3b8' }}>ڕێژەی قازانج</th>
                      <th style={{ padding: '14px 18px', color: '#94a3b8' }}>ژمارەی پسووڵە</th>
                      <th style={{ padding: '14px 18px', color: '#94a3b8' }}>کردار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthDaysData.days.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>هیچ ڕۆژێک لەم مانگەدا نییە</td>
                      </tr>
                    ) : (
                      monthDaysData.days.map((d, idx) => {
                        const margin = d.sales > 0 ? ((d.profit / d.sales) * 100).toFixed(1) : 0;
                        return (
                          <tr 
                            key={idx}
                            onClick={() => handleSelectDay(d.date)}
                            style={{ 
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              cursor: 'pointer',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '14px 18px', fontWeight: 'bold' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={18} color="#10b981" />
                                {d.date} (ڕۆژی {d.day})
                              </div>
                            </td>
                            <td style={{ padding: '14px 18px', color: '#38bdf8', fontWeight: 'bold' }}>
                              {d.sales.toLocaleString()} دینار
                            </td>
                            <td style={{ padding: '14px 18px', color: '#10b981', fontWeight: 'bold' }}>
                              {d.profit.toLocaleString()} دینار
                            </td>
                            <td style={{ padding: '14px 18px', color: '#f59e0b' }}>
                              {margin}%
                            </td>
                            <td style={{ padding: '14px 18px', color: '#cbd5e1' }}>
                              {d.invoice_count} پسووڵە
                            </td>
                            <td style={{ padding: '14px 18px' }}>
                              <button 
                                className="glass-panel"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectDay(d.date);
                                }}
                                style={{ padding: '6px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', cursor: 'pointer', fontSize: '0.85rem' }}
                              >
                                وردەکاری کاتژمێری 🕒
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ================= LEVEL 3: 24-HOUR HOURLY TIMELINE ================= */}
          {level === 'day_hours' && (
            <>
              {/* Day KPI Cards */}
              <div className="stats-grid mb-8">
                <div className="stat-card glass-panel" style={{ background: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
                  <h3>کۆی فرۆشتنی ڕۆژی {selectedDay}</h3>
                  <div className="value highlight" style={{ color: '#38bdf8' }}>
                    {dayHoursData.day_sales.toLocaleString()} دینار
                  </div>
                  <div className="sub-text">فرۆشتنی تەواوی ٢٤ کاتژمێر</div>
                </div>

                <div className="stat-card glass-panel" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                  <h3>کۆی قازانجی ڕۆژ</h3>
                  <div className="value success" style={{ color: '#10b981' }}>
                    {dayHoursData.day_profit.toLocaleString()} دینار
                  </div>
                  <div className="sub-text">
                    ڕێژەی قازانج: {dayHoursData.day_sales > 0 ? ((dayHoursData.day_profit / dayHoursData.day_sales) * 100).toFixed(1) : 0}%
                  </div>
                </div>

                <div className="stat-card glass-panel">
                  <h3>ژمارەی پسووڵەکانی ڕۆژ</h3>
                  <div className="value" style={{ color: '#cbd5e1' }}>
                    {dayHoursData.day_invoices} پسووڵە
                  </div>
                  <div className="sub-text">مامەڵە ئەنجامدراوەکان</div>
                </div>

                <div className="stat-card glass-panel" style={{ background: 'rgba(236, 72, 153, 0.08)', borderColor: 'rgba(236, 72, 153, 0.25)' }}>
                  <h3>کاتژمێری لوتکەی فرۆشتن</h3>
                  <div className="value" style={{ color: '#ec4899', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={24} />
                    {peakHour && peakHour.sales > 0 ? peakHour.hour_label : '-'}
                  </div>
                  <div className="sub-text" style={{ color: '#f472b6' }}>
                    {peakHour && peakHour.sales > 0 ? `${peakHour.sales.toLocaleString()} دینار فرۆشراوە` : 'هیچ فرۆشتنێک نەبووە'}
                  </div>
                </div>
              </div>

              {/* 24-Hour Timeline Bar Chart */}
              <div className="chart-container glass-panel mb-8" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={20} color="#38bdf8" />
                      شیکاری ٢٤ کاتژمێری فرۆشتن و قازانج ({selectedDay})
                    </h3>
                    <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                      کاتژمێر بە کاتژمێر لە 00:00 ی شەو تاوەکو 23:00 ی شەو
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}>
                      <span style={{ width: '12px', height: '12px', background: '#38bdf8', borderRadius: '3px' }}></span> فرۆشتن
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
                      <span style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '3px' }}></span> قازانج
                    </span>
                  </div>
                </div>

                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={dayHoursData.hours}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="hour_label" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip 
                        contentStyle={{ 
                          background: '#1e293b', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '10px',
                          color: '#fff',
                          textAlign: 'right'
                        }}
                        formatter={(val) => [`${Number(val).toLocaleString()} دینار`]}
                      />
                      <Bar dataKey="sales" name="فرۆشتن" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="قازانج" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Active Hours Table */}
              <div className="glass-panel" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>وردەکاری ئەو کاتژمێرانەی فرۆشتنیان تێدا ئەنجامدراوە</h3>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{activeHours.length} کاتژمێری چالاک</span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <tr>
                      <th style={{ padding: '14px 18px', color: '#94a3b8' }}>کاتژمێر</th>
                      <th style={{ padding: '14px 18px', color: '#94a3b8' }}>فرۆشتن (دینار)</th>
                      <th style={{ padding: '14px 18px', color: '#94a3b8' }}>قازانجی سافی (دینار)</th>
                      <th style={{ padding: '14px 18px', color: '#94a3b8' }}>ڕێژەی قازانج</th>
                      <th style={{ padding: '14px 18px', color: '#94a3b8' }}>ژمارەی پسووڵە</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeHours.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>هیچ فرۆشتنێک لەم ڕۆژەدا نەبووە</td>
                      </tr>
                    ) : (
                      activeHours.map((h, idx) => {
                        const margin = h.sales > 0 ? ((h.profit / h.sales) * 100).toFixed(1) : 0;
                        const isPeak = peakHour && peakHour.hour === h.hour && h.sales > 0;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '14px 18px', fontWeight: 'bold' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={16} color="#38bdf8" />
                                {h.hour_label}
                                {isPeak && (
                                  <span style={{ fontSize: '0.75rem', background: 'rgba(236,72,153,0.2)', color: '#f472b6', padding: '2px 8px', borderRadius: '12px' }}>
                                    لوتکەی فرۆشتن
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '14px 18px', color: '#38bdf8', fontWeight: 'bold' }}>
                              {h.sales.toLocaleString()} دینار
                            </td>
                            <td style={{ padding: '14px 18px', color: '#10b981', fontWeight: 'bold' }}>
                              {h.profit.toLocaleString()} دینار
                            </td>
                            <td style={{ padding: '14px 18px', color: '#f59e0b' }}>
                              {margin}%
                            </td>
                            <td style={{ padding: '14px 18px', color: '#cbd5e1' }}>
                              {h.invoice_count} پسووڵە
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ================= MODAL: MANUAL SALE FOR A SPECIFIC DATE ================= */}
      {isModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="pos-modal-card pos-modal-md" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                <PlusCircle color="#ec4899" size={22} />
                زیادکردنی فرۆشتن بۆ ڕۆژێکی دیاریکراو
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleManualSaleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="responsive-grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    بەروار *
                  </label>
                  <input 
                    type="date"
                    required
                    value={manualForm.date}
                    onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.95rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    کاتژمێر
                  </label>
                  <input 
                    type="time"
                    value={manualForm.time}
                    onChange={(e) => setManualForm({ ...manualForm, time: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.95rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  کۆی بڕی فرۆشتن (دینار) *
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, parseInt(manualForm.total_amount) || 0);
                      const next = Math.max(0, cur - 250);
                      setManualForm({ ...manualForm, total_amount: next === 0 ? '' : String(next) });
                    }}
                    style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}
                  >
                    -٢٥٠
                  </button>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input 
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="بۆ نموونە: 25000"
                      value={manualForm.total_amount}
                      onChange={(e) => setManualForm({ ...manualForm, total_amount: e.target.value })}
                      style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1.5px solid rgba(56, 189, 248, 0.4)', color: 'var(--accent-color)', fontSize: '1.1rem', fontWeight: 'bold', boxSizing: 'border-box' }}
                    />
                    <Coins size={18} color="var(--accent-color)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, parseInt(manualForm.total_amount) || 0);
                      setManualForm({ ...manualForm, total_amount: String(cur + 250) });
                    }}
                    style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}
                  >
                    +٢٥٠
                  </button>
                </div>
                {/* Fast Dinar Presets */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {[250, 500, 1000, 5000, 10000, 25000, 50000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setManualForm({ ...manualForm, total_amount: String(amt) })}
                      style={{ padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  قازانجی خاوێن (دینار)
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, parseInt(manualForm.total_profit) || 0);
                      const next = Math.max(0, cur - 250);
                      setManualForm({ ...manualForm, total_profit: next === 0 ? '' : String(next) });
                    }}
                    style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}
                  >
                    -٢٥٠
                  </button>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    placeholder="بۆ نموونە: 5000 (ئارەزوومەندانە)"
                    value={manualForm.total_profit}
                    onChange={(e) => setManualForm({ ...manualForm, total_profit: e.target.value })}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: '#10b981', fontSize: '1rem', fontWeight: 'bold' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, parseInt(manualForm.total_profit) || 0);
                      setManualForm({ ...manualForm, total_profit: String(cur + 250) });
                    }}
                    style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}
                  >
                    +٢٥٠
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  تێبینی
                </label>
                <input 
                  type="text"
                  placeholder="هۆکار یان تێبینی فرۆشتنی دەستی"
                  value={manualForm.note}
                  onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button 
                  type="submit"
                  disabled={submitting}
                  style={{ flex: 1, minWidth: '160px', padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #2563eb, #0284c7)', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 4px 14px rgba(37,99,235,0.35)' }}
                >
                  {submitting ? 'خەریکی تۆمارکردنە...' : 'تۆمارکردنی فرۆشتن ✓'}
                </button>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '12px 20px', borderRadius: '10px' }}
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TotalSales;
