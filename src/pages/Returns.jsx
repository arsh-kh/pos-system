import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  RotateCcw, 
  Search, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  Calendar, 
  User, 
  Receipt, 
  X,
  FileText
} from 'lucide-react';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import './Dashboard.css';

const REASON_OPTIONS = [
  'کاڵای هەڵە / نەخواستراو',
  'کاڵای تێکچوو یان کەموکوڕی دار',
  'بەرواری بەسەرچوون',
  'خواستی کڕیار',
  'هۆکاری تر'
];

const Returns = () => {
  // Search Sale
  const [saleIdInput, setSaleIdInput] = useState('');
  const [searchedSale, setSearchedSale] = useState(null);
  const [isSearchingSale, setIsSearchingSale] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Return Processing
  const [returnQtys, setReturnQtys] = useState({});
  const [returnReasons, setReturnReasons] = useState({});
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [processingItemId, setProcessingItemId] = useState(null);

  // History & Stats
  const [returnsHistory, setReturnsHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historySearch, setHistorySearch] = useState('');

  // Refund Receipt Modal
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const fetchReturnsHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await axios.get('http://localhost:3001/api/returns');
      if (res.data.status === 'SUCCESS') {
        setReturnsHistory(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load returns history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchReturnsHistory();
  }, []);

  const handleSearchSale = async (e) => {
    e?.preventDefault();
    const id = saleIdInput.trim();
    if (!id) return;

    setIsSearchingSale(true);
    setSearchError('');
    setSearchedSale(null);

    try {
      const res = await axios.get(`http://localhost:3001/api/returns/sale/${id}`);
      if (res.data.status === 'SUCCESS') {
        setSearchedSale(res.data.data);
        setRefundMethod(res.data.data.recommended_refund_method || 'CASH');
        // Initialize default return quantities to 1 or returnable_qty
        const initQtys = {};
        const initReasons = {};
        res.data.data.items?.forEach(item => {
          initQtys[item.product_id] = item.returnable_qty > 0 ? 1 : 0;
          initReasons[item.product_id] = REASON_OPTIONS[0];
        });
        setReturnQtys(initQtys);
        setReturnReasons(initReasons);
      }
    } catch (err) {
      setSearchError(err.response?.data?.message || 'پسووڵەی داواکراو نەدۆزرایەوە');
    } finally {
      setIsSearchingSale(false);
    }
  };

  const handleProcessReturn = async (item) => {
    const qtyToReturn = parseFloat(returnQtys[item.product_id]) || 0;
    if (qtyToReturn <= 0) {
      return alert('تکایە بڕی گەڕاندنەوەی دروست دیاری بکە');
    }
    if (qtyToReturn > item.returnable_qty) {
      return alert(`بڕی گەڕاندنەوە ناتوانێت لە ${item.returnable_qty} زیاتر بێت`);
    }

    const reason = returnReasons[item.product_id] || 'گەڕاندنەوە لە کڕیار';

    const confirmMsg = refundMethod === 'DEBT'
      ? `دڵنیایت لە گەڕاندنەوەی ${qtyToReturn} ${item.unit || 'دانە'} لە "${item.product_name}"؟ (پارەکەی لە قەرزی کڕیار کەم دەکرێتەوە)`
      : `دڵنیایت لە گەڕاندنەوەی ${qtyToReturn} ${item.unit || 'دانە'} لە "${item.product_name}"؟ (پارەکەی بە نەقد لە سندوق دەدرێتەوە)`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setProcessingItemId(item.product_id);
    try {
      const res = await axios.post('http://localhost:3001/api/returns', {
        sale_id: searchedSale.id,
        product_id: item.product_id,
        quantity: qtyToReturn,
        reason: reason,
        refund_method: refundMethod
      });

      if (res.data.status === 'SUCCESS') {
        alert(res.data.message);
        
        // Prepare Receipt
        const receiptData = {
          sale_id: searchedSale.id,
          product_name: item.product_name,
          barcode: item.barcode,
          quantity: qtyToReturn,
          unit: item.unit || 'دانە',
          price_at_sale: item.price_at_sale,
          refunded_amount: res.data.refunded_amount,
          refund_method: res.data.refund_method || refundMethod,
          customer_name: searchedSale.customer_name,
          reason: reason,
          created_at: new Date().toISOString()
        };
        setSelectedReceipt(receiptData);

        // Refresh sale data and history
        handleSearchSale();
        fetchReturnsHistory();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە گەڕاندنەوەی کاڵا');
    } finally {
      setProcessingItemId(null);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  // KPI Calculations
  const totalRefundedAmount = returnsHistory.reduce((sum, r) => sum + (Number(r.refunded_amount) || 0), 0);
  const totalReturnedQty = returnsHistory.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRefundedAmount = returnsHistory
    .filter(r => r.created_at?.startsWith(todayStr))
    .reduce((sum, r) => sum + (Number(r.refunded_amount) || 0), 0);

  const filteredHistory = returnsHistory.filter(r => 
    kurdishSearchMatch([r.product_name, r.barcode, r.sale_id, r.customer_name, r.reason], historySearch)
  );

  return (
    <div className="dashboard-page p-8" dir="rtl">
      {/* Header */}
      <div className="page-header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RotateCcw className="text-secondary" size={32} />
            گەڕاندنەوەی کاڵا لە کڕیار
          </h1>
          <p className="text-secondary">گەڕاندنەوەی کاڵای فرۆشراو بەپێی پسووڵە، زیادکردنەوە بۆ کۆگا و دانەوەی پارەی کڕیار</p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid mb-8">
        <div className="stat-card glass-panel" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
          <h3>کۆی پارەی دراوەتەوە بە کڕیار</h3>
          <div className="value" style={{ color: '#f87171' }}>
            {totalRefundedAmount.toLocaleString()} دینار
          </div>
          <div className="sub-text">کۆی گشتی پارەی گەڕێنراوە بۆ کڕیاران</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
          <h3>گەڕێنراوەی ئەمڕۆ</h3>
          <div className="value" style={{ color: '#fbbf24' }}>
            {todayRefundedAmount.toLocaleString()} دینار
          </div>
          <div className="sub-text">کۆی پارەی گەڕێنراوە لە بەرواری ئەمڕۆ</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.25)' }}>
          <h3>کۆی ژمارەی کاڵا گەڕاوەکان</h3>
          <div className="value" style={{ color: '#60a5fa' }}>
            {totalReturnedQty.toLocaleString()} دانە
          </div>
          <div className="sub-text">زیادکراوەتەوە سەر باڵانسی کۆگا</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
          <h3>ژمارەی گەڕاندنەوەکان</h3>
          <div className="value" style={{ color: '#34d399' }}>
            {returnsHistory.length} کرداری گەڕاندنەوە
          </div>
          <div className="sub-text">تۆمارکراو لە سیستەمدا</div>
        </div>
      </div>

      {/* Search Sale Section */}
      <div className="glass-panel mb-8" style={{ padding: '24px', borderRadius: '20px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', marginBottom: '16px' }}>
          <Search size={22} color="#38bdf8" />
          گەڕان بەدوای پسووڵەی فرۆشتن بۆ گەڕاندنەوە
        </h2>

        <form onSubmit={handleSearchSale} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', maxWidth: '600px' }}>
          <input 
            type="number" 
            placeholder="ژمارەی پسووڵە بنووسە (نموونە: 9)..."
            value={saleIdInput}
            onChange={(e) => setSaleIdInput(e.target.value)}
            style={{ flex: 1, padding: '12px 18px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }}
          />
          <button 
            type="submit" 
            disabled={isSearchingSale}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: 'var(--accent-color)', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <Search size={18} /> {isSearchingSale ? 'دەگەڕێت...' : 'دۆزینەوەی پسووڵە'}
          </button>
        </form>

        {searchError && (
          <div style={{ marginTop: '16px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} /> {searchError}
          </div>
        )}

        {/* Display Searched Sale Information */}
        {searchedSale && (
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {/* Smart Settlement Sale Meta Card */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              background: searchedSale.payment_method === 'DEBT' 
                ? 'rgba(239, 68, 68, 0.08)' 
                : (searchedSale.payment_method === 'SPLIT' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)'), 
              padding: '16px 20px', 
              borderRadius: '16px', 
              marginBottom: '20px', 
              border: `1px solid ${searchedSale.payment_method === 'DEBT' ? 'rgba(239, 68, 68, 0.25)' : (searchedSale.payment_method === 'SPLIT' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.25)')}`,
              flexWrap: 'wrap', 
              gap: '1rem' 
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '1.2rem' }}>پسووڵەی ژمارە #{searchedSale.id}</span>
                  <span style={{ 
                    padding: '4px 12px', 
                    borderRadius: '8px', 
                    fontSize: '0.8rem', 
                    fontWeight: 'bold',
                    background: searchedSale.payment_method === 'DEBT' ? 'rgba(239, 68, 68, 0.2)' : (searchedSale.payment_method === 'SPLIT' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'),
                    color: searchedSale.payment_method === 'DEBT' ? '#ef4444' : (searchedSale.payment_method === 'SPLIT' ? '#f59e0b' : '#10b981')
                  }}>
                    {searchedSale.payment_method === 'DEBT' ? 'فرۆشراو بە قەرز 💳' : (searchedSale.payment_method === 'SPLIT' ? 'فرۆشراو بە تێکەڵ ⚖️' : 'فرۆشراو بە نەقد 💵')}
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
                  کڕیار: <strong style={{ color: 'var(--text-primary)' }}>{searchedSale.customer_name}</strong> {searchedSale.customer_phone ? `(${searchedSale.customer_phone})` : ''}
                  {searchedSale.customer_id && (
                    <span style={{ marginRight: '10px', color: '#f59e0b', fontWeight: 'bold' }}>
                      (قەرزی ئێستای کڕیار: {Number(searchedSale.customer_total_debt || 0).toLocaleString()} د.ع)
                    </span>
                  )}
                </div>
              </div>

              {/* Settlement Mode Selector & Notice */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start', background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                  شێوازی دانەوەی پارەی گەڕاوە:
                </div>
                {searchedSale.payment_method === 'SPLIT' ? (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setRefundMethod('DEBT')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        border: refundMethod === 'DEBT' ? '1px solid #ef4444' : '1px solid var(--border-color)',
                        background: refundMethod === 'DEBT' ? '#ef4444' : 'var(--bg-tertiary)',
                        color: refundMethod === 'DEBT' ? 'white' : 'var(--text-secondary)'
                      }}
                    >
                      💳 کەمکردنەوە لە قەرز (پێشنیارکراو)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefundMethod('CASH')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        border: refundMethod === 'CASH' ? '1px solid #10b981' : '1px solid var(--border-color)',
                        background: refundMethod === 'CASH' ? '#10b981' : 'var(--bg-tertiary)',
                        color: refundMethod === 'CASH' ? 'white' : 'var(--text-secondary)'
                      }}
                    >
                      💵 دانەوە بە نەقد لە سندوق
                    </button>
                  </div>
                ) : (
                  <div style={{ 
                    fontSize: '0.85rem', 
                    color: refundMethod === 'DEBT' ? '#f87171' : '#34d399',
                    fontWeight: 'bold',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px' 
                  }}>
                    {refundMethod === 'DEBT' 
                      ? '💳 ڕاستەوخۆ لە دەفتەری قەرزی کڕیار کەم دەکرێتەوە (سندوق دەستکاری ناکرێت)' 
                      : '💵 پارەی نەقد لە سندوقی کاشێر دەدرێتەوە'}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>بەرواری فرۆشتن:</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 'bold' }}>
                    {new Date(searchedSale.created_at).toLocaleDateString('ku-IQ')}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>کۆی پسووڵە:</div>
                  <div style={{ color: '#34d399', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {Number(searchedSale.total_amount || 0).toLocaleString()} دینار
                  </div>
                </div>
              </div>
            </div>

            {/* Sale Items Table for Returns */}
            <h3 style={{ fontSize: '1.05rem', marginBottom: '12px', color: 'var(--text-primary)' }}>لیستی کاڵاکانی پسووڵە بۆ گەڕاندنەوە:</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>ناوی کاڵا</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>بارکۆد</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>نرخی فرۆشتن</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>کڕدراو</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>گەڕێنراوە</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>ماوە بۆ گەڕاندنەوە</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>بڕی گەڕاندنەوە</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>هۆکار</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 700 }}>کردار</th>
                  </tr>
                </thead>
                <tbody>
                  {searchedSale.items?.map((item) => {
                    const isFullyReturned = item.returnable_qty <= 0;
                    const isProcessing = processingItemId === item.product_id;

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: isFullyReturned ? 0.6 : 1 }}>
                        <td style={{ padding: '14px 16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{item.product_name}</td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.barcode || '-'}</td>
                        <td style={{ padding: '14px 16px', color: 'var(--accent-color)', fontWeight: 'bold' }}>{Number(item.price_at_sale).toLocaleString()} د.ع</td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-primary)' }}>{item.quantity} {item.unit || 'دانە'}</td>
                        <td style={{ padding: '14px 16px', color: item.already_returned > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                          {item.already_returned} {item.unit || 'دانە'}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 'bold', color: item.returnable_qty > 0 ? '#059669' : 'var(--text-secondary)' }}>
                          {item.returnable_qty} {item.unit || 'دانە'}
                        </td>

                        {/* Input for return quantity */}
                        <td style={{ padding: '14px 16px' }}>
                          {!isFullyReturned ? (
                            <input 
                              type="number" 
                              min="0.001" 
                              max={item.returnable_qty}
                              step="any"
                              value={returnQtys[item.product_id] ?? 1}
                              onChange={(e) => setReturnQtys({ ...returnQtys, [item.product_id]: e.target.value })}
                              style={{ width: '80px', padding: '6px 10px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', textAlign: 'center', outline: 'none', fontWeight: 'bold' }}
                            />
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>تەواو گەڕاوەتەوە</span>
                          )}
                        </td>

                        {/* Return Reason */}
                        <td style={{ padding: '14px 16px' }}>
                          {!isFullyReturned ? (
                            <select 
                              value={returnReasons[item.product_id] || REASON_OPTIONS[0]}
                              onChange={(e) => setReturnReasons({ ...returnReasons, [item.product_id]: e.target.value })}
                              style={{ padding: '6px 10px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }}
                            >
                              {REASON_OPTIONS.map((opt, i) => (
                                <option key={i} value={opt} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>

                        {/* Action Button */}
                        <td style={{ padding: '14px 16px' }}>
                          {!isFullyReturned ? (
                            <button 
                              onClick={() => handleProcessReturn(item)}
                              disabled={isProcessing}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', background: '#dc2626', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                            >
                              <RotateCcw size={16} /> {isProcessing ? 'دەگەڕێتەوە...' : 'گەڕاندنەوە ↩️'}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>بێ ماوە</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Returns History Section */}
      <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', margin: 0 }}>
            <FileText size={22} color="#f43f5e" />
            مێژووی گەڕاندنەوەی کاڵاکان
          </h2>

          <input 
            type="text" 
            placeholder="گەڕان بەپێی کاڵا، بارکۆد یان پسووڵە..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            style={{ padding: '10px 16px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', width: '300px', outline: 'none' }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
            <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>#</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>بەروار</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>پسووڵە</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>شێوازی دانەوە</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>ناوی کاڵا</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>بارکۆد</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>کڕیار</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>بڕی گەڕاوە</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>پارەی دراوەتەوە</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>هۆکار</th>
                <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 700 }}>پسووڵە</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    هیچ کاڵایەکی گەڕێنراوە لە سیستەمدا نەدۆزرایەوە
                  </td>
                </tr>
              ) : (
                filteredHistory.map((ret) => (
                  <tr key={ret.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>#{ret.id}</td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {new Date(ret.created_at).toLocaleDateString('ku-IQ')} {new Date(ret.created_at).toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--accent-color)', fontWeight: 'bold' }}>
                      #{ret.sale_id}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {ret.refund_method === 'DEBT' ? (
                        <span style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          💳 لە قەرز
                        </span>
                      ) : (
                        <span style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>
                          💵 لە سندوق
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{ret.product_name}</td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{ret.barcode || '-'}</td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-primary)' }}>{ret.customer_name}</td>
                    <td style={{ padding: '14px 18px', color: '#ef4444', fontWeight: 'bold' }}>
                      {ret.quantity} {ret.unit || 'دانە'}
                    </td>
                    <td style={{ padding: '14px 18px', color: '#ef4444', fontWeight: 'bold' }}>
                      {Number(ret.refunded_amount || 0).toLocaleString()} د.ع
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{ret.reason || 'گەڕاندنەوە'}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <button 
                        onClick={() => setSelectedReceipt({
                          sale_id: ret.sale_id,
                          product_name: ret.product_name,
                          barcode: ret.barcode,
                          quantity: ret.quantity,
                          unit: ret.unit || 'دانە',
                          refunded_amount: ret.refunded_amount,
                          refund_method: ret.refund_method,
                          customer_name: ret.customer_name,
                          reason: ret.reason,
                          created_at: ret.created_at
                        })}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                      >
                        <Printer size={14} /> چاپ
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Refund Receipt Preview & Print */}
      {selectedReceipt && (
        <div className="pos-modal-overlay" onClick={() => setSelectedReceipt(null)}>
          <div className="pos-modal-card pos-modal-sm" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', margin: 0, color: '#f87171', fontWeight: 800 }}>
                <Receipt size={20} /> پسووڵەی گەڕاندنەوەی کاڵا
              </h2>
              <button onClick={() => setSelectedReceipt(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            {/* Printable Box */}
            <div id="refund-receipt-printable-area" style={{ background: '#ffffff', color: '#000000', padding: '20px 18px', borderRadius: '8px', fontFamily: 'monospace, Tahoma', fontSize: '13px', lineHeight: '1.5', direction: 'rtl' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '12px', marginBottom: '12px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>مارکێتی زیرەک</h3>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 'bold', color: '#b91c1c' }}>پسووڵەی گەڕاندنەوەی کاڵا</h4>
                <div style={{ fontSize: '12px' }}>بۆ پسووڵەی ژمارە: #{selectedReceipt.sale_id}</div>
              </div>

              <div style={{ fontSize: '11px', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}>
                <div>بەروار: {new Date(selectedReceipt.created_at).toLocaleString('ku-IQ')}</div>
                <div>کڕیار: {selectedReceipt.customer_name}</div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 'bold' }}>
                  <span>ناوی کاڵا:</span>
                  <span>{selectedReceipt.product_name}</span>
                </div>
                {selectedReceipt.barcode && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: '#555' }}>
                    <span>بارکۆد:</span>
                    <span>{selectedReceipt.barcode}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>بڕی گەڕێنراوە:</span>
                  <span>{selectedReceipt.quantity} {selectedReceipt.unit}</span>
                </div>
                {selectedReceipt.reason && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: '#555' }}>
                    <span>هۆکار:</span>
                    <span>{selectedReceipt.reason}</span>
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', color: '#000', marginBottom: '6px' }}>
                  <span>کۆی پارەی گەڕێنراوە:</span>
                  <span>{Number(selectedReceipt.refunded_amount || 0).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', color: selectedReceipt.refund_method === 'DEBT' ? '#b45309' : '#047857' }}>
                  <span>شێوازی پاکتاوکردن:</span>
                  <span>
                    {selectedReceipt.refund_method === 'DEBT' ? '💳 داشکاندن لە قەرزی کڕیار' : '💵 دانەوەی نەقد لە سندوق'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '10px', fontSize: '11px', textAlign: 'center' }}>
                <div style={{ width: '45%' }}>
                  <div>واژۆی کڕیار</div>
                  <div style={{ marginTop: '25px', borderBottom: '1px dotted #000' }}></div>
                </div>
                <div style={{ width: '45%' }}>
                  <div>واژۆی کاشێر</div>
                  <div style={{ marginTop: '25px', borderBottom: '1px dotted #000' }}></div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '10px', color: '#555' }}>
                سوپاس بۆ مامەڵەکردنتان لەگەڵ مارکێتی ئێمە
              </div>
            </div>

            {/* Print Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button 
                onClick={printReceipt}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                <Printer size={18} /> چاپکردنی پسووڵە
              </button>
              <button 
                onClick={() => setSelectedReceipt(null)}
                style={{ padding: '12px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: 'none', cursor: 'pointer' }}
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Print CSS for Refund Receipt */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          #refund-receipt-printable-area, #refund-receipt-printable-area * {
            visibility: visible !important;
          }
          #refund-receipt-printable-area {
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
            font-family: monospace, Tahoma, sans-serif !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Returns;
