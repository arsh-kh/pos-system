import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  FileText,
  ShoppingCart,
  Scan,
  Plus,
  Minus,
  Check,
  CreditCard,
  Banknote
} from 'lucide-react';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { formatDate, formatDateTime, formatCurrency } from '../utils/dateFormatter';
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

  // Active Tab: 'DIRECT' (خێرا بە بارکۆد) vs 'INVOICE' (بەپێی پسووڵە)
  const [activeTab, setActiveTab] = useState('DIRECT');

  // Products & Customers for Direct Return
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Fast Direct Return State
  const [directSearchQuery, setDirectSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [directQty, setDirectQty] = useState(1);
  const [directRefundMethod, setDirectRefundMethod] = useState('CASH');
  const [directCustomerId, setDirectCustomerId] = useState('');
  const [directReason, setDirectReason] = useState(REASON_OPTIONS[0]);
  const [isSubmittingDirect, setIsSubmittingDirect] = useState(false);
  const [directSuccessMsg, setDirectSuccessMsg] = useState('');
  const [directErrorMsg, setDirectErrorMsg] = useState('');
  const directInputRef = useRef(null);

  // Search Sale (Invoice Mode)
  const [saleIdInput, setSaleIdInput] = useState('');
  const [searchedSale, setSearchedSale] = useState(null);
  const [isSearchingSale, setIsSearchingSale] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Invoice Return Processing
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

  // Fetch initial products, customers, and history
  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      const [prodRes, custRes] = await Promise.all([
        axios.get('http://localhost:3001/api/products').catch(() => ({ data: { data: [] } })),
        axios.get('http://localhost:3001/api/customers').catch(() => ({ data: { data: [] } }))
      ]);
      setProducts(prodRes.data?.data || prodRes.data || []);
      setCustomers(custRes.data?.data || custRes.data || []);
    } catch (err) {
      console.error('Failed to load products/customers:', err);
    } finally {
      setLoadingData(false);
    }
  };

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
    loadInitialData();
    fetchReturnsHistory();
    // Focus barcode input by default
    setTimeout(() => {
      directInputRef.current?.focus();
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

  // Direct Product Filter (Search by Barcode or Name)
  const matchingProducts = useMemo(() => {
    const q = directSearchQuery.trim();
    if (!q || !products.length) return [];
    return products.filter(p => {
      const matchBarcode = p.barcode && String(p.barcode).trim().toLowerCase() === q.toLowerCase();
      const matchBoxBarcode = p.box_barcode && String(p.box_barcode).trim().toLowerCase() === q.toLowerCase();
      const matchName = kurdishSearchMatch([p.name], q);
      return matchBarcode || matchBoxBarcode || matchName;
    }).slice(0, 8);
  }, [directSearchQuery, products]);

  // Handle direct barcode search / scan auto-detect
  const handleBarcodeChange = (val) => {
    setDirectSearchQuery(val);
    setDirectErrorMsg('');
    const clean = val.trim();
    if (!clean) return;

    // Check if exact barcode matches
    const exactMatch = products.find(p => 
      (p.barcode && String(p.barcode).trim() === clean) ||
      (p.box_barcode && String(p.box_barcode).trim() === clean)
    );

    if (exactMatch) {
      setSelectedProduct(exactMatch);
      setDirectQty(1);
    }
  };

  const selectDirectProduct = (product) => {
    setSelectedProduct(product);
    setDirectQty(1);
    setDirectSearchQuery('');
    setDirectErrorMsg('');
  };

  // Submit Fast Direct Return
  const handleExecuteDirectReturn = async (e) => {
    e?.preventDefault();
    if (!selectedProduct) {
      setDirectErrorMsg('تکایە سەرەتا کاڵایەک سکان بکە یان دیاری بکە');
      return;
    }
    const qty = parseFloat(directQty);
    if (isNaN(qty) || qty <= 0) {
      setDirectErrorMsg('تکایە بڕی گەڕاندنەوە بە دروستی بنووسە');
      return;
    }

    setIsSubmittingDirect(true);
    setDirectErrorMsg('');
    setDirectSuccessMsg('');

    try {
      const unitPrice = Number(selectedProduct.selling_price || selectedProduct.price || 0);
      const res = await axios.post('http://localhost:3001/api/returns/direct', {
        product_id: selectedProduct.id,
        quantity: qty,
        reason: directReason,
        refund_method: directRefundMethod,
        customer_id: directRefundMethod === 'DEBT' ? directCustomerId || null : null,
        unit_type: 'PIECE',
        price: unitPrice
      });

      if (res.data.status === 'SUCCESS') {
        const refundAmt = res.data.data?.refunded_amount || Math.round(unitPrice * qty);
        const successText = `✓ کاڵای (${selectedProduct.name}) بە بڕی (${qty} ${selectedProduct.unit || 'دانە'}) گەڕێنرایەوە بۆ مەخزەن و ${refundAmt.toLocaleString()} د.ع درایەوە.`;
        setDirectSuccessMsg(successText);

        // Open Cash Drawer if Cash
        if (directRefundMethod === 'CASH' && window.require) {
          try {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('open-cash-drawer');
          } catch (_) {}
        }

        // Prepare Receipt
        const receiptData = {
          sale_id: `RET-${res.data.data?.return_id || Date.now().toString().slice(-4)}`,
          product_name: selectedProduct.name,
          barcode: selectedProduct.barcode,
          quantity: qty,
          unit: selectedProduct.unit || 'دانە',
          price_at_sale: unitPrice,
          refunded_amount: refundAmt,
          refund_method: directRefundMethod,
          customer_name: directRefundMethod === 'DEBT' && directCustomerId 
            ? customers.find(c => String(c.id) === String(directCustomerId))?.name || 'کڕیاری دیاریکراو' 
            : 'کڕیاری گشتی',
          reason: directReason,
          created_at: new Date().toISOString()
        };
        setSelectedReceipt(receiptData);

        // Reset inputs for next return
        setSelectedProduct(null);
        setDirectSearchQuery('');
        setDirectQty(1);

        // Refresh products stock & history
        loadInitialData();
        fetchReturnsHistory();

        // Refocus on barcode input
        setTimeout(() => directInputRef.current?.focus(), 100);
      }
    } catch (err) {
      console.error('Direct return error:', err);
      setDirectErrorMsg(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە گەڕاندنەوەی کاڵا');
    } finally {
      setIsSubmittingDirect(false);
    }
  };

  // Search Sale (Invoice Mode)
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

  const handleProcessInvoiceReturn = async (item) => {
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

        handleSearchSale();
        fetchReturnsHistory();
        loadInitialData();
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

  const currentUnitRefundPrice = Number(selectedProduct?.selling_price || selectedProduct?.price || 0);
  const calculatedDirectTotal = Math.round(currentUnitRefundPrice * (parseFloat(directQty) || 0));

  return (
    <div className="dashboard-page p-8" dir="rtl">
      {/* Header with Quick Back to Cashier Button */}
      <div className="page-header mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <RotateCcw className="text-secondary" size={30} color="#f59e0b" />
            گەڕاندنەوەی کاڵا لە کڕیار
          </h1>
          <p className="text-secondary" style={{ marginTop: '4px', fontSize: '0.88rem' }}>
            گەڕاندنەوەی کاڵا بە بارکۆد، زیادکردنەوە بۆ مەخزەن و دانەوەی پارەی کڕیار
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/cashier')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            background: 'var(--primary-color)',
            color: '#ffffff',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.95rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            transition: 'all 0.15s ease'
          }}
          title="گەڕانەوە بۆ شاشەی کاشێر (F1)"
        >
          <ShoppingCart size={18} /> گەڕانەوە بۆ کاشێر (F1)
        </button>
      </div>

      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => {
            setActiveTab('DIRECT');
            setTimeout(() => directInputRef.current?.focus(), 100);
          }}
          style={{
            flex: 1,
            padding: '12px 18px',
            borderRadius: '12px',
            border: activeTab === 'DIRECT' ? '2px solid #f59e0b' : '1px solid var(--border-color)',
            background: activeTab === 'DIRECT' ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-tertiary)',
            color: activeTab === 'DIRECT' ? '#f59e0b' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Scan size={18} /> گەڕاندنەوەی خێرا بە بارکۆد (بێ پسووڵە)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('INVOICE')}
          style={{
            flex: 1,
            padding: '12px 18px',
            borderRadius: '12px',
            border: activeTab === 'INVOICE' ? '2px solid #0284c7' : '1px solid var(--border-color)',
            background: activeTab === 'INVOICE' ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-tertiary)',
            color: activeTab === 'INVOICE' ? '#0284c7' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Receipt size={18} /> گەڕاندنەوە بەپێی ژمارەی پسووڵە
        </button>
      </div>

      {/* TAB 1: FAST DIRECT BARCODE RETURN */}
      {activeTab === 'DIRECT' && (
        <div className="glass-panel mb-8" style={{ padding: '24px', borderRadius: '18px', border: '1.5px solid rgba(245, 158, 11, 0.3)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
            <Scan size={22} color="#f59e0b" />
            سکانکردنی بارکۆد و گەڕاندنەوەی دەستبەجێ
          </h2>

          {/* Barcode Search Bar */}
          <div style={{ position: 'relative', maxWidth: '700px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  ref={directInputRef}
                  type="text"
                  value={directSearchQuery}
                  onChange={(e) => handleBarcodeChange(e.target.value)}
                  placeholder="بارکۆدی کاڵاکە سکان بکە یان ناوی کاڵا بنووسە..."
                  style={{
                    width: '100%',
                    padding: '13px 42px 13px 16px',
                    borderRadius: '12px',
                    background: 'var(--bg-secondary)',
                    border: '2px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.select()}
                />
                <Scan size={20} color="#f59e0b" style={{ position: 'absolute', right: '14px', top: '14px' }} />
              </div>

              {directSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setDirectSearchQuery('');
                    directInputRef.current?.focus();
                  }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Dropdown for Matching Products (if typed by name) */}
            {directSearchQuery && !selectedProduct && matchingProducts.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '105%',
                right: 0,
                left: 0,
                background: 'var(--bg-card)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                zIndex: 50,
                maxHeight: '260px',
                overflowY: 'auto'
              }}>
                {matchingProducts.map(p => (
                  <div
                    key={p.id}
                    onClick={() => selectDirectProduct(p)}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>بارکۆد: {p.barcode || 'بێ بارکۆد'}</div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 800, color: '#10b981' }}>{Number(p.selling_price || 0).toLocaleString()} د.ع</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>مەخزەن: {Number(p.stock || 0)} {p.unit || 'دانە'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Feedback messages */}
          {directErrorMsg && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#ef4444', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} /> {directErrorMsg}
            </div>
          )}

          {directSuccessMsg && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.14)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#10b981', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} /> {directSuccessMsg}
            </div>
          )}

          {/* Selected Product Return Form Card */}
          {selectedProduct ? (
            <form onSubmit={handleExecuteDirectReturn} style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '14px', border: '1.5px solid var(--border-color)', maxWidth: '700px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                    کاڵای دیاریکراو
                  </span>
                  <h3 style={{ margin: '6px 0 2px 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                    {selectedProduct.name}
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    بارکۆد: {selectedProduct.barcode || '—'}
                  </span>
                </div>

                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>مەخزەنی ئێستا</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {Number(selectedProduct.stock || 0)} {selectedProduct.unit || 'دانە'}
                  </div>
                </div>
              </div>

              {/* Quantity, Reason, & Refund Method Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '18px' }}>
                {/* Quantity */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    بڕی گەڕێنراوە ({selectedProduct.unit || 'دانە'}):
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setDirectQty(prev => Math.max(1, (parseFloat(prev) || 1) - 1))}
                      style={{ width: '38px', height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={directQty}
                      onChange={(e) => setDirectQty(e.target.value)}
                      style={{ flex: 1, height: '38px', textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', borderRadius: '8px', border: '1.5px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setDirectQty(prev => (parseFloat(prev) || 0) + 1)}
                      style={{ width: '38px', height: '38px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Refund Method */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    شێوازی دانەوەی پارە:
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setDirectRefundMethod('CASH')}
                      style={{
                        flex: 1,
                        height: '38px',
                        borderRadius: '8px',
                        border: directRefundMethod === 'CASH' ? '2px solid #10b981' : '1px solid var(--border-color)',
                        background: directRefundMethod === 'CASH' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)',
                        color: directRefundMethod === 'CASH' ? '#10b981' : 'var(--text-secondary)',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Banknote size={16} /> نەقد
                    </button>

                    <button
                      type="button"
                      onClick={() => setDirectRefundMethod('DEBT')}
                      style={{
                        flex: 1,
                        height: '38px',
                        borderRadius: '8px',
                        border: directRefundMethod === 'DEBT' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                        background: directRefundMethod === 'DEBT' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-tertiary)',
                        color: directRefundMethod === 'DEBT' ? '#ef4444' : 'var(--text-secondary)',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <CreditCard size={16} /> قەرز
                    </button>
                  </div>
                </div>
              </div>

              {/* If DEBT: Customer Selector */}
              {directRefundMethod === 'DEBT' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    کڕیار بۆ کەمکردنەوە لە قەرزەکەی:
                  </label>
                  <select
                    value={directCustomerId}
                    onChange={(e) => setDirectCustomerId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-tertiary)',
                      border: '1.5px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                      outline: 'none'
                    }}
                  >
                    <option value="">-- کڕیارێک هەڵبژێرە --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} - قەرز: {Number(c.total_debt || 0).toLocaleString()} د.ع
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reason */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  هۆکاری گەڕاندنەوە:
                </label>
                <select
                  value={directReason}
                  onChange={(e) => setDirectReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-tertiary)',
                    border: '1.5px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                >
                  {REASON_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Big Total Refund Banner & Submit Button */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1.5px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>کۆی پارەی گەڕاوە بە کڕیار:</span>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981' }}>
                    {calculatedDirectTotal.toLocaleString()} دینار
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProduct(null);
                      directInputRef.current?.focus();
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 700
                    }}
                  >
                    پەشیمانبوونەوە
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingDirect || calculatedDirectTotal <= 0}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      border: 'none',
                      cursor: isSubmittingDirect ? 'wait' : 'pointer',
                      fontWeight: 900,
                      fontSize: '1rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <RotateCcw size={18} />
                    {isSubmittingDirect ? 'تۆمار دەکرێت...' : 'پەسەندکردنی گەڕاندنەوە'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div style={{ padding: '30px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '14px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
              <Package size={40} style={{ opacity: 0.4, marginBottom: '8px' }} />
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>بارکۆدی کاڵاکە سکان بکە یان لە سەرەوە ناوی بنووسە</div>
              <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>دەستبەجێ زانیاری کاڵاکە و کۆگاکەت پیشان دەدات</div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RETURN BY INVOICE ID */}
      {activeTab === 'INVOICE' && (
        <div className="glass-panel mb-8" style={{ padding: '24px', borderRadius: '18px', border: '1.5px solid rgba(2, 132, 199, 0.3)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
            <Search size={22} color="#0284c7" />
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
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: '#0284c7', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              <Search size={18} /> {isSearchingSale ? 'دەگەڕێت...' : 'دۆزینەوەی پسووڵە'}
            </button>
          </form>

          {searchError && (
            <div style={{ marginTop: '16px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} /> {searchError}
            </div>
          )}

          {/* Searched Sale Items */}
          {searchedSale && (
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                background: searchedSale.payment_method === 'DEBT' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)', 
                padding: '16px 20px', 
                borderRadius: '14px', 
                marginBottom: '20px', 
                border: `1px solid ${searchedSale.payment_method === 'DEBT' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                flexWrap: 'wrap', 
                gap: '1rem' 
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: '#0284c7', fontWeight: 'bold', fontSize: '1.2rem' }}>پسووڵەی ژمارە #{searchedSale.id}</span>
                    <span style={{ 
                      padding: '4px 12px', 
                      borderRadius: '8px', 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold',
                      background: searchedSale.payment_method === 'DEBT' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: searchedSale.payment_method === 'DEBT' ? '#ef4444' : '#10b981'
                    }}>
                      {searchedSale.payment_method === 'DEBT' ? 'قەرز' : 'نەقد'}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
                    کڕیار: <strong style={{ color: 'var(--text-primary)' }}>{searchedSale.customer_name}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setRefundMethod('CASH')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: refundMethod === 'CASH' ? '2px solid #10b981' : '1px solid var(--border-color)',
                      background: refundMethod === 'CASH' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-tertiary)',
                      color: refundMethod === 'CASH' ? '#10b981' : 'var(--text-secondary)'
                    }}
                  >
                    💵 دانەوەی نەقد
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundMethod('DEBT')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: refundMethod === 'DEBT' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                      background: refundMethod === 'DEBT' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-tertiary)',
                      color: refundMethod === 'DEBT' ? '#ef4444' : 'var(--text-secondary)'
                    }}
                  >
                    💳 کەمکردنەوە لە قەرز
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div className="table-responsive">
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '12px 16px' }}>ناوی کاڵا</th>
                      <th style={{ padding: '12px 16px' }}>فرۆشراو</th>
                      <th style={{ padding: '12px 16px' }}>ماوە بۆ گەڕاندنەوە</th>
                      <th style={{ padding: '12px 16px' }}>بڕی گەڕاندنەوە</th>
                      <th style={{ padding: '12px 16px' }}>کردار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchedSale.items?.map(it => (
                      <tr key={it.product_id}>
                        <td style={{ padding: '14px 16px', fontWeight: 800 }}>
                          {it.product_name}
                          {it.has_discount && (
                            <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>
                              ({Number(it.effective_unit_price).toLocaleString()} د.ع بە داشکاندنەوە)
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>{it.quantity} {it.unit || 'دانە'}</td>
                        <td style={{ padding: '14px 16px', color: '#10b981', fontWeight: 800 }}>{it.returnable_qty} {it.unit || 'دانە'}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <input
                            type="number"
                            min="1"
                            max={it.returnable_qty}
                            value={returnQtys[it.product_id] || ''}
                            onChange={(e) => setReturnQtys(prev => ({ ...prev, [it.product_id]: e.target.value }))}
                            disabled={it.returnable_qty <= 0}
                            style={{ width: '70px', padding: '6px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                          />
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button
                            type="button"
                            onClick={() => handleProcessInvoiceReturn(it)}
                            disabled={it.returnable_qty <= 0 || processingItemId === it.product_id}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '8px',
                              background: it.returnable_qty > 0 ? '#f59e0b' : 'var(--bg-tertiary)',
                              color: it.returnable_qty > 0 ? '#ffffff' : 'var(--text-muted)',
                              border: 'none',
                              fontWeight: 800,
                              cursor: it.returnable_qty > 0 ? 'pointer' : 'not-allowed',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <RotateCcw size={14} />
                            {processingItemId === it.product_id ? 'دەگەڕێتەوە...' : 'گەڕاندنەوە'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="stats-grid mb-8">
        <div className="stat-card glass-panel" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
          <h3>کۆی پارەی دراوەتەوە بە کڕیار</h3>
          <div className="value" style={{ color: '#f87171' }}>
            {totalRefundedAmount.toLocaleString()} دینار
          </div>
          <div className="sub-text">کۆی گشتی پارەی گەڕێنراوە</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
          <h3>گەڕێنراوەی ئەمڕۆ</h3>
          <div className="value" style={{ color: '#fbbf24' }}>
            {todayRefundedAmount.toLocaleString()} دینار
          </div>
          <div className="sub-text">پارەی گەڕێنراوە لە بەرواری ئەمڕۆ</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.25)' }}>
          <h3>کۆی ژمارەی کاڵا گەڕاوەکان</h3>
          <div className="value" style={{ color: '#60a5fa' }}>
            {totalReturnedQty.toLocaleString()} دانە
          </div>
          <div className="sub-text">زیادکراوەتەوە سەر باڵانسی مەخزەن</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
          <h3>ژمارەی گەڕاندنەوەکان</h3>
          <div className="value" style={{ color: '#34d399' }}>
            {returnsHistory.length} کرداری گەڕاندنەوە
          </div>
          <div className="sub-text">تۆمارکراو لە سیستەمدا</div>
        </div>
      </div>

      {/* Returns History Table */}
      <div className="glass-panel" style={{ padding: '24px', borderRadius: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', margin: 0 }}>
            <FileText size={22} color="#10b981" />
            مێژووی گەڕاندنەوەی کاڵاکان
          </h2>

          <div style={{ position: 'relative', width: '300px' }}>
            <input 
              type="text" 
              placeholder="گەڕان بەدوای کاڵا، بارکۆد، کڕیار..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              style={{ width: '100%', padding: '10px 38px 10px 14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', right: '12px', top: '12px' }} />
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ padding: '14px 18px' }}>#</th>
                <th style={{ padding: '14px 18px' }}>ناوی کاڵا</th>
                <th style={{ padding: '14px 18px' }}>بڕ</th>
                <th style={{ padding: '14px 18px' }}>پارەی دراوەتەوە</th>
                <th style={{ padding: '14px 18px' }}>شێوازی دانەوە</th>
                <th style={{ padding: '14px 18px' }}>کڕیار</th>
                <th style={{ padding: '14px 18px' }}>هۆکار</th>
                <th style={{ padding: '14px 18px' }}>بەروار و کات</th>
                <th style={{ padding: '14px 18px' }}>چاپکردن</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>چاوەڕێبە... داتاکان باردەکرێن</td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    هیچ تۆمارێکی گەڕاندنەوە نەدۆزرایەوە.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((ret) => (
                  <tr key={ret.id}>
                    <td style={{ padding: '14px 18px', fontWeight: 'bold', color: 'var(--accent-color)' }}>#{ret.id}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 'bold' }}>{ret.product_name}</td>
                    <td style={{ padding: '14px 18px' }}>{ret.quantity} {ret.unit || 'دانە'}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 'bold', color: '#f87171' }}>
                      {Number(ret.refunded_amount).toLocaleString()} دینار
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '6px', 
                        fontSize: '0.8rem', 
                        fontWeight: 'bold',
                        background: ret.refund_method === 'DEBT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: ret.refund_method === 'DEBT' ? '#ef4444' : '#10b981'
                      }}>
                        {ret.refund_method === 'DEBT' ? '💳 قەرز' : '💵 نەقد'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>{ret.customer_name || 'کڕیاری گشتی'}</td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{ret.reason || 'گەڕاندنەوە'}</td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {formatDateTime(ret.created_at, { twelveHour: true })}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(ret)}
                        title="چاپکردنەوەی وەسڵی گەڕاندنەوە"
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: 'rgba(56, 189, 248, 0.12)',
                          color: '#0284c7',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 700
                        }}
                      >
                        <Printer size={13} /> وەسڵ
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
                <Receipt size={20} /> وەسڵی گەڕاندنەوەی کاڵا
              </h2>
              <button onClick={() => setSelectedReceipt(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <div id="refund-receipt-printable-area" style={{ background: '#ffffff', color: '#000000', padding: '20px 18px', borderRadius: '8px', fontFamily: 'monospace, Tahoma', fontSize: '13px', lineHeight: '1.5', direction: 'rtl' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '12px', marginBottom: '12px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>
                  {localStorage.getItem('pos_store_name') || 'مارکێتی شارەکەم'}
                </h3>
                <div style={{ textAlign: 'center', fontSize: '11px', color: '#555', marginBottom: '4px' }}>
                  پەیوەندی: {localStorage.getItem('pos_store_phone') || '0770 000 0000'}
                </div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 'bold', color: '#b91c1c' }}>وەسڵی گەڕاندنەوەی کاڵا</h4>
                <div style={{ fontSize: '12px' }}>ژمارەی مامەڵە: #{selectedReceipt.sale_id || selectedReceipt.id}</div>
              </div>

              <div style={{ fontSize: '11px', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}>
                <div>بەروار: {formatDateTime(selectedReceipt.created_at, { twelveHour: true })}</div>
                <div>کڕیار: {selectedReceipt.customer_name || 'کڕیاری گشتی'}</div>
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
                  <span>{selectedReceipt.quantity} {selectedReceipt.unit || 'دانە'}</span>
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
                سوپاس بۆ مامەڵەکردنتان
              </div>
            </div>

            {/* Print Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button 
                type="button"
                onClick={printReceipt}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                <Printer size={18} /> چاپکردنی وەسڵ
              </button>
              <button 
                type="button"
                onClick={() => setSelectedReceipt(null)}
                style={{ padding: '12px 20px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 700 }}
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
