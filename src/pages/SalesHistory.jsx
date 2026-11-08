import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Search, Printer, X, User, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
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
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto" style={{ direction: 'rtl' }}>
      
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

      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            مێژووی فرۆشتن
          </h1>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input 
              type="text" 
              placeholder="گەڕان بە پسووڵە، کاشێر، کڕیار..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-9 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-shadow"
            />
          </div>

          {/* Cashier Filter Dropdown */}
          <div className="relative">
            <select
              value={cashierFilter}
              onChange={(e) => setCashierFilter(e.target.value)}
              className="py-1.5 px-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">هەموو کاشێرەکان</option>
              {cashiersList.map((cashier) => (
                <option key={cashier} value={cashier}>{cashier}</option>
              ))}
            </select>
          </div>

          {/* Date Filter Tabs */}
          <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
            {[
              { id: 'ALL', label: 'هەموو کات' },
              { id: 'TODAY', label: 'ئەمڕۆ' },
              { id: 'WEEK', label: 'ئەم هەفتەیە' },
              { id: 'MONTH', label: 'ئەم مانگە' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  dateFilter === tab.id 
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards (Strictly Clean & Minimalist: No Helper Text) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-center">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">کۆی داهاتی پسووڵەکان</span>
          <span className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">
            {totalRevenue.toLocaleString()} <span className="text-xs font-normal text-slate-500">د.ع</span>
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-center">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">کۆی قازانجی سافی</span>
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {totalProfit.toLocaleString()} <span className="text-xs font-normal text-slate-500">د.ع</span>
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-center">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">ژمارەی پسووڵەکان</span>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {filteredSales.length} <span className="text-xs font-normal text-slate-500">پسووڵە</span>
          </span>
        </div>
      </div>

      {/* Sales Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <th className="py-2.5 px-3.5 font-semibold"># وەسڵ</th>
                <th className="py-2.5 px-3.5 font-semibold">کاشێر</th>
                <th className="py-2.5 px-3.5 font-semibold">کڕیار</th>
                <th className="py-2.5 px-3.5 font-semibold">شێواز</th>
                <th className="py-2.5 px-3.5 font-semibold">کاڵا</th>
                <th className="py-2.5 px-3.5 font-semibold">کۆی فرۆشتن</th>
                <th className="py-2.5 px-3.5 font-semibold">قازانجی سافی</th>
                <th className="py-2.5 px-3.5 font-semibold">کات و بەروار</th>
                <th className="py-2.5 px-3.5 font-semibold text-center w-28">کردار</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    چاوەڕوان بە، باردەکرێت...
                  </td>
                </tr>
              ) : paginatedSales.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    هیچ پسووڵەیەک نەدۆزرایەوە
                  </td>
                </tr>
              ) : (
                paginatedSales.map((s) => (
                  <tr 
                    key={s.id} 
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Invoice ID */}
                    <td className="py-2 px-3.5 font-mono font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      #{s.id}
                    </td>

                    {/* Cashier */}
                    <td className="py-2 px-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                        <User size={11} className="text-slate-400" />
                        {s.cashier_name || 'کاشێر'}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="py-2 px-3.5 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">
                      {s.customer_name}
                    </td>

                    {/* Payment Method */}
                    <td className="py-2 px-3.5 whitespace-nowrap">
                      {s.payment_method === 'DEBT' ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
                          قەرز
                        </span>
                      ) : s.payment_method === 'SPLIT' ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">
                          تێکەڵ
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40">
                          نەقد
                        </span>
                      )}
                    </td>

                    {/* Item Count */}
                    <td className="py-2 px-3.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {s.item_count} دانە
                    </td>

                    {/* Total Amount */}
                    <td className="py-2 px-3.5 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {Number(s.total_amount).toLocaleString()} <span className="font-normal text-[10px] text-slate-500">د.ع</span>
                    </td>

                    {/* Net Profit */}
                    <td className="py-2 px-3.5 font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {Number(s.total_profit).toLocaleString()} <span className="font-normal text-[10px] text-slate-500">د.ع</span>
                    </td>

                    {/* Date and Time */}
                    <td className="py-2 px-3.5 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                      {formatDateTime(s.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3.5 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => openSaleDetails(s.id, false)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          وردەکاری
                        </button>
                        <button 
                          onClick={() => openSaleDetails(s.id, true)}
                          title="چاپکردنەوەی خێرای وەسڵ"
                          className="p-1 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                        >
                          <Printer size={14} />
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>پیشاندانی</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="py-0.5 px-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>لە کۆی {filteredSales.length} پسووڵە</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
              <span className="px-2 text-xs font-medium">
                پەڕەی {currentPage} لە {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-800 transition-colors"
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
            className="pos-modal-card pos-modal-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-5" 
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '750px', width: '92vw' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200/80 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  وردەکاری پسووڵەی #{selectedSale.id}
                </h2>
                <div className="text-xs text-slate-400 mt-0.5">
                  {formatDateTime(selectedSale.created_at)}
                </div>
              </div>
              <button 
                onClick={() => setSelectedSale(null)} 
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Clean Metadata Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 block">کاشێر</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                  {selectedSale.cashier_name || 'کاشێر'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 block">کڕیار</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                  {selectedSale.customer_name}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 block">کۆی فرۆشتن</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {Number(selectedSale.total_amount).toLocaleString()} د.ع
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block">قازانجی سافی</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  {Number(selectedSale.total_profit).toLocaleString()} د.ع
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden mb-4">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/70 dark:border-slate-800 text-slate-500">
                    <th className="py-2 px-3 font-semibold">ناوی کاڵا</th>
                    <th className="py-2 px-3 font-semibold">بارکۆد</th>
                    <th className="py-2 px-3 font-semibold text-center">دانە</th>
                    <th className="py-2 px-3 font-semibold">نرخ</th>
                    <th className="py-2 px-3 font-semibold">کۆ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {selectedSale.items?.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30">
                      <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                        <div>{item.product_name}</div>
                        {item.batches && item.batches.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.batches.map((b, bIdx) => (
                              <span 
                                key={bIdx}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/50"
                              >
                                {b.batch_number || ('#' + b.batch_id)}: {Number(b.quantity_deducted)} دانە ({Number(b.unit_cost_price).toLocaleString()} د.ع)
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{item.barcode}</td>
                      <td className="py-2 px-3 text-center text-slate-700 dark:text-slate-300 font-medium">{item.quantity}</td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{Number(item.price_at_sale).toLocaleString()}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {(Number(item.price_at_sale) * Number(item.quantity)).toLocaleString()} د.ع
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button 
                onClick={() => setSelectedSale(null)} 
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors"
              >
                داخستن
              </button>
              <button 
                onClick={() => handleReprintReceipt(selectedSale)}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
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
