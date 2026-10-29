import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { formatDate, formatDateTime } from '../utils/dateFormatter';
import './Dashboard.css';

const REASON_OPTIONS = [
  'خواستی کڕیار',
  'کاڵای هەڵە / نەخواستراو',
  'کاڵای تێکچوو یان کەموکوڕی دار',
  'بەرواری بەسەرچوون',
  'هۆکاری تر'
];

const Returns = () => {
  const navigate = useNavigate();

  // Search Sale State (By Invoice ID only)
  const [saleIdInput, setSaleIdInput] = useState('');
  const [searchedSale, setSearchedSale] = useState(null);
  const [isSearchingSale, setIsSearchingSale] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Invoice Return Processing State
  const [returnQtys, setReturnQtys] = useState({});
  const [returnReasons, setReturnReasons] = useState({});
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [processingItemId, setProcessingItemId] = useState(null);

  // History & Stats State
  const [returnsHistory, setReturnsHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historySearch, setHistorySearch] = useState('');

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const saleInputRef = useRef(null);

  const fetchReturnsHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await axios.get('http://localhost:3001/api/returns');
      if (res.data?.status === 'SUCCESS') {
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
    setTimeout(() => {
      saleInputRef.current?.focus();
    }, 150);
  }, []);

  // Keyboard shortcut: F1 or Escape to return to cashier
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1' || (e.key === 'Escape' && !selectedReceipt)) {
        e.preventDefault();
        navigate('/cashier');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedReceipt, navigate]);

  // Search Sale by Invoice ID (Supports manual typing or Barcode Scanner)
  const handleSearchSale = async (e) => {
    e?.preventDefault();
    const raw = saleIdInput.trim();
    let cleanId = raw;
    if (/shrm\/\d+\//i.test(cleanId)) {
      const parts = cleanId.split('/');
      const lastPart = parts[parts.length - 1];
      cleanId = String(parseInt(lastPart, 10) || '');
    } else {
      cleanId = cleanId.replace(/[^0-9]/g, '');
    }
    if (!cleanId) return;

    setIsSearchingSale(true);
    setSearchError('');
    setSearchedSale(null);

    try {
      const res = await axios.get(`http://localhost:3001/api/returns/sale/${cleanId}`);
      if (res.data?.status === 'SUCCESS') {
        setSearchedSale(res.data.data);
        setSaleIdInput(String(res.data.data.id));
        setRefundMethod(res.data.data.recommended_refund_method || 'CASH');
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

  // Process Item Return
  const handleProcessInvoiceReturn = async (item) => {
    const qtyToReturn = parseFloat(returnQtys[item.product_id]) || 0;
    if (qtyToReturn <= 0) {
      return alert('تکایە بڕی گەڕاندنەوەی دروست بنووسە');
    }
    if (qtyToReturn > item.returnable_qty) {
      return alert(`بڕی گەڕاندنەوە ناتوانێت لە ${item.returnable_qty} زیاتر بێت`);
    }

    const reason = returnReasons[item.product_id] || 'خواستی کڕیار';

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

      if (res.data?.status === 'SUCCESS') {
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

        // Refresh sale data to update remaining returnable quantities
        handleSearchSale();
        fetchReturnsHistory();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی گەڕاندنەوەی کاڵا');
    } finally {
      setProcessingItemId(null);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  // Compact Stats
  const totalRefundedAmount = useMemo(() => {
    return returnsHistory.reduce((sum, r) => sum + (Number(r.refunded_amount) || 0), 0);
  }, [returnsHistory]);

  const totalReturnedQty = useMemo(() => {
    return returnsHistory.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  }, [returnsHistory]);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRefundedAmount = useMemo(() => {
    return returnsHistory
      .filter(r => r.created_at?.startsWith(todayStr))
      .reduce((sum, r) => sum + (Number(r.refunded_amount) || 0), 0);
  }, [returnsHistory, todayStr]);

  // Filtered History
  const filteredHistory = returnsHistory;

  return (
    <div className="dashboard-page p-6" dir="rtl" style={{ background: '#f8fafc', minHeight: '100vh' }}>
      
      {/* Search Invoice & Stats Section: Unified Header */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '14px 18px',
        marginBottom: '16px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Right: Search Invoice Input + Find Button */}
          <form onSubmit={handleSearchSale} style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: '1 1 360px', maxWidth: '460px' }}>
            <input 
              ref={saleInputRef}
              type="text" 
              placeholder="ژمارەی پسووڵە یان باڕکۆد..."
              value={saleIdInput}
              onChange={(e) => setSaleIdInput(e.target.value)}
              style={{
                flex: 1,
                height: '38px',
                padding: '0 12px',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                fontSize: '0.88rem',
                fontWeight: 600,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <button 
              type="submit" 
              disabled={isSearchingSale || !saleIdInput.trim()}
              style={{
                height: '38px',
                padding: '0 18px',
                borderRadius: '6px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                cursor: isSearchingSale ? 'wait' : 'pointer',
                fontWeight: 700,
                fontSize: '0.86rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {isSearchingSale ? 'دەگەڕێت...' : 'دۆزینەوەی پسووڵە'}
            </button>
          </form>

          {/* Left / Beside Button: KPI Stat Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{
              height: '36px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              color: '#475569',
              whiteSpace: 'nowrap'
            }}>
              <span>کۆی گەڕێنراوە:</span>
              <strong style={{ color: '#ef4444', fontWeight: 700 }}>
                {totalRefundedAmount.toLocaleString()} د.ع
              </strong>
            </div>

            <div style={{
              height: '36px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              color: '#475569',
              whiteSpace: 'nowrap'
            }}>
              <span>گەڕێنراوەی ئەمڕۆ:</span>
              <strong style={{ color: '#b45309', fontWeight: 700 }}>
                {todayRefundedAmount.toLocaleString()} د.ع
              </strong>
            </div>

            <div style={{
              height: '36px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              color: '#475569',
              whiteSpace: 'nowrap'
            }}>
              <span>کۆی کاڵا:</span>
              <strong style={{ color: '#0284c7', fontWeight: 700 }}>
                {totalReturnedQty.toLocaleString()} دانە
              </strong>
            </div>


          </div>
        </div>

        {searchError && (
          <div style={{ marginTop: '10px', color: '#ef4444', fontSize: '0.86rem', fontWeight: 700 }}>
            {searchError}
          </div>
        )}

        {/* Found Sale Invoice Details & Returnable Items */}
        {searchedSale && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
            
            {/* Invoice Meta Bar: Clean, Single Line */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '0.86rem' }}>
                <div>
                  <span style={{ color: '#64748b' }}>ژمارەی پسووڵە: </span>
                  <b style={{ color: '#0284c7', fontFamily: 'monospace' }}>#{searchedSale.id}</b>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>کڕیار: </span>
                  <b style={{ color: '#0f172a' }}>{searchedSale.customer_name}</b>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>بەروار: </span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{formatDate(searchedSale.created_at)}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>شێوازی فرۆشتن: </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: searchedSale.payment_method === 'DEBT' ? '#fef2f2' : '#f0fdf4',
                    color: searchedSale.payment_method === 'DEBT' ? '#ef4444' : '#16a34a'
                  }}>
                    {searchedSale.payment_method === 'DEBT' ? 'قەرز' : 'نەقد'}
                  </span>
                </div>
              </div>

              {/* Refund Method Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 700 }}>شێوازی دانەوەی پارە:</span>
                <button
                  type="button"
                  onClick={() => setRefundMethod('CASH')}
                  style={{
                    height: '30px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    border: refundMethod === 'CASH' ? '1.5px solid #10b981' : '1px solid #cbd5e1',
                    background: refundMethod === 'CASH' ? '#f0fdf4' : '#ffffff',
                    color: refundMethod === 'CASH' ? '#16a34a' : '#475569'
                  }}
                >
                  دانەوەی نەقد
                </button>
                <button
                  type="button"
                  onClick={() => setRefundMethod('DEBT')}
                  disabled={!searchedSale.customer_id}
                  style={{
                    height: '30px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: !searchedSale.customer_id ? 'not-allowed' : 'pointer',
                    opacity: !searchedSale.customer_id ? 0.45 : 1,
                    border: refundMethod === 'DEBT' ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                    background: refundMethod === 'DEBT' ? '#fef2f2' : '#ffffff',
                    color: refundMethod === 'DEBT' ? '#ef4444' : '#475569'
                  }}
                  title={!searchedSale.customer_id ? 'ئەم پسووڵەیە هی کڕیاری دیاریکراو نییە' : ''}
                >
                  کەمکردنەوە لە قەرز
                </button>
              </div>
            </div>

            {/* Sale Items Table */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ height: '36px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '0 14px', textAlign: 'right' }}>ناوی کاڵا</th>
                    <th style={{ padding: '0 10px', textAlign: 'center' }}>بارکۆد</th>
                    <th style={{ padding: '0 10px', textAlign: 'center' }}>بڕی فرۆشراو</th>
                    <th style={{ padding: '0 10px', textAlign: 'center' }}>ماوە بۆ گەڕاندنەوە</th>
                    <th style={{ padding: '0 10px', textAlign: 'center' }}>نرخی فرۆشتن</th>
                    <th style={{ padding: '0 10px', textAlign: 'center' }}>بڕی گەڕاندنەوە</th>
                    <th style={{ padding: '0 10px', textAlign: 'center' }}>هۆکاری گەڕاندنەوە</th>
                    <th style={{ padding: '0 14px', textAlign: 'left' }}>کردار</th>
                  </tr>
                </thead>
                <tbody>
                  {!searchedSale.items || searchedSale.items.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ height: '40px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                        هیچ کاڵایەک نەدۆزرایەوە
                      </td>
                    </tr>
                  ) : (
                    searchedSale.items.map((it) => {
                      const isReturnable = it.returnable_qty > 0;
                      return (
                        <tr 
                          key={it.product_id}
                          style={{ height: '40px', borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s ease' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '0 14px', fontWeight: 700, color: '#1e293b', fontSize: '0.86rem' }}>
                            {it.product_name}
                          </td>
                          <td style={{ padding: '0 10px', textAlign: 'center', fontFamily: 'monospace', color: '#64748b', fontSize: '0.82rem' }}>
                            {it.barcode || '—'}
                          </td>
                          <td style={{ padding: '0 10px', textAlign: 'center', color: '#475569', fontSize: '0.84rem' }}>
                            {it.quantity} {it.unit || 'دانە'}
                          </td>
                          <td style={{ padding: '0 10px', textAlign: 'center', fontWeight: 700, color: isReturnable ? '#10b981' : '#94a3b8', fontSize: '0.86rem' }}>
                            {isReturnable ? `${it.returnable_qty} ${it.unit || 'دانە'}` : 'تەواوی بڕەکەی گەڕاوەتەوە'}
                          </td>
                          <td style={{ padding: '0 10px', textAlign: 'center', fontWeight: 700, color: '#0f172a', fontSize: '0.86rem' }}>
                            {Number(it.effective_unit_price || it.price_at_sale).toLocaleString()} د.ع
                          </td>
                          <td style={{ padding: '0 10px', textAlign: 'center' }}>
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              max={it.returnable_qty}
                              value={returnQtys[it.product_id] || ''}
                              onChange={(e) => setReturnQtys(prev => ({ ...prev, [it.product_id]: e.target.value }))}
                              disabled={!isReturnable}
                              style={{
                                width: '70px',
                                height: '28px',
                                padding: '0 6px',
                                borderRadius: '4px',
                                textAlign: 'center',
                                border: '1px solid #cbd5e1',
                                background: isReturnable ? '#ffffff' : '#f1f5f9',
                                color: '#0f172a',
                                fontWeight: 700,
                                fontSize: '0.84rem',
                                outline: 'none'
                              }}
                            />
                          </td>
                          <td style={{ padding: '0 10px', textAlign: 'center' }}>
                            <select
                              value={returnReasons[it.product_id] || REASON_OPTIONS[0]}
                              onChange={(e) => setReturnReasons(prev => ({ ...prev, [it.product_id]: e.target.value }))}
                              disabled={!isReturnable}
                              style={{
                                height: '28px',
                                padding: '0 6px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                background: isReturnable ? '#ffffff' : '#f1f5f9',
                                color: '#0f172a',
                                fontSize: '0.80rem',
                                fontWeight: 600,
                                outline: 'none'
                              }}
                            >
                              {REASON_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '0 14px', textAlign: 'left' }}>
                            <button
                              type="button"
                              onClick={() => handleProcessInvoiceReturn(it)}
                              disabled={!isReturnable || processingItemId === it.product_id}
                              style={{
                                height: '28px',
                                padding: '0 14px',
                                borderRadius: '4px',
                                background: isReturnable ? '#0284c7' : '#f1f5f9',
                                color: isReturnable ? '#ffffff' : '#94a3b8',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                cursor: isReturnable ? 'pointer' : 'not-allowed',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {processingItemId === it.product_id ? 'چاوەڕێبە...' : 'گەڕاندنەوە'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>

      {/* Returns History Table: Clean Data Grid */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '16px 20px',
        overflow: 'hidden'
      }}>
        <div style={{ marginBottom: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
            مێژووی گەڕاندنەوەکان
          </h2>
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ height: '36px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0 12px', textAlign: 'center', width: '40px' }}>#</th>
                <th style={{ padding: '0 10px', textAlign: 'center', width: '90px' }}>ژمارەی پسووڵە</th>
                <th style={{ padding: '0 12px', textAlign: 'right' }}>ناوی کاڵا</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>بڕ</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>پارەی گەڕاوە</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>شێوازی دانەوە</th>
                <th style={{ padding: '0 12px', textAlign: 'right' }}>کڕیار</th>
                <th style={{ padding: '0 12px', textAlign: 'right' }}>هۆکار</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>بەروار</th>
                <th style={{ padding: '0 14px', textAlign: 'left', width: '80px' }}>چاپکردن</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td colSpan="10" style={{ height: '40px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                    باردەکرێت...
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ height: '40px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                    هیچ تۆمارێکی گەڕاندنەوە نەدۆزرایەوە
                  </td>
                </tr>
              ) : (
                filteredHistory.map((ret) => (
                  <tr 
                    key={ret.id}
                    style={{ height: '38px', borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s ease' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0 12px', textAlign: 'center', color: '#64748b', fontSize: '0.80rem' }}>
                      {ret.id}
                    </td>
                    <td style={{ padding: '0 10px', textAlign: 'center', fontFamily: 'monospace', color: '#0284c7', fontWeight: 700, fontSize: '0.82rem' }}>
                      #{ret.sale_id}
                    </td>
                    <td style={{ padding: '0 12px', fontWeight: 700, color: '#1e293b', fontSize: '0.86rem' }}>
                      {ret.product_name}
                    </td>
                    <td style={{ padding: '0 10px', textAlign: 'center', color: '#475569', fontSize: '0.84rem' }}>
                      {ret.quantity} {ret.unit || 'دانە'}
                    </td>
                    <td style={{ padding: '0 10px', textAlign: 'center', fontWeight: 700, color: '#ef4444', fontSize: '0.86rem' }}>
                      {Number(ret.refunded_amount).toLocaleString()} د.ع
                    </td>
                    <td style={{ padding: '0 10px', textAlign: 'center', fontSize: '0.80rem' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        background: ret.refund_method === 'DEBT' ? '#fef2f2' : '#f0fdf4',
                        color: ret.refund_method === 'DEBT' ? '#ef4444' : '#16a34a'
                      }}>
                        {ret.refund_method === 'DEBT' ? 'قەرز' : 'نەقد'}
                      </span>
                    </td>
                    <td style={{ padding: '0 12px', color: '#334155', fontSize: '0.84rem' }}>
                      {ret.customer_name || 'کڕیاری گشتی'}
                    </td>
                    <td style={{ padding: '0 12px', color: '#64748b', fontSize: '0.82rem' }}>
                      {ret.reason || 'گەڕاندنەوە'}
                    </td>
                    <td style={{ padding: '0 10px', textAlign: 'center', color: '#64748b', fontSize: '0.80rem' }}>
                      {formatDateTime(ret.created_at, { twelveHour: true })}
                    </td>
                    <td style={{ padding: '0 14px', textAlign: 'left' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(ret)}
                        style={{
                          height: '26px',
                          padding: '0 10px',
                          borderRadius: '4px',
                          background: '#ffffff',
                          color: '#0284c7',
                          border: '1px solid #cbd5e1',
                          cursor: 'pointer',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.borderColor = '#93c5fd'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                      >
                        وەسڵ
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
          <div 
            className="pos-modal-card" 
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '380px',
              width: '92%',
              padding: '16px',
              borderRadius: '12px',
              background: '#ffffff',
              direction: 'rtl',
              border: '1px solid #cbd5e1',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                وەسڵی گەڕاندنەوەی کاڵا
              </h3>
              <button 
                type="button"
                onClick={() => setSelectedReceipt(null)} 
                style={{ 
                  background: '#f1f5f9', 
                  border: '1px solid #cbd5e1', 
                  color: '#64748b', 
                  cursor: 'pointer', 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '6px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '16px', 
                  fontWeight: 700 
                }}
              >
                ×
              </button>
            </div>

            <div id="refund-receipt-printable-area" style={{ background: '#ffffff', color: '#000000', padding: '12px 10px', borderRadius: '6px', fontFamily: 'monospace, Tahoma', fontSize: '12px', lineHeight: '1.4', direction: 'rtl' }}>
              <div style={{ textAlign: 'center', borderBottom: '1.5px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
                <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: 'bold' }}>
                  {localStorage.getItem('pos_store_name') || 'مارکێتی شارەکەم'}
                </h4>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#b91c1c' }}>وەسڵی گەڕاندنەوەی کاڵا</div>
                <div style={{ fontSize: '11px' }}>ژمارەی پسووڵە: #{selectedReceipt.sale_id || selectedReceipt.id}</div>
              </div>

              <div style={{ fontSize: '11px', marginBottom: '8px', borderBottom: '1px solid #ddd', paddingBottom: '6px' }}>
                <div>بەروار: {formatDateTime(selectedReceipt.created_at, { twelveHour: true })}</div>
                <div>کڕیار: {selectedReceipt.customer_name || 'کڕیاری گشتی'}</div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontWeight: 'bold' }}>
                  <span>ناوی کاڵا:</span>
                  <span>{selectedReceipt.product_name}</span>
                </div>
                {selectedReceipt.barcode && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '11px', color: '#555' }}>
                    <span>بارکۆد:</span>
                    <span>{selectedReceipt.barcode}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span>بڕی گەڕێنراوە:</span>
                  <span>{selectedReceipt.quantity} {selectedReceipt.unit || 'دانە'}</span>
                </div>
                {selectedReceipt.reason && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '11px', color: '#555' }}>
                    <span>هۆکار:</span>
                    <span>{selectedReceipt.reason}</span>
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '1.5px dashed #000', paddingBottom: '8px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', color: '#000', marginBottom: '4px' }}>
                  <span>کۆی پارەی گەڕێنراوە:</span>
                  <span>{Number(selectedReceipt.refunded_amount || 0).toLocaleString()} د.ع</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
                  <span>شێوازی دانەوە:</span>
                  <span>
                    {selectedReceipt.refund_method === 'DEBT' ? 'داشکاندن لە قەرز' : 'دانەوەی نەقد لە سندوق'}
                  </span>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '10px', color: '#777' }}>
                سوپاس بۆ مامەڵەکردنتان
              </div>
            </div>

            {/* Print & Close Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button 
                type="button"
                onClick={printReceipt}
                style={{
                  flex: 1,
                  height: '36px',
                  borderRadius: '6px',
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.84rem'
                }}
              >
                چاپکردنی وەسڵ
              </button>
              <button 
                type="button"
                onClick={() => setSelectedReceipt(null)}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '6px',
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.84rem'
                }}
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
