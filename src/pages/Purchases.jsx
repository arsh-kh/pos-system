import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { 
  ScanBarcode, 
  FileText, 
  Save, 
  Trash2, 
  Plus, 
  X,
  PackagePlus,
  RotateCcw
} from 'lucide-react';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import './Dashboard.css';

const Purchases = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Invoice Header State
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(() => {
    return `INV-${Date.now().toString().slice(-6)}`;
  });
  const [invoiceDate, setInvoiceDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // CASH, DEBT, PARTIAL
  const [paidAmount, setPaidAmount] = useState('');

  // Invoice Items State
  // { product_id, name, barcode, quantity, cost_price, selling_price, stock_before }
  const [items, setItems] = useState([]);

  // Barcode Scanner State
  const [scanBarcode, setScanBarcode] = useState('');
  const scanInputRef = useRef(null);

  // Quick Add Product Modal State (when scanned barcode doesn't exist)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickProductData, setQuickProductData] = useState({
    name: '',
    barcode: '',
    cost_price: '',
    selling_price: '',
    category_id: ''
  });

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

  // Core Barcode Processing Engine
  const handleProcessBarcode = (code) => {
    if (!code) return;
    const cleanCode = code.trim();
    const existing = products.find(p => p.barcode === cleanCode);

    if (existing) {
      // Product exists -> Add or increment in cart
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
              stock_before: existing.stock || 0,
              original_cost_price: existing.cost_price || 0
            }
          ];
        }
      });
    } else {
      // Product DOES NOT exist -> User approved quick pop-up to add product immediately
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

  // Hardware wedge barcode scanner listener
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
        // Append to items
        setItems(prev => [
          ...prev,
          {
            product_id: newProd.id,
            name: newProd.name,
            barcode: newProd.barcode,
            quantity: '1',
            cost_price: newProd.cost_price,
            selling_price: newProd.selling_price,
            stock_before: 0,
            original_cost_price: newProd.cost_price || 0
          }
        ]);

        // Refresh products list
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

  // Grand Calculations
  const { totalInvoiceCost, totalSalesValue, totalProfit } = useMemo(() => {
    let cost = 0;
    let sales = 0;

    items.forEach(item => {
      const q = Math.max(0, parseInt(item.quantity) || 0);
      const cp = Math.max(0, Number(item.cost_price) || 0);
      const sp = Math.max(0, Number(item.selling_price) || 0);

      cost += cp * q;
      sales += sp * q;
    });

    return {
      totalInvoiceCost: cost,
      totalSalesValue: sales,
      totalProfit: sales - cost
    };
  }, [items]);

  // Payment Method Smart Auto-Calculation Engine
  useEffect(() => {
    if (paymentMethod === 'CASH') {
      setPaidAmount(totalInvoiceCost.toString());
    } else if (paymentMethod === 'DEBT') {
      setPaidAmount('0');
    }
  }, [paymentMethod, totalInvoiceCost]);

  const effectivePaid = Number(paidAmount) || 0;
  const totalRemaining = Math.max(0, totalInvoiceCost - effectivePaid);

  const handleSaveInvoice = async () => {
    if (!supplierId && (paymentMethod === 'DEBT' || totalRemaining > 0)) {
      return alert('کڕین بە قەرز پێویستی بە هەڵبژاردنی کۆمپانیایە');
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
        paid_amount: effectivePaid,
        remaining_amount: totalRemaining,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: Math.max(1, parseInt(i.quantity) || 1),
          cost_price: Math.max(0, Number(i.cost_price) || 0),
          selling_price: Math.max(0, Number(i.selling_price) || 0)
        }))
      };

      await axios.post('http://localhost:3001/api/purchase-invoices', payload);

      alert('پسووڵەی کڕین بە سەرکەوتوویی تۆمارکرا! دانەکان لە کۆگا تازە کرانەوە و قەرزی کۆمپانیا نوێ کرایەوە.');
      
      // Reset form
      setSupplierId('');
      setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
      setItems([]);
      setPaymentMethod('CASH');
      setPaidAmount('');

      // Refresh products to show updated stock
      const prodRes = await axios.get('http://localhost:3001/api/products', getAuthConfig());
      if (prodRes.data.status === 'SUCCESS') setProducts(prodRes.data.data);

    } catch (error) {
      alert(error.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردن');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dashboard-page p-8" style={{ position: 'relative' }}>
      
      {/* Header */}
      <div className="header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText color="#f43f5e" size={32} />
            پسووڵەی کڕین
          </h1>
          <p className="text-secondary">تۆمارکردنی کاڵای نوێ بۆ کۆگا، بەراوردی نرخی کڕین، سکانی بارکۆد و قەرزی کۆمپانیا</p>
        </div>

        <a 
          href="#/financials?tab=RETURNS"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#f87171',
            textDecoration: 'none',
            fontWeight: 'bold',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}
        >
          <RotateCcw size={18} /> گەڕاندنەوە بۆ کۆمپانیاکان (Purchase Returns)
        </a>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* Main Section: Barcode Wedge Scan + Items Table */}
        <div style={{ flex: '1 1 66%', display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: '320px' }}>
          
          {/* Scan Barcode & Pick Product Panel */}
          <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', borderRadius: '18px', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(244, 63, 94, 0.2)', padding: '12px', borderRadius: '12px', color: '#fb7185' }}>
              <ScanBarcode size={26} />
            </div>
            
            <form onSubmit={handleBarcodeSubmit} style={{ flex: '1 1 300px', display: 'flex', gap: '8px' }}>
              <input 
                ref={scanInputRef}
                type="text" 
                placeholder="بارکۆدی کاڵا سکان بکە یان بنووسە..." 
                value={scanBarcode}
                onChange={(e) => setScanBarcode(e.target.value)}
                autoFocus
                style={{ flex: 1, padding: '14px 18px', borderRadius: '12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(244, 63, 94, 0.35)', color: 'white', fontSize: '1.05rem', fontFamily: 'monospace' }}
              />
              <button 
                type="submit" 
                style={{ padding: '0 20px', borderRadius: '12px', background: '#f43f5e', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={18} /> زیادکردن
              </button>
            </form>

            {/* Quick Product Pick Dropdown */}
            <div style={{ flex: '1 1 240px' }}>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleProcessBarcode(e.target.value);
                    e.target.value = '';
                  }
                }}
                style={{ width: '100%', padding: '14px 14px', borderRadius: '12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.95rem' }}
              >
                <option value="">یان کاڵایەک لە لیست هەڵبژێرە...</option>
                {products.map(p => (
                  <option key={p.id} value={p.barcode} style={{ background: '#1e293b' }}>
                    {p.name} ({Number(p.cost_price || 0).toLocaleString()} دینار)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Items Table */}
          <div className="glass-panel" style={{ padding: '1px', borderRadius: '18px', overflowX: 'auto', minHeight: '420px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
              <thead style={{ background: 'rgba(0,0,0,0.25)' }}>
                <tr>
                  <th style={{ padding: '16px', color: '#94a3b8' }}>ناوی کاڵا</th>
                  <th style={{ padding: '16px', color: '#94a3b8' }}>بڕ (دانە)</th>
                  <th style={{ padding: '16px', color: '#94a3b8' }}>نرخی کڕین (دینار)</th>
                  <th style={{ padding: '16px', color: '#94a3b8' }}>نرخی فرۆشتن (دینار)</th>
                  <th style={{ padding: '16px', color: '#94a3b8' }}>قازانجی یەکە</th>
                  <th style={{ padding: '16px', color: '#94a3b8' }}>کۆی فرۆشتن</th>
                  <th style={{ padding: '16px', color: '#94a3b8' }}>کۆی ستۆک</th>
                  <th style={{ padding: '16px', color: '#94a3b8' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '80px 20px', textAlign: 'center', color: '#94a3b8' }}>
                      <ScanBarcode size={50} opacity={0.2} style={{ marginBottom: '1rem' }} /><br/>
                      هیچ کاڵایەک لە پسووڵەکەدا نییە.<br/>بارکۆدی کاڵایەک سکان بکە بۆ دەستپێکردن.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const qty = parseInt(item.quantity) || 0;
                    const cp = Number(item.cost_price) || 0;
                    const sp = Number(item.selling_price) || 0;
                    const unitProfit = sp - cp;
                    const lineTotalSales = sp * qty;
                    const lineStockValuation = sp * ((item.stock_before || 0) + qty);

                    return (
                      <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '16px', fontWeight: 'bold', color: '#f8fafc' }}>
                          {item.name}
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                            بارکۆد: {item.barcode} • کۆگای پێشوو: {item.stock_before} دانە
                          </div>
                        </td>

                        <td style={{ padding: '16px' }}>
                          <input 
                            type="number" 
                            min="1" 
                            value={item.quantity} 
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)} 
                            style={{ width: '80px', padding: '8px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', textAlign: 'center', fontWeight: 'bold' }} 
                          />
                        </td>

                        <td style={{ padding: '16px' }}>
                          <input 
                            type="number" 
                            value={item.cost_price} 
                            onChange={(e) => updateItem(index, 'cost_price', e.target.value)} 
                            style={{ width: '110px', padding: '8px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold' }} 
                          />
                          {(() => {
                            const orig = Number(item.original_cost_price) || 0;
                            const current = Number(item.cost_price) || 0;
                            if (!orig) return (
                              <div style={{ fontSize: '0.72rem', color: '#60a5fa', marginTop: '4px' }}>
                                ✨ کاڵای نوێ
                              </div>
                            );
                            const diff = current - orig;
                            if (diff > 0) {
                              return (
                                <div style={{ fontSize: '0.72rem', color: '#f97316', fontWeight: 'bold', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  🔺 +{diff.toLocaleString()} (گرانتر)
                                </div>
                              );
                            } else if (diff < 0) {
                              return (
                                <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 'bold', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  🔻 {diff.toLocaleString()} (هەرزانتر)
                                </div>
                              );
                            } else {
                              return (
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                                  وەک خۆیەتی ({orig.toLocaleString()})
                                </div>
                              );
                            }
                          })()}
                        </td>

                        <td style={{ padding: '16px' }}>
                          <input 
                            type="number" 
                            value={item.selling_price} 
                            onChange={(e) => updateItem(index, 'selling_price', e.target.value)} 
                            style={{ width: '110px', padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontWeight: 'bold' }} 
                          />
                        </td>

                        <td style={{ padding: '16px', fontWeight: 'bold', color: unitProfit >= 0 ? '#10b981' : '#ef4444' }}>
                          {unitProfit.toLocaleString()} دینار
                        </td>

                        <td style={{ padding: '16px', fontWeight: 'bold', color: '#38bdf8' }}>
                          {lineTotalSales.toLocaleString()} دینار
                        </td>

                        <td style={{ padding: '16px', color: '#a78bfa' }}>
                          {lineStockValuation.toLocaleString()} دینار
                        </td>

                        <td style={{ padding: '16px' }}>
                          <button 
                            onClick={() => removeItem(index)} 
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="سڕینەوە"
                          >
                            <Trash2 size={16} />
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

        {/* Sidebar: Invoice Information, Smart Payment Method & Calculations */}
        <div style={{ flex: '1 1 30%', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '20px' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText color="#f43f5e" /> زانیاری پسووڵەی کڕین
            </h3>

            {/* Supplier Select */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>کۆمپانیا / دابینکەر (یان کڕینی لۆکاڵی)</label>
              <select 
                value={supplierId} 
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  if (!e.target.value) setPaymentMethod('CASH');
                }} 
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '1rem', outline: 'none' }}
              >
                <option value="">کڕینی لۆکاڵی / بێ کۆمپانیا (نەقد)</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Invoice Number & Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>ژمارەی پسووڵە</label>
                <input 
                  type="text" 
                  value={invoiceNumber} 
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontFamily: 'monospace' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>بەروار</label>
                <input 
                  type="date" 
                  value={invoiceDate} 
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} 
                />
              </div>
            </div>

            {/* Payment Method Selector (User Approved Smart Calculation) */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>شێوازی پارەدان</label>
              <div style={{ display: 'flex', gap: '8px' }}>
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
                        alert('کڕین بە قەرز یان بەشەکی پێویستی بە هەڵبژاردنی کۆمپانیایە');
                        return;
                      }
                      setPaymentMethod(pm.id);
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 6px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: paymentMethod === pm.id ? 'bold' : 'normal',
                      background: paymentMethod === pm.id ? '#f43f5e' : 'rgba(255,255,255,0.05)',
                      color: paymentMethod === pm.id ? '#ffffff' : '#94a3b8',
                      fontSize: '0.85rem'
                    }}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Invoice Summary Card */}
            <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.25)', borderRadius: '14px', border: '1px dashed rgba(255,255,255,0.1)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', color: '#94a3b8' }}>
                <span>کۆی گشتی تێچووی پسووڵە:</span>
                <span style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '1.2rem' }}>{totalInvoiceCost.toLocaleString()} دینار</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', color: '#94a3b8' }}>
                <span>کۆی فرۆشتنی پێشبینیکراو:</span>
                <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{totalSalesValue.toLocaleString()} دینار</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', color: '#94a3b8' }}>
                <span>کۆی قازانجی پێشبینیکراو:</span>
                <span style={{ color: totalProfit >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                  {totalProfit.toLocaleString()} دینار
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>ژمارەی کاڵاکان:</span>
                <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{items.length} جۆر</span>
              </div>
            </div>

            {/* Paid Amount */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: '#10b981', fontWeight: 'bold' }}>پارەی دراو بە کۆمپانیا (دینار)</label>
              <input 
                type="number" 
                value={paidAmount} 
                disabled={paymentMethod === 'CASH' || paymentMethod === 'DEBT'}
                onChange={(e) => setPaidAmount(e.target.value)} 
                placeholder="0"
                style={{ width: '100%', padding: '14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '1.2rem', fontWeight: 'bold' }} 
              />
            </div>

            {/* Remaining Amount */}
            <div style={{ marginBottom: '1.5rem', padding: '1.25rem', background: totalRemaining > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', border: `1px solid ${totalRemaining > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: totalRemaining > 0 ? '#ef4444' : '#10b981' }}>
                <span style={{ fontWeight: 'bold' }}>پارەی ماوە (قەرزی کۆمپانیا):</span>
                <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{totalRemaining.toLocaleString()} دینار</span>
              </div>
            </div>

            {/* Save Button */}
            <button 
              onClick={handleSaveInvoice}
              disabled={isSubmitting || items.length === 0}
              style={{
                width: '100%', 
                padding: '16px', 
                borderRadius: '12px', 
                background: (isSubmitting || items.length === 0) ? 'rgba(255,255,255,0.1)' : '#f43f5e', 
                color: (isSubmitting || items.length === 0) ? '#64748b' : 'white', 
                border: 'none', 
                fontSize: '1.1rem', 
                fontWeight: 'bold', 
                cursor: (isSubmitting || items.length === 0) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: (isSubmitting || items.length === 0) ? 'none' : '0 4px 15px rgba(244,63,94,0.4)'
              }}
            >
              {isSubmitting ? 'خەریکە پاشەکەوت دەکرێت...' : <><Save size={20} /> پاشەکەوتکردنی پسووڵە</>}
            </button>
          </div>

        </div>

      </div>

      {/* Quick Add Product Modal (User Approved Feature) */}
      {isQuickAddOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', borderRadius: '24px', padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PackagePlus color="#f43f5e" /> زیادکردنی خێرای کاڵای نوێ
                </h2>
                <small style={{ color: '#94a3b8' }}>ئەم بارکۆدە لە مارکێتدا نەبوو، دەتوانیت لێرە ڕاستەوخۆ زیادی بکەیت</small>
              </div>
              <button onClick={() => setIsQuickAddOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={24}/>
              </button>
            </div>

            <form onSubmit={handleQuickAddProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>بارکۆد</label>
                <input 
                  type="text" 
                  disabled 
                  value={quickProductData.barcode} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#a78bfa', fontFamily: 'monospace', fontWeight: 'bold' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>ناوی کاڵا <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="ناوی کاڵای نوێ بنووسە..."
                  value={quickProductData.name} 
                  onChange={(e) => setQuickProductData({ ...quickProductData, name: e.target.value })} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>کەتەگۆری / جۆر</label>
                <select 
                  value={quickProductData.category_id} 
                  onChange={(e) => setQuickProductData({ ...quickProductData, category_id: e.target.value })} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                >
                  <option value="">بێ کەتەگۆری...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>نرخی کڕین (دینار)</label>
                  <input 
                    type="number" 
                    placeholder="0"
                    value={quickProductData.cost_price} 
                    onChange={(e) => setQuickProductData({ ...quickProductData, cost_price: e.target.value })} 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold' }} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: '#10b981', fontWeight: 'bold' }}>نرخی فرۆشتن (دینار) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="number" 
                    required
                    value={quickProductData.selling_price} 
                    onChange={(e) => setQuickProductData({ ...quickProductData, selling_price: e.target.value })} 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontWeight: 'bold' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#f43f5e', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  زیادکردن بۆ پسووڵە
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsQuickAddOpen(false)}
                  style={{ padding: '14px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: '#94a3b8', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  داخستن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Purchases;
