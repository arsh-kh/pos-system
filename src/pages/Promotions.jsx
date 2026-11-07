import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { formatDate } from '../utils/dateFormatter';
import './Dashboard.css';

// 1 Single Beautiful Combobox for Product Search & Selection
const ProductCombobox = ({ products, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  const selectedProduct = useMemo(() => {
    return products.find(p => String(p.id) === String(value)) || null;
  }, [products, value]);

  const filtered = useMemo(() => {
    if (!query) return products.slice(0, 50);
    return products.filter(p => kurdishSearchMatch([p.name, p.barcode], query)).slice(0, 50);
  }, [products, query]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {selectedProduct && !isOpen ? (
        <div 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(37, 99, 235, 0.05)',
            border: '2px solid #2563eb',
            borderRadius: '12px',
            padding: '14px 18px',
            gap: '12px'
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: 800, marginBottom: '2px' }}>
              کاڵای هەڵبژێردراو:
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              {selectedProduct.name}
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              <span>نرخی فرۆشتنی ئێستا: <strong style={{ color: '#2563eb', fontSize: '0.95rem' }}>{Number(selectedProduct.selling_price).toLocaleString()} د.ع</strong></span>
              {selectedProduct.barcode && <span>بارکۆد: <strong>{selectedProduct.barcode}</strong></span>}
              <span>مەوجودی کۆگا: <strong>{selectedProduct.stock} {selectedProduct.unit || 'دانە'}</strong></span>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
              setIsOpen(true);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'var(--bg-tertiary)',
              border: '1.5px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            گۆڕینی کاڵا
          </button>
        </div>
      ) : (
        <div>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-tertiary)',
              border: '2px solid ' + (isOpen ? '#2563eb' : 'var(--border-color)'),
              borderRadius: '10px',
              padding: '10px 16px',
              transition: 'border-color 0.15s ease'
            }}
          >
            <input 
              type="text"
              value={query}
              placeholder="ناوی کاڵا یان بارکۆد بنووسە بۆ گەڕان و هەڵبژاردن..."
              onChange={(e) => {
                setQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                fontWeight: 600
              }}
            />
            {isOpen && (
              <button 
                type="button" 
                onClick={() => setIsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 8px', fontSize: '0.85rem', fontWeight: 700 }}
              >
                داخستن
              </button>
            )}
          </div>

          {isOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              left: 0,
              maxHeight: '280px',
              overflowY: 'auto',
              background: 'var(--bg-secondary)',
              border: '1.5px solid var(--border-color)',
              borderRadius: '12px',
              boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
              zIndex: 9999,
              padding: '6px'
            }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  هیچ کاڵایەک نەدۆزرایەوە
                </div>
              ) : (
                filtered.map(p => {
                  const isSelected = String(p.id) === String(value);
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onChange(p.id);
                        setIsOpen(false);
                        setQuery('');
                      }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                        marginBottom: '3px',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: isSelected ? '#2563eb' : 'var(--text-primary)' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {p.barcode ? `بارکۆد: ${p.barcode}` : 'بێ بارکۆد'}
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#2563eb' }}>
                        {Number(p.selling_price).toLocaleString()} د.ع
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Promotions = () => {
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    product_id: '',
    discount_type: 'FIXED_PRICE', // 'FIXED_PRICE' or 'PERCENT'
    discount_value: '',
    min_qty: '1',
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

  // Live Calculated Promotional Price per Unit
  const calculatedPromoPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    const orig = Number(selectedProduct.selling_price) || 0;
    const val = parseFloat(formData.discount_value) || 0;

    if (formData.discount_type === 'PERCENT') {
      return Math.max(0, Math.round(orig - (orig * Math.min(100, val)) / 100));
    }
    return Math.max(0, Math.round(val));
  }, [selectedProduct, formData.discount_type, formData.discount_value]);

  const unitSavings = useMemo(() => {
    if (!selectedProduct) return 0;
    const orig = Number(selectedProduct.selling_price) || 0;
    return Math.max(0, orig - calculatedPromoPrice);
  }, [selectedProduct, calculatedPromoPrice]);

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
      return alert('تکایە نرخی ئۆفەر یان بڕی داشکاندن بنووسە');
    }

    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      return alert('بەرواری دەستپێک نابێت لە بەرواری کۆتایی درەنگتر بێت');
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post('http://localhost:3001/api/promotions', {
        ...formData,
        discount_value: val,
        min_qty: formData.min_qty ? Math.max(0.001, parseFloat(formData.min_qty)) : 1,
        max_qty_per_sale: formData.max_qty_per_sale ? Math.max(0.001, parseFloat(formData.max_qty_per_sale)) : null
      });

      if (res.data.status === 'SUCCESS') {
        setIsModalOpen(false);
        setFormData({
          product_id: '',
          discount_type: 'FIXED_PRICE',
          discount_value: '',
          min_qty: '1',
          max_qty_per_sale: '',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          notes: ''
        });
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

  return (
    <div className="dashboard-page p-8" dir="rtl">
      {/* Top Header - Strictly No Orange and No Icons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            بەڕێوەبردنی ئۆفەرەکان
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="btn-secondary"
            style={{ padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}
          >
            نوێکردنەوە
          </button>

          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ 
              padding: '10px 24px', 
              borderRadius: '10px', 
              background: '#2563eb', 
              color: 'white', 
              border: 'none', 
              cursor: 'pointer', 
              fontWeight: 700, 
              fontSize: '0.95rem'
            }}
          >
            ئۆفەری نوێ
          </button>
        </div>
      </div>

      {/* Filter Tabs and Search Bar - Clean & Icon-free */}
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
                padding: '8px 18px',
                borderRadius: '8px',
                border: '1px solid ' + (statusFilter === tab.id ? 'transparent' : 'var(--border-color)'),
                cursor: 'pointer',
                fontWeight: statusFilter === tab.id ? 800 : 600,
                background: statusFilter === tab.id ? '#2563eb' : 'var(--bg-tertiary)',
                color: statusFilter === tab.id ? 'white' : 'var(--text-secondary)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ width: '280px' }}>
          <input 
            type="text" 
            placeholder="گەڕان..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '9px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>
      </div>

      {/* Clean Minimalist Offers Table */}
      <div className="glass-panel" style={{ padding: '0', borderRadius: '12px', overflowX: 'auto', border: '1px solid var(--border-color)' }}>
        <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <thead style={{ background: 'var(--bg-tertiary)' }}>
            <tr>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>کاڵا و بارکۆد</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>نرخی ئاسایی</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>نرخی ئۆفەر</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>کەمترین بڕ</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>سنووری بڕ</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>ماوەی ئۆفەر</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>دۆخ</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>کردارەکان</th>
            </tr>
          </thead>
          <tbody>
            {filteredPromotions.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
                  هیچ ئۆفەرێک نەدۆزرایەوە
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
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{promo.product_name}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{promo.barcode || ''}</div>
                    </td>

                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                      <span style={{ textDecoration: 'line-through' }}>{orig.toLocaleString()} د.ع</span>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#2563eb', fontWeight: 800, fontSize: '1rem' }}>
                          {promoPrice.toLocaleString()} د.ع
                        </span>
                        {discountPercent > 0 && (
                          <span style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                            -{discountPercent}%
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#10b981', fontSize: '0.78rem', marginTop: '2px' }}>
                        پاشەکەوت: {discountAmount.toLocaleString()} د.ع
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {Number(promo.min_qty || 1).toLocaleString()} {promo.unit || 'دانە'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      {promo.max_qty_per_sale ? (
                        <span style={{ background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.82rem' }}>
                          زۆرترین {Number(promo.max_qty_per_sale).toLocaleString()} {promo.unit || 'دانە'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>بێ سنوور</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {formatDate(promo.start_date)} تا {formatDate(promo.end_date)}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      {promo.calculated_status === 'ACTIVE' && (
                        <span style={{ padding: '3px 10px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700, fontSize: '0.78rem' }}>
                          چالاک
                        </span>
                      )}
                      {promo.calculated_status === 'SCHEDULED' && (
                        <span style={{ padding: '3px 10px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', fontWeight: 700, fontSize: '0.78rem' }}>
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
                          سڕینەوە
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

      {/* Modal: Create Promotion - Spacious (maxWidth: 780px), Crystal Clear & User-Friendly */}
      {isModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div 
            className="pos-modal-card" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              maxWidth: '780px', 
              width: '95%', 
              borderRadius: '16px', 
              padding: '30px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.35)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <h2 style={{ fontSize: '1.3rem', margin: 0, color: 'var(--text-primary)', fontWeight: 800 }}>
                دروستکردنی ئۆفەری نوێ
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                style={{ 
                  background: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)', 
                  color: 'var(--text-secondary)', 
                  cursor: 'pointer', 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  fontWeight: 700
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePromotion}>
              {/* Product Selector */}
              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 800 }}>
                  هەڵبژاردنی کاڵا *
                </label>
                <ProductCombobox 
                  products={products}
                  value={formData.product_id}
                  onChange={(val) => setFormData({ ...formData, product_id: val })}
                />
              </div>

              {/* Discount Mode Selector */}
              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 800 }}>
                  شێوازی داشکاندن *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'FIXED_PRICE' })}
                    style={{
                      padding: '14px 18px',
                      borderRadius: '12px',
                      border: '2px solid ' + (formData.discount_type === 'FIXED_PRICE' ? '#2563eb' : 'var(--border-color)'),
                      cursor: 'pointer',
                      background: formData.discount_type === 'FIXED_PRICE' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-tertiary)',
                      color: formData.discount_type === 'FIXED_PRICE' ? '#2563eb' : 'var(--text-primary)',
                      textAlign: 'right',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '4px' }}>
                      نرخی نوێی فرۆشتن بە دینار
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      ڕاستەوخۆ نرخی نوێی داشکێنراو بنووسە (نموونە: ۲۵۰ دینار)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'PERCENT' })}
                    style={{
                      padding: '14px 18px',
                      borderRadius: '12px',
                      border: '2px solid ' + (formData.discount_type === 'PERCENT' ? '#2563eb' : 'var(--border-color)'),
                      cursor: 'pointer',
                      background: formData.discount_type === 'PERCENT' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-tertiary)',
                      color: formData.discount_type === 'PERCENT' ? '#2563eb' : 'var(--text-primary)',
                      textAlign: 'right',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '4px' }}>
                      داشکاندن بە ڕێژەی لەسەدا (%)
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      داشکاندن بە ڕێژەی لەسەدا دیاری بکە (نموونە: %٥٠)
                    </div>
                  </button>
                </div>
              </div>

              {/* Discount Value & Min Quantity in 2 Wide Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 800 }}>
                    {formData.discount_type === 'FIXED_PRICE' ? 'نرخی نوێی داشکێنراو بۆ هەر دانەیەک (بە دینار) *' : 'ڕێژەی داشکاندن (لەسەدا %) *'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="number" 
                      min="0"
                      max={formData.discount_type === 'PERCENT' ? 99 : undefined}
                      step={formData.discount_type === 'FIXED_PRICE' ? "any" : "1"}
                      value={formData.discount_value} 
                      onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                      placeholder={formData.discount_type === 'FIXED_PRICE' ? 'نموونە: 250' : 'نموونە: 50'}
                      required
                      style={{ 
                        width: '100%', 
                        padding: '12px 16px', 
                        borderRadius: '10px', 
                        background: 'var(--bg-tertiary)', 
                        border: '1.5px solid var(--border-color)', 
                        color: 'var(--text-primary)', 
                        outline: 'none', 
                        fontSize: '1.05rem', 
                        fontWeight: 800 
                      }}
                    />
                    <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.85rem' }}>
                      {formData.discount_type === 'FIXED_PRICE' ? 'دینار' : '%'}
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 800 }}>
                    کەمترین بڕی کڕین بۆ داشکاندن (دانە) *
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    step="any"
                    value={formData.min_qty} 
                    onChange={(e) => setFormData({ ...formData, min_qty: e.target.value })}
                    placeholder="1"
                    required
                    style={{ 
                      width: '100%', 
                      padding: '12px 16px', 
                      borderRadius: '10px', 
                      background: 'var(--bg-tertiary)', 
                      border: '1.5px solid var(--border-color)', 
                      color: 'var(--text-primary)', 
                      outline: 'none', 
                      fontSize: '1.05rem', 
                      fontWeight: 800 
                    }}
                  />
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    ئەگەر کڕیار لەم ژمارەیە کەمتر بکڕێت، نرخەکەی ئاسایی حیساب دەبێت
                  </div>
                </div>
              </div>

              {/* Max Limit (Optional) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 800 }}>
                  سنووری زۆرترین بڕ لە یەک پسووڵەدا (ئارەزوومەندانە)
                </label>
                <input 
                  type="number" 
                  min="0.1"
                  step="any"
                  value={formData.max_qty_per_sale} 
                  onChange={(e) => setFormData({ ...formData, max_qty_per_sale: e.target.value })}
                  placeholder="بێ سنوور (هەموو بڕێک دەیگرێتەوە)"
                  style={{ 
                    width: '100%', 
                    padding: '11px 16px', 
                    borderRadius: '10px', 
                    background: 'var(--bg-tertiary)', 
                    border: '1.5px solid var(--border-color)', 
                    color: 'var(--text-primary)', 
                    outline: 'none', 
                    fontSize: '0.95rem' 
                  }}
                />
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  ئەگەر دیاری نەکرێت، کڕیار دەتوانێت بەبێ سنوور بە نرخی ئۆفەرەکە بکڕێت
                </div>
              </div>

              {/* Dates in 2 Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '22px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 800 }}>
                    بەرواری دەستپێک *
                  </label>
                  <input 
                    type="date" 
                    lang="en-GB"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    style={{ 
                      width: '100%', 
                      padding: '11px 14px', 
                      borderRadius: '10px', 
                      background: 'var(--bg-tertiary)', 
                      border: '1.5px solid var(--border-color)', 
                      color: 'var(--text-primary)', 
                      outline: 'none',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 800 }}>
                    بەرواری کۆتایی *
                  </label>
                  <input 
                    type="date" 
                    lang="en-GB"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                    style={{ 
                      width: '100%', 
                      padding: '11px 14px', 
                      borderRadius: '10px', 
                      background: 'var(--bg-tertiary)', 
                      border: '1.5px solid var(--border-color)', 
                      color: 'var(--text-primary)', 
                      outline: 'none',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>
              </div>

              {/* Crystal Clear Live Simulation of POS Behavior */}
              {selectedProduct && formData.discount_value && (
                <div style={{ 
                  background: 'rgba(37, 99, 235, 0.06)', 
                  border: '1.5px solid #2563eb', 
                  borderRadius: '14px', 
                  padding: '18px 20px', 
                  marginBottom: '24px' 
                }}>
                  <div style={{ fontWeight: 800, color: '#2563eb', fontSize: '1rem', marginBottom: '10px' }}>
                    چۆنیەتی جێبەجێبوونی ئەم ئۆفەرە لە کاشێردا:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>•</span>
                      <span>نرخی ئاسایی ئەم کاڵایە: <strong>{Number(selectedProduct.selling_price).toLocaleString()} دینارە</strong>.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>•</span>
                      <span>
                        ئەگەر کڕیار <strong>کەمتر لە {Number(formData.min_qty || 1)} دانە</strong> بکڕێت:
                        نرخەکەی بە <strong>{Number(selectedProduct.selling_price).toLocaleString()} دینار</strong> دەمێنێتەوە.
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>•</span>
                      <span>
                        ئەگەر کڕیار <strong>{Number(formData.min_qty || 1)} دانە یان زیاتر</strong> بکڕێت:
                        نرخی هەر دانەیەکی دەبێتە <strong style={{ color: '#2563eb', fontSize: '1rem' }}>{calculatedPromoPrice.toLocaleString()} دینار</strong>.
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 800 }}>
                      <span>•</span>
                      <span>
                        پاشەکەوت و سوودی کڕیار: {unitSavings.toLocaleString()} دینار بۆ هەر دانەیەک.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Cost Safeguard Alert */}
              {isBelowCost && (
                <div style={{ marginBottom: '20px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', fontSize: '0.85rem' }}>
                  ئاگاداربە: ئەم نرخە لە تێچووی کڕین ({Number(selectedProduct.cost_price || 0).toLocaleString()} د.ع) کەمترە.
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '14px' }}>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ 
                    flex: 1, 
                    padding: '14px', 
                    borderRadius: '10px', 
                    background: '#2563eb', 
                    color: 'white', 
                    border: 'none', 
                    cursor: 'pointer', 
                    fontWeight: 800, 
                    fontSize: '1rem'
                  }}
                >
                  {isSubmitting ? 'تکایە بوەستە...' : 'تۆمارکردنی ئۆفەر'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '14px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}
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
