import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, 
  Calendar, 
  Award, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3
} from 'lucide-react';
import './Dashboard.css';

const KURDISH_MONTHS = ['کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران', 'تەممووز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'];
const _now = new Date();
const CURRENT_MONTH_LABEL = `${KURDISH_MONTHS[_now.getMonth()]} ${_now.getFullYear()}`;

const ThisMonth = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({ current_month: {}, chart_data: [] });
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/analytics/dashboard');
        if (response.data.status === 'SUCCESS') {
          const rawData = response.data.data;
          setData({
            current_month: rawData.current_month || {},
            chart_data: rawData.chart_data || []
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Compute Daily Trend & Day-over-Day Deltas
  const processedDailyData = useMemo(() => {
    if (!data.chart_data || data.chart_data.length === 0) return [];

    return data.chart_data.map((d, index, arr) => {
      const sales = Number(d.sales) || 0;
      const profit = Number(d.profit) || 0;
      const profitMargin = sales > 0 ? ((profit / sales) * 100).toFixed(1) : 0;
      
      let changePercent = null;
      if (index > 0) {
        const prevSales = Number(arr[index - 1].sales) || 0;
        if (prevSales > 0) {
          changePercent = (((sales - prevSales) / prevSales) * 100).toFixed(1);
        } else if (sales > 0) {
          changePercent = 100;
        }
      }

      return {
        ...d,
        formattedDate: new Date(d.date).toLocaleDateString('en-GB'),
        sales,
        profit,
        profitMargin,
        changePercent
      };
    });
  }, [data.chart_data]);

  const current = data.current_month || {};
  const totalSales = Number(current.total_sales || 0);
  const totalProfit = Number(current.total_profit || 0);
  const daysRecorded = processedDailyData.length;
  const averageDaily = daysRecorded > 0 ? Math.round(totalSales / daysRecorded) : 0;

  // Find highest single-day sales
  const maxDay = useMemo(() => {
    if (processedDailyData.length === 0) return { sales: 0, formattedDate: '-' };
    return processedDailyData.reduce((prev, curr) => (curr.sales > prev.sales ? curr : prev), processedDailyData[0]);
  }, [processedDailyData]);

  // Latest Day-over-Day Delta
  const latestDelta = useMemo(() => {
    if (processedDailyData.length < 2) return null;
    const last = processedDailyData[processedDailyData.length - 1];
    return last.changePercent;
  }, [processedDailyData]);

  return (
    <div className="dashboard-page p-8" style={{ position: 'relative' }}>
      
      {/* Header */}
      <div className="header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp color="#10b981" size={32} />
            ئاماری ئەم مانگە
          </h1>
          <p className="text-secondary">ڕاپۆرتی فرۆشتن، قازانجی سافی، تێکڕای ڕۆژانە و گۆڕانکاری ڕۆژ بە ڕۆژ</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            className="glass-panel"
            onClick={() => navigate('/total-sales')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15))', border: '1px solid rgba(236,72,153,0.3)', color: '#f472b6', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <BarChart3 size={18} />
            کۆی گشتی فرۆشتن 📊
          </button>

          {/* Current Month Badge */}
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', color: '#10b981', fontWeight: 'bold' }}>
            <Calendar size={18} />
            {CURRENT_MONTH_LABEL}
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid mb-8">
        
        {/* Total Sales */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
          <h3>کۆی فرۆشتنی ئەم مانگە</h3>
          <div className="value highlight" style={{ color: '#38bdf8' }}>{totalSales.toLocaleString()} دینار</div>
          {latestDelta !== null && (
            <div className="sub-text" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: Number(latestDelta) >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
              {Number(latestDelta) >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              {Number(latestDelta) >= 0 ? `+${latestDelta}%` : `${latestDelta}%`} گۆڕانکاری لە چاو دوێنێ
            </div>
          )}
        </div>

        {/* Net Profit */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
          <h3>قازانجی سافی ئەم مانگە</h3>
          <div className="value success" style={{ color: '#10b981' }}>{totalProfit.toLocaleString()} دینار</div>
          <div className="sub-text" style={{ color: '#94a3b8' }}>
            ڕێژەی قازانج: {totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0}% لە فرۆش
          </div>
        </div>

        {/* Average Daily Sales */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
          <h3>تێکڕای فرۆشتنی ڕۆژانە</h3>
          <div className="value" style={{ color: '#f59e0b' }}>{averageDaily.toLocaleString()} دینار</div>
          <div className="sub-text" style={{ color: '#94a3b8' }}>
            لە {daysRecorded} ڕۆژی چالاک و تۆمارکراو
          </div>
        </div>

        {/* Highest Sales Single Day */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(168, 85, 247, 0.08)', borderColor: 'rgba(168, 85, 247, 0.25)' }}>
          <h3>زۆرترین فرۆشتنی یەک ڕۆژ</h3>
          <div className="value" style={{ color: '#c084fc' }}>{maxDay.sales.toLocaleString()} دینار</div>
          <div className="sub-text" style={{ color: '#a78bfa', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Award size={14} /> بەروار: {maxDay.formattedDate}
          </div>
        </div>

      </div>

      {/* Dual Gradient Area Chart: Sales vs Net Profit (User Approved) */}
      <div className="chart-container glass-panel mb-8" style={{ padding: '2rem', borderRadius: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity color="#38bdf8" /> هێڵکاری فرۆشتنی ڕۆژانە و قازانج
            </h3>
            <small style={{ color: '#94a3b8' }}>بەراوردی ڕاستەوخۆی داهات لەگەڵ قازانجی خاوێن</small>
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem' }}>
            <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', background: '#38bdf8', borderRadius: '3px', display: 'inline-block' }}></span> فرۆشتن (داهات)
            </span>
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '3px', display: 'inline-block' }}></span> قازانجی سافی
            </span>
          </div>
        </div>

        {processedDailyData.length === 0 ? (
          <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexDirection: 'column', gap: '8px' }}>
            <Calendar size={48} style={{ opacity: 0.3 }} />
            <p style={{ margin: 0 }}>هیچ داتایەکی فرۆشتن لەم مانگەدا تۆمار نەکراوە</p>
          </div>
        ) : (
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={processedDailyData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorSalesMonth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfitMonth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                <XAxis dataKey="formattedDate" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f8fafc' }}
                  formatter={(val) => [`${Number(val).toLocaleString()} دینار`]}
                />
                <Area type="monotone" dataKey="sales" name="فرۆشتن" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorSalesMonth)" />
                <Area type="monotone" dataKey="profit" name="قازانج" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfitMonth)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Day-by-Day Performance Table with Day-over-Day Changes */}
      <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
        <h3 style={{ margin: '0 0 1.5rem 0' }}>وردەکاری ڕۆژ بە ڕۆژی فرۆشتن و گۆڕانکاری</h3>

        <div style={{ padding: '1px', borderRadius: '14px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
            <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>بەروار</th>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>فرۆشتن (دینار)</th>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>قازانجی سافی (دینار)</th>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>ڕێژەی قازانج</th>
                <th style={{ padding: '14px 18px', color: '#94a3b8' }}>گۆڕانکاری لە چاو ڕۆژی پێشوو</th>
              </tr>
            </thead>
            <tbody>
              {processedDailyData.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>هیچ داتایەک نییە</td></tr>
              ) : (
                processedDailyData.map((d, index) => {
                  const isUp = d.changePercent !== null && Number(d.changePercent) >= 0;

                  return (
                    <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '14px 18px', fontWeight: 'bold' }}>{d.formattedDate}</td>
                      <td style={{ padding: '14px 18px', color: '#38bdf8', fontWeight: 'bold' }}>
                        {d.sales.toLocaleString()} دینار
                      </td>
                      <td style={{ padding: '14px 18px', color: '#10b981', fontWeight: 'bold' }}>
                        {d.profit.toLocaleString()} دینار
                      </td>
                      <td style={{ padding: '14px 18px', color: '#f59e0b' }}>
                        {d.profitMargin}%
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {d.changePercent === null ? (
                          <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Minus size={14} /> سەرەتا
                          </span>
                        ) : isUp ? (
                          <span style={{ color: '#10b981', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                            <ArrowUpRight size={14} /> +{d.changePercent}%
                          </span>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                            <ArrowDownRight size={14} /> {d.changePercent}%
                          </span>
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

    </div>
  );
};

export default ThisMonth;
