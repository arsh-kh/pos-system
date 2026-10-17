import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { 
  Truck, 
  Building2, 
  Search, 
  Plus, 
  RotateCcw, 
  Printer, 
  Calendar, 
  X, 
  Filter, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  UserCheck,
  TrendingDown,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const REASON_PRESETS = [
  'بەسەردەچوونی بەروار (Expired)',
  'تێکچوون یان کەم و کوڕی لە کارگە',
  'شکان و لەدەستچوون لە گواستنەوەدا',
  'کاڵای هەڵە / جیاواز لە داواکاری',
  'گۆڕینەوە بە کاڵای نوێ (Exchange)',
  'هۆکاری تر'
];

const VendorReturns = () => {
  const { user, isAdmin } = useAuth();

  // State
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [returnsList, setReturnsList] = useState([]);
  const [stats, setStats] = useState({
    this_month: { this_month_refund: 0, this_month_units: 0, this_month_records: 0 },
    today: { today_refund: 0, today_units: 0, today_records: 0 },
    lifetime: { lifetime_refund: 0, lifetime_units: 0, lifetime_records: 0 },
    top_suppliers: []
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [unitType, setUnitType] = useState('PIECE'); // 'PIECE' or 'BOX'
  const [quantity, setQuantity] = useState('1');
  const [costPrice, setCostPrice] = useState('');
  const [refundType, setRefundType] = useState('DEBT_DEDUCT'); // 'DEBT_DEDUCT' or 'CASH_REFUND'
  const [reason, setReason] = useState(REASON_PRESETS[0]);
  const [notes, setNotes] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  // Filters State
  const [timeFilter, setTimeFilter] = useState('THIS_MONTH'); // 'THIS_MONTH', 'TODAY', 'ALL'
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Printable Voucher State
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const barcodeInputRef = useRef(null);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [supRes, prodRes, retRes, statsRes] = await Promise.all([
        axios.get('http://localhost:3001/api/suppliers'),
        axios.get('http://localhost:3001/api/products'),
        axios.get('http://localhost:3001/api/purchase-returns', {
          params: { filter: timeFilter, supplier_id: supplierFilter, search: searchQuery }
        }),
        axios.get('http://localhost:3001/api/purchase-returns/stats')
      ]);

      if (supRes.data.status === 'SUCCESS') setSuppliers(supRes.data.data);
      if (prodRes.data.status === 'SUCCESS') setProducts(prodRes.data.data);
      if (retRes.data.status === 'SUCCESS') setReturnsList(retRes.data.data);
      if (statsRes.data.status === 'SUCCESS') setStats(statsRes.data.data);
    } catch (err) {
      console.error('Error fetching RTV data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeFilter, supplierFilter]);

  // Selected supplier object & remaining debt
  const selectedSupplierObj = useMemo(() => {
    if (!selectedSupplierId) return null;
    return suppliers.find(s => String(s.id) === String(selectedSupplierId)) || null;
  }, [suppliers, selectedSupplierId]);

  // Autocomplete products
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return products.filter(p => 
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.box_barcode?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [products, productSearch]);

  // Select Product
  const handleSelectProduct = (prod) => {
    setSelectedProduct(prod);
    setProductSearch(prod.name);
    setIsProductDropdownOpen(false);
    setCostPrice(prod.cost_price || 0);

    // Auto switch to BOX if searched by carton barcode
    if (prod.box_barcode && productSearch.trim() === prod.box_barcode) {
      setUnitType('BOX');
    } else {
      setUnitType('PIECE');
    }
  };

  // Instant Barcode Scan Enter Key
  const handleProductSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = productSearch.trim();
      if (!code) return;

      const exact = products.find(p => p.barcode === code || p.box_barcode === code);
      if (exact) {
        handleSelectProduct(exact);
      } else if (filteredProducts.length > 0) {
        handleSelectProduct(filteredProducts[0]);
      }
    }
  };

  // Live Calculations
  const calculations = useMemo(() => {
    if (!selectedProduct) return { totalUnits: 0, totalRefund: 0, multiplier: 1, isBox: false, newRemainingDebt: 0 };
    const qty = parseFloat(quantity) || 0;
    const isBox = unitType === 'BOX';
    const multiplier = isBox ? Math.max(1, parseFloat(selectedProduct.units_per_box) || 1) : 1;
    const totalUnits = qty * multiplier;
    const unitCost = parseFloat(costPrice) || 0;
    const totalRefund = Math.round(totalUnits * unitCost);

    const currentDebt = Number(selectedSupplierObj?.total_remaining || 0);
    const newRemainingDebt = refundType === 'DEBT_DEDUCT' ? Math.max(0, currentDebt - totalRefund) : currentDebt;

    return { totalUnits, totalRefund, multiplier, isBox, currentDebt, newRemainingDebt };
  }, [selectedProduct, unitType, quantity, costPrice, selectedSupplierObj, refundType]);

  // Filter history live search
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return returnsList;
    const q = searchQuery.toLowerCase();
    return returnsList.filter(r => 
      r.product_name?.toLowerCase().includes(q) ||
      r.product_barcode?.toLowerCase().includes(q) ||
      r.supplier_name?.toLowerCase().includes(q) ||
      r.representative_name?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    );
  }, [returnsList, searchQuery]);

  // Submit Return to Vendor
  const handleSubmitReturn = async (e) => {
    e.preventDefault();

    if (!selectedProduct) {
      alert('تکایە سەرەتا کاڵایەک دەستنیشان بکە یان بارکۆدەکەی لێبدە.');
      return;
    }

    const qty = parseFloat(quantity);
    if (!qty || qty <= 0 || isNaN(qty)) {
      alert('تکایە ژمارەی دروستی کاڵای گەڕاوە بنووسە.');
      return;
    }

    const cost = parseFloat(costPrice);
    if (isNaN(cost) || cost < 0) {
      alert('تکایە نرخی تێچوونی دروست بنووسە.');
      return;
    }

    const supName = selectedSupplierObj?.name || 'کڕینی لۆکاڵی / بێ کۆمپانیا';
    const confirmPrompt = `دڵنیایت لە گەڕاندنەوەی ئەم کاڵایە بۆ کۆمپانیا؟
- کۆمپانیا: ${supName}
- مەندوب: ${representativeName || 'دیارینەکراو'}
- کاڵا: ${selectedProduct.name}
- بڕ: ${qty} ${unitType === 'BOX' ? 'کارتۆن' : 'دانە'} (کۆی گشتی: ${calculations.totalUnits} دانە لە مەخزەن دەرچوو)
- کۆی پارەی گەڕێنراوە: ${calculations.totalRefund.toLocaleString()} دینار
- شێوازی پاکتاوکردن: ${refundType === 'DEBT_DEDUCT' ? 'داشکاندن لە قەرزی کۆمپانیا' : 'وەرگرتنەوەی نەقد'}
- قەرزی کۆمپانیا دەبێتە: ${calculations.newRemainingDebt.toLocaleString()} دینار`;

    if (!window.confirm(confirmPrompt)) return;

    setSubmitting(true);
    try {
      const res = await axios.post('http://localhost:3001/api/purchase-returns', {
        supplier_id: selectedSupplierId || null,
        product_id: selectedProduct.id,
        unit_type: unitType,
        quantity: qty,
        cost_price: cost,
        refund_type: refundType,
        reason: reason,
        representative_name: representativeName,
        notes: notes
      }, {
        headers: {
          'x-user-name': user?.username || 'کاشێر'
        }
      });

      if (res.data.status === 'SUCCESS') {
        alert(res.data.message);

        // Prepare Voucher
        setSelectedReceipt({
          id: res.data.data.return_id,
          supplier_name: res.data.data.supplier_name,
          supplier_phone: res.data.data.supplier_phone,
          representative_name: representativeName || 'دیارینەکراو',
          product_name: selectedProduct.name,
          barcode: (unitType === 'BOX' && selectedProduct.box_barcode) ? selectedProduct.box_barcode : selectedProduct.barcode,
          quantity: qty,
          unit: unitType === 'BOX' ? `کارتۆن (${calculations.multiplier} دانەیی)` : 'دانە',
          total_units: calculations.totalUnits,
          cost_price: cost,
          total_refund: calculations.totalRefund,
          refund_type: refundType,
          prev_supplier_debt: calculations.currentDebt,
          new_supplier_debt: calculations.newRemainingDebt,
          reason: reason,
          notes: notes,
          created_by_username: user?.username || 'کاشێر',
          created_at: new Date().toISOString()
        });

        // Reset form
        setSelectedProduct(null);
        setProductSearch('');
        setQuantity('1');
        setCostPrice('');
        setNotes('');
        setUnitType('PIECE');

        // Refresh Data
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە گەڕاندنەوە بۆ کۆمپانیا');
    } finally {
      setSubmitting(false);
    }
  };

  // Revert / Delete Return (Admin Only)
  const handleDeleteReturn = async (id, prodName, unitsDeducted, refundAmount) => {
    if (!isAdmin) {
      alert('⚠️ تەنها بەڕێوەبەر (Admin) دەسەڵاتی هەڵوەشاندنەوەی گەڕاندنەوەی هەیە.');
      return;
    }

    if (!window.confirm(`ئایا دڵنیایت لە هەڵوەشاندنەوەی ئەم گەڕاندنەوەیە؟
- بڕی ${unitsDeducted} دانە دەگەڕێتەوە بۆ مەخزەنی "${prodName}".
- بڕی ${Number(refundAmount).toLocaleString()} دینار دەگەڕێتەوە سەر قەرزی کۆمپانیا.`)) {
      return;
    }

    try {
      const res = await axios.delete(`http://localhost:3001/api/purchase-returns/${id}`, {
        headers: {
          'x-user-name': user?.username || 'ئەدمین'
        }
      });
      if (res.data.status === 'SUCCESS') {
        alert(res.data.message);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە سڕینەوە');
    }
  };

  const printVoucher = () => {
    window.print();
  };

  return (
    <div className="dashboard-page p-8" dir="rtl">
      {/* Header */}
      <div className="page-header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0 0 6px 0', color: '#0ea5e9' }}>
            <Truck size={34} color="#0ea5e9" />
            گەڕاندنەوە بۆ کۆمپانیا و مەندوب (Return to Vendor - RTV)
          </h1>
          <p className="text-secondary" style={{ margin: 0, fontSize: '0.95rem' }}>
            گەڕاندنەوەی کاڵای بەسەرچوو، شکاو و تێکچوو بۆ مەندوبی کۆمپانیا و داشکاندنی ڕاستەوخۆ لە قەرزی کۆمپانیا
          </p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid mb-8">
        {/* This Month Refund */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(14, 165, 233, 0.08)', borderColor: 'rgba(14, 165, 233, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>گەڕێنراوەی ئەم مانگە</h3>
            <DollarSign size={22} color="#0ea5e9" />
          </div>
          <div className="value highlight" style={{ color: '#0ea5e9' }}>
            {Number(stats.this_month?.this_month_refund || 0).toLocaleString()} دینار
          </div>
          <div className="sub-text" style={{ color: '#7dd3fc' }}>
            داشکێندراو لە حسابی کۆمپانیاکان لەم مانگەدا
          </div>
        </div>

        {/* This Month Units */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>کۆی دانەی گەڕێنراوە</h3>
            <TrendingDown size={22} color="#10b981" />
          </div>
          <div className="value" style={{ color: '#10b981' }}>
            {Number(stats.this_month?.this_month_units || 0).toLocaleString()} دانە
          </div>
          <div className="sub-text" style={{ color: '#a7f3d0' }}>
            دەرچوو لە کۆگای مارکێت بۆ مەندوبەکان
          </div>
        </div>

        {/* Today Refund */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>گەڕێنراوەی ئەمڕۆ</h3>
            <Calendar size={22} color="#f59e0b" />
          </div>
          <div className="value" style={{ color: '#f59e0b' }}>
            {Number(stats.today?.today_refund || 0).toLocaleString()} دینار
          </div>
          <div className="sub-text" style={{ color: '#fde68a' }}>
            {stats.today?.today_records || 0} تۆماری گەڕاندنەوە لە بەرواری ئەمڕۆ
          </div>
        </div>

        {/* Lifetime Refund */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(168, 85, 247, 0.08)', borderColor: 'rgba(168, 85, 247, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>کۆی گشتی هەموو کات</h3>
            <Building2 size={22} color="#a855f7" />
          </div>
          <div className="value" style={{ color: '#c084fc' }}>
            {Number(stats.lifetime?.lifetime_refund || 0).toLocaleString()} دینار
          </div>
          <div className="sub-text" style={{ color: '#e9d5ff' }}>
            کۆی گشتی پاکتاوکراوی کۆمپانیاکان
          </div>
        </div>
      </div>

      {/* Main Layout: Form Card & History */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        
        {/* Form Card */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(14, 165, 233, 0.25)', background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', margin: '0 0 20px 0', color: '#38bdf8' }}>
            <Plus size={22} /> تۆمارکردنی گەڕاندنەوەی کاڵا بۆ مەندوب
          </h2>

          <form onSubmit={handleSubmitReturn}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              
              {/* Supplier Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  کۆمپانیا / دابینکەر:
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">-- دیاریکردنی کۆمپانیا (یان کڕینی لۆکاڵی) --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      🏢 {s.name} (قەرز لای مارکێت: {Number(s.total_remaining || 0).toLocaleString()} د.ع)
                    </option>
                  ))}
                </select>
              </div>

              {/* Representative Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  ناوی مەندوب / نوێنەری کۆمپانیا:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="نموونە: کاک کاروان، کاک سەردار..."
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      paddingLeft: '38px',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'white',
                      fontSize: '0.95rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <UserCheck size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                </div>
              </div>

              {/* Product Search & Autocomplete */}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  کاڵا یان بارکۆد:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="بارکۆد لێبدە یان ناوی کاڵا بنووسە..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setIsProductDropdownOpen(true);
                      if (!e.target.value.trim()) setSelectedProduct(null);
                    }}
                    onFocus={() => setIsProductDropdownOpen(true)}
                    onKeyDown={handleProductSearchKeyDown}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      paddingLeft: '38px',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.06)',
                      border: selectedProduct ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.15)',
                      color: 'white',
                      fontSize: '0.95rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                </div>

                {/* Dropdown Results */}
                {isProductDropdownOpen && filteredProducts.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    left: 0,
                    marginTop: '6px',
                    background: '#1e293b',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    zIndex: 100,
                    maxHeight: '260px',
                    overflowY: 'auto'
                  }}>
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', color: 'white', fontSize: '0.95rem' }}>{p.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            بارکۆد: {p.barcode || '-'} {p.box_barcode ? `| کارتۆن: ${p.box_barcode}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'left', fontSize: '0.85rem' }}>
                          <span style={{ color: '#38bdf8' }}>مەخزەن: {p.stock} دانە</span>
                          <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>تێچوون: {Number(p.cost_price || 0).toLocaleString()} د.ع</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unit Type Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  جۆری یەکە:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setUnitType('PIECE')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: unitType === 'PIECE' ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                      background: unitType === 'PIECE' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.04)',
                      color: unitType === 'PIECE' ? '#38bdf8' : '#94a3b8',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.95rem'
                    }}
                  >
                    📦 دانە (Piece)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitType('BOX')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: unitType === 'BOX' ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.12)',
                      background: unitType === 'BOX' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.04)',
                      color: unitType === 'BOX' ? '#f59e0b' : '#94a3b8',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.95rem'
                    }}
                  >
                    📦 کارتۆن {selectedProduct?.units_per_box > 1 ? `(${selectedProduct.units_per_box} دانەیی)` : ''}
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  ژمارەی گەڕاوە (بڕ):
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Cost Price per Unit */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  نرخی تێچوونی دانە (دینار):
                </label>
                <input
                  type="number"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="نرخی تێچوون..."
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white',
                    fontSize: '1rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Settlement Type */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  شێوازی پاکتاوکردن:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setRefundType('DEBT_DEDUCT')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: refundType === 'DEBT_DEDUCT' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.12)',
                      background: refundType === 'DEBT_DEDUCT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)',
                      color: refundType === 'DEBT_DEDUCT' ? '#10b981' : '#94a3b8',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.85rem'
                    }}
                  >
                    💳 کەمکردنەوە لە قەرز
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundType('CASH_REFUND')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: refundType === 'CASH_REFUND' ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                      background: refundType === 'CASH_REFUND' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.04)',
                      color: refundType === 'CASH_REFUND' ? '#38bdf8' : '#94a3b8',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.85rem'
                    }}
                  >
                    💵 وەرگرتنی نەقد
                  </button>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  هۆکاری گەڕاندنەوە:
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  {REASON_PRESETS.map((r, i) => (
                    <option key={i} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  تێبینی زیاتر:
                </label>
                <input
                  type="text"
                  placeholder="نموونە: بە فەرمی لەگەڵ مەندوب پشکنرا..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

            </div>

            {/* Live Calculation Banner */}
            {selectedProduct && (
              <div style={{
                background: 'rgba(14, 165, 233, 0.12)',
                border: '1px solid rgba(14, 165, 233, 0.35)',
                borderRadius: '14px',
                padding: '14px 20px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#38bdf8' }}>
                    کۆی بڕی پارەی گەڕێنراوە: {calculations.totalRefund.toLocaleString()} دینار
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '4px' }}>
                    دەرچوون لە مەخزەن: <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{calculations.totalUnits} دانە</span>
                    {calculations.isBox && ` (بەپێی پێوانەی ${calculations.multiplier} دانە بۆ هەر کارتۆنێک)`}
                    {' | '} مەخزەنی ئێستا: {selectedProduct.stock} دانە 
                    {' ⬅️ '} دەبێتە: {Number(selectedProduct.stock) - calculations.totalUnits} دانە
                  </div>

                  {selectedSupplierObj && refundType === 'DEBT_DEDUCT' && (
                    <div style={{ fontSize: '0.85rem', color: '#a7f3d0', marginTop: '4px', fontWeight: 'bold' }}>
                      قەرزی کۆمپانیا لای مارکێت: {calculations.currentDebt.toLocaleString()} د.ع 
                      {' ⬅️ '} کەم دەبێتەوە بۆ: {calculations.newRemainingDebt.toLocaleString()} دینار
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '12px 28px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 15px rgba(14, 165, 233, 0.4)'
                  }}
                >
                  <Truck size={20} />
                  {submitting ? 'تۆمار دەکرێت...' : 'گەڕاندنەوە بۆ مەندوب و داشکاندنی قەرز'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* History Table & Filters */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', margin: 0 }}>
              <Filter size={22} color="#38bdf8" /> مێژووی کاڵا گەڕێنراوەکان بۆ کۆمپانیاکان
            </h2>

            {/* Filter Tabs & Search */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setTimeFilter('THIS_MONTH')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: timeFilter === 'THIS_MONTH' ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                  color: timeFilter === 'THIS_MONTH' ? '#0f172a' : 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.85rem'
                }}
              >
                ئەم مانگە
              </button>
              <button
                onClick={() => setTimeFilter('TODAY')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: timeFilter === 'TODAY' ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                  color: timeFilter === 'TODAY' ? '#0f172a' : 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.85rem'
                }}
              >
                ئەمڕۆ
              </button>
              <button
                onClick={() => setTimeFilter('ALL')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: timeFilter === 'ALL' ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                  color: timeFilter === 'ALL' ? '#0f172a' : 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.85rem'
                }}
              >
                هەمووی
              </button>

              {/* Supplier Filter */}
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white',
                  fontSize: '0.85rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">هەموو کۆمپانیاکان</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {/* Search Bar */}
              <input
                type="text"
                placeholder="گەڕان لە مێژوودا..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white',
                  fontSize: '0.85rem',
                  outline: 'none',
                  minWidth: '180px'
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                  <th style={{ padding: '12px' }}>#</th>
                  <th style={{ padding: '12px' }}>بەروار</th>
                  <th style={{ padding: '12px' }}>کۆمپانیا</th>
                  <th style={{ padding: '12px' }}>مەندوب</th>
                  <th style={{ padding: '12px' }}>ناوی کاڵا</th>
                  <th style={{ padding: '12px' }}>بڕی گەڕێنراوە</th>
                  <th style={{ padding: '12px' }}>دەرچوو لە کۆگا</th>
                  <th style={{ padding: '12px' }}>کۆی پارە</th>
                  <th style={{ padding: '12px' }}>شێوازی پاکتاوکردن</th>
                  <th style={{ padding: '12px' }}>هۆکار و تێبینی</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>کردار</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      هیچ تۆمارێکی گەڕاندنەوە بۆ کۆمپانیا نەدۆزرایەوە.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item, idx) => {
                    const unitsDeducted = parseFloat(item.quantity) * parseFloat(item.units_multiplier || 1);

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                          {new Date(item.created_at).toLocaleString('ku-IQ')}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#38bdf8' }}>
                          {item.supplier_name}
                        </td>
                        <td style={{ padding: '12px', color: '#cbd5e1' }}>
                          {item.representative_name || '-'}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: 'white' }}>
                          {item.product_name}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontWeight: 'bold' }}>{Number(item.quantity)}</span> {item.unit_type === 'BOX' ? 'کارتۆن' : 'دانە'}
                        </td>
                        <td style={{ padding: '12px', color: '#fbbf24', fontWeight: 'bold' }}>
                          {unitsDeducted} دانە
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#10b981' }}>
                          {Number(item.total_refund).toLocaleString()} دینار
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            background: item.refund_type === 'DEBT_DEDUCT' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                            color: item.refund_type === 'DEBT_DEDUCT' ? '#10b981' : '#38bdf8',
                            border: `1px solid ${item.refund_type === 'DEBT_DEDUCT' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`
                          }}>
                            {item.refund_type === 'DEBT_DEDUCT' ? '💳 داشکاندن لە قەرز' : '💵 وەرگرتنی نەقد'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '0.85rem', color: '#94a3b8' }}>
                          <div>{item.reason || '-'}</div>
                          {item.notes && <small style={{ color: '#64748b' }}>({item.notes})</small>}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              onClick={() => setSelectedReceipt({
                                id: item.id,
                                supplier_name: item.supplier_name,
                                supplier_phone: item.supplier_phone,
                                representative_name: item.representative_name || 'دیارینەکراو',
                                product_name: item.product_name,
                                barcode: item.product_barcode,
                                quantity: item.quantity,
                                unit: item.unit_type === 'BOX' ? `کارتۆن (${item.units_multiplier} دانەیی)` : 'دانە',
                                total_units: unitsDeducted,
                                cost_price: item.cost_price,
                                total_refund: item.total_refund,
                                refund_type: item.refund_type,
                                prev_supplier_debt: item.supplier_current_debt,
                                new_supplier_debt: item.supplier_current_debt,
                                reason: item.reason,
                                notes: item.notes,
                                created_by_username: item.created_by_username || 'کاشێر',
                                created_at: item.created_at
                              })}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '8px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: '#38bdf8',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="چاپکردنی پسووڵەی فەرمی"
                            >
                              <Printer size={14} /> پسووڵە
                            </button>

                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteReturn(item.id, item.product_name, unitsDeducted, item.total_refund)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#f87171',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="هەڵوەشاندنەوە و گەڕاندنەوە بۆ کۆگا و قەرز"
                              >
                                <RotateCcw size={14} /> هەڵوەشاندنەوە
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Modal: Printable RTV Voucher for Vendor */}
      {selectedReceipt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', padding: '24px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', margin: 0, color: '#38bdf8' }}>
                <Truck size={20} /> پسووڵەی گەڕاندنەوە بۆ کۆمپانیا (RTV)
              </h2>
              <button onClick={() => setSelectedReceipt(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Printable Area */}
            <div id="rtv-voucher-printable-area" style={{ background: '#ffffff', color: '#000000', padding: '20px 18px', borderRadius: '8px', fontFamily: 'monospace, Tahoma', fontSize: '13px', lineHeight: '1.5', direction: 'rtl' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '12px', marginBottom: '12px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>مارکێتی زیرەک</h3>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 'bold', color: '#0284c7' }}>پسووڵەی گەڕاندنەوەی کاڵا بۆ مەندوب (RTV)</h4>
                <div style={{ fontSize: '12px' }}>ژمارەی تۆمار: #{selectedReceipt.id}</div>
              </div>

              <div style={{ fontSize: '11px', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}>
                <div>بەروار: {new Date(selectedReceipt.created_at).toLocaleString('ku-IQ')}</div>
                <div>کۆمپانیا: <strong>{selectedReceipt.supplier_name}</strong></div>
                <div>مەندوب / وەرگر: <strong>{selectedReceipt.representative_name}</strong></div>
                {selectedReceipt.supplier_phone && <div>پەیوەندی: {selectedReceipt.supplier_phone}</div>}
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
                  <span>بڕی دراوەتەوە بە مەندوب:</span>
                  <span>{selectedReceipt.quantity} {selectedReceipt.unit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>کۆی دەرچوو لە کۆگا:</span>
                  <span>{selectedReceipt.total_units} دانە</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>تێچوونی دانە:</span>
                  <span>{Number(selectedReceipt.cost_price).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>هۆکاری گەڕاندنەوە:</span>
                  <span>{selectedReceipt.reason}</span>
                </div>
                {selectedReceipt.notes && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: '#555' }}>
                    <span>تێبینی:</span>
                    <span>{selectedReceipt.notes}</span>
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', color: '#0284c7', marginBottom: '6px' }}>
                  <span>کۆی پارەی گەڕێنراوە:</span>
                  <span>{Number(selectedReceipt.total_refund).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', color: selectedReceipt.refund_type === 'DEBT_DEDUCT' ? '#047857' : '#b45309' }}>
                  <span>شێوازی پاکتاوکردن:</span>
                  <span>
                    {selectedReceipt.refund_type === 'DEBT_DEDUCT' ? '💳 داشکاندن لە قەرزی کۆمپانیا' : '💵 وەرگرتنەوەی نەقد لە مەندوب'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '10px', fontSize: '11px', textAlign: 'center' }}>
                <div style={{ width: '45%' }}>
                  <div>واژۆی مەندوبی کۆمپانیا</div>
                  <div style={{ marginTop: '25px', borderBottom: '1px dotted #000' }}></div>
                </div>
                <div style={{ width: '45%' }}>
                  <div>واژۆی بەرپرسی کۆگا / مارکێت</div>
                  <div style={{ marginTop: '25px', borderBottom: '1px dotted #000' }}></div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '10px', color: '#555' }}>
                ئەم پسووڵەیە وەک بەڵگەنامەی فەرمی بۆ داشکاندنی باڵانسی کۆمپانیا کارپێکراوە.
              </div>
            </div>

            {/* Modal Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button 
                onClick={printVoucher}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
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

      {/* Print CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #rtv-voucher-printable-area, #rtv-voucher-printable-area * {
            visibility: visible;
          }
          #rtv-voucher-printable-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 80mm;
            margin: 0;
            padding: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default VendorReturns;
