import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
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
import { formatDate, formatDateTime, formatCurrency } from '../utils/dateFormatter';
import './Dashboard.css';

const REASON_OPTIONS = [
  { value: 'EXPIRED', label: 'بەسەردەچوون (بەروار بەسەرچوو)', color: '#ef4444', icon: '⏳' },
  { value: 'BROKEN', label: 'شکان و لەدەستچوون', color: '#f97316', icon: '💥' },
  { value: 'DAMAGED', label: 'تێکچوو / کەم و کوڕی', color: '#eab308', icon: '⚠️' },
  { value: 'THEFT_OR_LOST', label: 'ونبوون یان دزراو', color: '#0284c7', icon: '🔍' },
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
    return damagesList.filter(d => 
      kurdishSearchMatch([d.product_name, d.barcode, d.notes, d.reason_label], searchQuery)
    );
  }, [damagesList, searchQuery]);

  // Autocomplete products for recording
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    return products.filter(p => 
      kurdishSearchMatch([p.name, p.barcode, p.box_barcode], productSearch)
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
    <div className="dashboard-page" style={{ padding: '12px 18px' }} dir="rtl">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 2px 0', color: '#f87171', fontSize: '1.25rem', fontWeight: 800 }}>
            <PackageX size={22} color="#ef4444" />
            تۆمارکردنی زیان و فەوتانی کاڵا (Wastage & Damage)
          </h1>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            تۆمارکردنی کاڵای بەسەرچوو، شکاو و تێکچوو بۆ دەرکردن لە مەخزەن و دیاریکردنی زەرەری دارایی
          </p>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '10px' }}>
        {/* This Month Loss */}
        <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>کۆی زەرەری ئەم مانگە</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ef4444' }}>
              {Number(stats.this_month?.this_month_loss || 0).toLocaleString()} د.ع <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>({stats.this_month?.this_month_records || 0})</span>
            </div>
          </div>
          <Flame size={20} color="#ef4444" />
        </div>

        {/* This Month Units */}
        <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>کاڵای فەوتاوی ئەم مانگە</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--warning-color)' }}>
              {Number(stats.this_month?.this_month_units || 0).toLocaleString()} دانە
            </div>
          </div>
          <TrendingDown size={20} color="var(--warning-color)" />
        </div>

        {/* Today Loss */}
        <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>زەرەری ئەمڕۆ</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-hover)' }}>
              {Number(stats.today?.today_loss || 0).toLocaleString()} د.ع <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>({stats.today?.today_units || 0} د)</span>
            </div>
          </div>
          <Calendar size={20} color="var(--accent-hover)" />
        </div>

        {/* Lifetime Loss */}
        <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>کۆی گشتی زیان (هەموو کات)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--danger-color)' }}>
              {Number(stats.lifetime?.lifetime_loss || 0).toLocaleString()} د.ع
            </div>
          </div>
          <AlertTriangle size={20} color="var(--danger-color)" />
        </div>
      </div>

      {/* Main Content Layout: Form & History */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
        
        {/* Form Card */}
        <div style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          padding: '12px 16px', 
          boxShadow: 'var(--card-shadow)' 
        }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.05rem', margin: '0 0 10px 0', color: '#f87171', fontWeight: 800 }}>
            <Plus size={18} /> تۆمارکردنی کاڵای زیانلێکەوتووی نوێ
          </h2>

          <form onSubmit={handleSubmitDamage}>
            {/* Row 1: Product, Unit, Quantity, Cost */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '12px', 
              marginBottom: '12px' 
            }}>
              
              {/* Product Search & Autocomplete */}
              <div style={{ position: 'relative', minWidth: '240px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  کاڵا یان بارکۆد:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="بارکۆد سکان بکە یان ناوی کاڵا..."
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
                      padding: '7px 10px',
                      paddingLeft: '32px',
                      borderRadius: '8px',
                      background: 'var(--bg-tertiary)',
                      border: selectedProduct ? '1px solid #10b981' : '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Search size={15} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                </div>

                {/* Dropdown Results */}
                {isDropdownOpen && filteredProducts.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    left: 0,
                    marginTop: '4px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--card-shadow)',
                    zIndex: 100,
                    maxHeight: '220px',
                    overflowY: 'auto'
                  }}>
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.86rem' }}>{p.name}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            بارکۆد: {p.barcode || '-'} {p.box_barcode ? `| کارتۆن: ${p.box_barcode}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'left', fontSize: '0.78rem' }}>
                          <span style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>مەخزەن: {p.stock} دانە</span>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>تێچوون: {Number(p.cost_price || 0).toLocaleString()} د.ع</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unit Type Selection */}
              <div style={{ minWidth: '180px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  جۆری یەکە:
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setUnitType('PIECE')}
                    style={{
                      flex: 1,
                      padding: '7px 8px',
                      borderRadius: '8px',
                      border: unitType === 'PIECE' ? '2px solid var(--accent-hover)' : '1px solid var(--border-color)',
                      background: unitType === 'PIECE' ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                      color: unitType === 'PIECE' ? 'var(--accent-hover)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    📦 دانە (Piece)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitType('BOX')}
                    style={{
                      flex: 1,
                      padding: '7px 8px',
                      borderRadius: '8px',
                      border: unitType === 'BOX' ? '2px solid #f59e0b' : '1px solid var(--border-color)',
                      background: unitType === 'BOX' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-tertiary)',
                      color: unitType === 'BOX' ? '#f59e0b' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    📦 کارتۆن {selectedProduct?.units_per_box > 1 ? `(${selectedProduct.units_per_box})` : ''}
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div style={{ minWidth: '110px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 600 }}>
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
                    padding: '7px 10px',
                    borderRadius: '8px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Cost Price per Unit */}
              <div style={{ minWidth: '190px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  نرخی تێچوونی دانە (دینار):
                </label>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, parseInt(costPrice) || 0);
                      const next = Math.max(0, cur - 250);
                      setCostPrice(next === 0 ? '' : String(next));
                    }}
                    style={{ flexShrink: 0, padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    -٢٥٠
                  </button>
                  <input
                    type="number"
                    step="250"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="نرخی تێچوونی دانە..."
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: '7px 10px',
                      borderRadius: '8px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      textAlign: 'center',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Math.max(0, parseInt(costPrice) || 0);
                      setCostPrice(String(cur + 250));
                    }}
                    style={{ flexShrink: 0, padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    +٢٥٠
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Reason & Notes */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
              gap: '12px', 
              marginBottom: '10px' 
            }}>
              {/* Reason Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  هۆکاری زیان / فەوتان:
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.84rem',
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
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  تێبینی زیاتر:
                </label>
                <input
                  type="text"
                  placeholder="نموونە: بەسەرچوونی بەرواری لە کۆگا..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.84rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Live Calculation Banner */}
            {selectedProduct && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '10px',
                padding: '8px 14px',
                marginBottom: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#ef4444' }}>
                    کۆی زەرەری دارایی بەپێی تێچوون: {calculationSummary.totalLoss.toLocaleString()} دینار
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    دەرچوون لە مەخزەن: <span style={{ color: '#fbbf24', fontWeight: 700 }}>{calculationSummary.totalUnits} دانە</span>
                    {calculationSummary.isBox && ` (${calculationSummary.multiplier} دانە بۆ هەر کارتۆنێک)`}
                    {' | '} مەخزەنی ئێستا: {selectedProduct.stock} دانە 
                    {' ⬅️ '} دەبێتە: {Number(selectedProduct.stock) - calculationSummary.totalUnits} دانە
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: 'var(--card-shadow)'
                  }}
                >
                  <PackageX size={17} />
                  {submitting ? 'تۆمار دەکرێت...' : 'تۆمارکردنی زیان و دەرکردن لە کۆگا'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* History Table & Filter Section */}
        <div style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          padding: '12px 16px', 
          boxShadow: 'var(--card-shadow)' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.05rem', margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>
              <Filter size={18} color="var(--accent-hover)" /> مێژووی کاڵا زیانلێکەوتووەکان
            </h2>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => setTimeFilter('THIS_MONTH')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: timeFilter === 'THIS_MONTH' ? 'none' : '1px solid var(--border-color)',
                  background: timeFilter === 'THIS_MONTH' ? 'var(--accent-hover)' : 'var(--bg-tertiary)',
                  color: timeFilter === 'THIS_MONTH' ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.8rem'
                }}
              >
                ئەم مانگە
              </button>
              <button
                onClick={() => setTimeFilter('TODAY')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: timeFilter === 'TODAY' ? 'none' : '1px solid var(--border-color)',
                  background: timeFilter === 'TODAY' ? 'var(--accent-hover)' : 'var(--bg-tertiary)',
                  color: timeFilter === 'TODAY' ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.8rem'
                }}
              >
                ئەمڕۆ
              </button>
              <button
                onClick={() => setTimeFilter('ALL')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: timeFilter === 'ALL' ? 'none' : '1px solid var(--border-color)',
                  background: timeFilter === 'ALL' ? 'var(--accent-hover)' : 'var(--bg-tertiary)',
                  color: timeFilter === 'ALL' ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.8rem'
                }}
              >
                هەمووی
              </button>

              {/* Reason Filter */}
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
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
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none',
                  minWidth: '160px'
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>#</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>بەروار و کات</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>ناوی کاڵا</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>بارکۆد</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>بڕی فەوتاو</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>دەرچوو لە کۆگا</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>نرخی تێچوون</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>کۆی زیانی دارایی</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>هۆکار</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>تێبینی و بەکارهێنەر</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem', textAlign: 'center' }}>کردار</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      هیچ تۆمارێکی زیان یان فەوتان نەدۆزرایەوە لەم بەروارەدا.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item, idx) => {
                    const rOpt = REASON_OPTIONS.find(r => r.value === item.reason) || { color: '#64748b', icon: '📝' };
                    const unitsDeducted = parseFloat(item.quantity) * parseFloat(item.units_multiplier);

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {formatDateTime(item.created_at)}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.86rem' }}>
                          {item.product_name}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                          {item.barcode || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: '0.84rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{Number(item.quantity)}</span> {item.unit_type === 'BOX' ? 'کارتۆن' : 'دانە'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#fbbf24', fontWeight: 700, fontSize: '0.84rem' }}>
                          {unitsDeducted} دانە
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                          {Number(item.cost_price).toLocaleString()} د.ع
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 800, color: '#ef4444', fontSize: '0.86rem' }}>
                          {Number(item.total_cost_loss).toLocaleString()} دینار
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            background: `${rOpt.color}20`,
                            color: rOpt.color,
                            border: `1px solid ${rOpt.color}40`
                          }}>
                            {rOpt.icon} {item.reason_label}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <div>{item.notes || '-'}</div>
                          <small style={{ color: 'var(--text-secondary)' }}>تۆمارکەر: {item.created_by_username || 'کاشێر'}</small>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
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
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--accent-hover)',
                                cursor: 'pointer',
                                fontSize: '0.76rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                              title="چاپکردنی پسووڵەی زیان"
                            >
                              <Printer size={13} /> پسووڵە
                            </button>

                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteDamage(item.id, item.product_name, unitsDeducted)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#f87171',
                                  cursor: 'pointer',
                                  fontSize: '0.76rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                                title="هەڵوەشاندنەوە و گەڕاندنەوە بۆ کۆگا"
                              >
                                <RotateCcw size={13} /> گەڕاندنەوە
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
        <div className="pos-modal-overlay" onClick={() => setSelectedReceipt(null)}>
          <div className="pos-modal-card pos-modal-sm" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', margin: 0, color: '#f87171', fontWeight: 800 }}>
                <PackageX size={18} /> وەسڵی فەوتان و زیانی کاڵا
              </h2>
              <button onClick={() => setSelectedReceipt(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            {/* Printable Box */}
            <div id="damage-receipt-printable-area" style={{ background: '#ffffff', color: '#000000', padding: '16px 14px', borderRadius: '8px', fontFamily: 'monospace, Tahoma', fontSize: '13px', lineHeight: '1.5', direction: 'rtl' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold' }}>مارکێتی زیرەک</h3>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 'bold', color: '#b91c1c' }}>وەسڵی کاڵای فەوتاو و زیانلێکەوتوو</h4>
                <div style={{ fontSize: '11px' }}>ژمارەی تۆمار: #{selectedReceipt.id}</div>
              </div>

              <div style={{ fontSize: '11px', marginBottom: '8px', borderBottom: '1px solid #ddd', paddingBottom: '6px' }}>
                <div>بەروار: {formatDateTime(selectedReceipt.created_at, { twelveHour: true })}</div>
                <div>تۆمارکەر: {selectedReceipt.username}</div>
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
                  <span>بڕی فەوتاو:</span>
                  <span>{selectedReceipt.quantity} {selectedReceipt.unit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span>کۆی دەرچوو لە کۆگا:</span>
                  <span>{selectedReceipt.total_units} دانە</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span>تێچوونی دانە:</span>
                  <span>{Number(selectedReceipt.cost_price).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span>هۆکاری زیان:</span>
                  <span>{selectedReceipt.reason_label}</span>
                </div>
                {selectedReceipt.notes && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '11px', color: '#555' }}>
                    <span>تێبینی:</span>
                    <span>{selectedReceipt.notes}</span>
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '2px dashed #000', paddingBottom: '8px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', color: '#b91c1c' }}>
                  <span>کۆی زەرەری دارایی:</span>
                  <span>{Number(selectedReceipt.total_loss).toLocaleString()} دینار</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '8px', fontSize: '11px', textAlign: 'center' }}>
                <div style={{ width: '45%' }}>
                  <div>بەرپرسی کۆگا / کاشێر</div>
                  <div style={{ marginTop: '20px', borderBottom: '1px dotted #000' }}></div>
                </div>
                <div style={{ width: '45%' }}>
                  <div>پەسەندکردنی بەڕێوەبەر</div>
                  <div style={{ marginTop: '20px', borderBottom: '1px dotted #000' }}></div>
                </div>
              </div>
            </div>

            {/* Modal Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button 
                onClick={printReceipt}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.86rem' }}
              >
                <Printer size={16} /> چاپکردنی وەسڵ
              </button>
              <button 
                onClick={() => setSelectedReceipt(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600 }}
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
          @page {
            size: auto;
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          #damage-receipt-printable-area, #damage-receipt-printable-area * {
            visibility: visible !important;
          }
          #damage-receipt-printable-area {
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
            font-family: monospace, Tahoma, 'Noto Kufi Arabic', sans-serif !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Wastage;
