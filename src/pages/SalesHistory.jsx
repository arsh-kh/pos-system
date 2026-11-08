import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Search, Printer, X, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { formatDateTime } from '../utils/dateFormatter';
import BarcodeSVG from '../components/BarcodeSVG';
import './Dashboard.css';

const SalesHistory = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('ALL'); // ALL, TODAY, WEEK, MONTH
  const [cashierFilter, setCashierFilter] = useState('ALL');
  const [selectedSale, setSelectedSale] = useState(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Re-print Thermal Receipt State
  const [reprintReceipt, setReprintReceipt] = useState(null);
  const storeName = localStorage.getItem('pos_store_name') || 'مارکێتی شارەکەم';

  const fetchSales = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/sales');
      if (res.data?.status === 'SUCCESS' && Array.isArray(res.data.data)) {
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
      if (res.data?.status === 'SUCCESS') {
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

  // Distinct cashier list for filter
  const cashiersList = useMemo(() => {
    const list = sales.map(s => s.cashier_name).filter(Boolean);
    return Array.from(new Set(list));
  }, [sales]);

  // Filter Sales
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      // Cashier filter
      if (cashierFilter !== 'ALL' && s.cashier_name !== cashierFilter) {
        return false;
      }

      // Search match (id, customer_name, cashier_name)
      const matchesSearch = kurdishSearchMatch(
        [s.id, s.customer_name, s.cashier_name], 
        searchTerm
      );
      if (!matchesSearch) return false;

      // Date filter
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
  }, [sales, searchTerm, dateFilter, cashierFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, cashierFilter, pageSize]);

  // Totals
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  }, [filteredSales]);

  const totalProfit = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + Number(s.total_profit || 0), 0);
  }, [filteredSales]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredSales.length / pageSize) || 1;
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, currentPage, pageSize]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', direction: 'rtl', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
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
            max-width: 72mm !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            background: white !important;
            color: black !important;
            padding: 2px 4mm 30px 4mm !important;
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

      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-color)' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          مێژووی فرۆشتن
        </h1>

        {/* Filter Controls Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '6px 12px', minWidth: '230px' }}>
            <Search size={16} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="گەڕان بە پسووڵە، کاشێر، کڕیار..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', color: 'var(--text-primary)', width: '100%', fontFamily: 'inherit' }}
            />
          </div>

          {/* Cashier Filter Dropdown */}
          <select
            value={cashierFilter}
            onChange={(e) => setCashierFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '10px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            <option value="ALL">هەموو کاشێرەکان</option>
            {cashiersList.map((cashier) => (
              <option key={cashier} value={cashier}>{cashier}</option>
            ))}
          </select>

          {/* Date Filter Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '3px' }}>
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
                  padding: '5px 12px',
                  borderRadius: '7px',
                  background: dateFilter === tab.id ? 'var(--accent-color)' : 'transparent',
                  color: dateFilter === tab.id ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  fontWeight: dateFilter === tab.id ? 700 : 500,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards (Clean Minimalist, NO helper text) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: 'var(--card-shadow)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>کۆی داهاتی پسووڵەکان</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {totalRevenue.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>د.ع</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: 'var(--card-shadow)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>کۆی قازانجی سافی</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--success-color)', marginTop: '4px' }}>
            {totalProfit.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>د.ع</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: 'var(--card-shadow)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>ژمارەی پسووڵەکان</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-color)', marginTop: '4px' }}>
            {filteredSales.length} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>پسووڵە</span>
          </div>
        </div>
      </div>

      {/* Sales Table Container */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
            <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}># وەسڵ</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>کاشێر</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>کڕیار</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>شێواز</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>کاڵا</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>کۆی فرۆشتن</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>قازانجی سافی</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>کات و بەروار</th>
                <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center', width: '120px' }}>کردار</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    چاوەڕوان بە، باردەکرێت...
                  </td>
                </tr>
              ) : paginatedSales.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    هیچ پسووڵەیەک نەدۆزرایەوە
                  </td>
                </tr>
              ) : (
                paginatedSales.map((s) => (
                  <tr 
                    key={s.id} 
                    style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.12s ease' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Invoice ID */}
                    <td style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--accent-color)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      #{s.id}
                    </td>

                    {/* Cashier */}
                    <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--border-color)' }}>
                        <User size={12} color="var(--text-muted)" />
                        {s.cashier_name || 'کاشێر'}
                      </span>
                    </td>

                    {/* Customer */}
                    <td style={{ padding: '9px 14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {s.customer_name}
                    </td>

                    {/* Payment Method */}
                    <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                      {s.payment_method === 'DEBT' ? (
                        <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', fontSize: '0.78rem', fontWeight: 700 }}>
                          قەرز
                        </span>
                      ) : s.payment_method === 'SPLIT' ? (
                        <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', fontSize: '0.78rem', fontWeight: 700 }}>
                          تێکەڵ
                        </span>
                      ) : (
                        <span style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(5, 150, 105, 0.1)', color: '#059669', fontSize: '0.78rem', fontWeight: 700 }}>
                          نەقد
                        </span>
                      )}
                    </td>

                    {/* Item Count */}
                    <td style={{ padding: '9px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {s.item_count} دانە
                    </td>

                    {/* Total Amount */}
                    <td style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {Number(s.total_amount).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>د.ع</span>
                    </td>

                    {/* Net Profit */}
                    <td style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--success-color)', whiteSpace: 'nowrap' }}>
                      {Number(s.total_profit).toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>د.ع</span>
                    </td>

                    {/* Date and Time */}
                    <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {formatDateTime(s.created_at)}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '9px 14px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button 
                          onClick={() => openSaleDetails(s.id, false)}
                          style={{ padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit' }}
                        >
                          وردەکاری
                        </button>
                        <button 
                          onClick={() => openSaleDetails(s.id, true)}
                          title="چاپکردنەوەی خێرای وەسڵ"
                          style={{ padding: '4px 8px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <Printer size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Clean Footer Pagination Controls */}
        {filteredSales.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>پیشاندان:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>لە کۆی {filteredSales.length} پسووڵە</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? 0.35 : 1, display: 'flex', alignItems: 'center' }}
              >
                <ChevronRight size={14} />
              </button>
              <span style={{ fontWeight: 600 }}>
                پەڕەی {currentPage} لە {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                style={{ padding: '3px 6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', opacity: currentPage >= totalPages ? 0.35 : 1, display: 'flex', alignItems: 'center' }}
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedSale && (
        <div className="pos-modal-overlay" onClick={() => setSelectedSale(null)}>
          <div 
            className="pos-modal-card" 
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '720px', width: '92vw', background: 'var(--bg-secondary)', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  وردەکاری پسووڵەی #{selectedSale.id}
                </h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {formatDateTime(selectedSale.created_at)}
                </div>
              </div>
              <button 
                onClick={() => setSelectedSale(null)} 
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '9999px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.6rem 0.8rem', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>کاشێر</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {selectedSale.cashier_name || 'کاشێر'}
                </div>
              </div>

              <div style={{ padding: '0.6rem 0.8rem', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>کڕیار</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {selectedSale.customer_name}
                </div>
              </div>

              <div style={{ padding: '0.6rem 0.8rem', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>کۆی فرۆشتن</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {Number(selectedSale.total_amount).toLocaleString()} د.ع
                </div>
              </div>

              <div style={{ padding: '0.6rem 0.8rem', borderRadius: '10px', background: 'rgba(5, 150, 105, 0.08)', border: '1px solid rgba(5, 150, 105, 0.2)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--success-color)' }}>قازانجی سافی</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--success-color)', marginTop: '2px' }}>
                  {Number(selectedSale.total_profit).toLocaleString()} د.ع
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.82rem' }}>
                <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700 }}>ناوی کاڵا</th>
                    <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700 }}>بارکۆد</th>
                    <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700, textAlign: 'center' }}>دانە</th>
                    <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700 }}>نرخ</th>
                    <th style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 700 }}>کۆ</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.items?.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <div>{item.product_name}</div>
                        {item.batches && item.batches.length > 0 && (
                          <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {item.batches.map((b, bIdx) => (
                              <span 
                                key={bIdx}
                                style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(5, 150, 105, 0.08)', color: 'var(--success-color)', border: '1px solid rgba(5, 150, 105, 0.2)' }}
                              >
                                {b.batch_number || ('#' + b.batch_id)}: {Number(b.quantity_deducted)} دانە ({Number(b.unit_cost_price).toLocaleString()} د.ع)
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.78rem' }}>{item.barcode}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>{item.quantity}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{Number(item.price_at_sale).toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {(Number(item.price_at_sale) * Number(item.quantity)).toLocaleString()} د.ع
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => setSelectedSale(null)} 
                style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit' }}
              >
                داخستن
              </button>
              <button 
                onClick={() => handleReprintReceipt(selectedSale)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'var(--accent-color)', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit' }}
              >
                <Printer size={14} /> چاپکردنەوەی پسووڵە
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Thermal Reprint Receipt Container (Targeted by @media print) */}
      {reprintReceipt && (
        <div id="reprint-thermal-receipt" style={{
          width: '100%',
          maxWidth: '72mm',
          margin: '0 auto',
          padding: '0 4mm',
          boxSizing: 'border-box',
          overflow: 'hidden',
          direction: 'rtl',
          textAlign: 'right'
        }}>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>{storeName}</div>

          {/* Barcode directly below store name */}
          <div style={{ textAlign: 'center', margin: '4px 0 6px 0', width: '100%' }}>
            <BarcodeSVG value={'shrm/2026/' + String(reprintReceipt.id).padStart(4, '0')} maxWidth="60mm" barHeight={45} />
          </div>

          <div className="receipt-divider" style={{ width: '100%', borderBottom: '1px dashed #000000', margin: '5px 0' }}></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#000000', fontWeight: 'bold', padding: '0 2px', width: '100%' }}>
            <span>وەسڵی ژمارە:</span>
            <span>#{reprintReceipt.id}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#000000', fontWeight: 'bold', padding: '0 2px', width: '100%' }}>
            <span>کاشێر:</span>
            <span>{reprintReceipt.cashier_name || 'کاشێر'}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#000000', fontWeight: 'bold', padding: '0 2px', width: '100%' }}>
            <span>کڕیار:</span>
            <span>{reprintReceipt.customer_name || 'کڕیاری گشتی'}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#000000', fontWeight: 'bold', padding: '0 2px', width: '100%' }}>
            <span>بەروار و کات:</span>
            <span>{formatDateTime(reprintReceipt.created_at, { twelveHour: true })}</span>
          </div>

          <div className="receipt-divider" style={{ width: '100%', borderBottom: '1px dashed #000000', margin: '5px 0' }}></div>

          {/* 5-Column Items Table */}
          <table style={{ 
            width: '100%', 
            maxWidth: '100%',
            tableLayout: 'fixed',
            borderCollapse: 'collapse', 
            border: '1px solid #000000', 
            direction: 'rtl',
            fontSize: '11px',
            margin: '4px 0',
            boxSizing: 'border-box',
            overflow: 'hidden',
            color: '#000000'
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000000', background: '#f5f5f5', color: '#000000' }}>
                <th style={{ border: '1px solid #000000', padding: '2px', textAlign: 'center', width: '20px', color: '#000000', fontWeight: 'bold' }}>#</th>
                <th style={{ border: '1px solid #000000', padding: '2px 4px', textAlign: 'right', color: '#000000', fontWeight: 'bold' }}>کاڵا</th>
                <th style={{ border: '1px solid #000000', padding: '2px', textAlign: 'center', width: '36px', color: '#000000', fontWeight: 'bold' }}>دانە</th>
                <th style={{ border: '1px solid #000000', padding: '2px', textAlign: 'center', width: '46px', color: '#000000', fontWeight: 'bold' }}>نرخ</th>
                <th style={{ border: '1px solid #000000', padding: '2px', textAlign: 'center', width: '50px', color: '#000000', fontWeight: 'bold' }}>کۆ</th>
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
                    <td style={{ border: '1px solid #000000', padding: '2px', textAlign: 'center', color: '#000000', fontWeight: 'bold' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #000000', padding: '2px 4px', textAlign: 'right', color: '#000000', fontWeight: 'bold', overflow: 'hidden', wordBreak: 'break-word' }}>{it.product_name || it.name}</td>
                    <td style={{ border: '1px solid #000000', padding: '2px', textAlign: 'center', color: '#000000', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{displayQty}</td>
                    <td style={{ border: '1px solid #000000', padding: '2px', textAlign: 'center', color: '#000000', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{itemPrice.toLocaleString()}</td>
                    <td style={{ border: '1px solid #000000', padding: '2px', textAlign: 'center', color: '#000000', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{itemTotal.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="receipt-divider" style={{ width: '100%', borderBottom: '1px dashed #000000', margin: '5px 0' }}></div>

          {Number(reprintReceipt.discount || 0) > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '0 2px', width: '100%' }}>
                <span>کۆی سەرەتایی:</span>
                <span>{(Number(reprintReceipt.total_amount) + Number(reprintReceipt.discount)).toLocaleString()} دینار</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '0 2px', width: '100%' }}>
                <span>داشکاندن:</span>
                <span>-{Number(reprintReceipt.discount).toLocaleString()} دینار</span>
              </div>
              <div className="receipt-divider" style={{ width: '100%', borderBottom: '1px dashed #000000', margin: '5px 0' }}></div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', padding: '0 2px', width: '100%' }}>
            <span>کۆی گشتی:</span>
            <span>{Number(reprintReceipt.total_amount).toLocaleString()} دینار</span>
          </div>

          <div className="receipt-divider" style={{ width: '100%', borderBottom: '1px dashed #000000', margin: '5px 0' }}></div>
          <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '4px', width: '100%' }}>بەخێربێن بۆ {storeName}</div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
