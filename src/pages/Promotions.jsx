import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
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
    const matchesSearch = 
      p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = 
      statusFilter === 'ALL' || 
      p.calculated_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const filteredProductsForSelect = products.filter(p => 
    p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(productSearch.toLowerCase())
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
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
          >
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
            نوێکردنەوە
          </button>

          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)' }}
          >
            <Plus size={20} /> ئۆفەری نوێ 🏷️
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="stats-grid mb-8">
        <div className="stat-card glass-panel" style={{ background: 'rgba(139, 92, 246, 0.08)', borderColor: 'rgba(139, 92, 246, 0.25)' }}>
          <h3>ئۆفەرە چالاکەکانی ئێستا</h3>
          <div className="value" style={{ color: '#a78bfa' }}>
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
                border: 'none',
                cursor: 'pointer',
                fontWeight: statusFilter === tab.id ? 'bold' : 'normal',
                background: statusFilter === tab.id ? '#8b5cf6' : 'rgba(255,255,255,0.05)',
                color: statusFilter === tab.id ? 'white' : '#94a3b8'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', right: '12px', top: '12px' }} />
          <input 
            type="text" 
            placeholder="گەڕان بەپێی ناوی کاڵا یان بارکۆد..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 40px 10px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
          />
        </div>
      </div>

      {/* Promotions Table */}
      <div className="glass-panel" style={{ padding: '1px', borderRadius: '16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
            <tr>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>کاڵا و بارکۆد</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>نرخی ئاسایی</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>نرخی ئۆفەر</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>سنووری بڕ (بۆ هەر کڕینێک)</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>ماوەی ئۆفەر</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>دۆخ</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>کردارەکان</th>
            </tr>
          </thead>
          <tbody>
            {filteredPromotions.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
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
                  <tr key={promo.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {/* Product Name & Barcode */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{promo.product_name}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{promo.barcode || '-'}</div>
                    </td>

                    {/* Normal Price */}
                    <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                      <span style={{ textDecoration: 'line-through' }}>{orig.toLocaleString()} د.ع</span>
                    </td>

                    {/* Promo Price & Discount Badge */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#a78bfa', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          {promoPrice.toLocaleString()} د.ع
                        </span>
                        <span style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          -{discountPercent}%
                        </span>
                      </div>
                      <div style={{ color: '#34d399', fontSize: '0.8rem', marginTop: '2px' }}>
                        پاشەکەوت: {discountAmount.toLocaleString()} د.ع بۆ هەر {promo.unit || 'دانە'}
                      </div>
                    </td>

                    {/* Max Limit Per Sale */}
                    <td style={{ padding: '16px 20px' }}>
                      {promo.max_qty_per_sale ? (
                        <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          زۆرترین {promo.max_qty_per_sale} {promo.unit || 'دانە'}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>بێ سنوور (هەموو بڕێک)</span>
                      )}
                    </td>

                    {/* Promo Duration */}
                    <td style={{ padding: '16px 20px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} color="#94a3b8" />
                        لە {new Date(promo.start_date).toLocaleDateString('ku-IQ')} تا {new Date(promo.end_date).toLocaleDateString('ku-IQ')}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '16px 20px' }}>
                      {promo.calculated_status === 'ACTIVE' && (
                        <span style={{ padding: '4px 12px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          چالاکە 🟢
                        </span>
                      )}
                      {promo.calculated_status === 'SCHEDULED' && (
                        <span style={{ padding: '4px 12px', borderRadius: '20px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          پلاندانراو 🟡
                        </span>
                      )}
                      {promo.calculated_status === 'EXPIRED' && (
                        <span style={{ padding: '4px 12px', borderRadius: '20px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          بەسەرچوو 🔴
                        </span>
                      )}
                      {promo.calculated_status === 'INACTIVE' && (
                        <span style={{ padding: '4px 12px', borderRadius: '20px', background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8', fontWeight: 'bold', fontSize: '0.8rem' }}>
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
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: promo.is_active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                            color: promo.is_active ? '#34d399' : '#94a3b8',
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
                            color: '#f87171',
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '580px', borderRadius: '20px', padding: '24px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.25rem', margin: 0, color: '#c084fc' }}>
                <Sparkles size={24} /> دروستکردنی ئۆفەری نوێ
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePromotion}>
              {/* Product Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '0.9rem' }}>
                  هەڵبژاردنی کاڵا بۆ ئۆفەرەکە *
                </label>
                <input 
                  type="text" 
                  placeholder="گەڕان بەپێی ناوی کاڵا بۆ هەڵبژاردن..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', marginBottom: '8px' }}
                />
                
                <select 
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  required
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)', color: 'white', outline: 'none', fontSize: '0.95rem' }}
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
                <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', border: '1px solid rgba(139, 92, 246, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>نرخی کڕین (تێچوو):</span>
                    <strong style={{ display: 'block', color: '#f87171' }}>{Number(selectedProduct.cost_price || 0).toLocaleString()} دینار</strong>
                  </div>
                  <div>
                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>نرخی ئێستای فرۆشتن:</span>
                    <strong style={{ display: 'block', color: '#38bdf8' }}>{Number(selectedProduct.selling_price).toLocaleString()} دینار</strong>
                  </div>
                  <div>
                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>مەوجودی کۆگا:</span>
                    <strong style={{ display: 'block', color: '#34d399' }}>{selectedProduct.stock} {selectedProduct.unit || 'دانە'}</strong>
                  </div>
                </div>
              )}

              {/* Discount Type Toggle */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#cbd5e1', fontSize: '0.9rem' }}>شێوازی داشکاندن:</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'FIXED_PRICE' })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      background: formData.discount_type === 'FIXED_PRICE' ? '#8b5cf6' : 'rgba(255,255,255,0.06)',
                      color: formData.discount_type === 'FIXED_PRICE' ? 'white' : '#94a3b8'
                    }}
                  >
                    نرخی نوێی ئۆفەر (دینار)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'PERCENT' })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      background: formData.discount_type === 'PERCENT' ? '#8b5cf6' : 'rgba(255,255,255,0.06)',
                      color: formData.discount_type === 'PERCENT' ? 'white' : '#94a3b8'
                    }}
                  >
                    ڕێژەی لەسەدا (%)
                  </button>
                </div>
              </div>

              {/* Discount Value Input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '0.9rem' }}>
                  {formData.discount_type === 'FIXED_PRICE' ? 'نرخی نوێی داشکێنراو (بە دینار) *' : 'ڕێژەی داشکاندن (لە ١٪ بۆ ٩٩٪) *'}
                </label>
                <input 
                  type="number" 
                  value={formData.discount_value} 
                  onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                  placeholder={formData.discount_type === 'FIXED_PRICE' ? 'بۆ نموونە: 750' : 'بۆ نموونە: 25'}
                  min="0"
                  max={formData.discount_type === 'PERCENT' ? "99" : undefined}
                  required
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', outline: 'none', fontSize: '1.1rem', fontWeight: 'bold' }}
                />

                {/* Calculation Summary Preview */}
                {selectedProduct && formData.discount_value && (
                  <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>نرخی نێو ئۆفەر دەبێتە:</span>
                    <strong style={{ fontSize: '1.2rem', color: '#a78bfa' }}>{calculatedPromoPrice.toLocaleString()} دینار</strong>
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
                <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '0.9rem' }}>
                  سنووری زۆرترین بڕ بۆ یەک کڕین (Max Limit Per Sale)
                </label>
                <input 
                  type="number" 
                  value={formData.max_qty_per_sale} 
                  onChange={(e) => setFormData({ ...formData, max_qty_per_sale: e.target.value })}
                  placeholder="نموونە: 2 (ئەگەر کڕیار لە 2 زیاتر بکڕێت، ئەوانی تر بە نرخی ئاسایی دەبن)"
                  min="0.1"
                  step="any"
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', outline: 'none' }}
                />
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                  بۆ بێ سنوور، دەتوانیت بە بەتاڵی جێی بهێڵیت.
                </span>
              </div>

              {/* Date Pickers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '0.9rem' }}>بەرواری دەستپێک *</label>
                  <input 
                    type="date" 
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '0.9rem' }}>بەرواری کۆتایی *</label>
                  <input 
                    type="date" 
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '0.9rem' }}>تێبینی و هۆکاری ئۆفەر (ئارەزوومەندانە)</label>
                <input 
                  type="text" 
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="بۆ نموونە: ئۆفەری جەژن، داشکاندنی بەرواری نزیک..."
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', outline: 'none' }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
                >
                  {isSubmitting ? 'کەمێک بوەستە...' : 'تۆمارکردنی ئۆفەر 🚀'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '14px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', border: 'none', cursor: 'pointer' }}
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
