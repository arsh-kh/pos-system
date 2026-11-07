import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { 
  Tag, 
  Plus, 
  Search, 
  Trash2, 
  Calendar, 
  X, 
  RefreshCw,
  ChevronDown,
  AlertTriangle
} from 'lucide-react';
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
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-tertiary)',
          border: '1.5px solid ' + (isOpen ? '#2563eb' : 'var(--border-color)'),
          borderRadius: '10px',
          padding: '6px 14px',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
        onClick={() => setIsOpen(true)}
      >
        <Search size={18} color="var(--text-secondary)" style={{ marginLeft: '10px', flexShrink: 0 }} />
        <input 
          type="text"
          value={isOpen ? query : (selectedProduct ? `${selectedProduct.name} (نرخ: ${Number(selectedProduct.selling_price).toLocaleString()} د.ع)` : '')}
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
            fontSize: '0.92rem',
            padding: '6px 0',
            fontWeight: selectedProduct && !isOpen ? 700 : 500
          }}
        />
        {value ? (
          <button 
            type="button" 
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setQuery('');
            }}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={16} />
          </button>
        ) : (
          <ChevronDown size={18} color="var(--text-secondary)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
        )}
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          left: 0,
          maxHeight: '260px',
          overflowY: 'auto',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          boxShadow: '0 12px 28px rgba(0,0,0,0.22)',
          zIndex: 9999,
          padding: '6px'
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
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
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                    color: isSelected ? '#2563eb' : 'var(--text-primary)',
                    marginBottom: '2px',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.barcode || 'بێ بارکۆد'}</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0284c7' }}>
                    {Number(p.selling_price).toLocaleString()} د.ع
                  </div>
                </div>
              );
            })
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
      return alert('تکایە بڕی داشکاندن یان نرخی نوێ بنووسە');
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
      {/* Top Header */}
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
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #d97706, #b45309)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, boxShadow: '0 4px 15px rgba(217, 119, 6, 0.35)' }}
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
                        <span style={{ color: '#0284c7', fontWeight: 800, fontSize: '1rem' }}>
                          {promoPrice.toLocaleString()} د.ع
                        </span>
                        {discountPercent > 0 && (
                          <span style={{ background: 'rgba(217, 119, 6, 0.15)', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
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
                        <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#0284c7', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.82rem' }}>
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

      {/* Modal: Create Promotion - 1 Single Unified Combobox & Clean UI per AGENTS.md */}
      {isModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="pos-modal-card pos-modal-md" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)', fontWeight: 800 }}>
                دروستکردنی ئۆفەری نوێ
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePromotion}>
              {/* Product Selector - Single Unified Box */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}>
                  کاڵا
                </label>
                <ProductCombobox 
                  products={products}
                  value={formData.product_id}
                  onChange={(val) => setFormData({ ...formData, product_id: val })}
                />
              </div>

              {/* Discount Mode Selector (شێوازی داشکاندن) */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}>
                  شێوازی داشکاندن
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discount_type: 'FIXED_PRICE' })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1.5px solid ' + (formData.discount_type === 'FIXED_PRICE' ? '#2563eb' : 'var(--border-color)'),
                      cursor: 'pointer',
                      fontWeight: 700,
                      background: formData.discount_type === 'FIXED_PRICE' ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-tertiary)',
                      color: formData.discount_type === 'FIXED_PRICE' ? '#2563eb' : 'var(--text-secondary)'
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
                      borderRadius: '8px',
                      border: '1.5px solid ' + (formData.discount_type === 'PERCENT' ? '#2563eb' : 'var(--border-color)'),
                      cursor: 'pointer',
                      fontWeight: 700,
                      background: formData.discount_type === 'PERCENT' ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-tertiary)',
                      color: formData.discount_type === 'PERCENT' ? '#2563eb' : 'var(--text-secondary)'
                    }}
                  >
                    ڕێژەی داشکاندن (%)
                  </button>
                </div>
              </div>

              {/* Discount Value */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}>
                  {formData.discount_type === 'FIXED_PRICE' ? 'نرخی نوێی داشکێنراو (بە دینار)' : 'ڕێژەی داشکاندن (لەسەدا %)'}
                </label>
                <input 
                  type="number" 
                  min="0"
                  max={formData.discount_type === 'PERCENT' ? 99 : undefined}
                  step={formData.discount_type === 'FIXED_PRICE' ? "any" : "1"}
                  value={formData.discount_value} 
                  onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                  placeholder={formData.discount_type === 'FIXED_PRICE' ? 'نموونە: 250' : 'نموونە: 20'}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontWeight: 700 }}
                />
              </div>

              {/* Conditions Grid: Min Quantity and Max Limit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}>
                    کەمترین بڕ
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    step="any"
                    value={formData.min_qty} 
                    onChange={(e) => setFormData({ ...formData, min_qty: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}>
                    سنووری زۆرترین بڕ
                  </label>
                  <input 
                    type="number" 
                    min="0.1"
                    step="any"
                    value={formData.max_qty_per_sale} 
                    onChange={(e) => setFormData({ ...formData, max_qty_per_sale: e.target.value })}
                    placeholder="بێ سنوور"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Clean Live Calculation Preview */}
              {selectedProduct && formData.discount_value && (
                <div style={{ background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-color)', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    نرخی ئێستا: {Number(selectedProduct.selling_price).toLocaleString()} ⬅️ <strong>{calculatedPromoPrice.toLocaleString()} د.ع</strong>
                  </span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>
                    پاشەکەوت: {unitSavings.toLocaleString()} د.ع
                  </span>
                </div>
              )}

              {/* Cost Safeguard Alert */}
              {isBelowCost && (
                <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                  <AlertTriangle size={16} />
                  <span>ئاگاداربە: ئەم نرخە لە تێچووی کڕین ({Number(selectedProduct.cost_price || 0).toLocaleString()} د.ع) کەمترە.</span>
                </div>
              )}

              {/* Date Grid */}
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