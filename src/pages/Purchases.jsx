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
  RotateCcw,
  Truck,
  Printer,
  Search
} from 'lucide-react';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { formatDate, formatDateTime, formatCurrency } from '../utils/dateFormatter';
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
  const [additionalCost, setAdditionalCost] = useState(''); // Single additional cost field (delivery, lifting, etc.)

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

  // Printable Invoice Voucher State
  const [printedInvoice, setPrintedInvoice] = useState(null);
  const storeName = localStorage.getItem('pos_store_name') || 'مارکێتی حاجی ئاکۆ';
  const storePhone = localStorage.getItem('pos_store_phone') || '0772 979 0421';

  // Product Kurdish Search State
  const [productSearch, setProductSearch] = useState('');
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

  // Grand Calculations (with Exact Proportional Landed Cost Allocation)
  const { 
    itemsSubtotal, 
    effectiveAdditionalCost, 
    totalInvoiceCost, 
    totalSalesValue, 
    totalProfit, 
    itemsWithLandedCost 
  } = useMemo(() => {
    let cost = 0;
    let sales = 0;

    items.forEach(item => {
      const q = Math.max(0, parseInt(item.quantity) || 0);
      const cp = Math.max(0, Number(item.cost_price) || 0);
      const sp = Math.max(0, Number(item.selling_price) || 0);

      cost += cp * q;
      sales += sp * q;
    });

    const addCost = Math.max(0, Math.round(Number(additionalCost) || 0));
    const grandTotal = cost + addCost;

    // Distribute additional cost proportionally per line item
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
      itemsWithLandedCost: itemsWithLanded
    };
  }, [items, additionalCost]);

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

  const handleSaveInvoice = async (andPrint = false) => {
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
        supplierName: savedSupplier ? savedSupplier.name : 'کۆمپانیای گشتی',
        supplierPhone: savedSupplier ? savedSupplier.phone : '',
        date: formatDate(invoiceDate || new Date()),
        paymentMethod: paymentMethod === 'CASH' ? 'نەقد (کاش)' : (paymentMethod === 'DEBT' ? 'قەرز' : 'بەشەکی'),
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

      alert('پسووڵەی کڕین بە سەرکەوتوویی تۆمارکرا!');
      
      // Reset form
      setSupplierId('');
      setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
      setItems([]);
      setPaymentMethod('CASH');
      setPaidAmount('');
      setAdditionalCost('');
      setProductSearch('');

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
          <RotateCcw size={18} /> گەڕاندنەوە بۆ کۆمپانیاکان
        </a>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* Main Section: Barcode Wedge Scan + Items Table */}
        <div style={{ flex: '1 1 66%', display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: '320px' }}>
          
          {/* Scan Barcode & Pick Product Panel */}
          <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(244, 63, 94, 0.2)', padding: '12px', borderRadius: '12px', color: '#fb7185' }}>
                <ScanBarcode size={26} />
              </div>
              
              {/* Barcode Form */}
              <form onSubmit={handleBarcodeSubmit} style={{ flex: '1 1 260px', display: 'flex', gap: '8px' }}>
                <input 
                  ref={scanInputRef}
                  type="text" 
                  placeholder="بارکۆدی کاڵا سکان بکە یان بنووسە..." 
                  value={scanBarcode}
                  onChange={(e) => setScanBarcode(e.target.value)}
                  autoFocus
                  style={{ flex: 1, padding: '14px 18px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1.5px solid rgba(244, 63, 94, 0.45)', color: 'var(--text-primary)', fontSize: '1.05rem', fontFamily: 'monospace' }}
                />
                <button 
                  type="submit" 
                  style={{ padding: '0 20px', borderRadius: '12px', background: '#f43f5e', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={18} /> زیادکردن
                </button>
              </form>

              {/* Kurdish Live Product Search with Autocomplete */}
              <div style={{ flex: '1 1 280px', position: 'relative' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={18} style={{ position: 'absolute', right: '14px', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                  <input 
                    type="text"
                    placeholder="گەڕان بە ناوی کاڵا (کوردی)..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    style={{ width: '100%', padding: '14px 40px 14px 14px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.95rem' }}
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      style={{ position: 'absolute', left: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {filteredProducts.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.35)', zIndex: 100, maxHeight: '250px', overflowY: 'auto' }}>
                    {filteredProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          handleProcessBarcode(p.barcode);
                          setProductSearch('');
                        }}
                        style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s ease' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div>
                          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{p.name}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '8px' }}>({p.barcode})</span>
                        </div>
                        <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem' }}>{Number(p.cost_price || 0).toLocaleString()} د.ع</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Product Pick Dropdown */}
              <div style={{ flex: '1 1 200px' }}>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleProcessBarcode(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  style={{ width: '100%', padding: '14px 14px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.95rem' }}
                >
                  <option value="">لیستی هەموو کاڵاکان...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.barcode} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      {p.name} ({Number(p.cost_price || 0).toLocaleString()} دینار)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="glass-panel" style={{ padding: '1px', borderRadius: '18px', overflowX: 'auto', minHeight: '420px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
              <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                <tr>
                  <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 700 }}>ناوی کاڵا</th>
                  <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 700 }}>بڕ (دانە)</th>
                  <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 700 }}>نرخی کڕین (دینار)</th>
                  <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 700 }}>نرخی فرۆشتن (دینار)</th>
                  <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 700 }}>قازانجی یەکە</th>
                  <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 700 }}>کۆی فرۆشتن</th>
                  <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 700 }}>کۆی ستۆک</th>
                  <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 700 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <ScanBarcode size={50} opacity={0.2} style={{ marginBottom: '1rem' }} /><br/>
                      هیچ کاڵایەک لە پسووڵەکەدا نییە.<br/>بارکۆدی کاڵایەک سکان بکە بۆ دەستپێکردن.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const qty = parseInt(item.quantity) || 0;
                    const cp = Number(item.cost_price) || 0;
                    const sp = Number(item.selling_price) || 0;
                    const itemLanded = itemsWithLandedCost[index];
                    const effectiveCp = (itemLanded && effectiveAdditionalCost > 0) ? itemLanded.landedUnitCost : cp;
                    const unitProfit = sp - effectiveCp;
                    const lineTotalSales = sp * qty;
                    const lineStockValuation = sp * ((item.stock_before || 0) + qty);

                    return (
                      <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          {item.name}
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            بارکۆد: {item.barcode} • کۆگای پێشوو: {item.stock_before} دانە
                          </div>
                        </td>

                        <td style={{ padding: '16px' }}>
                          <input 
                            type="number" 
                            min="1" 
                            value={item.quantity} 
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)} 
                            style={{ width: '80px', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 'bold' }} 
                          />
                        </td>

                        <td style={{ padding: '16px' }}>
                          <input 
                            type="number" 
                            step="250"
                            min="0"
                            value={item.cost_price} 
                            onChange={(e) => updateItem(index, 'cost_price', e.target.value)} 
                            style={{ width: '110px', padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold' }} 
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
                          {effectiveAdditionalCost > 0 && itemLanded && itemLanded.perUnitAdd > 0 && (
                            <div style={{ fontSize: '0.72rem', color: '#fbbf24', marginTop: '5px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                              🚚 تێچووی گەیشتن: <strong>{itemLanded.landedUnitCost.toLocaleString()}</strong> (+{itemLanded.perUnitAdd.toLocaleString()})
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '16px' }}>
                          <input 
                            type="number" 
                            step="250"
                            min="0"
                            value={item.selling_price} 
                            onChange={(e) => updateItem(index, 'selling_price', e.target.value)} 
                            style={{ width: '110px', padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontWeight: 'bold' }} 
                          />
                        </td>

                        <td style={{ padding: '16px', fontWeight: 'bold', color: unitProfit >= 0 ? '#10b981' : '#ef4444' }}>
                          {unitProfit.toLocaleString()} دینار
                          {effectiveAdditionalCost > 0 && (
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'normal' }}>
                              قازانجی نێت بە کرێوە
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '16px', fontWeight: 'bold', color: '#38bdf8' }}>
                          {lineTotalSales.toLocaleString()} دینار
                        </td>

                        <td style={{ padding: '16px', color: '#0284c7', fontWeight: 'bold' }}>
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
              <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>کۆمپانیا / دابینکەر (یان کڕینی ناوخۆیی)</label>
              <select 
                value={supplierId} 
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  if (!e.target.value) setPaymentMethod('CASH');
                }} 
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }}
              >
                <option value="">کڕینی ناوخۆیی / بێ کۆمپانیا (نەقد)</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Invoice Number & Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>ژمارەی پسووڵە</label>
                <input 
                  type="text" 
                  value={invoiceNumber} 
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'monospace' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>بەروار</label>
                <input 
                  type="date" 
                  value={invoiceDate} 
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }} 
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

            {/* Single Additional Cost Field (Delivery / Lifting / Freight) */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', color: '#f59e0b', fontWeight: 'bold', fontSize: '0.9rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Truck size={16} /> تێچووی زیادە (بار / گەیاندن / حەماڵی)
                </span>
                {effectiveAdditionalCost > 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    دابەشکراو بەسەر کاڵاکاندا
                  </span>
                )}
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const current = Math.max(0, parseInt(additionalCost) || 0);
                    const nextVal = Math.max(0, current - 250);
                    setAdditionalCost(nextVal === 0 ? '' : String(nextVal));
                  }}
                  title="کەمکردنەوە بە ٢٥٠ دینار"
                  style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  -٢٥٠
                </button>

                <input 
                  type="number" 
                  step="250"
                  min="0"
                  value={additionalCost} 
                  onChange={(e) => setAdditionalCost(e.target.value)}
                  placeholder="0"
                  style={{ 
                    flex: 1, 
                    padding: '12px 14px', 
                    borderRadius: '10px', 
                    background: 'rgba(245, 158, 11, 0.08)', 
                    border: '1px solid rgba(245, 158, 11, 0.35)', 
                    color: '#d97706', 
                    fontFamily: 'monospace', 
                    fontSize: '1.1rem', 
                    fontWeight: 'bold',
                    textAlign: 'center' 
                  }} 
                />

                <button
                  type="button"
                  onClick={() => {
                    const current = Math.max(0, parseInt(additionalCost) || 0);
                    const nextVal = current + 250;
                    setAdditionalCost(String(nextVal));
                  }}
                  title="زیادکردن بە ٢٥٠ دینار"
                  style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  +٢٥٠
                </button>
              </div>

              {/* Iraqi Currency Pills for Additional Cost */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setAdditionalCost('')}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  0 ✕
                </button>
                {[250, 500, 1000, 5000, 10000, 25000].map(amt => (
                  <button
                    type="button"
                    key={amt}
                    onClick={() => {
                      const current = Math.max(0, parseInt(additionalCost) || 0);
                      setAdditionalCost(String(current + amt));
                    }}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    +{amt.toLocaleString()}
                  </button>
                ))}
              </div>

              <small style={{ color: '#94a3b8', fontSize: '0.76rem', marginTop: '6px', display: 'block', lineHeight: '1.4' }}>
                💡 ئەم بڕە دەچێتە سەر کۆی پسووڵە و نرخی تێچووی گەیشتووی دانەکان (Landed Cost) بە وردی دابەش دەکات.
              </small>
            </div>

            {/* Invoice Summary Card */}
            <div style={{ padding: '1.25rem', background: 'var(--bg-tertiary)', borderRadius: '14px', border: '1px dashed var(--border-color)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <span>کۆی کاڵاکان (خام):</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{itemsSubtotal.toLocaleString()} دینار</span>
              </div>
              {effectiveAdditionalCost > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: '#fbbf24', fontSize: '0.9rem' }}>
                  <span>+ تێچووی زیادە (بار و حەماڵی):</span>
                  <span style={{ fontWeight: 'bold' }}>{effectiveAdditionalCost.toLocaleString()} دینار</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <span style={{ fontWeight: 'bold' }}>کۆی گشتی تێچووی پسووڵە:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.25rem' }}>{totalInvoiceCost.toLocaleString()} دینار</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                <span>کۆی فرۆشتنی پێشبینیکراو:</span>
                <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{totalSalesValue.toLocaleString()} دینار</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                <span>کۆی قازانجی نێت:</span>
                <span style={{ color: totalProfit >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                  {totalProfit.toLocaleString()} دینار
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <span>ژمارەی کاڵاکان:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{items.length} جۆر</span>
              </div>
            </div>

            {/* Paid Amount */}
            <div style={{ marginBottom: '1.25rem' }}>
              {paymentMethod === 'PARTIAL' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <label style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>پارەی دراو بە کۆمپانیا (دینار)</span>
                      <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>بەشەکی</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setPaidAmount(String(totalInvoiceCost))}
                      style={{ padding: '3px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      هەموو بڕەکە ({totalInvoiceCost.toLocaleString()})
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const current = Math.max(0, parseInt(paidAmount) || 0);
                        const nextVal = Math.max(0, current - 250);
                        setPaidAmount(nextVal === 0 ? '' : String(nextVal));
                      }}
                      title="کەمکردنەوە بە ٢٥٠ دینار"
                      style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      -٢٥٠
                    </button>

                    <input 
                      type="number" 
                      step="250"
                      min="0"
                      value={paidAmount} 
                      onChange={(e) => setPaidAmount(e.target.value)} 
                      placeholder="0"
                      style={{ flex: 1, padding: '12px 14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1.5px solid rgba(16, 185, 129, 0.4)', color: '#059669', fontSize: '1.25rem', fontWeight: 'bold', textAlign: 'center', boxSizing: 'border-box', outline: 'none' }} 
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const current = Math.max(0, parseInt(paidAmount) || 0);
                        const nextVal = current + 250;
                        setPaidAmount(String(nextVal));
                      }}
                      title="زیادکردن بە ٢٥٠ دینار"
                      style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      +٢٥٠
                    </button>
                  </div>

                  {/* Quick Iraqi Currency Denominations for Partial Payment */}
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setPaidAmount('')}
                      style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      0 ✕
                    </button>
                    {[250, 500, 1000, 5000, 10000, 25000, 50000].map(amt => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => {
                          const current = Math.max(0, parseInt(paidAmount) || 0);
                          setPaidAmount(String(current + amt));
                        }}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        +{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '1.1rem 1.25rem',
                  background: paymentMethod === 'CASH' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(100, 116, 139, 0.08)',
                  borderRadius: '12px',
                  border: `1px solid ${paymentMethod === 'CASH' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(100, 116, 139, 0.2)'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ color: paymentMethod === 'CASH' ? '#10b981' : '#94a3b8', fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '3px' }}>
                      پارەی دراو بە کۆمپانیا:
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {paymentMethod === 'CASH' ? 'نەقد (تەواوی پارەی پسووڵە دراوە)' : 'قەرزی تەواو (هیچ پارەیەک نەدراوە)'}
                    </div>
                  </div>
                  <div style={{ color: paymentMethod === 'CASH' ? '#10b981' : 'var(--text-secondary)', fontWeight: 'bold', fontSize: '1.25rem' }}>
                    {paymentMethod === 'CASH' ? `${totalInvoiceCost.toLocaleString()} دینار` : '٠ دینار'}
                  </div>
                </div>
              )}
            </div>

            {/* Remaining Amount */}
            <div style={{ marginBottom: '1.5rem', padding: '1.1rem 1.25rem', background: totalRemaining > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', border: `1px solid ${totalRemaining > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: totalRemaining > 0 ? '#ef4444' : '#10b981' }}>
                <div>
                  <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>پارەی ماوە (قەرزی کۆمپانیا):</span>
                  {totalRemaining === 0 && <div style={{ fontSize: '0.76rem', color: '#10b981', marginTop: '2px' }}>پسووڵەکە بە تەواوی پاکتاو کراوە</div>}
                </div>
                <span style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>{totalRemaining.toLocaleString()} دینار</span>
              </div>
            </div>

            {/* Save Buttons & Print */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button 
                  onClick={() => handleSaveInvoice(false)}
                  disabled={isSubmitting || items.length === 0}
                  style={{
                    padding: '16px', 
                    borderRadius: '12px', 
                    background: (isSubmitting || items.length === 0) ? 'rgba(255,255,255,0.1)' : 'var(--bg-tertiary)', 
                    color: (isSubmitting || items.length === 0) ? '#64748b' : 'var(--text-primary)', 
                    border: '1px solid var(--border-color)', 
                    fontSize: '1rem', 
                    fontWeight: 'bold', 
                    cursor: (isSubmitting || items.length === 0) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Save size={18} /> پاشەکەوت
                </button>

                <button 
                  onClick={() => handleSaveInvoice(true)}
                  disabled={isSubmitting || items.length === 0}
                  style={{
                    padding: '16px', 
                    borderRadius: '12px', 
                    background: (isSubmitting || items.length === 0) ? 'rgba(255,255,255,0.1)' : '#f43f5e', 
                    color: (isSubmitting || items.length === 0) ? '#64748b' : 'white', 
                    border: 'none', 
                    fontSize: '1rem', 
                    fontWeight: 'bold', 
                    cursor: (isSubmitting || items.length === 0) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: (isSubmitting || items.length === 0) ? 'none' : '0 4px 15px rgba(244,63,94,0.4)'
                  }}
                >
                  <Printer size={18} /> پاشەکەوت و چاپ
                </button>
              </div>

              {printedInvoice && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    color: '#38bdf8',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Printer size={16} /> چاپکردنەوەی دوایین پسووڵەی کڕین ({printedInvoice.invoiceNumber})
                </button>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Quick Add Product Modal (User Approved Feature) */}
      {isQuickAddOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsQuickAddOpen(false)}>
          <div className="pos-modal-card pos-modal-md" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 800 }}>
                  <PackagePlus color="#f43f5e" /> زیادکردنی خێرای کاڵای نوێ
                </h2>
                <small style={{ color: 'var(--text-muted)' }}>ئەم بارکۆدە لە مارکێتدا نەبوو، دەتوانیت لێرە ڕاستەوخۆ زیادی بکەیت</small>
              </div>
              <button onClick={() => setIsQuickAddOpen(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18}/>
              </button>
            </div>

            <form onSubmit={handleQuickAddProductSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>بارکۆد</label>
                <input 
                  type="text" 
                  disabled 
                  value={quickProductData.barcode} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 'bold' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>ناوی کاڵا <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="ناوی کاڵای نوێ بنووسە..."
                  value={quickProductData.name} 
                  onChange={(e) => setQuickProductData({ ...quickProductData, name: e.target.value })} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>کەتەگۆری / جۆر</label>
                <select 
                  value={quickProductData.category_id} 
                  onChange={(e) => setQuickProductData({ ...quickProductData, category_id: e.target.value })} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">بێ کەتەگۆری...</option>
                  {categories.map(c => <option key={c.id} value={c.id} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{c.name}</option>)}
                </select>
              </div>

              <div className="responsive-grid-2">
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>نرخی کڕین (دینار)</label>
                  <input 
                    type="number" 
                    step="250"
                    min="0"
                    placeholder="0"
                    value={quickProductData.cost_price} 
                    onChange={(e) => setQuickProductData({ ...quickProductData, cost_price: e.target.value })} 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold' }} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: '#059669', fontWeight: 'bold' }}>نرخی فرۆشتن (دینار) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="number" 
                    required
                    step="250"
                    min="0"
                    value={quickProductData.selling_price} 
                    onChange={(e) => setQuickProductData({ ...quickProductData, selling_price: e.target.value })} 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1.5px solid rgba(16, 185, 129, 0.4)', color: '#059669', fontWeight: 'bold' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button 
                  type="submit" 
                  style={{ flex: 1, minWidth: '160px', padding: '14px', borderRadius: '12px', background: '#f43f5e', color: '#ffffff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  زیادکردن بۆ پسووڵە
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsQuickAddOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '14px 20px', borderRadius: '12px' }}
                >
                  داخستن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal & Print Styles for Purchase Invoices */}
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

      {/* Hidden Thermal Purchase Receipt (Targeted by @media print) */}
      {printedInvoice && (
        <div id="thermal-purchase-receipt">
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>{storeName}</div>
          <div style={{ textAlign: 'center', fontSize: '11px', color: '#333' }}>پەیوەندی: {storePhone}</div>
          <div className="purchase-divider"></div>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>وەسڵی کڕینی کاڵا</div>
          <div className="purchase-divider"></div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ژمارەی وەسڵ:</span>
            <span style={{ fontWeight: 'bold', direction: 'ltr' }}>{printedInvoice.invoiceNumber}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>دابینکەر / کۆمپانیا:</span>
            <span style={{ fontWeight: 'bold' }}>{printedInvoice.supplierName}</span>
          </div>
          {printedInvoice.supplierPhone && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ژمارەی مۆبایل:</span>
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
              <span>تێچووی زیادە (بار / حەماڵی):</span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#000' }}>
              <span>قەرزی ماوە:</span>
              <span>{printedInvoice.remainingAmount.toLocaleString()} د.ع</span>
            </div>
          )}

          <div className="purchase-divider"></div>
          <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '6px' }}>وەسڵی فەرمیی کڕین • بەشی کۆگا</div>
        </div>
      )}

    </div>
  );
};

export default Purchases;
