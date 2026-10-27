import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { 
  Tag, 
  Plus, 
  Search, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  X, 
  RefreshCw,
  TrendingDown,
  Layers,
  Sparkles
} from 'lucide-react';
import { formatDate, formatDateTime, formatCurrency } from '../utils/dateFormatter';
import './Dashboard.css';

const Promotions = () => {
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'ACTIVE', 'EXPIRED', 'SCHEDULED'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    product_id: '',
    discount_type: 'FIXED_PRICE', // 'FIXED_PRICE' or 'PERCENT'
    discount_value: '',
    max_qty_per_sale: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [promosRes, prodsRes] = await Promise.all([
        axios.get('http://localhost:3001/api/promotions'),
        axios.get('http://localhost:3001/api/products')
      ]);

      if (promosRes.data.status === 'SUCCESS') setPromotions(promosRes.data.data);
      if (prodsRes.data.status === 'SUCCESS') setProducts(prodsRes.data.data);
    } catch (err) {
      console.error('Failed to load promotions data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Selected Product for promo calculation
  const selectedProduct = useMemo(() => {
    return products.find(p => String(p.id) === String(formData.product_id)) || null;
  }, [products, formData.product_id]);

  // Live Calculated Promotional Price
  const calculatedPromoPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    const orig = Number(selectedProduct.selling_price) || 0;
    const val = parseFloat(formData.discount_value) || 0;

    if (formData.discount_type === 'PERCENT') {
      return Math.max(0, Math.round(orig - (orig * Math.min(100, val)) / 100));
    }
    return Math.max(0, Math.round(val));
  }, [selectedProduct, formData.discount_type, formData.discount_value]);

  // Cost Safeguard Warning
  const isBelowCost = useMemo(() => {
    if (!selectedProduct || !formData.discount_value) return false;
    const cost = Number(selectedProduct.cost_price) || 0;
    return calculatedPromoPrice < cost;
  }, [selectedProduct, calculatedPromoPrice, formData.discount_value]);

  const handleCreatePromotion = async (e) => {
    e.preventDefault();
    if (!formData.product_id) {
      return alert('تکایە کاڵایەک هەڵبژێرە');
    }
    const val = parseFloat(formData.discount_value);
    if (isNaN(val) || val <= 0) {
      return alert('تکایە بڕی داشکاندن یان نرخی ئۆفەری دروست بنووسە');
    }

    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      return alert('بەرواری دەستپێک نابێت لە بەرواری کۆتایی درەنگتر بێت');
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post('http://localhost:3001/api/promotions', {
        ...formData,
        discount_value: val,
        max_qty_per_sale: formData.max_qty_per_sale ? parseFloat(formData.max_qty_per_sale) : null
      });

      if (res.data.status === 'SUCCESS') {
        alert('ئۆفەر بە سەرکەوتوویی تۆمارکرا');
        setIsModalOpen(false);
        setFormData({
          product_id: '',
          discount_type: 'FIXED_PRICE',
          discount_value: '',
          max_qty_per_sale: '',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          notes: ''
        });
        setProductSearch('');
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی دروستکردنی ئۆفەر');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await axios.patch(`http://localhost:3001/api/promotions/${id}/toggle`);
      fetchData();
    } catch {
      alert('هەڵەیەک ڕوویدا لە گۆڕینی دۆخی ئۆفەر');
    }
  };

  const handleDeletePromotion = async (id) => {
    if (window.confirm('دڵنیایت لە سڕینەوەی ئەم ئۆفەرە؟')) {
      try {
        await axios.delete(`http://localhost:3001/api/promotions/${id}`);
        fetchData();
      } catch {
        alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوە');
      }
    }
  };

  // KPI Statistics
  const activeCount = promotions.filter(p => p.calculated_status === 'ACTIVE').length;
  const expiredCount = promotions.filter(p => p.calculated_status === 'EXPIRED').length;
  const scheduledCount = promotions.filter(p => p.calculated_status === 'SCHEDULED').length;

  // Filtered List
  const filteredPromotions = promotions.filter(p => {
    const matchesSearch = kurdishSearchMatch([p.product_name, p.barcode, p.notes], searchTerm);

    const matchesStatus = 
      statusFilter === 'ALL' || 
      p.calculated_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const filteredProductsForSelect = products.filter(p => 
    kurdishSearchMatch([p.name, p.barcode], productSearch)
  );

  return (
    <div className="dashboard-page p-8" dir="rtl">
      {/* Top Header */}
      <div className="page-header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Tag className="text-secondary" size={32} />
            بەڕێوەبردنی ئۆفەرەکان و داشکاندنی گشتی
          </h1>
          <p className="text-secondary">داشکاندنی گشتی لەسەر کاڵاکان بە دیاریکردنی زۆرترین بڕ بۆ یەک کڕین و بەرواری دەستپێک و کۆتایی</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
            نوێکردنەوە
          </button>

          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #d97706, #b45309)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(217, 119, 6, 0.35)' }}
          >
            <Plus size={20} /> ئۆفەری نوێ 🏷️
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="stats-grid mb-8">
        <div className="stat-card glass-panel" style={{ background: 'rgba(217, 119, 6, 0.08)', borderColor: 'rgba(217, 119, 6, 0.25)' }}>
          <h3>ئۆفەرە چالاکەکانی ئێستا</h3>
          <div className="value" style={{ color: '#d97706' }}>
            {activeCount} ئۆفەری چالاک
          </div>
          <div className="sub-text">دەستبەجێ لە کاشێر جێبەجێ دەبن</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.25)' }}>
          <h3>کۆی گشتی ئۆفەرەکان</h3>
          <div className="value" style={{ color: '#60a5fa' }}>
            {promotions.length} ئۆفەر
          </div>
          <div className="sub-text">تۆمارکراو لە داتابەیسدا</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
          <h3>ئۆفەرە پلاندانراوەکان</h3>
          <div className="value" style={{ color: '#fbbf24' }}>
            {scheduledCount} لە چاوەڕوانیدا
          </div>
          <div className="sub-text">لە بەرواری دیاریکراودا دەستپێدەکەن</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
          <h3>ئۆفەرە بەسەرچووەکان</h3>
          <div className="value" style={{ color: '#f87171' }}>
            {expiredCount} بەسەرچوو
          </div>
          <div className="sub-text">کاتیان کۆتایی هاتووە</div>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'ALL', label: 'هەموو' },
            { id: 'ACTIVE', label: 'چالاکەکان 🟢' },
            { id: 'SCHEDULED', label: 'پلاندانراو 🟡' },
            { id: 'EXPIRED', label: 'بەسەرچوو 🔴' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1px solid ' + (statusFilter === tab.id ? 'transparent' : 'var(--border-color)'),
                cursor: 'pointer',
                fontWeight: statusFilter === tab.id ? 'bold' : 'normal',
                background: statusFilter === tab.id ? '#2563eb' : 'var(--bg-tertiary)',
                color: statusFilter === tab.id ? 'white' : 'var(--text-secondary)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', right: '12px', top: '12px' }} />
          <input 
            type="text" 
            placeholder="گەڕان بەپێی ناوی کاڵا یان بارکۆد..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 40px 10px 16px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>
      </div>

      {/* Promotions Table */}
      <div className="glass-panel" style={{ padding: '1px', borderRadius: '16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <thead style={{ background: 'var(--bg-tertiary)' }}>
            <tr>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>کاڵا و بارکۆد</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>نرخی ئاسایی</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>نرخی ئۆفەر</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>سنووری بڕ (بۆ هەر کڕینێک)</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>ماوەی ئۆفەر</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>دۆخ</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>کردارەکان</th>
            </tr>
          </thead>
          <tbody>
            {filteredPromotions.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  هیچ ئۆفەرێک لەم بەشەدا نەدۆزرایەوە
                </td>
              </tr>
            ) : (
              filteredPromotions.map((promo) => {
                const orig = Number(promo.original_price);
                let promoPrice = orig;
                if (promo.discount_type === 'PERCENT') {
                  promoPrice = Math.max(0, Math.round(orig - (orig * Number(promo.discount_value)) / 100));
                } else {
                  promoPrice = Math.max(0, Math.round(Number(promo.discount_value)));
                }

                const discountAmount = Math.max(0, orig - promoPrice);
                const discountPercent = orig > 0 ? Math.round((discountAmount / orig) * 100) : 0;

                return (
                  <tr key={promo.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {/* Product Name & Barcode */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-primary)' }}>{promo.product_name}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{promo.barcode || '-'}</div>
                    </td>

                    {/* Normal Price */}
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>
                      <span style={{ textDecoration: 'line-through' }}>{orig.toLocaleString()} د.ع</span>
                    </td>

                    {/* Promo Price & Discount Badge */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#0284c7', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          {promoPrice.toLocaleString()} د.ع
                        </span>
                        <span style={{ background: 'rgba(217, 119, 6, 0.15)', color: '#b45309', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          -{discountPercent}%
                        </span>
                      </div>
                      <div style={{ color: '#10b981', fontSize: '0.8rem', marginTop: '2px' }}>
                        پاشەکەوت: {discountAmount.toLocaleString()} د.ع بۆ هەر {promo.unit || 'دانە'}
                      </div>
                    </td>

                    {/* Max Limit Per Sale */}
                    <td style={{ padding: '16px 20px' }}>
                      {promo.max_qty_per_sale ? (
                        <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#0284c7', padding: '4px 10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          زۆرترین {promo.max_qty_per_sale} {promo.unit || 'دانە'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>بێ سنوور (هەموو بڕێک)</span>
                      )}
                    </td>

                    {/* Promo Duration */}
                    <td style={{ padding: '16px 20px', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} color="var(--text-secondary)" />
                        لە {formatDate(promo.start_date)} تا {formatDate(promo.end_date)}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '16px 20px' }}>
                      {promo.calculated_status === 'ACTIVE' && (
                        <span style={{ padding: '4px 12px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          چالاکە 🟢
                        </span>
                      )}
                      {promo.calculated_status === 'SCHEDULED' && (
                        <span style={{ padding: '4px 12px', borderRadius: '20px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          پلاندانراو 🟡
                        </span>
                      )}
                      {promo.calculated_status === 'EXPIRED' && (
                        <span style={{ padding: '4px 12px', borderRadius: '20px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          بەسەرچوو 🔴
                        </span>
                      )}
                      {promo.calculated_status === 'INACTIVE' && (
                        <span style={{ padding: '4px 12px', borderRadius: '20px', background: 'rgba(148, 163, 184, 0.2)', color: 'var(--text-secondary)', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          ناچالاککراو ⚪
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => handleToggleStatus(promo.id)}
                          title={promo.is_active ? 'ناچالاککردن' : 'چالاککردن'}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: promo.is_active ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)',
                            color: promo.is_active ? '#10b981' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                          }}
                        >
                          {promo.is_active ? 'دەستکاریکردن بۆ ناچالاک' : 'چالاککردنەوە'}
                        </button>

                        <button
                          onClick={() => handleDeletePromotion(promo.id)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Create Promotion */}
      {isModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="pos-modal-card pos-modal-md" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)', fontWeight: 800 }}>
                <Sparkles size={22} color="#d97706" /> دروستکردنی ئۆفەری نوێ
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePromotion}>
              {/* Product Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  هەڵبژاردنی کاڵا بۆ ئۆفەرەکە *
                </label>
                <input 
                  type="text" 
                  placeholder="گەڕان بەپێی ناوی کاڵا بۆ هەڵبژاردن..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', marginBottom: '8px' }}
                />
                
                <select 
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  required
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
                >
                  <option value="">-- کاڵایەک دیاریبکە ({filteredProductsForSelect.length} کاڵا) --</option>
                  {filteredProductsForSelect.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} - نرخی فرۆشتن: {Number(p.selling_price).toLocaleString()} د.ع (کڕین: {Number(p.cost_price || 0).toLocaleString()} د.ع)
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Product Info Banner */}
              {selectedProduct && (
                <div style={{ background: 'rgba(217, 119, 6, 0.08)', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', border: '1px solid rgba(217, 119, 6, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>نرخی کڕین (تێچوو):</span>
                    <strong style={{ display: 'block', color: '#f87171' }}>{Number(selectedProduct.cost_price || 0).toLocaleString()} دینار</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>نرخی ئێستای فرۆشتن:</span>
                    <strong style={{ display: 'block', color: '#38bdf8' }}>{Number(selectedProduct.selling_price).toLocaleString()} دینار</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>مەوجودی کۆگا:</span>
                    <strong style={{ display: 'block', color: '#10b981' }}>{selectedProduct.stock} {selectedProduct.unit || 'دانە'}</strong>
                  </div>
                </div>
              )}

              {/* Discount Type Toggle */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>شێوازی داشکاندن:</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'FIXED_PRICE' })}
                    style={{
                      flex: '1 1 140px',
                      padding: '10px',
                      borderRadius: '10px',
                      border: '1px solid ' + (formData.discount_type === 'FIXED_PRICE' ? 'transparent' : 'var(--border-color)'),
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      background: formData.discount_type === 'FIXED_PRICE' ? '#2563eb' : 'var(--bg-tertiary)',
                      color: formData.discount_type === 'FIXED_PRICE' ? 'white' : 'var(--text-secondary)'
                    }}
                  >
                    نرخی نوێی ئۆفەر (دینار)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'PERCENT' })}
                    style={{
                      flex: '1 1 140px',
                      padding: '10px',
                      borderRadius: '10px',
                      border: '1px solid ' + (formData.discount_type === 'PERCENT' ? 'transparent' : 'var(--border-color)'),
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      background: formData.discount_type === 'PERCENT' ? '#2563eb' : 'var(--bg-tertiary)',
                      color: formData.discount_type === 'PERCENT' ? 'white' : 'var(--text-secondary)'
                    }}
                  >
                    ڕێژەی لەسەدا (%)
                  </button>
                </div>
              </div>

              {/* Discount Value Input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  {formData.discount_type === 'FIXED_PRICE' ? 'نرخی نوێی داشکێنراو (بە دینار) *' : 'ڕێژەی داشکاندن (لە ١٪ بۆ ٩٩٪) *'}
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const step = formData.discount_type === 'FIXED_PRICE' ? 250 : 5;
                      const cur = Math.max(0, parseInt(formData.discount_value) || 0);
                      const next = Math.max(0, cur - step);
                      setFormData({ ...formData, discount_value: next === 0 ? '' : String(next) });
                    }}
                    style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <span dir="ltr" style={{ display: 'inline-block' }}>{formData.discount_type === 'FIXED_PRICE' ? '-250' : '-5%'}</span>
                  </button>
                  <input 
                    type="number" 
                    value={formData.discount_value} 
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    placeholder={formData.discount_type === 'FIXED_PRICE' ? 'بۆ نموونە: 750' : 'بۆ نموونە: 25'}
                    min="0"
                    step={formData.discount_type === 'FIXED_PRICE' ? "any" : "1"}
                    max={formData.discount_type === 'PERCENT' ? "99" : undefined}
                    required
                    style={{ flex: '1 1 120px', minWidth: '100px', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '1.1rem', fontWeight: 'bold', textAlign: 'center' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const step = formData.discount_type === 'FIXED_PRICE' ? 250 : 5;
                      const cur = Math.max(0, parseInt(formData.discount_value) || 0);
                      const maxVal = formData.discount_type === 'PERCENT' ? 99 : Infinity;
                      const next = Math.min(maxVal, cur + step);
                      setFormData({ ...formData, discount_value: String(next) });
                    }}
                    style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <span dir="ltr" style={{ display: 'inline-block' }}>{formData.discount_type === 'FIXED_PRICE' ? '+250' : '+5%'}</span>
                  </button>
                </div>

                {formData.discount_type === 'FIXED_PRICE' && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {[250, 500, 750, 1000, 1500, 2000, 2500, 5000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setFormData({ ...formData, discount_value: String(amt) })}
                        style={{ padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                )}

                {/* Calculation Summary Preview */}
                {selectedProduct && formData.discount_value && (
                  <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>نرخی نێو ئۆفەر دەبێتە:</span>
                    <strong style={{ fontSize: '1.2rem', color: '#0284c7' }}>{calculatedPromoPrice.toLocaleString()} دینار</strong>
                  </div>
                )}

                {/* Cost Safeguard Alert */}
                {isBelowCost && (
                  <div style={{ marginTop: '8px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <AlertTriangle size={18} />
                    <span>ئاگاداربە: ئەم نرخە ({calculatedPromoPrice.toLocaleString()} د.ع) لە نرخی کڕین ({Number(selectedProduct.cost_price || 0).toLocaleString()} د.ع) کەمترە و دەبێتە هۆی زیان!</span>
                  </div>
                )}
              </div>

              {/* Max Quantity Limit per Sale */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  سنووری زۆرترین بڕ بۆ یەک کڕین (Max Limit Per Sale)
                </label>
                <input 
                  type="number" 
                  value={formData.max_qty_per_sale} 
                  onChange={(e) => setFormData({ ...formData, max_qty_per_sale: e.target.value })}
                  placeholder="نموونە: 2 (ئەگەر کڕیار لە 2 زیاتر بکڕێت، ئەوانی تر بە نرخی ئاسایی دەبن)"
                  min="0.1"
                  step="any"
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  بۆ بێ سنوور، دەتوانیت بە بەتاڵی جێی بهێڵیت.
                </span>
              </div>

              {/* Date Pickers */}
              <div className="responsive-grid-2" style={{ marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>بەرواری دەستپێک *</label>
                  <input 
                    type="date" 
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>بەرواری کۆتایی *</label>
                  <input 
                    type="date" 
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>تێبینی و هۆکاری ئۆفەر (ئارەزوومەندانە)</label>
                <input 
                  type="text" 
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="بۆ نموونە: ئۆفەری جەژن، داشکاندنی بەرواری نزیک..."
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ flex: 1, minWidth: '160px', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #d97706, #b45309)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 4px 15px rgba(217, 119, 6, 0.35)' }}
                >
                  {isSubmitting ? 'کەمێک بوەستە...' : 'تۆمارکردنی ئۆفەر 🚀'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '14px 20px' }}
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Promotions;
