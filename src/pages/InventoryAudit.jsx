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
import { kurdishSearchMatch } from '../utils/kurdishSearch';
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

  // Autocomplete products with Kurdish search
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    return products.filter(p => 
      kurdishSearchMatch([p.name, p.barcode, p.box_barcode], productSearch)
    ).slice(0, 10);
  }, [products, productSearch]);

  // Filter history live with Kurdish search
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return auditList;
    return auditList.filter(a => 
      kurdishSearchMatch([a.product_name, a.barcode, a.notes, a.audited_by_username], searchQuery)
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
    <div className="dashboard-page" style={{ padding: '12px 18px', maxWidth: '100%', boxSizing: 'border-box' }} dir="rtl">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#10b981', fontSize: '1.25rem', fontWeight: 800 }}>
            <ClipboardCheck size={22} color="#10b981" />
            جەردکردنی زیرەکی کۆگا و ڕەفەکان
          </h1>
          <span style={{ 
            background: 'var(--success-light)', 
            color: 'var(--success-color)', 
            border: '1px solid rgba(16, 185, 129, 0.3)', 
            padding: '2px 8px', 
            borderRadius: '6px', 
            fontSize: '0.74rem', 
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Scan size={12} /> پشکنین و چاککردنی خێرا
          </span>
        </div>
      </div>

      {/* Slim KPI Metric Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '10px' }}>
        {/* Total Audits */}
        <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>جەردکراوی ئەم مانگە</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981' }}>{stats.this_month?.total_audits || 0} کاڵا</div>
          </div>
          <ClipboardCheck size={20} color="#10b981" />
        </div>

        {/* Shortage Loss */}
        <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>زیانی نوقسانی و ونبوون</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--danger-color)' }}>
              {Number(stats.this_month?.total_shortage_loss || 0).toLocaleString()} د.ع <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>({stats.this_month?.shortages_count || 0})</span>
            </div>
          </div>
          <TrendingDown size={20} color="var(--danger-color)" />
        </div>

        {/* Matches Count */}
        <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>هاوتا و تەواو (١٠٠٪)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-hover)' }}>{stats.this_month?.matches_count || 0} کاڵا</div>
          </div>
          <CheckCircle2 size={20} color="var(--accent-color)" />
        </div>

        {/* Surpluses */}
        <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>زیادەی دۆزراوە لە کۆگا</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--warning-color)' }}>
              +{Number(stats.this_month?.total_surplus_value || 0).toLocaleString()} د.ع <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>({stats.this_month?.surpluses_count || 0})</span>
            </div>
          </div>
          <TrendingUp size={20} color="var(--warning-color)" />
        </div>
      </div>

      {/* Main Console: Fast Stock Count Terminal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
        
        {/* Audit Form Card */}
        <div style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          padding: '12px 16px', 
          boxShadow: 'var(--card-shadow)' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', margin: 0, color: '#10b981', fontWeight: 800 }}>
              <Scan size={18} color="#10b981" />
              سکانەری خێرای جەردکردن
            </h2>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              💡 بە سکانکردنی بارکۆد سیستەم یەکسەر فۆکەس دەکاتە سەر خانەی ژمارەی ڕاستەقینە
            </div>
          </div>

          <form onSubmit={handleReconcile}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px', marginBottom: '10px' }}>
              
              {/* Barcode / Product Search */}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  بارکۆدی ڕەفە یان ناوی کاڵا:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="بارکۆد سکان بکە یان بنووسە..."
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
                      border: selectedProduct ? '1.5px solid #10b981' : '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: '0.86rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
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
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
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
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            بارکۆد: {p.barcode || '-'} {p.box_barcode ? `| کارتۆن: ${p.box_barcode}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'left', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--accent-hover)', fontWeight: 700 }}>مەخزەن: {p.stock} دانە</span>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>تێچوون: {Number(p.cost_price || 0).toLocaleString()} د.ع</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unit Type Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  جۆری یەکە بۆ ژماردن:
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setUnitType('PIECE')}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: unitType === 'PIECE' ? '1.5px solid var(--accent-color)' : '1px solid var(--border-color)',
                      background: unitType === 'PIECE' ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                      color: unitType === 'PIECE' ? 'var(--accent-color)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.82rem'
                    }}
                  >
                    📦 دانە
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitType('BOX')}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: unitType === 'BOX' ? '1.5px solid #0284c7' : '1px solid var(--border-color)',
                      background: unitType === 'BOX' ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-tertiary)',
                      color: unitType === 'BOX' ? '#0284c7' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.82rem'
                    }}
                  >
                    📦 کارتۆن {selectedProduct?.units_per_box > 1 ? `(${selectedProduct.units_per_box})` : ''}
                  </button>
                </div>
              </div>

              {/* Physical Counted Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  ژماردنی ڕاستەقینەی سەر ڕەفە:
                </label>
                <input
                  ref={countInputRef}
                  type="number"
                  step="any"
                  min="0"
                  placeholder="ژمارە..."
                  value={countedCount}
                  onChange={(e) => setCountedCount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-tertiary)',
                    border: '1.5px solid #10b981',
                    color: '#10b981',
                    fontSize: '1rem',
                    fontWeight: 800,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  تێبینی (ئارەزوومەندانە):
                </label>
                <input
                  type="text"
                  placeholder="نموونە: ڕەفەی دووەم..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '0.86rem',
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
                  ? 'var(--danger-light)' 
                  : (comparison.status === 'SURPLUS' ? 'var(--warning-light)' : 'var(--success-light)'),
                border: `1px solid ${comparison.status === 'SHORTAGE' ? 'rgba(239, 68, 68, 0.35)' : (comparison.status === 'SURPLUS' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)')}`,
                borderRadius: '10px',
                padding: '10px 14px',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedProduct.name}</span>
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: '6px', 
                      background: 'var(--bg-secondary)', 
                      color: 'var(--accent-hover)', 
                      fontSize: '0.76rem', 
                      fontWeight: 700,
                      border: '1px solid var(--border-color)'
                    }}>
                      سیستەم: {comparison.systemUnits} دانە
                    </span>
                  </div>

                  <div style={{ marginTop: '4px', fontSize: '0.82rem' }}>
                    {countedCount === '' ? (
                      <span style={{ color: 'var(--text-muted)' }}>
                        👈 تکایە ژمارەی بینراوی ڕاستەقینە بنووسە لە خانەکەی سەرەوە.
                      </span>
                    ) : comparison.status === 'MATCH' ? (
                      <div style={{ color: 'var(--success-color)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={15} /> هاوتا و تەواو: هەردووکیان {comparison.countedUnits} دانەن.
                      </div>
                    ) : comparison.status === 'SHORTAGE' ? (
                      <div>
                        <div style={{ color: 'var(--danger-color)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={15} /> نوقسانی: {Math.abs(comparison.differenceUnits)} دانە کەمە | زیان: {Math.abs(comparison.discrepancyValue).toLocaleString()} د.ع
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--warning-color)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TrendingUp size={15} /> زیادە: +{comparison.differenceUnits} دانە زیاترە لە سیستەم
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || countedCount === ''}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    background: comparison.status === 'SHORTAGE'
                      ? 'var(--danger-color)'
                      : '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    cursor: countedCount === '' ? 'not-allowed' : 'pointer',
                    opacity: countedCount === '' ? 0.6 : 1,
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ClipboardCheck size={16} />
                  {submitting ? '...' : 'پەسەندکردن و چاککردنی کۆگا'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* History Table & Filters */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px 16px', boxShadow: 'var(--card-shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem', margin: 0, color: 'var(--text-primary)', fontWeight: 800 }}>
              <Filter size={16} color="#10b981" /> مێژووی جەردەکانی کۆگا
            </h2>

            {/* Filter Tabs & Search */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setTimeFilter('THIS_MONTH')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: timeFilter === 'THIS_MONTH' ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                  background: timeFilter === 'THIS_MONTH' ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                  color: timeFilter === 'THIS_MONTH' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.78rem'
                }}
              >
                ئەم مانگە
              </button>
              <button
                onClick={() => setTimeFilter('TODAY')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: timeFilter === 'TODAY' ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                  background: timeFilter === 'TODAY' ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                  color: timeFilter === 'TODAY' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.78rem'
                }}
              >
                ئەمڕۆ
              </button>
              <button
                onClick={() => setTimeFilter('ALL')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: timeFilter === 'ALL' ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                  background: timeFilter === 'ALL' ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                  color: timeFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.78rem'
                }}
              >
                هەمووی
              </button>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">هەموو دۆخەکان</option>
                <option value="SHORTAGE">⚠️ تەنها نوقسانی</option>
                <option value="MATCH">✅ تەنها هاوتا</option>
                <option value="SURPLUS">📈 تەنها زیادە</option>
              </select>

              {/* Search Bar */}
              <input
                type="text"
                placeholder="گەڕان لە جەردەکاندا..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                  outline: 'none',
                  minWidth: '150px'
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  <th style={{ padding: '8px 10px' }}>#</th>
                  <th style={{ padding: '8px 10px' }}>بەروار و کات</th>
                  <th style={{ padding: '8px 10px' }}>ناوی کاڵا</th>
                  <th style={{ padding: '8px 10px' }}>بارکۆد</th>
                  <th style={{ padding: '8px 10px' }}>مەخزەنی پێشوو</th>
                  <th style={{ padding: '8px 10px' }}>ژماردنی بینراو</th>
                  <th style={{ padding: '8px 10px' }}>جیاوازی</th>
                  <th style={{ padding: '8px 10px' }}>زەرەر / بەهای جیاوازی</th>
                  <th style={{ padding: '8px 10px' }}>دۆخ</th>
                  <th style={{ padding: '8px 10px' }}>جەردکەر و تێبینی</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>کردار</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      هیچ تۆمارێکی جەردکردن نەدۆزرایەوە لەم بەروارەدا.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item, idx) => {
                    const isShortage = item.status === 'SHORTAGE';
                    const isSurplus = item.status === 'SURPLUS';
                    const isMatch = item.status === 'MATCH';

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.84rem' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {new Date(item.created_at).toLocaleString('ku-IQ')}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {item.product_name}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                          {item.barcode || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--accent-hover)', fontWeight: 700 }}>
                          {Number(item.system_stock)} دانە
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {Number(item.counted_stock)} دانە
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: isShortage ? 'var(--danger-color)' : (isSurplus ? 'var(--warning-color)' : 'var(--success-color)') }}>
                          {Number(item.difference_qty) > 0 ? `+${Number(item.difference_qty)}` : Number(item.difference_qty)} دانە
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: isShortage ? 'var(--danger-color)' : (isSurplus ? 'var(--warning-color)' : 'var(--text-secondary)') }}>
                          {isShortage ? `-${Number(Math.abs(item.total_cost_discrepancy)).toLocaleString()} د.ع` : (isSurplus ? `+${Number(item.total_cost_discrepancy).toLocaleString()} د.ع` : '٠ د.ع')}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: isShortage ? 'var(--danger-light)' : (isSurplus ? 'var(--warning-light)' : 'var(--success-light)'),
                            color: isShortage ? 'var(--danger-color)' : (isSurplus ? 'var(--warning-color)' : 'var(--success-color)'),
                            border: `1px solid ${isShortage ? 'rgba(239, 68, 68, 0.3)' : (isSurplus ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)')}`
                          }}>
                            {isShortage ? '⚠️ نوقسانی' : (isSurplus ? '📈 زیادە' : '✅ هاوتا')}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          <div>{item.notes || '-'}</div>
                          <small style={{ color: 'var(--text-muted)' }}>جەردکەر: {item.audited_by_username || 'خاوەنکار'}</small>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              onClick={() => setSelectedVoucher(item)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: 'var(--success-light)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                color: 'var(--success-color)',
                                cursor: 'pointer',
                                fontSize: '0.74rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontWeight: 700
                              }}
                              title="چاپکردنی پسووڵەی جەرد"
                            >
                              <Printer size={12} /> پسووڵە
                            </button>

                            {isAdmin && (
                              <button
                                onClick={() => handleRevertAudit(item.id, item.product_name, item.system_stock)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  background: 'var(--danger-light)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: 'var(--danger-color)',
                                  cursor: 'pointer',
                                  fontSize: '0.74rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontWeight: 700
                                }}
                                title="هەڵوەشاندنەوە و گەڕاندنەوەی مەخزەن"
                              >
                                <RotateCcw size={12} /> گەڕاندنەوە
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
        <div className="pos-modal-overlay" onClick={() => setSelectedVoucher(null)}>
          <div className="pos-modal-card pos-modal-sm" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.05rem', margin: 0, color: '#10b981', fontWeight: 800 }}>
                <ClipboardCheck size={20} /> پسووڵەی جەردی کۆگا
              </h2>
              <button onClick={() => setSelectedVoucher(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
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
                className="btn-secondary"
                style={{ padding: '12px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}
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
          #audit-voucher-printable-area, #audit-voucher-printable-area * {
            visibility: visible !important;
          }
          #audit-voucher-printable-area {
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

export default InventoryAudit;
