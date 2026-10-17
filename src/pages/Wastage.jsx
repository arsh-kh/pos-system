import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { 
  PackageX, 
  Search, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Flame, 
  Filter, 
  RotateCcw, 
  Printer, 
  Calendar, 
  CheckCircle2, 
  X,
  TrendingDown,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const REASON_OPTIONS = [
  { value: 'EXPIRED', label: 'بەسەردەچوون (بەروار بەسەرچوو)', color: '#ef4444', icon: '⏳' },
  { value: 'BROKEN', label: 'شکان و لەدەستچوون', color: '#f97316', icon: '💥' },
  { value: 'DAMAGED', label: 'تێکچوو / کەم و کوڕی', color: '#eab308', icon: '⚠️' },
  { value: 'THEFT_OR_LOST', label: 'ونبوون یان دزراو', color: '#a855f7', icon: '🔍' },
  { value: 'OTHER', label: 'هۆکاری تر', color: '#64748b', icon: '📝' }
];

const Wastage = () => {
  const { user, isAdmin } = useAuth();
  
  // Products and Data state
  const [products, setProducts] = useState([]);
  const [damagesList, setDamagesList] = useState([]);
  const [stats, setStats] = useState({
    this_month: { this_month_loss: 0, this_month_units: 0, this_month_records: 0 },
    today: { today_loss: 0, today_units: 0, today_records: 0 },
    lifetime: { lifetime_loss: 0, lifetime_units: 0, lifetime_records: 0 },
    reason_breakdown: [],
    top_products: []
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters state
  const [timeFilter, setTimeFilter] = useState('THIS_MONTH'); // 'THIS_MONTH', 'TODAY', 'ALL'
  const [selectedReason, setSelectedReason] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [unitType, setUnitType] = useState('PIECE'); // 'PIECE' or 'BOX'
  const [quantity, setQuantity] = useState('1');
  const [costPrice, setCostPrice] = useState('');
  const [reason, setReason] = useState('DAMAGED');
  const [notes, setNotes] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Printable receipt state
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const barcodeInputRef = useRef(null);

  // Fetch all initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, statsRes, histRes] = await Promise.all([
        axios.get('http://localhost:3001/api/products'),
        axios.get('http://localhost:3001/api/damages/stats'),
        axios.get('http://localhost:3001/api/damages', {
          params: { filter: timeFilter, reason: selectedReason, search: searchQuery }
        })
      ]);

      if (prodRes.data.status === 'SUCCESS') setProducts(prodRes.data.data);
      if (statsRes.data.status === 'SUCCESS') setStats(statsRes.data.data);
      if (histRes.data.status === 'SUCCESS') setDamagesList(histRes.data.data);
    } catch (err) {
      console.error('Error fetching damages data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeFilter, selectedReason]);

  // Handle live search in history table
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return damagesList;
    const q = searchQuery.toLowerCase();
    return damagesList.filter(d => 
      d.product_name?.toLowerCase().includes(q) ||
      d.barcode?.toLowerCase().includes(q) ||
      d.notes?.toLowerCase().includes(q) ||
      d.reason_label?.toLowerCase().includes(q)
    );
  }, [damagesList, searchQuery]);

  // Autocomplete products for recording
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return products.filter(p => 
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.box_barcode?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [products, productSearch]);

  // Product Selection handler
  const handleSelectProduct = (prod) => {
    setSelectedProduct(prod);
    setProductSearch(prod.name);
    setIsDropdownOpen(false);
    setCostPrice(prod.cost_price || 0);

    // If product has carton barcode matching search, auto switch to BOX
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

  // Live Loss & Quantity Calculations
  const calculationSummary = useMemo(() => {
    if (!selectedProduct) return { totalUnits: 0, totalLoss: 0, multiplier: 1 };
    
    const qty = parseFloat(quantity) || 0;
    const isBox = unitType === 'BOX';
    const multiplier = isBox ? Math.max(1, parseFloat(selectedProduct.units_per_box) || 1) : 1;
    const totalUnits = qty * multiplier;
    const unitCost = parseFloat(costPrice) || 0;
    const totalLoss = Math.round(totalUnits * unitCost);

    return { totalUnits, totalLoss, multiplier, isBox };
  }, [selectedProduct, unitType, quantity, costPrice]);

  // Submit Wastage / Damage Record
  const handleSubmitDamage = async (e) => {
    e.preventDefault();

    if (!selectedProduct) {
      alert('تکایە سەرەتا کاڵایەک دەستنیشان بکە یان بارکۆدەکەی لێبدە.');
      return;
    }

    const qty = parseFloat(quantity);
    if (!qty || qty <= 0 || isNaN(qty)) {
      alert('تکایە بڕێکی دروست بنووسە.');
      return;
    }

    const cost = parseFloat(costPrice);
    if (isNaN(cost) || cost < 0) {
      alert('تکایە نرخی تێچوونی دروست بنووسە.');
      return;
    }

    const confirmMsg = `دڵنیایت لە تۆمارکردنی زیانی:
- کاڵا: ${selectedProduct.name}
- بڕ: ${qty} ${unitType === 'BOX' ? 'کارتۆن' : 'دانە'} (کۆی گشتی: ${calculationSummary.totalUnits} دانە لە مەخزەن کەم دەبێتەوە)
- زەرەری دارایی: ${calculationSummary.totalLoss.toLocaleString()} دینار
- هۆکار: ${REASON_OPTIONS.find(r => r.value === reason)?.label}?`;

    if (!window.confirm(confirmMsg)) return;

    setSubmitting(true);
    try {
      const res = await axios.post('http://localhost:3001/api/damages', {
        product_id: selectedProduct.id,
        unit_type: unitType,
        quantity: qty,
        cost_price: cost,
        reason: reason,
        notes: notes
      }, {
        headers: {
          'x-user-name': user?.username || 'کاشێر'
        }
      });

      if (res.data.status === 'SUCCESS') {
        alert(res.data.message);

        // Prepare Printable Receipt
        setSelectedReceipt({
          id: res.data.data.damage_id,
          product_name: selectedProduct.name,
          barcode: (unitType === 'BOX' && selectedProduct.box_barcode) ? selectedProduct.box_barcode : selectedProduct.barcode,
          quantity: qty,
          unit: unitType === 'BOX' ? `کارتۆن (${calculationSummary.multiplier} دانەیی)` : 'دانە',
          total_units: calculationSummary.totalUnits,
          cost_price: cost,
          total_loss: calculationSummary.totalLoss,
          reason_label: res.data.data.reason,
          notes: notes,
          username: user?.username || 'کاشێر',
          created_at: new Date().toISOString()
        });

        // Reset Form
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
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی زیان');
    } finally {
      setSubmitting(false);
    }
  };

  // Revert / Delete Damage Record (Admin Only)
  const handleDeleteDamage = async (id, prodName, unitsDeducted) => {
    if (!isAdmin) {
      alert('⚠️ تەنها بەڕێوەبەر (Admin) دەسەڵاتی هەڵوەشاندنەوەی زیانی هەیە.');
      return;
    }

    if (!window.confirm(`ئایا دڵنیایت لە هەڵوەشاندنەوەی ئەم زیانە؟ بڕی ${unitsDeducted} دانە دەگەڕێتەوە بۆ ناو مەخزەنی "${prodName}".`)) {
      return;
    }

    try {
      const res = await axios.delete(`http://localhost:3001/api/damages/${id}`, {
        headers: {
          'x-user-name': user?.username || 'ئەدمین'
        }
      });
      if (res.data.status === 'SUCCESS') {
        alert(res.data.message);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە سڕینەوەی زیان');
    }
  };

  const printReceipt = () => {
    window.print();
  };

  return (
    <div className="dashboard-page p-8" dir="rtl">
      {/* Header */}
      <div className="page-header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0 0 6px 0', color: '#f87171' }}>
            <PackageX size={34} color="#ef4444" />
            تۆمارکردنی زیان و فەوتانی کاڵا (Wastage & Damage)
          </h1>
          <p className="text-secondary" style={{ margin: 0, fontSize: '0.95rem' }}>
            تۆمارکردنی کاڵای بەسەرچوو، شکاو و تێکچوو بۆ دەرکردن لە مەخزەن و دیاریکردنی زەرەری دارایی بۆ پاراستنی قازانجی ڕاستەقینە
          </p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid mb-8">
        {/* This Month Loss */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>کۆی زەرەری ئەم مانگە</h3>
            <Flame size={22} color="#ef4444" />
          </div>
          <div className="value highlight" style={{ color: '#f87171' }}>
            {Number(stats.this_month?.this_month_loss || 0).toLocaleString()} دینار
          </div>
          <div className="sub-text" style={{ color: '#fca5a5' }}>
            لە {stats.this_month?.this_month_records || 0} تۆماری جیاواز
          </div>
        </div>

        {/* This Month Units */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>کاڵای فەوتاوی ئەم مانگە</h3>
            <TrendingDown size={22} color="#f59e0b" />
          </div>
          <div className="value" style={{ color: '#fbbf24' }}>
            {Number(stats.this_month?.this_month_units || 0).toLocaleString()} دانە
          </div>
          <div className="sub-text" style={{ color: '#fde68a' }}>
            کۆی گشتی ئەو دانانەی لە مەخزەن دەرچوون
          </div>
        </div>

        {/* Today Loss */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>زەرەری تۆمارکراوی ئەمڕۆ</h3>
            <Calendar size={22} color="#38bdf8" />
          </div>
          <div className="value" style={{ color: '#38bdf8' }}>
            {Number(stats.today?.today_loss || 0).toLocaleString()} دینار
          </div>
          <div className="sub-text" style={{ color: '#bae6fd' }}>
            {stats.today?.today_units || 0} دانە لە بەرواری ئەمڕۆ
          </div>
        </div>

        {/* Lifetime Loss */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(168, 85, 247, 0.08)', borderColor: 'rgba(168, 85, 247, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>کۆی گشتی زیان (هەموو کات)</h3>
            <AlertTriangle size={22} color="#a855f7" />
          </div>
          <div className="value" style={{ color: '#c084fc' }}>
            {Number(stats.lifetime?.lifetime_loss || 0).toLocaleString()} دینار
          </div>
          <div className="sub-text" style={{ color: '#e9d5ff' }}>
            کۆی گشتی فەوتان لە سەرەتای کارکردنەوە
          </div>
        </div>
      </div>

      {/* Main Content Layout: Form & History */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        
        {/* Form Card */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.25)', background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', margin: '0 0 20px 0', color: '#f87171' }}>
            <Plus size={22} /> تۆمارکردنی کاڵای زیانلێکەوتووی نوێ
          </h2>

          <form onSubmit={handleSubmitDamage}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              
              {/* Product Search & Autocomplete */}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  کاڵا یان بارکۆد:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="بارکۆد سکان بکە یان ناوی کاڵا بنووسە..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setIsDropdownOpen(true);
                      if (!e.target.value.trim()) setSelectedProduct(null);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
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
                {isDropdownOpen && filteredProducts.length > 0 && (
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
                  ژمارەی کاڵا (بڕ):
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
                  placeholder="نرخی تێچوونی دانە..."
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

              {/* Reason Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  هۆکاری زیان / فەوتان:
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
                  {REASON_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.icon} {r.label}
                    </option>
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
                  placeholder="نموونە: بەسەرچوونی بەرواری لە کۆگا دۆزرایەوە..."
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
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
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
                  <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#f87171' }}>
                    کۆی زەرەری دارایی بەپێی تێچوون: {calculationSummary.totalLoss.toLocaleString()} دینار
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '4px' }}>
                    دەرچوون لە مەخزەن: <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{calculationSummary.totalUnits} دانە</span>
                    {calculationSummary.isBox && ` (بەپێی پێوانەی ${calculationSummary.multiplier} دانە بۆ هەر کارتۆنێک)`}
                    {' | '} مەخزەنی ئێستا: {selectedProduct.stock} دانە 
                    {' ⬅️ '} دەبێتە: {Number(selectedProduct.stock) - calculationSummary.totalUnits} دانە
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '12px 28px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  <PackageX size={20} />
                  {submitting ? 'تۆمار دەکرێت...' : 'تۆمارکردنی زیان و دەرکردن لە کۆگا'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* History Table & Filter Section */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', margin: 0 }}>
              <Filter size={22} color="#38bdf8" /> مێژووی کاڵا زیانلێکەوتووەکان
            </h2>

            {/* Filter Tabs */}
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

              {/* Reason Filter */}
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
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
                <option value="ALL">هەموو هۆکارەکان</option>
                {REASON_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.icon} {r.label}</option>
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
                  <th style={{ padding: '12px' }}>بەروار و کات</th>
                  <th style={{ padding: '12px' }}>ناوی کاڵا</th>
                  <th style={{ padding: '12px' }}>بارکۆد</th>
                  <th style={{ padding: '12px' }}>بڕی فەوتاو</th>
                  <th style={{ padding: '12px' }}>دەرچوو لە کۆگا</th>
                  <th style={{ padding: '12px' }}>نرخی تێچوون</th>
                  <th style={{ padding: '12px' }}>کۆی زیانی دارایی</th>
                  <th style={{ padding: '12px' }}>هۆکار</th>
                  <th style={{ padding: '12px' }}>تێبینی و بەکارهێنەر</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>کردار</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      هیچ تۆمارێکی زیان یان فەوتان نەدۆزرایەوە لەم بەروارەدا.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item, idx) => {
                    const rOpt = REASON_OPTIONS.find(r => r.value === item.reason) || { color: '#64748b', icon: '📝' };
                    const unitsDeducted = parseFloat(item.quantity) * parseFloat(item.units_multiplier);

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                          {new Date(item.created_at).toLocaleString('ku-IQ')}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: 'white' }}>
                          {item.product_name}
                        </td>
                        <td style={{ padding: '12px', color: '#94a3b8', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                          {item.barcode || '-'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontWeight: 'bold' }}>{Number(item.quantity)}</span> {item.unit_type === 'BOX' ? 'کارتۆن' : 'دانە'}
                        </td>
                        <td style={{ padding: '12px', color: '#fbbf24', fontWeight: 'bold' }}>
                          {unitsDeducted} دانە
                        </td>
                        <td style={{ padding: '12px', color: '#cbd5e1' }}>
                          {Number(item.cost_price).toLocaleString()} د.ع
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#f87171' }}>
                          {Number(item.total_cost_loss).toLocaleString()} دینار
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
                            background: `${rOpt.color}20`,
                            color: rOpt.color,
                            border: `1px solid ${rOpt.color}40`
                          }}>
                            {rOpt.icon} {item.reason_label}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '0.85rem', color: '#94a3b8' }}>
                          <div>{item.notes || '-'}</div>
                          <small style={{ color: '#64748b' }}>تۆمارکەر: {item.created_by_username || 'کاشێر'}</small>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              onClick={() => setSelectedReceipt({
                                id: item.id,
                                product_name: item.product_name,
                                barcode: item.barcode,
                                quantity: item.quantity,
                                unit: item.unit_type === 'BOX' ? `کارتۆن (${item.units_multiplier} دانەیی)` : 'دانە',
                                total_units: unitsDeducted,
                                cost_price: item.cost_price,
                                total_loss: item.total_cost_loss,
                                reason_label: item.reason_label,
                                notes: item.notes,
                                username: item.created_by_username || 'کاشێر',
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
                              title="چاپکردنی پسووڵەی زیان"
                            >
                              <Printer size={14} /> پسووڵە
                            </button>

                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteDamage(item.id, item.product_name, unitsDeducted)}
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
                                title="هەڵوەشاندنەوە و گەڕاندنەوە بۆ کۆگا"
                              >
                                <RotateCcw size={14} /> گەڕاندنەوە
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

      {/* Modal: Printable Wastage Voucher */}
      {selectedReceipt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', padding: '24px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', margin: 0, color: '#f87171' }}>
                <PackageX size={20} /> پسووڵەی فەوتان و زیانی کاڵا
              </h2>
              <button onClick={() => setSelectedReceipt(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Printable Box */}
            <div id="damage-receipt-printable-area" style={{ background: '#ffffff', color: '#000000', padding: '20px 18px', borderRadius: '8px', fontFamily: 'monospace, Tahoma', fontSize: '13px', lineHeight: '1.5', direction: 'rtl' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '12px', marginBottom: '12px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>مارکێتی زیرەک</h3>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 'bold', color: '#b91c1c' }}>پسووڵەی کاڵای فەوتاو و زیانلێکەوتوو</h4>
                <div style={{ fontSize: '12px' }}>ژمارەی تۆمار: #{selectedReceipt.id}</div>
              </div>

              <div style={{ fontSize: '11px', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}>
                <div>بەروار: {new Date(selectedReceipt.created_at).toLocaleString('ku-IQ')}</div>
                <div>تۆمارکەر: {selectedReceipt.username}</div>
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
                  <span>بڕی فەوتاو:</span>
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
                  <span>هۆکاری زیان:</span>
                  <span>{selectedReceipt.reason_label}</span>
                </div>
                {selectedReceipt.notes && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: '#555' }}>
                    <span>تێبینی:</span>
                    <span>{selectedReceipt.notes}</span>
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', color: '#b91c1c' }}>
                  <span>کۆی زەرەری دارایی:</span>
                  <span>{Number(selectedReceipt.total_loss).toLocaleString()} دینار</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '10px', fontSize: '11px', textAlign: 'center' }}>
                <div style={{ width: '45%' }}>
                  <div>بەرپرسی کۆگا / کاشێر</div>
                  <div style={{ marginTop: '25px', borderBottom: '1px dotted #000' }}></div>
                </div>
                <div style={{ width: '45%' }}>
                  <div>پەسەندکردنی بەڕێوەبەر</div>
                  <div style={{ marginTop: '25px', borderBottom: '1px dotted #000' }}></div>
                </div>
              </div>
            </div>

            {/* Modal Buttons */}
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

      {/* Print CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #damage-receipt-printable-area, #damage-receipt-printable-area * {
            visibility: visible;
          }
          #damage-receipt-printable-area {
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

export default Wastage;
