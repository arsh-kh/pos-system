import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { normalizeBarcode } from '../utils/barcodeNormalizer';
import { formatDate } from '../utils/dateFormatter';
import './Dashboard.css';

const Purchases = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Invoice Header State
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(() => `INV-${Date.now().toString().slice(-6)}`);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // CASH, DEBT, PARTIAL
  const [paidAmount, setPaidAmount] = useState('');
  const [additionalCost, setAdditionalCost] = useState('');

  // Invoice Items State
  const [items, setItems] = useState([]);

  // Barcode Scanner & Search State
  const [scanBarcode, setScanBarcode] = useState('');
  const scanInputRef = useRef(null);
  const [productSearch, setProductSearch] = useState('');

  // Quick Add Product Modal State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickProductData, setQuickProductData] = useState({
    name: '',
    barcode: '',
    cost_price: '',
    selling_price: '',
    category_id: ''
  });

  // Printable Invoice Voucher State
  const [printedInvoice, setPrintedInvoice] = useState(null);
  const storeName = localStorage.getItem('pos_store_name') || 'مارکێتی شارەکەم';
  const storePhone = localStorage.getItem('pos_store_phone') || '';

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    return products.filter(p => kurdishSearchMatch([p.name, p.barcode, p.box_barcode], productSearch)).slice(0, 10);
  }, [products, productSearch]);

  const getAuthConfig = () => {
    const token = localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  const fetchData = async () => {
    try {
      const config = getAuthConfig();
      const [supRes, prodRes, catRes] = await Promise.all([
        axios.get('http://localhost:3001/api/suppliers'),
        axios.get('http://localhost:3001/api/products', config),
        axios.get('http://localhost:3001/api/categories', config)
      ]);
      if (supRes.data.status === 'SUCCESS') setSuppliers(supRes.data.data);
      if (prodRes.data.status === 'SUCCESS') setProducts(prodRes.data.data);
      if (catRes.data.status === 'SUCCESS') setCategories(catRes.data.data);
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleProcessBarcode = (code) => {
    if (!code) return;
    const cleanCode = normalizeBarcode(code).trim();
    const existing = products.find(p => p.barcode === cleanCode || p.box_barcode === cleanCode);

    if (existing) {
      setItems(prevItems => {
        const itemIdx = prevItems.findIndex(i => i.product_id === existing.id);
        if (itemIdx >= 0) {
          const updated = [...prevItems];
          const newQty = (parseInt(updated[itemIdx].quantity) || 0) + 1;
          updated[itemIdx].quantity = newQty.toString();
          return updated;
        } else {
          return [
            ...prevItems,
            {
              product_id: existing.id,
              name: existing.name,
              barcode: existing.barcode,
              quantity: '1',
              cost_price: existing.cost_price || 0,
              selling_price: existing.selling_price || 0,
              stock_before: existing.stock || 0
            }
          ];
        }
      });
    } else {
      setQuickProductData({
        name: '',
        barcode: cleanCode,
        cost_price: '',
        selling_price: '',
        category_id: categories[0]?.id || ''
      });
      setIsQuickAddOpen(true);
    }
    setScanBarcode('');
    scanInputRef.current?.focus();
  };

  useBarcodeScanner((scannedCode) => {
    handleProcessBarcode(scannedCode);
  });

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (scanBarcode) {
      handleProcessBarcode(scanBarcode);
    }
  };

  const handleQuickAddProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const config = getAuthConfig();
      const payload = {
        name: quickProductData.name,
        barcode: quickProductData.barcode,
        cost_price: Number(quickProductData.cost_price) || 0,
        selling_price: Number(quickProductData.selling_price) || 0,
        stock: 0,
        category_id: quickProductData.category_id || null
      };

      const res = await axios.post('http://localhost:3001/api/products', payload, config);
      if (res.data.status === 'SUCCESS' || res.status === 201) {
        const newProd = res.data.data;
        setItems(prev => [
          ...prev,
          {
            product_id: newProd.id,
            name: newProd.name,
            barcode: newProd.barcode,
            quantity: '1',
            cost_price: newProd.cost_price,
            selling_price: newProd.selling_price,
            stock_before: 0
          }
        ]);

        const refreshed = await axios.get('http://localhost:3001/api/products', config);
        if (refreshed.data.status === 'SUCCESS') setProducts(refreshed.data.data);

        setIsQuickAddOpen(false);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە زیادکردنی کاڵاکە');
    }
  };

  const updateItem = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const { 
    itemsSubtotal, 
    effectiveAdditionalCost, 
    totalInvoiceCost, 
    totalSalesValue, 
    totalProfit, 
    totalQty,
    itemsWithLandedCost 
  } = useMemo(() => {
    let cost = 0;
    let sales = 0;
    let qtySum = 0;

    items.forEach(item => {
      const q = Math.max(0, parseInt(item.quantity) || 0);
      const cp = Math.max(0, Number(item.cost_price) || 0);
      const sp = Math.max(0, Number(item.selling_price) || 0);

      cost += cp * q;
      sales += sp * q;
      qtySum += q;
    });

    const addCost = Math.max(0, Math.round(Number(additionalCost) || 0));
    const grandTotal = cost + addCost;

    let remainingAdd = addCost;
    const itemsWithLanded = items.map((item, idx) => {
      const q = Math.max(1, parseInt(item.quantity) || 1);
      const cp = Math.max(0, Number(item.cost_price) || 0);
      const lineSub = cp * q;

      let allocated = 0;
      if (addCost > 0 && cost > 0) {
        if (idx === items.length - 1) {
          allocated = remainingAdd;
        } else {
          allocated = Math.round((addCost * lineSub) / cost);
          remainingAdd -= allocated;
        }
      }
      const perUnitAdd = Math.round(allocated / q);
      const landedUnitCost = cp + perUnitAdd;

      return {
        ...item,
        allocatedCost: allocated,
        perUnitAdd,
        landedUnitCost
      };
    });

    return {
      itemsSubtotal: cost,
      effectiveAdditionalCost: addCost,
      totalInvoiceCost: grandTotal,
      totalSalesValue: sales,
      totalProfit: sales - grandTotal,
      totalQty: qtySum,
      itemsWithLandedCost: itemsWithLanded
    };
  }, [items, additionalCost]);

  useEffect(() => {
    if (paymentMethod === 'CASH') {
      setPaidAmount(totalInvoiceCost.toString());
    } else if (paymentMethod === 'DEBT') {
      setPaidAmount('0');
    }
  }, [paymentMethod, totalInvoiceCost]);

  const effectivePaid = paymentMethod === 'CASH' 
    ? totalInvoiceCost 
    : (paymentMethod === 'DEBT' ? 0 : (Number(paidAmount) || 0));
  const totalRemaining = Math.max(0, totalInvoiceCost - effectivePaid);

  const handleSaveInvoice = async (andPrint = false) => {
    if (!supplierId && (paymentMethod === 'DEBT' || totalRemaining > 0)) {
      return alert('کڕین بە قەرز پێویستی بە دیاریکردنی کۆمپانیایە');
    }
    if (items.length === 0) return alert('هیچ کاڵایەک لە پسووڵەکەدا نییە');
    if (effectivePaid < 0 || effectivePaid > totalInvoiceCost) return alert('بڕی پارەی دراو نادروستە');

    setIsSubmitting(true);
    try {
      const payload = {
        supplier_id: supplierId ? supplierId : null,
        invoice_number: invoiceNumber || null,
        invoice_date: invoiceDate,
        payment_method: paymentMethod,
        additional_cost: effectiveAdditionalCost,
        paid_amount: effectivePaid,
        remaining_amount: totalRemaining,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: Math.max(0.001, parseFloat(i.quantity) || 1),
          cost_price: Math.max(0, Number(i.cost_price) || 0),
          selling_price: Math.max(0, Number(i.selling_price) || 0)
        }))
      };

      await axios.post('http://localhost:3001/api/purchase-invoices', payload);

      const savedSupplier = suppliers.find(s => String(s.id) === String(supplierId));
      const invoiceReceiptData = {
        invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
        supplierName: savedSupplier ? savedSupplier.name : 'کڕینی نەقد',
        supplierPhone: savedSupplier ? savedSupplier.phone : '',
        date: formatDate(invoiceDate || new Date()),
        paymentMethod: paymentMethod === 'CASH' ? 'نەقد' : (paymentMethod === 'DEBT' ? 'قەرز' : 'بەشەکی'),
        paidAmount: effectivePaid,
        remainingAmount: totalRemaining,
        itemsSubtotal,
        additionalCost: effectiveAdditionalCost,
        totalInvoiceCost,
        items: itemsWithLandedCost.map(i => ({
          name: i.name,
          quantity: i.quantity,
          cost_price: Number(i.cost_price) || 0,
          landedUnitCost: i.landedUnitCost || Number(i.cost_price) || 0,
          total: Math.round((Number(i.cost_price) || 0) * (parseFloat(i.quantity) || 1))
        }))
      };

      setPrintedInvoice(invoiceReceiptData);
      if (andPrint) {
        setTimeout(() => window.print(), 100);
      }

      alert('پسووڵەی کڕین بە سەرکەوتوویی تۆمارکرا');
      
      // Reset form
      setSupplierId('');
      setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
      setItems([]);
      setPaymentMethod('CASH');
      setPaidAmount('');
      setAdditionalCost('');
      setProductSearch('');

      const prodRes = await axios.get('http://localhost:3001/api/products', getAuthConfig());
      if (prodRes.data.status === 'SUCCESS') setProducts(prodRes.data.data);

    } catch (error) {
      alert(error.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردن');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      height: '100%',
      maxHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: '10px 16px',
      gap: '8px',
      boxSizing: 'border-box'
    }}>
      
      {/* Top Section: Header & Invoice Details */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flexShrink: 0
      }}>
        {/* Row 1: Title & Return Link */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            پسووڵەی کڕین
          </h1>
          <a 
            href="#/financials?tab=RETURNS"
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#f87171',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              border: '1px solid rgba(239, 68, 68, 0.25)'
            }}
          >
            گەڕاندنەوە بۆ کۆمپانیاکان
          </a>
        </div>

        {/* Row 2: Invoice Fields Toolbar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 1.4fr) minmax(110px, 0.9fr) minmax(125px, 0.9fr) minmax(180px, 1fr) auto minmax(110px, 0.8fr)',
          gap: '8px',
          alignItems: 'center'
        }}>
          {/* Supplier */}
          <div>
            <select 
              value={supplierId} 
              onChange={(e) => {
                setSupplierId(e.target.value);
                if (!e.target.value) setPaymentMethod('CASH');
              }} 
              style={{
                width: '100%',
                height: '36px',
                padding: '0 10px',
                borderRadius: '8px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                outline: 'none',
                fontWeight: 600
              }}
            >
              <option value="">کڕینی نەقد (بێ کۆمپانیا)</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Invoice Number */}
          <div>
            <input 
              type="text" 
              value={invoiceNumber} 
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="ژمارەی پسووڵە"
              style={{
                width: '100%',
                height: '36px',
                padding: '0 10px',
                borderRadius: '8px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '0.88rem',
                boxSizing: 'border-box'
              }} 
            />
          </div>

          {/* Date */}
          <div>
            <input 
              type="date" 
              value={invoiceDate} 
              onChange={(e) => setInvoiceDate(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                padding: '0 10px',
                borderRadius: '8px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.88rem',
                boxSizing: 'border-box'
              }} 
            />
          </div>

          {/* Payment Method Selector */}
          <div style={{
            display: 'flex',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            height: '36px'
          }}>
            {[
              { id: 'CASH', label: 'نەقد' },
              { id: 'DEBT', label: 'قەرز' },
              { id: 'PARTIAL', label: 'بەشەکی' }
            ].map(pm => (
              <button
                key={pm.id}
                type="button"
                onClick={() => {
                  if (pm.id !== 'CASH' && !supplierId) {
                    alert('کڕین بە قەرز یان بەشەکی پێویستی بە دیاریکردنی کۆمپانیایە');
                    return;
                  }
                  setPaymentMethod(pm.id);
                }}
                style={{
                  flex: 1,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: paymentMethod === pm.id ? 800 : 600,
                  background: paymentMethod === pm.id ? '#f43f5e' : 'var(--bg-tertiary)',
                  color: paymentMethod === pm.id ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  transition: 'background 0.15s ease'
                }}
              >
                {pm.label}
              </button>
            ))}
          </div>

          {/* Paid Amount Field (Only in Partial Mode) */}
          {paymentMethod === 'PARTIAL' ? (
            <div style={{ width: '130px' }}>
              <input 
                type="number" 
                step="250"
                min="0"
                value={paidAmount} 
                onChange={(e) => setPaidAmount(e.target.value)} 
                placeholder="پارەی دراو"
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 8px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1.5px solid #10b981',
                  color: '#10b981',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                  outline: 'none'
                }} 
              />
            </div>
          ) : (
            <div />
          )}

          {/* Additional Cost Field */}
          <div>
            <input 
              type="number" 
              step="250"
              min="0"
              value={additionalCost} 
              onChange={(e) => setAdditionalCost(e.target.value)}
              placeholder="تێچووی زیادە"
              style={{
                width: '100%',
                height: '36px',
                padding: '0 8px',
                borderRadius: '8px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: '#f59e0b',
                fontWeight: 700,
                fontSize: '0.88rem',
                textAlign: 'center',
                boxSizing: 'border-box'
              }} 
            />
          </div>
        </div>
      </div>

      {/* Barcode & Product Search Row */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '6px 10px',
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 1.2fr) minmax(220px, 1.2fr) minmax(180px, 1fr)',
        gap: '8px',
        alignItems: 'center',
        flexShrink: 0
      }}>
        {/* Barcode Scan Form */}
        <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', gap: '6px' }}>
          <input 
            ref={scanInputRef}
            type="text" 
            placeholder="سکان یان نوسینی بارکۆد..." 
            value={scanBarcode}
            onChange={(e) => setScanBarcode(normalizeBarcode(e.target.value))}
            autoFocus
            style={{
              flex: 1,
              height: '34px',
              padding: '0 10px',
              borderRadius: '6px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              fontFamily: 'monospace'
            }}
          />
          <button 
            type="submit" 
            style={{
              height: '34px',
              padding: '0 14px',
              borderRadius: '6px',
              background: '#f43f5e',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.82rem',
              whiteSpace: 'nowrap'
            }}
          >
            زیادکردن
          </button>
        </form>

        {/* Kurdish Live Search */}
        <div style={{ position: 'relative' }}>
          <input 
            type="text"
            placeholder="گەڕان بە ناوی کاڵا..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            style={{
              width: '100%',
              height: '34px',
              padding: '0 10px',
              borderRadius: '6px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              boxSizing: 'border-box'
            }}
          />
          {filteredProducts.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
              zIndex: 100,
              maxHeight: '220px',
              overflowY: 'auto'
            }}>
              {filteredProducts.map(p => (
                <div
                  key={p.id}
                  onClick={() => {
                    handleProcessBarcode(p.barcode);
                    setProductSearch('');
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-color)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{p.name}</span>
                  <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>{Number(p.cost_price || 0).toLocaleString()} د.ع</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Product Pick Dropdown */}
        <div>
          <select
            onChange={(e) => {
              if (e.target.value) {
                handleProcessBarcode(e.target.value);
                e.target.value = '';
              }
            }}
            style={{
              width: '100%',
              height: '34px',
              padding: '0 8px',
              borderRadius: '6px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          >
            <option value="">لیستی کاڵاکان...</option>
            {products.map(p => (
              <option key={p.id} value={p.barcode} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                {p.name} ({Number(p.cost_price || 0).toLocaleString()} د.ع)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Items Table Container (Flex: 1, Internally Scrollable, Zero Page Scroll) */}
      <div style={{
        flex: 1,
        minHeight: 0,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflowY: 'auto',
        overflowX: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <thead style={{
            position: 'sticky',
            top: 0,
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-color)',
            zIndex: 10
          }}>
            <tr>
              <th style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', width: '35px' }}>#</th>
              <th style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 800, fontSize: '0.8rem' }}>ناوی کاڵا</th>
              <th style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 800, fontSize: '0.8rem', width: '130px' }}>بارکۆد</th>
              <th style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', width: '90px' }}>بڕ</th>
              <th style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 800, fontSize: '0.8rem', width: '120px' }}>نرخی کڕین</th>
              <th style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 800, fontSize: '0.8rem', width: '120px' }}>نرخی فرۆشتن</th>
              <th style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 800, fontSize: '0.8rem', width: '120px' }}>کۆی کڕین</th>
              <th style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  هیچ کاڵایەک لە پسووڵەکەدا نییە
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const qty = parseInt(item.quantity) || 0;
                const cp = Number(item.cost_price) || 0;
                const sp = Number(item.selling_price) || 0;
                const lineTotalCost = cp * qty;

                return (
                  <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.82rem' }}>
                      {index + 1}
                    </td>

                    <td style={{ padding: '8px 10px', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                      {item.name}
                    </td>

                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                      {item.barcode}
                    </td>

                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <input 
                        type="number" 
                        min="1" 
                        value={item.quantity} 
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)} 
                        style={{
                          width: '75px',
                          height: '32px',
                          borderRadius: '6px',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          textAlign: 'center',
                          fontWeight: 800,
                          fontSize: '0.88rem'
                        }} 
                      />
                    </td>

                    <td style={{ padding: '8px 10px' }}>
                      <input 
                        type="number" 
                        step="250"
                        min="0"
                        value={item.cost_price} 
                        onChange={(e) => updateItem(index, 'cost_price', e.target.value)} 
                        style={{
                          width: '110px',
                          height: '32px',
                          borderRadius: '6px',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          padding: '0 8px'
                        }} 
                      />
                    </td>

                    <td style={{ padding: '8px 10px' }}>
                      <input 
                        type="number" 
                        step="250"
                        min="0"
                        value={item.selling_price} 
                        onChange={(e) => updateItem(index, 'selling_price', e.target.value)} 
                        style={{
                          width: '110px',
                          height: '32px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          color: '#10b981',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          padding: '0 8px'
                        }} 
                      />
                    </td>

                    <td style={{ padding: '8px 10px', fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                      {lineTotalCost.toLocaleString()} د.ع
                    </td>

                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <button 
                        type="button"
                        onClick={() => removeItem(index)} 
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.8rem'
                        }}
                      >
                        سڕینەوە
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Fixed Summary & Save Bar (Fixed height, ZERO page scroll) */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '8px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0
      }}>
        {/* Summary Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            کاڵا: <strong style={{ color: 'var(--text-primary)' }}>{items.length} جۆر ({totalQty} دانە)</strong>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            کۆی کڕین: <strong style={{ color: 'var(--text-primary)' }}>{itemsSubtotal.toLocaleString()} د.ع</strong>
          </div>

          {effectiveAdditionalCost > 0 && (
            <div style={{ fontSize: '0.85rem', color: '#f59e0b' }}>
              تێچووی زیادە: <strong>{effectiveAdditionalCost.toLocaleString()} د.ع</strong>
            </div>
          )}

          <div style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            کۆی گشتی: <span style={{ color: '#f43f5e', fontSize: '1.15rem' }}>{totalInvoiceCost.toLocaleString()} د.ع</span>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            دراو: <strong style={{ color: '#10b981' }}>{effectivePaid.toLocaleString()} د.ع</strong>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            ماوە (قەرز): <strong style={{ color: totalRemaining > 0 ? '#ef4444' : '#10b981' }}>{totalRemaining.toLocaleString()} د.ع</strong>
          </div>
        </div>

        {/* Action Save & Print Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {printedInvoice && (
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38bdf8',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              چاپکردنەوەی وەسڵ
            </button>
          )}

          <button 
            type="button"
            onClick={() => handleSaveInvoice(false)}
            disabled={isSubmitting || items.length === 0}
            style={{
              height: '38px',
              padding: '0 18px',
              borderRadius: '8px',
              background: (isSubmitting || items.length === 0) ? 'rgba(255,255,255,0.06)' : 'var(--bg-tertiary)',
              color: (isSubmitting || items.length === 0) ? 'var(--text-muted)' : 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: (isSubmitting || items.length === 0) ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            پاشەکەوت
          </button>

          <button 
            type="button"
            onClick={() => handleSaveInvoice(true)}
            disabled={isSubmitting || items.length === 0}
            style={{
              height: '38px',
              padding: '0 20px',
              borderRadius: '8px',
              background: (isSubmitting || items.length === 0) ? 'rgba(255,255,255,0.06)' : '#f43f5e',
              color: (isSubmitting || items.length === 0) ? 'var(--text-muted)' : '#ffffff',
              border: 'none',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: (isSubmitting || items.length === 0) ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            پاشەکەوت و چاپ
          </button>
        </div>
      </div>

      {/* Quick Add Product Modal */}
      {isQuickAddOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsQuickAddOpen(false)}>
          <div className="pos-modal-card pos-modal-md" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 800 }}>
                تۆمارکردنی کاڵای نوێ
              </h2>
              <button 
                type="button" 
                onClick={() => setIsQuickAddOpen(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickAddProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>بارکۆد</label>
                <input 
                  type="text" 
                  disabled 
                  value={quickProductData.barcode} 
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 700, boxSizing: 'border-box' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>ناوی کاڵا</label>
                <input 
                  type="text" 
                  required
                  placeholder="ناوی کاڵا بنووسە..."
                  value={quickProductData.name} 
                  onChange={(e) => setQuickProductData({ ...quickProductData, name: e.target.value })} 
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', boxSizing: 'border-box' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>کەتەگۆری</label>
                <select 
                  value={quickProductData.category_id} 
                  onChange={(e) => setQuickProductData({ ...quickProductData, category_id: e.target.value })} 
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                >
                  <option value="">بێ کەتەگۆری...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>نرخی کڕین</label>
                  <input 
                    type="number" 
                    step="250"
                    min="0"
                    placeholder="0"
                    value={quickProductData.cost_price} 
                    onChange={(e) => setQuickProductData({ ...quickProductData, cost_price: e.target.value })} 
                    style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 700, boxSizing: 'border-box' }} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.82rem', color: '#10b981', fontWeight: 700 }}>نرخی فرۆشتن</label>
                  <input 
                    type="number" 
                    required
                    step="250"
                    min="0"
                    value={quickProductData.selling_price} 
                    onChange={(e) => setQuickProductData({ ...quickProductData, selling_price: e.target.value })} 
                    style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10b981', color: '#10b981', fontWeight: 700, boxSizing: 'border-box' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  style={{ flex: 1, height: '38px', borderRadius: '8px', background: '#f43f5e', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  تۆمارکردن
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsQuickAddOpen(false)}
                  style={{ height: '38px', padding: '0 16px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}
                >
                  داخستن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Thermal Purchase Receipt (Targeted by @media print) */}
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-purchase-receipt, #thermal-purchase-receipt * {
            visibility: visible !important;
          }
          #thermal-purchase-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            background: white !important;
            color: black !important;
            padding: 8px 10px !important;
            font-family: monospace, Tahoma, 'Noto Kufi Arabic', sans-serif !important;
            font-size: 13px !important;
            direction: rtl !important;
            text-align: right !important;
          }
          .purchase-divider {
            border-bottom: 1px dashed #000 !important;
            margin: 6px 0 !important;
          }
        }
      `}</style>

      {printedInvoice && (
        <div id="thermal-purchase-receipt">
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>{storeName}</div>
          {storePhone && <div style={{ textAlign: 'center', fontSize: '11px', color: '#333' }}>پەیوەندی: {storePhone}</div>}
          <div className="purchase-divider"></div>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>وەسڵی کڕینی کاڵا</div>
          <div className="purchase-divider"></div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ژمارەی وەسڵ:</span>
            <span style={{ fontWeight: 'bold', direction: 'ltr' }}>{printedInvoice.invoiceNumber}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>کۆمپانیا:</span>
            <span style={{ fontWeight: 'bold' }}>{printedInvoice.supplierName}</span>
          </div>
          {printedInvoice.supplierPhone && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>مۆبایل:</span>
              <span style={{ direction: 'ltr' }}>{printedInvoice.supplierPhone}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>بەروار:</span>
            <span>{printedInvoice.date}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>شێوازی پارەدان:</span>
            <span style={{ fontWeight: 'bold' }}>{printedInvoice.paymentMethod}</span>
          </div>

          <div className="purchase-divider"></div>

          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ padding: '4px 0' }}>کاڵا</th>
                <th style={{ padding: '4px 0', textAlign: 'center' }}>بڕ</th>
                <th style={{ padding: '4px 0', textAlign: 'left' }}>کۆ</th>
              </tr>
            </thead>
            <tbody>
              {printedInvoice.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                  <td style={{ padding: '4px 0' }}>{item.name}</td>
                  <td style={{ padding: '4px 0', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ padding: '4px 0', textAlign: 'left' }}>{item.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="purchase-divider"></div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>کۆی کاڵاکان:</span>
            <span>{printedInvoice.itemsSubtotal.toLocaleString()} د.ع</span>
          </div>
          {printedInvoice.additionalCost > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>تێچووی زیادە:</span>
              <span>{printedInvoice.additionalCost.toLocaleString()} د.ع</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', margin: '4px 0' }}>
            <span>کۆی گشتی:</span>
            <span>{printedInvoice.totalInvoiceCost.toLocaleString()} د.ع</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>پارەی دراو:</span>
            <span>{printedInvoice.paidAmount.toLocaleString()} د.ع</span>
          </div>
          {printedInvoice.remainingAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>قەرزی ماوە:</span>
              <span>{printedInvoice.remainingAmount.toLocaleString()} د.ع</span>
            </div>
          )}

          <div className="purchase-divider"></div>
          <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '6px' }}>وەسڵی فەرمیی کڕین</div>
        </div>
      )}

    </div>
  );
};

export default Purchases;
