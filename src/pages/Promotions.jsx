import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { formatDate } from '../utils/dateFormatter';
import './Dashboard.css';

// Compact Clean Combobox for Product Search & Selection
const ProductCombobox = ({ products, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  const selectedProduct = useMemo(() => {
    return products.find(p => String(p.id) === String(value)) || null;
  }, [products, value]);

  const filtered = useMemo(() => {
    if (!query) return products.slice(0, 40);
    return products.filter(p => kurdishSearchMatch([p.name, p.barcode], query)).slice(0, 40);
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
            border: '1.5px solid #2563eb',
            borderRadius: '8px',
            padding: '7px 12px',
            cursor: 'pointer'
          }}
          onClick={() => {
            setIsOpen(true);
            setQuery('');
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
              {selectedProduct.name}
            </span>
            <span style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: 600 }}>
              ({Number(selectedProduct.selling_price).toLocaleString()} د.ع)
            </span>
          </div>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setQuery('');
              setIsOpen(true);
            }}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            گۆڕین
          </button>
        </div>
      ) : (
        <div>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-tertiary)',
              border: '1.5px solid ' + (isOpen ? '#2563eb' : 'var(--border-color)'),
              borderRadius: '8px',
              padding: '6px 12px'
            }}
          >
            <input 
              type="text"
              value={query}
              placeholder="گەڕان بەپێی ناوی کاڵا یان بارکۆد..."
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
                fontSize: '0.88rem'
              }}
            />
            {isOpen && (
              <button 
                type="button" 
                onClick={() => setIsOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 6px', fontSize: '0.78rem' }}
              >
                داخستن
              </button>
            )}
          </div>

          {isOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              left: 0,
              maxHeight: '200px',
              overflowY: 'auto',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              zIndex: 9999,
              padding: '4px'
            }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
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
                        padding: '7px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                        marginBottom: '2px'
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isSelected ? '#2563eb' : 'var(--text-primary)' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: 700 }}>
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

  // Form State: Supports both UNIT_DISCOUNT and BUNDLE_PACKAGE
  const [formData, setFormData] = useState({
    product_id: '',
    offer_type: 'UNIT_DISCOUNT', // 'UNIT_DISCOUNT' or 'BUNDLE_PACKAGE'
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

  const handleCreatePromotion = async (e) => {
    e.preventDefault();
    if (!formData.product_id) {
      return alert('تکایە کاڵایەک هەڵبژێرە');
    }
    const val = parseFloat(formData.discount_value);
    if (isNaN(val) || val <= 0) {
      return alert('تکایە نرخی ئۆفەر یان ڕێژەی داشکاندن بنووسە');
    }

    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      return alert('بەرواری دەستپێک نابێت لە بەرواری کۆتایی درەنگتر بێت');
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post('http://localhost:3001/api/promotions', {
        ...formData,
        discount_value: val,
        min_qty: formData.min_qty ? Math.max(1, parseFloat(formData.min_qty)) : 1,
        max_qty_per_sale: formData.max_qty_per_sale ? Math.max(0.001, parseFloat(formData.max_qty_per_sale)) : null
      });

      if (res.data.status === 'SUCCESS') {
        setIsModalOpen(false);
        setFormData({
          product_id: '',
          offer_type: 'UNIT_DISCOUNT',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          بەڕێوەبردنی ئۆفەرەکان
        </h1>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="btn-secondary"
            style={{ padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
          >
            نوێکردنەوە
          </button>

          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ 
              padding: '8px 20px', 
              borderRadius: '8px', 
              background: '#2563eb', 
              color: 'white', 
              border: 'none', 
              cursor: 'pointer', 
              fontWeight: 700, 
              fontSize: '0.88rem'
            }}
          >
            ئۆفەری نوێ
          </button>
        </div>
      </div>

      {/* Filter Tabs and Search Bar - Clean & Icon-free */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
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
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid ' + (statusFilter === tab.id ? 'transparent' : 'var(--border-color)'),
                cursor: 'pointer',
                fontWeight: statusFilter === tab.id ? 700 : 500,
                background: statusFilter === tab.id ? '#2563eb' : 'var(--bg-tertiary)',
                color: statusFilter === tab.id ? 'white' : 'var(--text-secondary)',
                fontSize: '0.85rem'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ width: '240px' }}>
          <input 
            type="text" 
            placeholder="گەڕان..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '7px 12px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Clean Minimalist Offers Table */}
      <div className="glass-panel" style={{ padding: '0', borderRadius: '10px', overflowX: 'auto', border: '1px solid var(--border-color)' }}>
        <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <thead style={{ background: 'var(--bg-tertiary)' }}>
            <tr>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>کاڵا</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>نرخی ئاسایی</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>ئۆفەر</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>سنووری بڕ</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>ماوەی ئۆفەر</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>دۆخ</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>کردارەکان</th>
            </tr>
          </thead>
          <tbody>
            {filteredPromotions.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  هیچ ئۆفەرێک نەدۆزرایەوە
                </td>
              </tr>
            ) : (
              filteredPromotions.map((promo) => {
                const orig = Number(promo.original_price);
                const isBundle = promo.offer_type === 'BUNDLE_PACKAGE';
                let offerDisplay = '';

                if (isBundle) {
                  const bundleQty = Math.max(1, Number(promo.min_qty) || 1);
                  let bundlePrice = orig * bundleQty;
                  if (promo.discount_type === 'PERCENT') {
                    bundlePrice = Math.max(0, Math.round((orig * bundleQty) - ((orig * bundleQty * Number(promo.discount_value)) / 100)));
                  } else {
                    bundlePrice = Math.max(0, Math.round(Number(promo.discount_value)));
                  }
                  offerDisplay = `پاکێج: ${bundleQty} ${promo.unit || 'دانە'} بە ${bundlePrice.toLocaleString()} د.ع`;
                } else {
                  let promoPrice = orig;
                  if (promo.discount_type === 'PERCENT') {
                    promoPrice = Math.max(0, Math.round(orig - (orig * Number(promo.discount_value)) / 100));
                  } else {
                    promoPrice = Math.max(0, Math.round(Number(promo.discount_value)));
                  }
                  const minText = Number(promo.min_qty) > 1 ? ` (کەمترین: ${Number(promo.min_qty)})` : '';
                  offerDisplay = `${promoPrice.toLocaleString()} د.ع بۆ هەر دانەیەک${minText}`;
                }

                return (
                  <tr key={promo.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{promo.product_name}</div>
                      {promo.barcode && <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{promo.barcode}</div>}
                    </td>

                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      {orig.toLocaleString()} د.ع
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: '#2563eb', fontWeight: 700, fontSize: '0.9rem' }}>
                        {offerDisplay}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {promo.max_qty_per_sale ? `زۆرترین ${promo.max_qty_per_sale}` : 'بێ سنوور'}
                    </td>

                    <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {formatDate(promo.start_date)} تا {formatDate(promo.end_date)}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {promo.calculated_status === 'ACTIVE' && (
                        <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 600, fontSize: '0.75rem' }}>
                          چالاک
                        </span>
                      )}
                      {promo.calculated_status === 'SCHEDULED' && (
                        <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', fontWeight: 600, fontSize: '0.75rem' }}>
                          پلاندانراو
                        </span>
                      )}
                      {promo.calculated_status === 'EXPIRED' && (
                        <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 600, fontSize: '0.75rem' }}>
                          بەسەرچوو
                        </span>
                      )}
                      {promo.calculated_status === 'INACTIVE' && (
                        <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem' }}>
                          ناچالاک
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => handleToggleStatus(promo.id)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: promo.is_active ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-tertiary)',
                            color: promo.is_active ? '#10b981' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        >
                          {promo.is_active ? 'ناچالاککردن' : 'چالاککردن'}
                        </button>

                        <button
                          onClick={() => handleDeletePromotion(promo.id)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: 'none',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
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

      {/* Modal: Ultra-Minimalist & Compact - Fits Screen with NO Scrolling */}
      {isModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div 
            className="pos-modal-card" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              maxWidth: '480px', 
              width: '95%', 
              borderRadius: '12px', 
              padding: '18px 20px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.3)'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                دروستکردنی ئۆفەر
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-secondary)', 
                  cursor: 'pointer', 
                  fontSize: '1.1rem',
                  padding: '2px'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePromotion}>
              {/* Product */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  کاڵا
                </label>
                <ProductCombobox 
                  products={products}
                  value={formData.product_id}
                  onChange={(val) => setFormData({ ...formData, product_id: val })}
                />
              </div>

              {/* Offer Type Selector */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  جۆری ئۆفەر
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ 
                      ...formData, 
                      offer_type: 'UNIT_DISCOUNT',
                      min_qty: '1'
                    })}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: '1.5px solid ' + (formData.offer_type === 'UNIT_DISCOUNT' ? '#2563eb' : 'var(--border-color)'),
                      cursor: 'pointer',
                      background: formData.offer_type === 'UNIT_DISCOUNT' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-tertiary)',
                      color: formData.offer_type === 'UNIT_DISCOUNT' ? '#2563eb' : 'var(--text-primary)',
                      fontSize: '0.82rem',
                      fontWeight: 600
                    }}
                  >
                    داشکاندنی نرخ (بۆ هەر دانەیەک)
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ 
                      ...formData, 
                      offer_type: 'BUNDLE_PACKAGE',
                      min_qty: '3',
                      discount_type: 'FIXED_PRICE'
                    })}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: '1.5px solid ' + (formData.offer_type === 'BUNDLE_PACKAGE' ? '#2563eb' : 'var(--border-color)'),
                      cursor: 'pointer',
                      background: formData.offer_type === 'BUNDLE_PACKAGE' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-tertiary)',
                      color: formData.offer_type === 'BUNDLE_PACKAGE' ? '#2563eb' : 'var(--text-primary)',
                      fontSize: '0.82rem',
                      fontWeight: 600
                    }}
                  >
                    ئۆفەری پاکێج (فرەدانە)
                  </button>
                </div>
              </div>

              {/* Conditional Inputs based on Offer Type */}
              {formData.offer_type === 'UNIT_DISCOUNT' ? (
                <>
                  {/* Discount Method Toggle */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, discount_type: 'FIXED_PRICE' })}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          border: '1px solid ' + (formData.discount_type === 'FIXED_PRICE' ? '#2563eb' : 'var(--border-color)'),
                          cursor: 'pointer',
                          background: formData.discount_type === 'FIXED_PRICE' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-tertiary)',
                          color: formData.discount_type === 'FIXED_PRICE' ? '#2563eb' : 'var(--text-primary)',
                          fontSize: '0.8rem',
                          fontWeight: 600
                        }}
                      >
                        نرخی دیاریکراو (دینار)
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, discount_type: 'PERCENT' })}
                        style={{
                          padding: '6px',
                          borderRadius: '6px',
                          border: '1px solid ' + (formData.discount_type === 'PERCENT' ? '#2563eb' : 'var(--border-color)'),
                          cursor: 'pointer',
                          background: formData.discount_type === 'PERCENT' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-tertiary)',
                          color: formData.discount_type === 'PERCENT' ? '#2563eb' : 'var(--text-primary)',
                          fontSize: '0.8rem',
                          fontWeight: 600
                        }}
                      >
                        ڕێژەی داشکاندن (%)
                      </button>
                    </div>
                  </div>

                  {/* Price & Min Qty */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formData.discount_type === 'FIXED_PRICE' ? 'نرخی داشکاندن' : 'ڕێژەی داشکاندن (%)'}
                      </label>
                      <input 
                        type="number" 
                        min="0"
                        max={formData.discount_type === 'PERCENT' ? 99 : undefined}
                        step={formData.discount_type === 'FIXED_PRICE' ? "any" : "1"}
                        value={formData.discount_value} 
                        onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                        placeholder={formData.discount_type === 'FIXED_PRICE' ? '250' : '20'}
                        required
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem', fontWeight: 600 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        کەمترین بڕی کڕین
                      </label>
                      <input 
                        type="number" 
                        min="1"
                        step="any"
                        value={formData.min_qty} 
                        onChange={(e) => setFormData({ ...formData, min_qty: e.target.value })}
                        placeholder="1"
                        required
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem', fontWeight: 600 }}
                      />
                    </div>
                  </div>

                  {/* Max Limit per invoice */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      چەن دانە لە پسووڵەیەکدا؟
                    </label>
                    <input 
                      type="number" 
                      min="0.1"
                      step="any"
                      value={formData.max_qty_per_sale} 
                      onChange={(e) => setFormData({ ...formData, max_qty_per_sale: e.target.value })}
                      placeholder="بێ سنوور (نموونە: 2 دانە)"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* BUNDLE_PACKAGE: Pack Qty & Pack Price */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        بڕی پاکێج (دانە)
                      </label>
                      <input 
                        type="number" 
                        min="1"
                        step="any"
                        value={formData.min_qty} 
                        onChange={(e) => setFormData({ ...formData, min_qty: e.target.value })}
                        placeholder="3"
                        required
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem', fontWeight: 600 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        نرخی کۆی پاکێج (دینار)
                      </label>
                      <input 
                        type="number" 
                        min="0"
                        step="any"
                        value={formData.discount_value} 
                        onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                        placeholder="1250"
                        required
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem', fontWeight: 600 }}
                      />
                    </div>
                  </div>

                  {/* Max Limit */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      چەن دانە لە پسووڵەیەکدا؟
                    </label>
                    <input 
                      type="number" 
                      min="0.1"
                      step="any"
                      value={formData.max_qty_per_sale} 
                      onChange={(e) => setFormData({ ...formData, max_qty_per_sale: e.target.value })}
                      placeholder="بێ سنوور (نموونە: 6 دانە)"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                    />
                  </div>
                </>
              )}

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    بەرواری دەستپێک
                  </label>
                  <input 
                    type="date" 
                    lang="en-GB"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    بەرواری کۆتایی
                  </label>
                  <input 
                    type="date" 
                    lang="en-GB"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              {/* Action Button */}
              <div>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    borderRadius: '6px', 
                    background: '#2563eb', 
                    color: 'white', 
                    border: 'none', 
                    cursor: 'pointer', 
                    fontWeight: 700, 
                    fontSize: '0.92rem'
                  }}
                >
                  {isSubmitting ? 'کەمێک بوەستە...' : 'تۆمارکردن'}
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
