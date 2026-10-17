import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Search, FileText, X, Printer, Layers } from 'lucide-react';
import './Dashboard.css';

const SalesHistory = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('ALL'); // ALL, TODAY, WEEK, MONTH
  const [selectedSale, setSelectedSale] = useState(null);
  
  // Re-print Thermal Receipt State
  const [reprintReceipt, setReprintReceipt] = useState(null);
  const storeName = localStorage.getItem('pos_store_name') || 'مارکێتی نموونەیی';
  const storePhone = localStorage.getItem('pos_store_phone') || '0750 000 0000';

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

  const openSaleDetails = async (id) => {
    try {
      const res = await axios.get(`http://localhost:3001/api/sales/${id}`);
      if (res.data.status === 'SUCCESS') {
        setSelectedSale(res.data.data);
      }
    } catch {
      alert('هەڵەیەک ڕوویدا لە کاتی هێنانی زانیاری پسووڵە');
    }
  };

  const handleReprintReceipt = (sale) => {
    setReprintReceipt(sale);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Filter Sales
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const matchesSearch = 
        s.id.toString().includes(searchTerm) || 
        (s.customer_name && s.customer_name.toLowerCase().includes(searchTerm.toLowerCase()));

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
        @media print {
          body * {
            visibility: hidden !important;
          }
          #reprint-thermal-receipt, #reprint-thermal-receipt * {
            visibility: visible !important;
          }
          #reprint-thermal-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            background: white !important;
            color: black !important;
            padding: 10px !important;
            font-family: monospace !important;
            font-size: 13px !important;
            direction: rtl !important;
            text-align: right !important;
          }
          .receipt-divider {
            border-bottom: 1px dashed #000 !important;
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
          <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 1rem', borderRadius: '12px' }}>
            <Search size={18} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="گەڕان بە ژمارەی پسووڵە یان کڕیار..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'white', marginRight: '8px', outline: 'none', width: '220px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px' }}>
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
                  color: dateFilter === tab.id ? 'white' : '#94a3b8',
                  fontSize: '0.85rem',
                  fontWeight: dateFilter === tab.id ? 'bold' : 'normal',
                  border: 'none',
                  cursor: 'pointer'
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
        <div className="stat-card glass-panel" style={{ background: 'rgba(168, 85, 247, 0.08)', borderColor: 'rgba(168, 85, 247, 0.25)' }}>
          <h3>ژمارەی پسووڵەکان</h3>
          <div className="value" style={{ color: '#c084fc' }}>{filteredSales.length} پسووڵە</div>
          <div className="sub-text">پسووڵەی تۆمارکراو بە پارێزراوی</div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="glass-panel" style={{ borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="#3b82f6" /> لیستی تەواوی پسووڵەکانی فرۆشتن
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
            <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '16px 20px', color: '#94a3b8' }}>ژمارەی پسووڵە</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8' }}>کڕیار</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8' }}>شێوازی پارەدان</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8' }}>ژمارەی کاڵا</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8' }}>کۆی فرۆشتن (دینار)</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8' }}>قازانج (دینار)</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8' }}>بەروار و کات</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8' }}>کردار</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>چاوەڕوان بە، باردەکرێت...</td></tr>
              ) : filteredSales.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>هیچ پسووڵەیەک نەدۆزرایەوە</td></tr>
              ) : (
                filteredSales.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 'bold', color: '#38bdf8' }}>#{s.id}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 'bold' }}>{s.customer_name}</td>
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
                    <td style={{ padding: '16px 20px', color: '#94a3b8' }}>{s.item_count} دانە</td>
                    <td style={{ padding: '16px 20px', color: '#38bdf8', fontWeight: 'bold' }}>{Number(s.total_amount).toLocaleString()} دینار</td>
                    <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: 'bold' }}>{Number(s.total_profit).toLocaleString()} دینار</td>
                    <td style={{ padding: '16px 20px', color: '#94a3b8', fontSize: '0.9rem' }}>{new Date(s.created_at).toLocaleString('en-GB')}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <button 
                        onClick={() => openSaleDetails(s.id)}
                        style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                      >
                        بینینی وردەکاری
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '24px', padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, color: '#f8fafc' }}>پسووڵەی فرۆشتن #{selectedSale.id}</h2>
                <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>{new Date(selectedSale.created_at).toLocaleString('en-GB')}</p>
              </div>
              <button onClick={() => setSelectedSale(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={28} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>کڕیار</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '4px' }}>{selectedSale.customer_name}</div>
              </div>
              <div style={{ flex: 1, minWidth: '140px', padding: '1rem', background: 'rgba(56,189,248,0.05)', borderRadius: '12px', border: '1px solid rgba(56,189,248,0.2)' }}>
                <div style={{ fontSize: '0.85rem', color: '#38bdf8' }}>کۆی گشتی فرۆشتن</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '4px' }}>{Number(selectedSale.total_amount).toLocaleString()} دینار</div>
              </div>
              <div style={{ flex: 1, minWidth: '140px', padding: '1rem', background: 'rgba(16,185,129,0.05)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Layers size={15} /> قازانجی سافی (FIFO)
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#10b981', marginTop: '4px' }}>{Number(selectedSale.total_profit).toLocaleString()} دینار</div>
              </div>
              <div style={{ flex: 1.2, minWidth: '180px', padding: '1rem', background: selectedSale.payment_method === 'DEBT' ? 'rgba(239,68,68,0.08)' : (selectedSale.payment_method === 'SPLIT' ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)'), borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>شێوازی پارەدان</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 'bold', marginTop: '4px', color: selectedSale.payment_method === 'DEBT' ? '#ef4444' : (selectedSale.payment_method === 'SPLIT' ? '#f59e0b' : '#10b981') }}>
                  {selectedSale.payment_method === 'DEBT' ? 'قەرز (تەواو)' : (selectedSale.payment_method === 'SPLIT' ? `تێکەڵ (نەقد: ${Number(selectedSale.paid_amount || 0).toLocaleString()} | قەرز: ${Number(selectedSale.debt_amount || 0).toLocaleString()} د.ع)` : 'نەقد')}
                </div>
              </div>
            </div>

            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>کاڵاکانی ناو ئەم پسووڵەیە:</h3>
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '14px', overflow: 'hidden', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', color: '#94a3b8' }}>ناوی کاڵا و وەجبەکانی FIFO</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8' }}>بارکۆد</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8' }}>دانە</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8' }}>نرخ لە فرۆشتندا</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8' }}>کۆی نرخ</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.items?.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '500' }}>
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
                                  color: '#34d399',
                                  border: '1px solid rgba(16, 185, 129, 0.25)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                📦 {b.batch_number || `وەجبەی #${b.batch_id}`}: <b>{Number(b.quantity_deducted)} دانە</b> بە تێچوونی <b>{Number(b.unit_cost_price).toLocaleString()} د.ع</b>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.85rem', fontFamily: 'monospace' }}>{item.barcode}</td>
                      <td style={{ padding: '12px 16px' }}>{item.quantity} دانە</td>
                      <td style={{ padding: '12px 16px' }}>{Number(item.price_at_sale).toLocaleString()} دینار</td>
                      <td style={{ padding: '12px 16px', color: '#38bdf8', fontWeight: 'bold' }}>
                        {(Number(item.price_at_sale) * Number(item.quantity)).toLocaleString()} دینار
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => handleReprintReceipt(selectedSale)}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Printer size={18} /> چاپکردنەوەی پسووڵە
              </button>
              <button 
                onClick={() => setSelectedSale(null)} 
                style={{ padding: '14px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Thermal Reprint Receipt Container (Targeted by @media print) */}
      {reprintReceipt && (
        <div id="reprint-thermal-receipt">
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>{storeName}</div>
          <div style={{ textAlign: 'center', fontSize: '11px', color: '#333' }}>پەیوەندی: {storePhone}</div>
          <div className="receipt-divider"></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ژمارەی پسووڵە:</span>
            <span>#{reprintReceipt.id}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>کڕیار:</span>
            <span>{reprintReceipt.customer_name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>بەروار:</span>
            <span>{new Date(reprintReceipt.created_at).toLocaleString('en-US', { hour12: true })}</span>
          </div>

          <div className="receipt-divider"></div>

          {/* Items */}
          <div style={{ margin: '4px 0' }}>
            {reprintReceipt.items?.map((it, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0' }}>
                <span>{it.product_name} x {it.quantity}</span>
                <span>{(Number(it.price_at_sale) * Number(it.quantity)).toLocaleString()} دینار</span>
              </div>
            ))}
          </div>

          <div className="receipt-divider"></div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold' }}>
            <span>کۆی گشتی:</span>
            <span>{Number(reprintReceipt.total_amount).toLocaleString()} دینار</span>
          </div>

          {reprintReceipt.payment_method === 'SPLIT' ? (
            <div style={{ margin: '4px 0', padding: '4px 0', borderTop: '1px dashed #000' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold' }}>
                <span>شێوازی پارەدان:</span>
                <span>فرە-جۆر (تێکەڵ)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>دراو بە نەقد:</span>
                <span>{Number(reprintReceipt.paid_amount || 0).toLocaleString()} دینار</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold' }}>
                <span>ماوە بە قەرز:</span>
                <span>{Number(reprintReceipt.debt_amount || 0).toLocaleString()} دینار</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '2px' }}>
              <span>شێوازی پارەدان:</span>
              <span>{reprintReceipt.payment_method === 'DEBT' ? 'قەرز' : 'نەقد'}</span>
            </div>
          )}

          <div className="receipt-divider"></div>
          <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '6px' }}>وەسڵی فرۆشتن (لەپێشینە)</div>
        </div>
      )}

    </div>
  );
};

export default SalesHistory;
