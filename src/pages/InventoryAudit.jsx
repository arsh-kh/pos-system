import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { 
  ClipboardCheck, 
  Scan, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Printer, 
  RotateCcw, 
  X, 
  Filter, 
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const InventoryAudit = () => {
  const { user, isAdmin } = useAuth();

  // State
  const [products, setProducts] = useState([]);
  const [auditList, setAuditList] = useState([]);
  const [stats, setStats] = useState({
    this_month: { total_audits: 0, matches_count: 0, shortages_count: 0, surpluses_count: 0, total_shortage_loss: 0, total_surplus_value: 0 },
    today: { total_audits: 0, matches_count: 0, shortages_count: 0, today_shortage_loss: 0 },
    lifetime: { total_audits: 0, lifetime_shortage_loss: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Audit Input State
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [unitType, setUnitType] = useState('PIECE'); // 'PIECE' or 'BOX'
  const [countedCount, setCountedCount] = useState('');
  const [notes, setNotes] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Filters State
  const [timeFilter, setTimeFilter] = useState('THIS_MONTH'); // 'THIS_MONTH', 'TODAY', 'ALL'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'MATCH', 'SHORTAGE', 'SURPLUS'
  const [searchQuery, setSearchQuery] = useState('');

  // Printable Modal State
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  // Refs for fast barcode scanning workflow
  const searchInputRef = useRef(null);
  const countInputRef = useRef(null);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, auditRes, statsRes] = await Promise.all([
        axios.get('http://localhost:3001/api/products'),
        axios.get('http://localhost:3001/api/inventory-audit/history', {
          params: { filter: timeFilter, status: statusFilter, search: searchQuery }
        }),
        axios.get('http://localhost:3001/api/inventory-audit/stats')
      ]);

      if (prodRes.data.status === 'SUCCESS') setProducts(prodRes.data.data);
      if (auditRes.data.status === 'SUCCESS') setAuditList(auditRes.data.data);
      if (statsRes.data.status === 'SUCCESS') setStats(statsRes.data.data);
    } catch (err) {
      console.error('Error fetching inventory audit data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeFilter, statusFilter]);

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

  // Filter history live
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return auditList;
    const q = searchQuery.toLowerCase();
    return auditList.filter(a => 
      a.product_name?.toLowerCase().includes(q) ||
      a.barcode?.toLowerCase().includes(q) ||
      a.notes?.toLowerCase().includes(q) ||
      a.audited_by_username?.toLowerCase().includes(q)
    );
  }, [auditList, searchQuery]);

  // Select Product and autofocus on count input
  const handleSelectProduct = (prod) => {
    setSelectedProduct(prod);
    setProductSearch(prod.name);
    setIsDropdownOpen(false);
    setCountedCount('');

    if (prod.box_barcode && productSearch.trim() === prod.box_barcode) {
      setUnitType('BOX');
    } else {
      setUnitType('PIECE');
    }

    setTimeout(() => {
      countInputRef.current?.focus();
    }, 100);
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

  // Real-time comparison calculation
  const comparison = useMemo(() => {
    if (!selectedProduct) return { differenceUnits: 0, discrepancyValue: 0, status: 'MATCH', multiplier: 1, countedUnits: 0, systemUnits: 0 };

    const countNum = parseFloat(countedCount);
    const isBox = unitType === 'BOX';
    const multiplier = isBox ? Math.max(1, parseFloat(selectedProduct.units_per_box) || 1) : 1;
    const systemUnits = parseFloat(selectedProduct.stock) || 0;

    if (isNaN(countNum)) {
      return { differenceUnits: 0, discrepancyValue: 0, status: 'PENDING', multiplier, isBox, countedUnits: 0, systemUnits };
    }

    const countedUnits = countNum * multiplier;
    const differenceUnits = countedUnits - systemUnits;
    const unitCost = Math.round(Number(selectedProduct.cost_price || 0));
    const discrepancyValue = Math.round(differenceUnits * unitCost);

    let status = 'MATCH';
    if (differenceUnits < -0.0001) status = 'SHORTAGE';
    else if (differenceUnits > 0.0001) status = 'SURPLUS';

    return { differenceUnits, discrepancyValue, status, multiplier, isBox, countedUnits, systemUnits, unitCost };
  }, [selectedProduct, unitType, countedCount]);

  // Submit Audit Reconciliation
  const handleReconcile = async (e) => {
    e.preventDefault();

    if (!selectedProduct) {
      alert('تکایە سەرەتا بارکۆدی کاڵاکە سکان بکە یان دیاریی بکە.');
      return;
    }

    const countNum = parseFloat(countedCount);
    if (isNaN(countNum) || countNum < 0) {
      alert('تکایە ژمارەی ڕاستەقینەی ناو مارکێتەکە بنووسە.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('http://localhost:3001/api/inventory-audit/reconcile', {
        product_id: selectedProduct.id,
        counted_stock: countNum,
        unit_type: unitType,
        notes: notes
      }, {
        headers: {
          'x-user-name': user?.username || 'خاوەنکار'
        }
      });

      if (res.data.status === 'SUCCESS') {
        const auditData = res.data.data;

        // Show Voucher
        setSelectedVoucher({
          id: auditData.audit_id,
          product_name: auditData.product_name,
          barcode: auditData.barcode,
          unit_type: auditData.unit_type,
          system_stock: auditData.system_stock,
          counted_stock: auditData.counted_stock,
          difference_qty: auditData.difference_qty,
          cost_price: auditData.cost_price,
          total_cost_discrepancy: auditData.total_cost_discrepancy,
          status: auditData.status,
          damage_id: auditData.damage_id,
          audited_by_username: auditData.audited_by_username,
          notes: notes,
          created_at: auditData.created_at
        });

        // Reset form for next scan
        setSelectedProduct(null);
        setProductSearch('');
        setCountedCount('');
        setNotes('');
        setUnitType('PIECE');

        // Focus back to search for the next shelf item
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 150);

        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی جەردکردن');
    } finally {
      setSubmitting(false);
    }
  };

  // Revert Audit (Admin Only)
  const handleRevertAudit = async (id, prodName, systemStock) => {
    if (!isAdmin) {
      alert('⚠️ تەنها بەڕێوەبەر (Admin) دەسەڵاتی هەڵوەشاندنەوەی جەردی هەیە.');
      return;
    }

    if (!window.confirm(`ئایا دڵنیایت لە هەڵوەشاندنەوەی ئەم جەردە؟
مەخزەنی "${prodName}" دەگەڕێتەوە بۆ ژمارەی پێشووی (${systemStock} دانە) و تۆماری زیانەکە لە قازانج دەسڕدرێتەوە.`)) {
      return;
    }

    try {
      const res = await axios.delete(`http://localhost:3001/api/inventory-audit/${id}`, {
        headers: {
          'x-user-name': user?.username || 'ئەدمین'
        }
      });
      if (res.data.status === 'SUCCESS') {
        alert(res.data.message);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی هەڵوەشاندنەوە');
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0 0 6px 0' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0, color: '#10b981' }}>
              <ClipboardCheck size={34} color="#10b981" />
              جەردکردنی زیرەکی کۆگا و ڕەفەکان (Smart Inventory Audit)
            </h1>
            <span style={{ 
              background: 'rgba(16, 185, 129, 0.15)', 
              color: '#10b981', 
              border: '1px solid rgba(16, 185, 129, 0.4)', 
              padding: '4px 12px', 
              borderRadius: '20px', 
              fontSize: '0.8rem', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Scan size={14} /> دۆخی پێداچوونەوە و ڕاستکردنەوەی کۆگا
            </span>
          </div>
          <p className="text-secondary" style={{ margin: 0, fontSize: '0.95rem' }}>
            سکانی بارکۆدی ڕەفەکان، بینینی ژمارەی حیسابکراوی سیستەم، ژماردنی بە چاو، و تۆمارکردنی خۆکاری نوقسانییەکان لەسەر لیستی زیانەکانی کۆتایی مانگ
          </p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid mb-8">
        {/* Total Audits */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>کۆی جەردکراوەکانی ئەم مانگە</h3>
            <ClipboardCheck size={22} color="#10b981" />
          </div>
          <div className="value highlight" style={{ color: '#10b981' }}>
            {stats.this_month?.total_audits || 0} کاڵا
          </div>
          <div className="sub-text" style={{ color: '#a7f3d0' }}>
            پشکنین و جەردکراو لەسەر ڕەفەکان
          </div>
        </div>

        {/* Shortage Loss */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>زیانی نوقسانی و ونبوون (ئەم مانگە)</h3>
            <TrendingDown size={22} color="#ef4444" />
          </div>
          <div className="value" style={{ color: '#f87171' }}>
            {Number(stats.this_month?.total_shortage_loss || 0).toLocaleString()} دینار
          </div>
          <div className="sub-text" style={{ color: '#fca5a5' }}>
            {stats.this_month?.shortages_count || 0} کاڵا نوقسانی هەبووە و لە قازانج دەرهێنراوە
          </div>
        </div>

        {/* Matches Count */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>کاڵا هاوتاکان (١٠٠٪ تەواو)</h3>
            <CheckCircle2 size={22} color="#38bdf8" />
          </div>
          <div className="value" style={{ color: '#38bdf8' }}>
            {stats.this_month?.matches_count || 0} کاڵا
          </div>
          <div className="sub-text" style={{ color: '#bae6fd' }}>
            ژمارەی مەخزەن و ڕەفەکان تەواو یەک بوون
          </div>
        </div>

        {/* Surpluses */}
        <div className="stat-card glass-panel" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>زیادەی دۆزراوە لە کۆگا</h3>
            <TrendingUp size={22} color="#f59e0b" />
          </div>
          <div className="value" style={{ color: '#fbbf24' }}>
            {stats.this_month?.surpluses_count || 0} کاڵا
          </div>
          <div className="sub-text" style={{ color: '#fde68a' }}>
            بڕی {Number(stats.this_month?.total_surplus_value || 0).toLocaleString()} د.ع زیادە
          </div>
        </div>
      </div>

      {/* Main Console: Fast Stock Count Terminal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        
        {/* Audit Form Card */}
        <div className="glass-panel" style={{ padding: '26px', borderRadius: '24px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(10, 15, 30, 0.95) 100%)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.3rem', margin: 0, color: '#34d399' }}>
              <Scan size={24} color="#10b981" />
              سکانەری خێرای جەردکردن
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              💡 تێبینی: بە سکانکردنی بارکۆد سیستەم یەکسەر فۆکەس دەکاتە سەر خانەی ژمارەی ڕاستەقینە
            </div>
          </div>

          <form onSubmit={handleReconcile}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '18px', marginBottom: '20px' }}>
              
              {/* Barcode / Product Search */}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  بارکۆدی ڕەفە یان ناوی کاڵا:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={searchInputRef}
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
                      padding: '14px 18px',
                      paddingLeft: '40px',
                      borderRadius: '14px',
                      background: 'rgba(255,255,255,0.06)',
                      border: selectedProduct ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.18)',
                      color: 'white',
                      fontSize: '1.05rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Search size={20} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
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
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
                    zIndex: 100,
                    maxHeight: '260px',
                    overflowY: 'auto'
                  }}>
                    {filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', color: 'white', fontSize: '1rem' }}>{p.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            بارکۆد: {p.barcode || '-'} {p.box_barcode ? `| کارتۆن: ${p.box_barcode}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'left', fontSize: '0.9rem' }}>
                          <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>مەخزەن: {p.stock} دانە</span>
                          <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>تێچوون: {Number(p.cost_price || 0).toLocaleString()} د.ع</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unit Type Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  جۆری یەکە بۆ ژماردن:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setUnitType('PIECE')}
                    style={{
                      flex: 1,
                      padding: '13px',
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
                      padding: '13px',
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

              {/* Physical Counted Input (ژماردنی ڕاستەقینە) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  ژماردنی ڕاستەقینە (ئەوەی لەسەر ڕەفەکە بینیوتە):
                </label>
                <input
                  ref={countInputRef}
                  type="number"
                  step="any"
                  min="0"
                  placeholder="ژمارەی بینراو بنووسە..."
                  value={countedCount}
                  onChange={(e) => setCountedCount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '2px solid #38bdf8',
                    color: '#38bdf8',
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '6px', color: '#cbd5e1', fontWeight: 'bold' }}>
                  تێبینی جەرد (ئارەزوومەندانە):
                </label>
                <input
                  type="text"
                  placeholder="نموونە: ساردکەرەوەی بەشی وزەبەخشەکان..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    borderRadius: '14px',
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

            {/* Smart Inventory Verification Card & Live Banner */}
            {selectedProduct && (
              <div style={{
                background: comparison.status === 'SHORTAGE' 
                  ? 'rgba(239, 68, 68, 0.12)' 
                  : (comparison.status === 'SURPLUS' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)'),
                border: `1.5px solid ${comparison.status === 'SHORTAGE' ? 'rgba(239, 68, 68, 0.4)' : (comparison.status === 'SURPLUS' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)')}`,
                borderRadius: '18px',
                padding: '20px 24px',
                marginBottom: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{selectedProduct.name}</span>
                    <span style={{ 
                      padding: '4px 12px', 
                      borderRadius: '10px', 
                      background: 'rgba(56, 189, 248, 0.2)', 
                      color: '#38bdf8', 
                      fontSize: '0.88rem', 
                      fontWeight: 'bold',
                      border: '1px solid rgba(56, 189, 248, 0.35)'
                    }}>
                      ژمارەی ناو سیستەم: {comparison.systemUnits} دانە
                    </span>
                  </div>

                  <div style={{ marginTop: '10px', fontSize: '0.95rem' }}>
                    {countedCount === '' ? (
                      <span style={{ color: '#94a3b8' }}>
                        👈 تکایە ژمارەی ڕاستەقینەی ناو ساردکەرەوە یان ڕەفەکە بنووسە لە خانەی سەرەوە.
                      </span>
                    ) : comparison.status === 'MATCH' ? (
                      <div style={{ color: '#10b981', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={18} /> هاوتا و ڕێک: هەردووکیان {comparison.countedUnits} دانەن. هیچ کەم و کوڕییەک نییە!
                      </div>
                    ) : comparison.status === 'SHORTAGE' ? (
                      <div>
                        <div style={{ color: '#f87171', fontWeight: 'bold', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={20} /> نوقسانی دۆزرایەوە: {Math.abs(comparison.differenceUnits)} دانە کەمە لە سیستەم!
                        </div>
                        <div style={{ color: '#cbd5e1', fontSize: '0.88rem', marginTop: '4px' }}>
                          زەرەری دارایی: <strong style={{ color: '#f87171' }}>{Math.abs(comparison.discrepancyValue).toLocaleString()} دینار</strong> (ڕاستەوخۆ دەخرێتە سەر لیستی زیانەکانی ئەم مانگە بۆ دەرکردن لە قازانجی ڕاستەقینە).
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: '#fbbf24', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TrendingUp size={18} /> زیادە: +{comparison.differenceUnits} دانە زیاترە لە سیستەم | مەخزەن زیاد دەکرێت بۆ {comparison.countedUnits} دانە.
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || countedCount === ''}
                  style={{
                    padding: '14px 32px',
                    borderRadius: '14px',
                    background: comparison.status === 'SHORTAGE'
                      ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                      : 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    border: 'none',
                    cursor: countedCount === '' ? 'not-allowed' : 'pointer',
                    opacity: countedCount === '' ? 0.6 : 1,
                    fontWeight: 'bold',
                    fontSize: '1.05rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.3)'
                  }}
                >
                  <ClipboardCheck size={22} />
                  {submitting ? 'پەسەند دەکرێت...' : 'پەسەندکردن و چاککردنی کۆگا'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* History Table & Filters */}
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', margin: 0 }}>
              <Filter size={22} color="#10b981" /> مێژووی جەردە ئەنجامدراوەکانی کۆگا
            </h2>

            {/* Filter Tabs & Search */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setTimeFilter('THIS_MONTH')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: timeFilter === 'THIS_MONTH' ? '#10b981' : 'rgba(255,255,255,0.06)',
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
                  background: timeFilter === 'TODAY' ? '#10b981' : 'rgba(255,255,255,0.06)',
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
                  background: timeFilter === 'ALL' ? '#10b981' : 'rgba(255,255,255,0.06)',
                  color: timeFilter === 'ALL' ? '#0f172a' : 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.85rem'
                }}
              >
                هەمووی
              </button>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
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
                <option value="ALL">هەموو دۆخەکان</option>
                <option value="SHORTAGE">⚠️ تەنها نوقسانییەکان</option>
                <option value="MATCH">✅ تەنها هاوتاکان</option>
                <option value="SURPLUS">📈 تەنها زیادەکان</option>
              </select>

              {/* Search Bar */}
              <input
                type="text"
                placeholder="گەڕان لە جەردەکاندا..."
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
                  <th style={{ padding: '12px' }}>ژمارەی سیستەم</th>
                  <th style={{ padding: '12px' }}>ژماردنی ڕاستەقینە</th>
                  <th style={{ padding: '12px' }}>جیاوازی</th>
                  <th style={{ padding: '12px' }}>زەرەر / بەهای جیاوازی</th>
                  <th style={{ padding: '12px' }}>دۆخ</th>
                  <th style={{ padding: '12px' }}>جەردکەر و تێبینی</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>کردار</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      هیچ تۆمارێکی جەردکردن نەدۆزرایەوە لەم بەروارەدا.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item, idx) => {
                    const isShortage = item.status === 'SHORTAGE';
                    const isSurplus = item.status === 'SURPLUS';
                    const isMatch = item.status === 'MATCH';

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
                        <td style={{ padding: '12px', color: '#38bdf8', fontWeight: 'bold' }}>
                          {Number(item.system_stock)} دانە
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: 'white' }}>
                          {Number(item.counted_stock)} دانە
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: isShortage ? '#f87171' : (isSurplus ? '#fbbf24' : '#10b981') }}>
                          {Number(item.difference_qty) > 0 ? `+${Number(item.difference_qty)}` : Number(item.difference_qty)} دانە
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: isShortage ? '#f87171' : (isSurplus ? '#fbbf24' : '#94a3b8') }}>
                          {isShortage ? `-${Number(Math.abs(item.total_cost_discrepancy)).toLocaleString()} د.ع` : (isSurplus ? `+${Number(item.total_cost_discrepancy).toLocaleString()} د.ع` : '٠ د.ع')}
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
                            background: isShortage ? 'rgba(239, 68, 68, 0.15)' : (isSurplus ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'),
                            color: isShortage ? '#f87171' : (isSurplus ? '#fbbf24' : '#10b981'),
                            border: `1px solid ${isShortage ? 'rgba(239, 68, 68, 0.3)' : (isSurplus ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)')}`
                          }}>
                            {isShortage ? '⚠️ نوقسانی' : (isSurplus ? '📈 زیادە' : '✅ هاوتا')}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '0.85rem', color: '#94a3b8' }}>
                          <div>{item.notes || '-'}</div>
                          <small style={{ color: '#64748b' }}>جەردکەر: {item.audited_by_username || 'خاوەنکار'}</small>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              onClick={() => setSelectedVoucher(item)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '8px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: '#10b981',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="چاپکردنی پسووڵەی جەرد"
                            >
                              <Printer size={14} /> پسووڵە
                            </button>

                            {isAdmin && (
                              <button
                                onClick={() => handleRevertAudit(item.id, item.product_name, item.system_stock)}
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
                                title="هەڵوەشاندنەوە و گەڕاندنەوەی مەخزەن"
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

      {/* Modal: Printable Inventory Audit Voucher */}
      {selectedVoucher && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px', padding: '24px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', margin: 0, color: '#10b981' }}>
                <ClipboardCheck size={20} /> پسووڵەی جەردی کۆگا
              </h2>
              <button onClick={() => setSelectedVoucher(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Printable Box */}
            <div id="audit-voucher-printable-area" style={{ background: '#ffffff', color: '#000000', padding: '20px 18px', borderRadius: '8px', fontFamily: 'monospace, Tahoma', fontSize: '13px', lineHeight: '1.5', direction: 'rtl' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '12px', marginBottom: '12px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>مارکێتی زیرەک</h3>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 'bold', color: '#047857' }}>پسووڵەی فەرمیی جەردی کۆگا و ڕەفەکان</h4>
                <div style={{ fontSize: '12px' }}>ژمارەی تۆمار: #{selectedVoucher.id}</div>
              </div>

              <div style={{ fontSize: '11px', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '8px' }}>
                <div>بەروار: {new Date(selectedVoucher.created_at).toLocaleString('ku-IQ')}</div>
                <div>جەردکەر: {selectedVoucher.audited_by_username || 'خاوەنکار'}</div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 'bold' }}>
                  <span>ناوی کاڵا:</span>
                  <span>{selectedVoucher.product_name}</span>
                </div>
                {selectedVoucher.barcode && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: '#555' }}>
                    <span>بارکۆد:</span>
                    <span>{selectedVoucher.barcode}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>ژمارەی پێشووی سیستەم:</span>
                  <span>{Number(selectedVoucher.system_stock)} دانە</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>ژماردنی ڕاستەقینە:</span>
                  <span>{Number(selectedVoucher.counted_stock)} دانە</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 'bold' }}>
                  <span>جیاوازی ژماردن:</span>
                  <span>{Number(selectedVoucher.difference_qty) > 0 ? `+${Number(selectedVoucher.difference_qty)}` : Number(selectedVoucher.difference_qty)} دانە</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>نرخی تێچوونی دانە:</span>
                  <span>{Number(selectedVoucher.cost_price).toLocaleString()} دینار</span>
                </div>
                {selectedVoucher.notes && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px', color: '#555' }}>
                    <span>تێبینی:</span>
                    <span>{selectedVoucher.notes}</span>
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', color: selectedVoucher.status === 'SHORTAGE' ? '#b91c1c' : (selectedVoucher.status === 'SURPLUS' ? '#b45309' : '#047857') }}>
                  <span>ئەنجامی دارایی جەرد:</span>
                  <span>
                    {selectedVoucher.status === 'SHORTAGE'
                      ? `-${Number(Math.abs(selectedVoucher.total_cost_discrepancy)).toLocaleString()} د.ع (نوقسانی)`
                      : (selectedVoucher.status === 'SURPLUS'
                        ? `+${Number(selectedVoucher.total_cost_discrepancy).toLocaleString()} د.ع (زیادە)`
                        : '٠ د.ع (هاوتا)')}
                  </span>
                </div>
                {selectedVoucher.status === 'SHORTAGE' && (
                  <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '4px' }}>
                    * ئەم نوقسانییە ڕاستەوخۆ دەخرێتە سەر لیستی زیانەکان بۆ دەرکردن لە قازانجی ڕاستەقینەی مانگ.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '10px', fontSize: '11px', textAlign: 'center' }}>
                <div style={{ width: '45%' }}>
                  <div>واژۆی جەردکەر</div>
                  <div style={{ marginTop: '25px', borderBottom: '1px dotted #000' }}></div>
                </div>
                <div style={{ width: '45%' }}>
                  <div>پەسەندکردنی خاوەنکار</div>
                  <div style={{ marginTop: '25px', borderBottom: '1px dotted #000' }}></div>
                </div>
              </div>
            </div>

            {/* Modal Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button 
                onClick={printVoucher}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                <Printer size={18} /> چاپکردنی پسووڵە
              </button>
              <button 
                onClick={() => setSelectedVoucher(null)}
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
          #audit-voucher-printable-area, #audit-voucher-printable-area * {
            visibility: visible;
          }
          #audit-voucher-printable-area {
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

export default InventoryAudit;
