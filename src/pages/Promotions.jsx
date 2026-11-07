import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { 
  Tag, 
  Plus, 
  Search, 
  Trash2, 
  Calendar, 
  X, 
  RefreshCw
} from 'lucide-react';
import { formatDate } from '../utils/dateFormatter';
import './Dashboard.css';

const Promotions = () => {
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    product_id: '',
    discount_type: 'FIXED_PRICE',
    discount_value: '',
    min_qty: '3',
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

  const selectedProduct = useMemo(() => {
    return products.find(p => String(p.id) === String(formData.product_id)) || null;
  }, [products, formData.product_id]);

  const regularUnitPrice = useMemo(() => {
    return selectedProduct ? (Number(selectedProduct.selling_price) || 0) : 0;
  }, [selectedProduct]);

  const bundleQty = useMemo(() => {
    return Math.max(1, parseInt(formData.min_qty) || 1);
  }, [formData.min_qty]);

  const regularBundleTotal = useMemo(() => {
    return regularUnitPrice * bundleQty;
  }, [regularUnitPrice, bundleQty]);

  const offerBundlePrice = useMemo(() => {
    return Math.max(0, parseInt(formData.discount_value) || 0);
  }, [formData.discount_value]);

  const bundleSavings = useMemo(() => {
    return Math.max(0, regularBundleTotal - offerBundlePrice);
  }, [regularBundleTotal, offerBundlePrice]);

  const handleCreatePromotion = async (e) => {
    e.preventDefault();
    if (!formData.product_id) {
      return alert('تکایە کاڵایەک هەڵبژێرە');
    }
    const val = parseFloat(formData.discount_value);
    if (isNaN(val) || val <= 0) {
      return alert('تکایە نرخی ئۆفەر بنووسە');
    }

    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      return alert('بەرواری دەستپێک نابێت لە بەرواری کۆتایی درەنگتر بێت');
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post('http://localhost:3001/api/promotions', {
        ...formData,
        discount_value: val,
        min_qty: bundleQty,
        max_qty_per_sale: null
      });

      if (res.data.status === 'SUCCESS') {
        setIsModalOpen(false);
        setFormData({
          product_id: '',
          discount_type: 'FIXED_PRICE',
          discount_value: '',
          min_qty: '3',
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

  // Filtered List
  const filteredPromotions = promotions.filter(p => {
    const matchesSearch = kurdishSearchMatch([p.product_name, p.barcode], searchTerm);
    const matchesStatus = statusFilter === 'ALL' || p.calculated_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredProductsForSelect = products.filter(p => 
    kurdishSearchMatch([p.name, p.barcode], productSearch)
  );

  return (
    <div className="dashboard-page p-8" dir="rtl">
      {/* Top Header - Clean and Minimal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
            <Tag size={26} color="#d97706" />
            بەڕێوەبردنی ئۆفەرەکان
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            نوێکردنەوە
          </button>

          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            <Plus size={18} /> ئۆفەری نوێ
          </button>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'ALL', label: 'هەموو' },
            { id: 'ACTIVE', label: 'چالاکەکان' },
            { id: 'SCHEDULED', label: 'پلاندانراو' },
            { id: 'EXPIRED', label: 'بەسەرچوو' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
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

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', right: '12px', top: '11px' }} />
          <input 
            type="text" 
            placeholder="گەڕان..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '8px 36px 8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>
      </div>

      {/* Clean Minimalist Offers Table */}
      <div className="glass-panel" style={{ padding: '0', borderRadius: '12px', overflowX: 'auto', border: '1px solid var(--border-color)' }}>
        <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <thead style={{ background: 'var(--bg-tertiary)' }}>
            <tr>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>کاڵا</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>نرخی ئاسایی</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>ئۆفەر</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>پاشەکەوت</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>ماوەی ئۆفەر</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>دۆخ</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>کردار</th>
            </tr>
          </thead>
          <tbody>
            {filteredPromotions.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  هیچ ئۆفەرێک نەدۆزرایەوە
                </td>
              </tr>
            ) : (
              filteredPromotions.map((promo) => {
                const orig = Number(promo.original_price);
                const bQty = Math.max(1, Number(promo.min_qty) || 1);
                const offerPrice = Number(promo.discount_value);
                const regularTotal = orig * bQty;
                const savings = Math.max(0, regularTotal - offerPrice);

                return (
                  <tr key={promo.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{promo.product_name}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{promo.barcode || ''}</div>
                    </td>

                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                      {orig.toLocaleString()} د.ع
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ color: '#0284c7', fontWeight: 800, fontSize: '0.95rem' }}>
                        {bQty > 1 ? `${bQty} دانە بە ${offerPrice.toLocaleString()} د.ع` : `${offerPrice.toLocaleString()} د.ع`}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', color: '#10b981', fontWeight: 700 }}>
                      {savings > 0 ? `${savings.toLocaleString()} د.ع` : '٠'}
                    </td>

                    <td style={{ padding: '14px 18px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {formatDate(promo.start_date)} تا {formatDate(promo.end_date)}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      {promo.calculated_status === 'ACTIVE' && (
                        <span style={{ padding: '3px 10px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700, fontSize: '0.78rem' }}>
                          چالاک
                        </span>
                      )}
                      {promo.calculated_status === 'SCHEDULED' && (
                        <span style={{ padding: '3px 10px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontWeight: 700, fontSize: '0.78rem' }}>
                          پلاندانراو
                        </span>
                      )}
                      {promo.calculated_status === 'EXPIRED' && (
                        <span style={{ padding: '3px 10px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 700, fontSize: '0.78rem' }}>
                          بەسەرچوو
                        </span>
                      )}
                      {promo.calculated_status === 'INACTIVE' && (
                        <span style={{ padding: '3px 10px', borderRadius: '12px', background: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.78rem' }}>
                          ناچالاک
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => handleToggleStatus(promo.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: promo.is_active ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-tertiary)',
                            color: promo.is_active ? '#10b981' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: 700
                          }}
                        >
                          {promo.is_active ? 'ناچالاککردن' : 'چالاککردن'}
                        </button>

                        <button
                          onClick={() => handleDeletePromotion(promo.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={15} />
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

      {/* Modal: Create Promotion - Strictly Minimalist per AGENTS.md */}
      {isModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="pos-modal-card pos-modal-md" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--text-primary)', fontWeight: 800 }}>
                دروستکردنی ئۆفەری نوێ
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePromotion}>
              {/* Product Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}>
                  کاڵا
                </label>
                <input 
                  type="text" 
                  placeholder="گەڕان بەپێی ناوی کاڵا..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', marginBottom: '6px' }}
                />
                
                <select 
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
                >
                  <option value="">هەڵبژاردنی کاڵا</option>
                  {filteredProductsForSelect.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (نرخ: {Number(p.selling_price).toLocaleString()} د.ع)
                    </option>
                  ))}
                </select>
              </div>

              {/* Clean 2-Column Grid: Quantity and Offer Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}>
                    بڕ
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    step="1"
                    value={formData.min_qty} 
                    onChange={(e) => setFormData({ ...formData, min_qty: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}>
                    نرخی ئۆفەر
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    step="any"
                    value={formData.discount_value} 
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    placeholder="نموونە: 1250"
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Clean Live Calculation Preview */}
              {selectedProduct && formData.discount_value && (
                <div style={{ background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <strong>{bundleQty}</strong> دانە بە <strong>{offerBundlePrice.toLocaleString()}</strong> د.ع
                  </span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>
                    پاشەکەوت: {bundleSavings.toLocaleString()} د.ع
                  </span>
                </div>
              )}

              {/* Clean 2-Column Grid: Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}>
                    بەرواری دەستپێک
                  </label>
                  <input 
                    type="date" 
                    lang="en-GB"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}>
                    بەرواری کۆتایی
                  </label>
                  <input 
                    type="date" 
                    lang="en-GB"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem' }}
                >
                  {isSubmitting ? 'تکایە بوەستە...' : 'تۆمارکردن'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '12px 20px', borderRadius: '8px', cursor: 'pointer' }}
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

export default Promotions;