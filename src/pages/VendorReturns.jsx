import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
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
    return products.filter(p => 
      kurdishSearchMatch([p.name, p.barcode, p.box_barcode], productSearch)
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
    return returnsList.filter(r => 
      kurdishSearchMatch([r.product_name, r.product_barcode, r.supplier_name, r.representative_name, r.notes], searchQuery)
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

    const supName = selectedSupplierObj?.name || 'کڕینی ناوخۆیی / بێ کۆمپانیا';
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
    <div className="dashboard-page" style={{ padding: '12px 18px', maxWidth: '100%', boxSizing: 'border-box' }} dir="rtl">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#0ea5e9', fontSize: '1.25rem', fontWeight: 800 }}>
            <Truck size={22} color="#0ea5e9" />
            گەڕاندنەوە بۆ کۆمپانیا و مەندوب (RTV)
          </h1>
          <span style={{ 
            background: 'var(--accent-light)', 
            color: 'var(--accent-hover)', 
            border: '1px solid rgba(14, 165, 233, 0.3)', 
            padding: '2px 8px', 
            borderRadius: '6px', 
            fontSize: '0.74rem', 
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            داشکاندن لە قەرز و چاککردنی کۆگا
          </span>
        </div>
      </div>

      {/* Slim KPI Metric Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '10px' }}>
        {/* This Month Refund */}
        <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>گەڕێنراوەی ئەم مانگە</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-hover)' }}>
              {Number(stats.this_month?.this_month_refund || 0).toLocaleString()} د.ع
            </div>
          </div>
          <DollarSign size={20} color="var(--accent-color)" />
        </div>

        {/* This Month Units */}
        <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>دانەی گەڕێنراو</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--success-color)' }}>
              {Number(stats.this_month?.this_month_units || 0).toLocaleString()} دانە
            </div>
          </div>
          <TrendingDown size={20} color="var(--success-color)" />
        </div>

        {/* Today Refund */}
        <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>گەڕێنراوەی ئەمڕۆ</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--warning-color)' }}>
              {Number(stats.today?.today_refund || 0).toLocaleString()} د.ع <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>({stats.today?.today_records || 0})</span>
            </div>
          </div>
          <Calendar size={20} color="var(--warning-color)" />
        </div>

        {/* Lifetime Refund */}
        <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>کۆی گشتی هەموو کات</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284c7' }}>
              {Number(stats.lifetime?.lifetime_refund || 0).toLocaleString()} د.ع
            </div>
          </div>
          <Building2 size={20} color="#0284c7" />
        </div>
      </div>

      {/* Main Layout: Form Card & History */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
        
        {/* Form Card */}
        <div style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          padding: '12px 16px', 
          boxShadow: 'var(--card-shadow)' 
        }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.05rem', margin: '0 0 10px 0', color: 'var(--accent-hover)', fontWeight: 800 }}>
            <Plus size={18} /> تۆمارکردنی گەڕاندنەوەی کاڵا بۆ مەندوب
          </h2>

          <form onSubmit={handleSubmitReturn}>
            {/* Row 1: Company, Rep, and Reason */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
              gap: '12px', 
              marginBottom: '12px' 
            }}>
              {/* Supplier Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  کۆمپانیا / دابینکەر:
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
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
                  <option value="">-- دیاریکردنی کۆمپانیا (یان کڕینی ناوخۆیی) --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      🏢 {s.name} (قەرز لای مارکێت: {Number(s.total_remaining || 0).toLocaleString()} د.ع)
                    </option>
                  ))}
                </select>
              </div>

              {/* Representative Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  ناوی مەندوب / نوێنەری کۆمپانیا:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="نموونە: کاک کاروان..."
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      paddingLeft: '32px',
                      borderRadius: '8px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <UserCheck size={15} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  هۆکاری گەڕاندنەوە:
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
                  {REASON_PRESETS.map((r, i) => (
                    <option key={i} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Product & Quantity Specifications */}
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
                    placeholder="بارکۆد یان ناوی کاڵا..."
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
                {isProductDropdownOpen && filteredProducts.length > 0 && (
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
                    placeholder="نرخی تێچوون..."
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

            {/* Row 3: Settlement Method & Notes */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
              gap: '12px', 
              marginBottom: '10px' 
            }}>
              {/* Settlement Type */}
              <div style={{ minWidth: '280px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  شێوازی پاکتاوکردن:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setRefundType('DEBT_DEDUCT')}
                    style={{
                      minWidth: 0,
                      padding: '7px 8px',
                      borderRadius: '8px',
                      border: refundType === 'DEBT_DEDUCT' ? '2px solid #10b981' : '1px solid var(--border-color)',
                      background: refundType === 'DEBT_DEDUCT' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)',
                      color: refundType === 'DEBT_DEDUCT' ? '#10b981' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    💳 کەمکردنەوە لە قەرز
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundType('CASH_REFUND')}
                    style={{
                      minWidth: 0,
                      padding: '7px 8px',
                      borderRadius: '8px',
                      border: refundType === 'CASH_REFUND' ? '2px solid var(--accent-hover)' : '1px solid var(--border-color)',
                      background: refundType === 'CASH_REFUND' ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                      color: refundType === 'CASH_REFUND' ? 'var(--accent-hover)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    💵 نەقد
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  تێبینی زیاتر:
                </label>
                <input
                  type="text"
                  placeholder="نموونە: بە فەرمی لەگەڵ مەندوب پشکنرا..."
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

            {/* Live Calculation Banner or Action Strip */}
            {selectedProduct ? (
              <div style={{
                background: 'var(--accent-light)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '10px 14px',
                marginTop: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--accent-hover)' }}>
                    کۆی بڕی پارەی گەڕێنراوە: {calculations.totalRefund.toLocaleString()} دینار
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    دەرچوون لە مەخزەن: <span style={{ color: '#fbbf24', fontWeight: 700 }}>{calculations.totalUnits} دانە</span>
                    {calculations.isBox && ` (${calculations.multiplier} دانە بۆ هەر کارتۆنێک)`}
                    {' | '} مەخزەنی ئێستا: {selectedProduct.stock} دانە 
                    {' ⬅️ '} دەبێتە: {Number(selectedProduct.stock) - calculations.totalUnits} دانە
                  </div>

                  {selectedSupplierObj && refundType === 'DEBT_DEDUCT' && (
                    <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '2px', fontWeight: 700 }}>
                      قەرزی کۆمپانیا لای مارکێت: {calculations.currentDebt.toLocaleString()} د.ع 
                      {' ⬅️ '} کەم دەبێتەوە بۆ: {calculations.newRemainingDebt.toLocaleString()} دینار
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    background: 'var(--accent-color)',
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
                  <Truck size={17} />
                  {submitting ? 'تۆمار دەکرێت...' : 'گەڕاندنەوە بۆ مەندوب و داشکاندنی قەرز'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={true}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                    cursor: 'not-allowed',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="تکایە سەرەتا کاڵایەک دیاریبکە"
                >
                  <Truck size={16} />
                  تۆمارکردنی گەڕاندنەوە (سەرەتا کاڵا دیاریبکە)
                </button>
              </div>
            )}
          </form>
        </div>

        {/* History Table & Filters */}
        <div style={{ 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          padding: '12px 16px', 
          boxShadow: 'var(--card-shadow)' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.05rem', margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>
              <Filter size={18} color="var(--accent-hover)" /> مێژووی کاڵا گەڕێنراوەکان بۆ کۆمپانیاکان
            </h2>

            {/* Filter Tabs & Search */}
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

              {/* Supplier Filter */}
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
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
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>بەروار</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>کۆمپانیا</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>مەندوب</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>ناوی کاڵا</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>بڕی گەڕێنراوە</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>دەرچوو لە کۆگا</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>کۆی پارە</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>شێوازی پاکتاوکردن</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem' }}>هۆکار و تێبینی</th>
                  <th style={{ padding: '8px 10px', fontSize: '0.8rem', textAlign: 'center' }}>کردار</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      هیچ تۆمارێکی گەڕاندنەوە بۆ کۆمپانیا نەدۆزرایەوە.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item, idx) => {
                    const unitsDeducted = parseFloat(item.quantity) * parseFloat(item.units_multiplier || 1);

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {new Date(item.created_at).toLocaleString('ku-IQ')}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--accent-hover)', fontSize: '0.84rem' }}>
                          {item.supplier_name}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                          {item.representative_name || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.86rem' }}>
                          {item.product_name}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: '0.84rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{Number(item.quantity)}</span> {item.unit_type === 'BOX' ? 'کارتۆن' : 'دانە'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#fbbf24', fontWeight: 700, fontSize: '0.84rem' }}>
                          {unitsDeducted} دانە
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 800, color: '#10b981', fontSize: '0.86rem' }}>
                          {Number(item.total_refund).toLocaleString()} دینار
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
                            background: item.refund_type === 'DEBT_DEDUCT' ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent-light)',
                            color: item.refund_type === 'DEBT_DEDUCT' ? '#10b981' : 'var(--accent-hover)',
                            border: `1px solid ${item.refund_type === 'DEBT_DEDUCT' ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`
                          }}>
                            {item.refund_type === 'DEBT_DEDUCT' ? '💳 داشکاندن لە قەرز' : '💵 وەرگرتنی نەقد'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <div>{item.reason || '-'}</div>
                          {item.notes && <small style={{ color: 'var(--text-secondary)' }}>({item.notes})</small>}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
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
                              title="چاپکردنی پسووڵەی فەرمی"
                            >
                              <Printer size={13} /> پسووڵە
                            </button>

                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteReturn(item.id, item.product_name, unitsDeducted, item.total_refund)}
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
                                title="هەڵوەشاندنەوە و گەڕاندنەوە بۆ کۆگا و قەرز"
                              >
                                <RotateCcw size={13} /> هەڵوەشاندنەوە
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
        <div className="pos-modal-overlay" onClick={() => setSelectedReceipt(null)}>
          <div className="pos-modal-card pos-modal-sm" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', margin: 0, color: 'var(--accent-hover)', fontWeight: 800 }}>
                <Truck size={18} /> پسووڵەی گەڕاندنەوە بۆ کۆمپانیا (RTV)
              </h2>
              <button onClick={() => setSelectedReceipt(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>

            {/* Printable Area */}
            <div id="rtv-voucher-printable-area" style={{ background: '#ffffff', color: '#000000', padding: '16px 14px', borderRadius: '8px', fontFamily: 'monospace, Tahoma', fontSize: '13px', lineHeight: '1.5', direction: 'rtl' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold' }}>مارکێتی زیرەک</h3>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 'bold', color: '#0284c7' }}>پسووڵەی گەڕاندنەوەی کاڵا بۆ مەندوب (RTV)</h4>
                <div style={{ fontSize: '11px' }}>ژمارەی تۆمار: #{selectedReceipt.id}</div>
              </div>

              <div style={{ fontSize: '11px', marginBottom: '8px', borderBottom: '1px solid #ddd', paddingBottom: '6px' }}>
                <div>بەروار: {new Date(selectedReceipt.created_at).toLocaleString('ku-IQ')}</div>
                <div>کۆمپانیا: <strong>{selectedReceipt.supplier_name}</strong></div>
                <div>مەندوب / وەرگر: <strong>{selectedReceipt.representative_name}</strong></div>
                {selectedReceipt.supplier_phone && <div>پەیوەندی: {selectedReceipt.supplier_phone}</div>}
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
                  <span>بڕی دراوەتەوە بە مەندوب:</span>
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
                  <span>هۆکاری گەڕاندنەوە:</span>
                  <span>{selectedReceipt.reason}</span>
                </div>
                {selectedReceipt.notes && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '11px', color: '#555' }}>
                    <span>تێبینی:</span>
                    <span>{selectedReceipt.notes}</span>
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '2px dashed #000', paddingBottom: '8px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', color: '#0284c7', marginBottom: '4px' }}>
                  <span>کۆی پارەی گەڕێنراوە:</span>
                  <span>{Number(selectedReceipt.total_refund).toLocaleString()} دینار</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', color: selectedReceipt.refund_type === 'DEBT_DEDUCT' ? '#047857' : '#b45309' }}>
                  <span>شێوازی پاکتاوکردن:</span>
                  <span>
                    {selectedReceipt.refund_type === 'DEBT_DEDUCT' ? '💳 داشکاندن لە قەرزی کۆمپانیا' : '💵 وەرگرتنەوەی نەقد لە مەندوب'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '8px', fontSize: '11px', textAlign: 'center' }}>
                <div style={{ width: '45%' }}>
                  <div>واژۆی مەندوبی کۆمپانیا</div>
                  <div style={{ marginTop: '20px', borderBottom: '1px dotted #000' }}></div>
                </div>
                <div style={{ width: '45%' }}>
                  <div>واژۆی بەرپرسی کۆگا / مارکێت</div>
                  <div style={{ marginTop: '20px', borderBottom: '1px dotted #000' }}></div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '10px', color: '#555' }}>
                ئەم پسووڵەیە وەک بەڵگەنامەی فەرمی بۆ داشکاندنی باڵانسی کۆمپانیا کارپێکراوە.
              </div>
            </div>

            {/* Modal Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button 
                onClick={printVoucher}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'var(--accent-color)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.86rem' }}
              >
                <Printer size={16} /> چاپکردنی پسووڵە
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
          #rtv-voucher-printable-area, #rtv-voucher-printable-area * {
            visibility: visible !important;
          }
          #rtv-voucher-printable-area {
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

export default VendorReturns;
