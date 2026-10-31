import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Search, FileText, X, Printer, Layers } from 'lucide-react';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { formatDate, formatDateTime, formatCurrency } from '../utils/dateFormatter';
import BarcodeSVG from '../components/BarcodeSVG';
import './Dashboard.css';

const SalesHistory = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('ALL'); // ALL, TODAY, WEEK, MONTH
  const [selectedSale, setSelectedSale] = useState(null);
  
  // Re-print Thermal Receipt State
  const [reprintReceipt, setReprintReceipt] = useState(null);
  const storeName = localStorage.getItem('pos_store_name') || 'مارکێتی شارەکەم';
  const storePhone = localStorage.getItem('pos_store_phone') || '';

  const fetchSales = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/sales');
      if (res.data.status === 'SUCCESS') {
        setSales(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch sales history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const openSaleDetails = async (id, andPrint = false) => {
    try {
      const res = await axios.get(`http://localhost:3001/api/sales/${id}`);
      if (res.data.status === 'SUCCESS') {
        setSelectedSale(res.data.data);
        if (andPrint) {
          handleReprintReceipt(res.data.data);
        }
      }
    } catch {
      alert('هەڵەیەک ڕوویدا لە کاتی هێنانی زانیاری پسووڵە');
    }
  };

  const handleReprintReceipt = (sale) => {
    setReprintReceipt(sale);
    setTimeout(async () => {
      if (window.require) {
        try {
          const { ipcRenderer } = window.require('electron');
          const receiptEl = document.getElementById('reprint-thermal-receipt');
          if (receiptEl && receiptEl.innerHTML) {
            await ipcRenderer.invoke('print-thermal-receipt', {
              htmlContent: receiptEl.innerHTML
            });
            return;
          }
        } catch (_) {}
      }
      window.print();
    }, 120);
  };

  // Filter Sales
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const matchesSearch = kurdishSearchMatch([s.id, s.customer_name], searchTerm);

      if (!matchesSearch) return false;
      if (dateFilter === 'ALL') return true;

      const saleDate = new Date(s.created_at);
      const now = new Date();

      if (dateFilter === 'TODAY') {
        return saleDate.toDateString() === now.toDateString();
      }
      if (dateFilter === 'WEEK') {
        const diffTime = Math.abs(now - saleDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }
      if (dateFilter === 'MONTH') {
        return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [sales, searchTerm, dateFilter]);

  // Calculate totals
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  }, [filteredSales]);

  const totalProfit = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + Number(s.total_profit || 0), 0);
  }, [filteredSales]);

  return (
    <div className="dashboard-page p-8" style={{ position: 'relative' }}>
      
      {/* Thermal Print Receipt Style */}
      <style>{`
        #reprint-thermal-receipt {
          display: none !important;
        }
        @media screen {
          #reprint-thermal-receipt {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
          }
        }
        @media print {
          @page {
            size: 80mm auto;
            margin: 0 !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            background: #ffffff !important;
          }
          body * {
            visibility: hidden !important;
          }
          #reprint-thermal-receipt {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: 100% !important;
            max-width: 71mm !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            background: white !important;
            color: black !important;
            padding: 2px 2mm 30px 2mm !important;
            font-family: 'Segoe UI', Tahoma, 'Noto Kufi Arabic', sans-serif !important;
            font-size: 12px !important;
            direction: rtl !important;
            text-align: right !important;
          }
          #reprint-thermal-receipt * {
            visibility: visible !important;
            box-sizing: border-box !important;
          }
          #reprint-thermal-receipt table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            box-sizing: border-box !important;
          }
          #reprint-thermal-receipt table,
          #reprint-thermal-receipt table th,
          #reprint-thermal-receipt table td {
            color: #000000 !important;
            font-weight: bold !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          .receipt-divider {
            width: 100% !important;
            border-bottom: 1px dashed #000000 !important;
            margin: 6px 0 !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText color="#3b82f6" size={32} />
            مێژووی فرۆشتن
          </h1>
          <p className="text-secondary">هەموو پسووڵەکانی فرۆشتن بە پارێزراوی لەگەڵ وردەکاری کاڵاکان و قازانج</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 1rem', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <Search size={18} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="گەڕان بە ژمارەی پسووڵە یان کڕیار..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', marginRight: '8px', outline: 'none', width: '220px', fontSize: '0.92rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '4px', borderRadius: '12px' }}>
            {[
              { id: 'ALL', label: 'هەموو کات' },
              { id: 'TODAY', label: 'ئەمڕۆ' },
              { id: 'WEEK', label: 'ئەم هەفتەیە' },
              { id: 'MONTH', label: 'ئەم مانگە' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: dateFilter === tab.id ? 'var(--accent-color)' : 'transparent',
                  color: dateFilter === tab.id ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: dateFilter === tab.id ? 'bold' : '600',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid mb-8">
        <div className="stat-card glass-panel" style={{ background: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
          <h3>کۆی داهاتی پسووڵەکان</h3>
          <div className="value highlight" style={{ color: '#38bdf8' }}>{totalRevenue.toLocaleString()} دینار</div>
          <div className="sub-text">کۆی پارەی وەرگیراو لە فرۆش</div>
        </div>
        <div className="stat-card glass-panel" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
          <h3>کۆی قازانجی سافی</h3>
          <div className="value success" style={{ color: '#10b981' }}>{totalProfit.toLocaleString()} دینار</div>
          <div className="sub-text">قازانجی خاوێن بەبێ تێچوو</div>
        </div>
        <div className="stat-card glass-panel" style={{ background: 'rgba(2, 132, 199, 0.08)', borderColor: 'rgba(2, 132, 199, 0.25)' }}>
          <h3>ژمارەی پسووڵەکان</h3>
          <div className="value" style={{ color: '#0284c7' }}>{filteredSales.length} پسووڵە</div>
          <div className="sub-text">پسووڵەی تۆمارکراو بە پارێزراوی</div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="glass-panel" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <FileText size={20} color="var(--accent-color)" /> لیستی تەواوی پسووڵەکانی فرۆشتن
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
            <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontWeight: 700 }}>ژمارەی وەسڵ</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontWeight: 700 }}>کڕیار</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontWeight: 700 }}>شێوازی پارەدان</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontWeight: 700 }}>ژمارەی کاڵا</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontWeight: 700 }}>کۆی فرۆشتن (دینار)</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontWeight: 700 }}>قازانج (دینار)</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontWeight: 700 }}>بەروار و کات</th>
                <th style={{ padding: '14px 20px', color: 'var(--text-secondary)', fontWeight: 700 }}>کردار</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>چاوەڕوان بە، باردەکرێت...</td></tr>
              ) : filteredSales.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>هیچ پسووڵەیەک نەدۆزرایەوە</td></tr>
              ) : (
                filteredSales.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s ease' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 'bold', color: 'var(--accent-color)' }}>#{s.id}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{s.customer_name}</td>
                    <td style={{ padding: '16px 20px' }}>
                      {s.payment_method === 'DEBT' ? (
                        <span style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          قەرز
                        </span>
                      ) : s.payment_method === 'SPLIT' ? (
                        <span style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          تێکەڵ (نەقد: {Number(s.paid_amount || 0).toLocaleString()} | قەرز: {Number(s.debt_amount || 0).toLocaleString()})
                        </span>
                      ) : (
                        <span style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          نەقد
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{s.item_count} دانە</td>
                    <td style={{ padding: '16px 20px', color: 'var(--accent-color)', fontWeight: 'bold' }}>{Number(s.total_amount).toLocaleString()} دینار</td>
                    <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: 'bold' }}>{Number(s.total_profit).toLocaleString()} دینار</td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{formatDateTime(s.created_at)}</td>
                    <td style={{ padding: '16px 20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button 
                        onClick={() => openSaleDetails(s.id, false)}
                        style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--accent-light)', color: 'var(--accent-color)', border: '1px solid var(--accent-color)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold' }}
                      >
                        وردەکاری
                      </button>
                      <button 
                        onClick={() => openSaleDetails(s.id, true)}
                        title="چاپکردنەوەی خێرای وەسڵ"
                        style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Printer size={14} /> چاپکردنی وەسڵ
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Detail Drawer / Modal */}
      {selectedSale && (
        <div className="pos-modal-overlay" onClick={() => setSelectedSale(null)}>
          <div className="pos-modal-card pos-modal-lg" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>پسووڵەی فرۆشتن #{selectedSale.id}</h2>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatDateTime(selectedSale.created_at)}</p>
              </div>
              <button onClick={() => setSelectedSale(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>کڕیار</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '4px', color: 'var(--text-primary)' }}>{selectedSale.customer_name}</div>
              </div>
              <div style={{ flex: 1, minWidth: '140px', padding: '1rem', background: 'rgba(56,189,248,0.05)', borderRadius: '12px', border: '1px solid rgba(56,189,248,0.2)' }}>
                <div style={{ fontSize: '0.85rem', color: '#0284c7' }}>کۆی گشتی فرۆشتن</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0284c7', marginTop: '4px' }}>{Number(selectedSale.total_amount).toLocaleString()} دینار</div>
              </div>
              <div style={{ flex: 1, minWidth: '140px', padding: '1rem', background: 'rgba(16,185,129,0.05)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ fontSize: '0.85rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Layers size={15} /> قازانجی سافی (FIFO)
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#059669', marginTop: '4px' }}>{Number(selectedSale.total_profit).toLocaleString()} دینار</div>
              </div>
              <div style={{ flex: 1.2, minWidth: '180px', padding: '1rem', background: selectedSale.payment_method === 'DEBT' ? 'rgba(239,68,68,0.08)' : (selectedSale.payment_method === 'SPLIT' ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)'), borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>شێوازی پارەدان</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 'bold', marginTop: '4px', color: selectedSale.payment_method === 'DEBT' ? '#ef4444' : (selectedSale.payment_method === 'SPLIT' ? '#d97706' : '#059669') }}>
                  {selectedSale.payment_method === 'DEBT' 
                    ? 'قەرز (تەواو)' 
                    : (selectedSale.payment_method === 'SPLIT' 
                        ? 'تێکەڵ (نەقد: ' + Number(selectedSale.paid_amount || 0).toLocaleString() + ' | قەرز: ' + Number(selectedSale.debt_amount || 0).toLocaleString() + ' د.ع)' 
                        : 'نەقد')}
                </div>
              </div>
            </div>

            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>کاڵاکانی ناو ئەم پسووڵەیە:</h3>
            <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '14px', overflowX: 'auto', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', minWidth: '550px', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>ناوی کاڵا و وەجبەکانی FIFO</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>بارکۆد</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>دانە</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>نرخ لە فرۆشتندا</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>کۆی نرخ</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.items?.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        <div>{item.product_name}</div>
                        {item.batches && item.batches.length > 0 && (
                          <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {item.batches.map((b, bIdx) => (
                              <span 
                                key={bIdx}
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  color: '#059669',
                                  border: '1px solid rgba(16, 185, 129, 0.25)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                📦 {b.batch_number || ('وەجبەی #' + b.batch_id)}: <b>{Number(b.quantity_deducted)} دانە</b> بە تێچوونی <b>{Number(b.unit_cost_price).toLocaleString()} د.ع</b>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'monospace' }}>{item.barcode}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>{item.quantity} دانە</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{Number(item.price_at_sale).toLocaleString()} دینار</td>
                      <td style={{ padding: '12px 16px', color: 'var(--accent-color)', fontWeight: 'bold' }}>
                        {(Number(item.price_at_sale) * Number(item.quantity)).toLocaleString()} دینار
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => handleReprintReceipt(selectedSale)}
                className="btn-primary"
                style={{ flex: 1, minWidth: '160px', padding: '12px', borderRadius: '10px' }}
              >
                <Printer size={18} /> چاپکردنەوەی پسووڵە
              </button>
              <button 
                onClick={() => setSelectedSale(null)} 
                className="btn-secondary"
                style={{ padding: '12px 24px', borderRadius: '10px' }}
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Thermal Reprint Receipt Container (Targeted by @media print) */}
      {reprintReceipt && (
        <div id="reprint-thermal-receipt" style={{
          width: '100%',
          maxWidth: '71mm',
          margin: '0 auto',
          padding: '0 2mm',
          boxSizing: 'border-box',
          overflow: 'hidden',
          direction: 'rtl',
          textAlign: 'right'
        }}>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '20px' }}>مارکێتی شارەکەم</div>

          {/* Unique Barcode directly below store name */}
          <div style={{ textAlign: 'center', margin: '4px 0 6px 0', width: '100%' }}>
            <BarcodeSVG value={'shrm/2026/' + String(reprintReceipt.id).padStart(4, '0')} maxWidth="66mm" barHeight={54} />
          </div>

          <div className="receipt-divider" style={{ width: '100%', borderBottom: '1px dashed #000000', margin: '6px 0' }}></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#000000', fontWeight: 'bold', padding: '0 2px', width: '100%' }}>
            <span>بەروار و کات:</span>
            <span>{formatDateTime(reprintReceipt.created_at, { twelveHour: true })}</span>
          </div>

          <div className="receipt-divider" style={{ width: '100%', borderBottom: '1px dashed #000000', margin: '6px 0' }}></div>

          {/* 5-Column Grid Table matching Cashier screen (#، کاڵا، دانە، نرخ، کۆ) with vertical borders */}
          <table style={{ 
            width: '100%', 
            maxWidth: '100%',
            tableLayout: 'fixed',
            borderCollapse: 'collapse', 
            border: '1px solid #000000', 
            direction: 'rtl',
            fontSize: '12px',
            margin: '5px 0',
            boxSizing: 'border-box',
            overflow: 'hidden',
            color: '#000000'
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000000', background: '#f5f5f5', color: '#000000' }}>
                <th style={{ border: '1px solid #000000', padding: '4px 2px', textAlign: 'center', width: '22px', color: '#000000', fontWeight: 'bold' }}>#</th>
                <th style={{ border: '1px solid #000000', padding: '4px 2px', textAlign: 'right', color: '#000000', fontWeight: 'bold' }}>کاڵا</th>
                <th style={{ border: '1px solid #000000', padding: '4px 2px', textAlign: 'center', width: '42px', color: '#000000', fontWeight: 'bold' }}>دانە</th>
                <th style={{ border: '1px solid #000000', padding: '4px 2px', textAlign: 'center', width: '52px', color: '#000000', fontWeight: 'bold' }}>نرخ</th>
                <th style={{ border: '1px solid #000000', padding: '4px 2px', textAlign: 'center', width: '56px', color: '#000000', fontWeight: 'bold' }}>کۆ</th>
              </tr>
            </thead>
            <tbody>
              {reprintReceipt.items?.map((it, idx) => {
                const qtyVal = Number(it.quantity) || 0;
                const cleanQty = Number.isInteger(qtyVal) ? qtyVal : parseFloat(qtyVal.toFixed(3));
                const isGramOrWeight = it.unit === 'گم' || it.unit === 'کگم' || it.unit === 'گرام' || it.unit === 'کیلۆ' || it.unit_type === 'WEIGHT' || String(it.unit || '').includes('گم') || String(it.unit || '').includes('کێش');
                const isBox = it.unit_type === 'BOX' || it.unit === 'کارتۆن';
                const displayQty = isGramOrWeight ? (cleanQty + ' گم') : (isBox ? (cleanQty + ' کارتۆن') : cleanQty);
                const itemPrice = Number(it.price_at_sale || it.price || 0);
                const itemTotal = itemPrice * Number(it.quantity || 1);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #000000', color: '#000000' }}>
                    <td style={{ border: '1px solid #000000', padding: '4px 2px', textAlign: 'center', color: '#000000', fontWeight: 'bold' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000000', padding: '4px 2px', textAlign: 'right', color: '#000000', fontWeight: 'bold', overflow: 'hidden', wordBreak: 'break-word' }}>{it.product_name || it.name}</td>
                    <td style={{ border: '1px solid #000000', padding: '4px 2px', textAlign: 'center', color: '#000000', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{displayQty}</td>
                    <td style={{ border: '1px solid #000000', padding: '4px 2px', textAlign: 'center', color: '#000000', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{itemPrice.toLocaleString()}</td>
                    <td style={{ border: '1px solid #000000', padding: '4px 2px', textAlign: 'center', color: '#000000', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{itemTotal.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="receipt-divider" style={{ width: '100%', borderBottom: '1px dashed #000000', margin: '6px 0' }}></div>

          {Number(reprintReceipt.discount || 0) > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '0 2px', width: '100%' }}>
                <span>کۆی سەرەتایی:</span>
                <span>{(Number(reprintReceipt.total_amount) + Number(reprintReceipt.discount)).toLocaleString()} دینار</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '0 2px', width: '100%' }}>
                <span>داشکاندن:</span>
                <span>-{Number(reprintReceipt.discount).toLocaleString()} دینار</span>
              </div>
              <div className="receipt-divider" style={{ width: '100%', borderBottom: '1px dashed #000000', margin: '6px 0' }}></div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16.5px', fontWeight: 'bold', padding: '0 2px', width: '100%' }}>
            <span>کۆی گشتی:</span>
            <span>{Number(reprintReceipt.total_amount).toLocaleString()} دینار</span>
          </div>

          <div className="receipt-divider" style={{ width: '100%', borderBottom: '1px dashed #000000', margin: '6px 0' }}></div>
          <div style={{ textAlign: 'center', fontSize: '12.5px', marginTop: '6px', width: '100%' }}>بەخێربێن بۆ مارکێتی شارەکەم</div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
