import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { normalizeBarcode } from '../utils/barcodeNormalizer';
import { toast } from '../context/ToastContext';

const cleanNumericValue = (val, defaultVal = '') => {
  if (val === undefined || val === null || val === '') return defaultVal;
  const num = parseFloat(val);
  return isNaN(num) ? defaultVal : String(num);
};

/**
 * Reusable ProductModal Component
 * Following DRY (Don't Repeat Yourself) architecture.
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onSuccess: (productData, isEdit) => void
 * - mode: 'full' | 'purchase' (default: 'full')
 * - editProduct: object | null (only for full mode)
 * - presetBarcode: string (optional initial barcode, e.g. from scanned code in purchases)
 * - categories: Array<{ id, name }>
 * - onCategoriesUpdate: (newCat) => void
 * - title: string (optional override)
 * - submitText: string (optional override)
 */
const ProductModal = ({
  isOpen,
  onClose,
  onSuccess,
  mode = 'full',
  editProduct = null,
  presetBarcode = '',
  categories = [],
  onCategoriesUpdate,
  title,
  submitText
}) => {
  const isPurchaseMode = mode === 'purchase';

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    box_barcode: '',
    units_per_box: '1',
    box_cost_price: '',
    cost_price: '',
    selling_price: '',
    wholesale_price: '',
    stock: '',
    low_stock_threshold: '5',
    expiry_date: '',
    category_id: '',
    is_weighted: false,
    unit: 'دانە'
  });

  const [categoryInput, setCategoryInput] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const categoryContainerRef = useRef(null);

  // Close category dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (categoryContainerRef.current && !categoryContainerRef.current.contains(e.target)) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync Form Data on Modal Open or Prop Change
  useEffect(() => {
    if (!isOpen) return;

    if (editProduct) {
      const isW = Boolean(editProduct.is_weighted || editProduct.unit === 'کگم');
      const existingCat = categories.find(c => String(c.id) === String(editProduct.category_id));
      setCategoryInput(existingCat ? existingCat.name : (editProduct.category_name || ''));
      setIsCategoryOpen(false);

      const existingBoxCost = (editProduct.box_cost_price !== undefined && editProduct.box_cost_price !== null && Number(editProduct.box_cost_price) > 0)
        ? String(cleanNumericValue(editProduct.box_cost_price))
        : '';
      const inferredBoxCost = existingBoxCost || (
        (editProduct.cost_price && editProduct.units_per_box && Number(editProduct.units_per_box) > 1)
          ? String(Math.round(Number(editProduct.cost_price) * Number(editProduct.units_per_box)))
          : ''
      );

      setFormData({
        name: editProduct.name || '',
        barcode: editProduct.barcode || '',
        cost_price: cleanNumericValue(editProduct.cost_price, ''),
        selling_price: cleanNumericValue(editProduct.selling_price, ''),
        stock: cleanNumericValue(editProduct.stock, '0'),
        category_id: editProduct.category_id || '',
        wholesale_price: cleanNumericValue(editProduct.wholesale_price, ''),
        expiry_date: editProduct.expiry_date ? String(editProduct.expiry_date).split('T')[0] : '',
        low_stock_threshold: cleanNumericValue(editProduct.low_stock_threshold, '5'),
        box_barcode: editProduct.box_barcode || '',
        units_per_box: cleanNumericValue(editProduct.units_per_box, '1'),
        box_cost_price: inferredBoxCost,
        is_weighted: isW,
        unit: isW ? 'کگم' : (editProduct.unit || 'دانە')
      });
    } else {
      // Add / Quick-Add Mode
      setCategoryInput('');
      setIsCategoryOpen(false);
      setFormData({
        name: '',
        barcode: presetBarcode ? String(presetBarcode).trim() : '',
        cost_price: '',
        selling_price: '',
        stock: '',
        category_id: '',
        wholesale_price: '',
        expiry_date: '',
        low_stock_threshold: '5',
        box_barcode: '',
        units_per_box: '1',
        box_cost_price: '',
        is_weighted: false,
        unit: 'دانە'
      });
    }
  }, [isOpen, editProduct, presetBarcode, isPurchaseMode]);

  // Hardware Scanner integration
  useBarcodeScanner((scannedBarcode) => {
    if (!isOpen) return;
    const cleaned = normalizeBarcode(scannedBarcode);
    setFormData(prev => ({ ...prev, barcode: cleaned }));
  });

  const getAuthConfig = () => {
    const token = localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  const filteredCategories = useMemo(() => {
    if (!categoryInput.trim()) return categories;
    return categories.filter(c => kurdishSearchMatch(c.name, categoryInput));
  }, [categories, categoryInput]);

  const generateBarcode = () => {
    const randomBarcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setFormData(prev => ({ ...prev, barcode: randomBarcode }));
  };

  const generateBoxBarcode = () => {
    const randomBox = 'BOX' + Math.floor(100000000 + Math.random() * 900000000).toString();
    setFormData(prev => ({ ...prev, box_barcode: randomBox }));
  };

  // Auto-calculate unit cost price based on carton cost price / units per box
  const handleBoxCostChange = (val) => {
    const boxCost = parseFloat(val);
    const units = parseFloat(formData.units_per_box);
    if (!isNaN(boxCost) && boxCost > 0 && !isNaN(units) && units > 0) {
      const calculatedUnitCost = Math.round(boxCost / units);
      setFormData(prev => ({
        ...prev,
        box_cost_price: val,
        cost_price: String(calculatedUnitCost)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        box_cost_price: val
      }));
    }
  };

  const handleUnitsPerBoxChange = (val) => {
    const units = parseFloat(val);
    const boxCost = parseFloat(formData.box_cost_price);
    if (!isNaN(boxCost) && boxCost > 0 && !isNaN(units) && units > 0) {
      const calculatedUnitCost = Math.round(boxCost / units);
      setFormData(prev => ({
        ...prev,
        units_per_box: val,
        cost_price: String(calculatedUnitCost)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        units_per_box: val
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('تکایە ناوی کاڵا بنووسە');
      return;
    }
    const finalBarcode = formData.barcode ? String(formData.barcode).trim() : '';
    if (!finalBarcode) {
      toast.error('تکایە بارکۆد بنووسە یان دروستی بکە');
      return;
    }

    setIsSubmitting(true);
    try {
      const config = getAuthConfig();

      // Resolve category: support typing or selecting category
      let finalCategoryId = formData.category_id || null;
      const trimmedCat = categoryInput.trim();
      if (trimmedCat) {
        const found = categories.find(c => c.name.trim().toLowerCase() === trimmedCat.toLowerCase());
        if (found) {
          finalCategoryId = found.id;
        } else {
          try {
            const catRes = await axios.post('http://localhost:3001/api/categories', { name: trimmedCat }, config);
            if (catRes.data?.data?.id) {
              finalCategoryId = catRes.data.data.id;
              if (onCategoriesUpdate) {
                onCategoriesUpdate(catRes.data.data);
              }
            }
          } catch (catErr) {
            console.error('Failed to auto-create category:', catErr);
          }
        }
      } else {
        finalCategoryId = null;
      }

      // Stock logic: In purchase mode, stock must always be 0 so invoice can cleanly add it via FIFO batches.
      const resolvedStock = isPurchaseMode ? 0 : (formData.stock ? parseFloat(formData.stock) : 0);

      const payload = {
        name: formData.name.trim(),
        barcode: finalBarcode,
        cost_price: formData.cost_price ? Number(formData.cost_price) : 0,
        box_cost_price: formData.box_cost_price ? Number(formData.box_cost_price) : null,
        selling_price: formData.selling_price ? Number(formData.selling_price) : 0,
        stock: resolvedStock,
        wholesale_price: (!formData.is_weighted && formData.wholesale_price) ? Number(formData.wholesale_price) : 0,
        expiry_date: (!formData.is_weighted && formData.expiry_date) ? formData.expiry_date : null,
        low_stock_threshold: formData.low_stock_threshold !== undefined && formData.low_stock_threshold !== '' ? parseFloat(formData.low_stock_threshold) : 5,
        box_barcode: (!formData.is_weighted && formData.box_barcode && formData.box_barcode.trim() !== '') ? formData.box_barcode.trim() : null,
        units_per_box: (!formData.is_weighted && formData.units_per_box) ? Math.max(1, parseFloat(formData.units_per_box)) : 1,
        is_weighted: formData.is_weighted ? 1 : 0,
        unit: formData.is_weighted ? 'کگم' : 'دانە',
        category_id: finalCategoryId
      };

      if (editProduct && !isPurchaseMode) {
        await axios.put(`http://localhost:3001/api/products/${editProduct.id}`, payload, config);
        if (onSuccess) {
          onSuccess({ ...payload, id: editProduct.id, box_cost_price: formData.box_cost_price }, true);
        }
      } else if (isPurchaseMode) {
        // Pure local draft: push to invoice items array without premature DB POST
        const tempDraftId = 'draft_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        if (onSuccess) {
          onSuccess({ 
            ...payload, 
            id: tempDraftId, 
            is_draft: true, 
            box_cost_price: formData.box_cost_price,
            initial_qty: (formData.stock !== undefined && formData.stock !== null && formData.stock !== '') 
              ? parseFloat(formData.stock) 
              : null
          }, false);
        }
      } else {
        const res = await axios.post('http://localhost:3001/api/products', payload, config);
        const newId = res.data?.id || res.data?.data?.id;
        if (onSuccess) {
          onSuccess({ ...payload, id: newId, box_cost_price: formData.box_cost_price }, false);
        }
      }

      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردنی کاڵاکە');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const modalTitle = title || (
    editProduct ? 'دەستکاریکردنی کاڵا' : (isPurchaseMode ? 'تۆمارکردنی کاڵای نوێ بۆ کۆگا' : 'زیادکردنی کاڵای نوێ')
  );

  const primaryBtnText = isSubmitting 
    ? 'تکایە چاوەڕوان بە...' 
    : (submitText || (isPurchaseMode ? 'زیادکردن' : 'پاشەکەوتکردن'));

  return (
    <div className="pos-modal-overlay" onClick={onClose}>
      <div 
        className="pos-modal-card pos-modal-product" 
        onClick={e => e.stopPropagation()}
        style={{ 
          maxWidth: '820px', 
          width: '92%', 
          padding: '20px 24px', 
          overflow: 'visible',
          background: '#ffffff',
          direction: 'rtl',
          borderRadius: '16px',
          border: '1px solid #cbd5e1'
        }}
      >
        {/* Header Row: Title on right, Unit Switcher + Close Button on left */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>
            {modalTitle}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Compact segmented toggle for unit type */}
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #cbd5e1', height: '34px', boxSizing: 'border-box' }}>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, is_weighted: false, unit: 'دانە' }))}
                style={{
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: !formData.is_weighted ? '#2563eb' : 'transparent',
                  color: !formData.is_weighted ? '#ffffff' : '#64748b',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                بە دانە
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, is_weighted: true, unit: 'کگم' }))}
                style={{
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: formData.is_weighted ? '#2563eb' : 'transparent',
                  color: formData.is_weighted ? '#ffffff' : '#64748b',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                بە کێش (کگم)
              </button>
            </div>

            {/* Close Button */}
            <button 
              type="button"
              onClick={onClose} 
              style={{ 
                background: '#f1f5f9', 
                border: '1px solid #cbd5e1', 
                color: '#64748b', 
                cursor: 'pointer', 
                width: '32px', 
                height: '32px', 
                borderRadius: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 700,
                lineHeight: 1
              }}
            >
              ×
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Row 1: Basic Info (3-Column Grid: 1.5fr 1fr 1.5fr, gap 12px) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                ناوی کاڵا <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="text" 
                required 
                placeholder="ناوی کاڵاکە بنووسە..."
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem', textAlign: 'center' }} 
              />
            </div>
            
            {/* Searchable and Typeable Category Combobox */}
            <div style={{ position: 'relative' }} ref={categoryContainerRef}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                جۆر
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="جۆر هەڵبژێرە..."
                  value={categoryInput} 
                  onChange={e => {
                    const val = e.target.value;
                    setCategoryInput(val);
                    setIsCategoryOpen(true);
                    const match = categories.find(c => c.name.trim().toLowerCase() === val.trim().toLowerCase());
                    setFormData(prev => ({ ...prev, category_id: match ? match.id : '' }));
                  }} 
                  onFocus={() => setIsCategoryOpen(true)}
                  style={{ 
                    width: '100%', 
                    height: '38px',
                    padding: '0 26px 0 26px', 
                    borderRadius: '8px', 
                    background: '#ffffff', 
                    border: isCategoryOpen ? '1px solid #2563eb' : '1px solid #cbd5e1', 
                    color: '#1e293b',
                    boxSizing: 'border-box',
                    fontSize: '0.88rem',
                    textAlign: 'center'
                  }} 
                />
                <button
                  type="button"
                  onClick={() => setIsCategoryOpen(prev => !prev)}
                  style={{
                    position: 'absolute',
                    left: '6px',
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px',
                    fontSize: '10px'
                  }}
                >
                  ▼
                </button>
              </div>

              {/* Dropdown Menu */}
              {isCategoryOpen && (
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    right: 0, 
                    left: 0, 
                    marginTop: '4px', 
                    background: '#ffffff', 
                    border: '1px solid #cbd5e1', 
                    borderRadius: '8px', 
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)', 
                    maxHeight: '190px', 
                    overflowY: 'auto', 
                    zIndex: 100, 
                    padding: '4px' 
                  }}
                >
                  <div 
                    onClick={() => {
                      setCategoryInput('');
                      setFormData(prev => ({ ...prev, category_id: '' }));
                      setIsCategoryOpen(false);
                    }}
                    style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', color: '#94a3b8', fontSize: '0.85rem' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    (بێ جۆر)
                  </div>

                  {filteredCategories.map(c => {
                    const isSelected = String(formData.category_id) === String(c.id) || categoryInput.trim().toLowerCase() === c.name.trim().toLowerCase();
                    return (
                      <div 
                        key={c.id} 
                        onClick={() => {
                          setCategoryInput(c.name);
                          setFormData(prev => ({ ...prev, category_id: c.id }));
                          setIsCategoryOpen(false);
                        }}
                        style={{ 
                          padding: '8px 12px', 
                          borderRadius: '6px', 
                          cursor: 'pointer', 
                          fontWeight: isSelected ? 'bold' : 'normal',
                          background: isSelected ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                          color: isSelected ? '#2563eb' : '#1e293b',
                          fontSize: '0.88rem'
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span>{c.name}</span>
                      </div>
                    );
                  })}

                  {categoryInput.trim() && !categories.some(c => c.name.trim().toLowerCase() === categoryInput.trim().toLowerCase()) && (
                    <div 
                      onClick={async () => {
                        const newName = categoryInput.trim();
                        try {
                          const config = getAuthConfig();
                          const res = await axios.post('http://localhost:3001/api/categories', { name: newName }, config);
                          if (res.data?.data) {
                            const createdCat = res.data.data;
                            if (onCategoriesUpdate) {
                              onCategoriesUpdate(createdCat);
                            }
                            setFormData(prev => ({ ...prev, category_id: createdCat.id }));
                            setCategoryInput(createdCat.name);
                          }
                        } catch (err) {
                          console.error(err);
                        }
                        setIsCategoryOpen(false);
                      }}
                      style={{ 
                        padding: '9px 12px', 
                        borderRadius: '6px', 
                        cursor: 'pointer', 
                        background: 'rgba(16, 185, 129, 0.1)', 
                        color: '#10b981', 
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        marginTop: '4px',
                        borderTop: '1px solid #e2e8f0'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.16)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                    >
                      + زیادکردنی جۆری نوێ: «{categoryInput.trim()}»
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                بارکۆد <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type="text" 
                  required 
                  placeholder="بارکۆد..."
                  value={formData.barcode} 
                  onChange={e => setFormData({ ...formData, barcode: normalizeBarcode(e.target.value) })} 
                  style={{ 
                    width: '100%', 
                    height: '38px', 
                    padding: '0 16px 0 85px', 
                    borderRadius: '8px', 
                    background: '#ffffff', 
                    border: '1px solid #cbd5e1', 
                    color: '#1e293b', 
                    fontFamily: 'monospace', 
                    fontSize: '0.86rem', 
                    boxSizing: 'border-box',
                    textAlign: 'right'
                  }} 
                />
                <button 
                  type="button" 
                  onClick={generateBarcode} 
                  style={{
                    position: 'absolute',
                    left: '4px',
                    top: '4px',
                    bottom: '4px',
                    padding: '0 10px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap'
                  }}
                >
                  دروستکردن
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Wholesale / Carton (4-Column Grid: 1fr 1fr 1fr 1.35fr, gap 12px — ONLY visible when "بە دانە" is selected) */}
          {!formData.is_weighted && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.35fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.80rem', fontWeight: 700, color: '#1e40af', whiteSpace: 'nowrap' }}>
                  نرخی کڕینی کارتۆن
                </label>
                <input 
                  type="number" 
                  step="any"
                  min="0"
                  placeholder="0"
                  value={formData.box_cost_price} 
                  onChange={e => handleBoxCostChange(e.target.value)} 
                  style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#f8fafc', border: '1.5px solid #93c5fd', color: '#1e3a8a', fontWeight: 700, boxSizing: 'border-box', fontSize: '0.88rem', textAlign: 'center' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.80rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                  نرخی فرۆشتنی کارتۆن
                </label>
                <input 
                  type="number" 
                  step="any"
                  min="0"
                  placeholder="0"
                  value={formData.wholesale_price} 
                  onChange={e => setFormData({ ...formData, wholesale_price: e.target.value })} 
                  style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem', textAlign: 'center' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.80rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                  دانە لە کارتۆندا
                </label>
                <input 
                  type="number" 
                  min="1"
                  step="any"
                  placeholder="24"
                  value={formData.units_per_box} 
                  onChange={e => handleUnitsPerBoxChange(e.target.value)} 
                  style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem', textAlign: 'center' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.80rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                  بارکۆدی کارتۆن
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    placeholder="بارکۆدی کارتۆن..."
                    value={formData.box_barcode} 
                    onChange={e => setFormData({ ...formData, box_barcode: normalizeBarcode(e.target.value) })} 
                    style={{ 
                      width: '100%', 
                      height: '38px', 
                      padding: '0 16px 0 85px', 
                      borderRadius: '8px', 
                      background: '#ffffff', 
                      border: '1px solid #cbd5e1', 
                      color: '#1e293b', 
                      fontFamily: 'monospace', 
                      fontSize: '0.84rem', 
                      boxSizing: 'border-box',
                      textAlign: 'right'
                    }} 
                  />
                  <button 
                    type="button" 
                    onClick={generateBoxBarcode} 
                    style={{
                      position: 'absolute',
                      left: '4px',
                      top: '4px',
                      bottom: '4px',
                      padding: '0 8px',
                      background: '#eff6ff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    دروستکردن
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Row 3: Pricing & Inventory */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: formData.is_weighted ? 'repeat(4, 1fr)' : 'repeat(5, 1fr)', 
            gap: '12px',
            borderTop: !formData.is_weighted ? '1px solid #f1f5f9' : 'none',
            paddingTop: !formData.is_weighted ? '12px' : '0'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                {formData.is_weighted ? 'نرخی کڕینی ١ کیلۆ' : 'نرخی کڕینی تاک'}
              </label>
              <input 
                type="number" 
                step="any"
                min="0"
                placeholder="0"
                value={formData.cost_price} 
                onChange={e => setFormData({ ...formData, cost_price: e.target.value })} 
                style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem', textAlign: 'center' }} 
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                {formData.is_weighted ? 'نرخی فرۆشتنی ١ کیلۆ' : 'نرخی فرۆشتنی تاک'} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="number" 
                step="any"
                min="0"
                required 
                placeholder="0"
                value={formData.selling_price} 
                onChange={e => setFormData({ ...formData, selling_price: e.target.value })} 
                style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem', textAlign: 'center' }} 
              />
            </div>

            {/* Stock / Weight Field: Always available so user can record how many kg or pieces they have / brought */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                {formData.is_weighted ? (isPurchaseMode ? 'کێش (کگم)' : 'کێش لە کۆگا (کگم)') : (isPurchaseMode ? 'بڕ (دانە)' : 'دانە لە کۆگا')}
              </label>
              <input 
                type="number" 
                step={formData.is_weighted ? '0.001' : '1'}
                min="0"
                placeholder="0"
                value={formData.stock} 
                onChange={e => setFormData({ ...formData, stock: e.target.value })} 
                style={{ 
                  width: '100%', 
                  height: '38px', 
                  padding: '0 10px', 
                  borderRadius: '8px', 
                  background: '#ffffff', 
                  border: '1px solid #cbd5e1', 
                  color: '#1e293b', 
                  boxSizing: 'border-box', 
                  fontSize: '0.88rem', 
                  textAlign: 'center'
                }} 
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                {formData.is_weighted ? 'ئاگاداری کەمبوونەوە (کگم)' : 'ئاگاداری کەمبوونەوە (دانە)'}
              </label>
              <input 
                type="number" 
                step={formData.is_weighted ? '0.001' : '1'}
                min="0"
                placeholder="5"
                value={formData.low_stock_threshold} 
                onChange={e => setFormData({ ...formData, low_stock_threshold: e.target.value })} 
                style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem', textAlign: 'center' }} 
              />
            </div>

            {!formData.is_weighted && (
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                  بەرواری بەسەرچوون
                </label>
                <input 
                  type="date" 
                  className="clean-date-input"
                  value={formData.expiry_date} 
                  onClick={(e) => { try { e.target.showPicker?.(); } catch(_) {} }}
                  onChange={e => setFormData({ ...formData, expiry_date: e.target.value })} 
                  style={{ width: '100%', height: '38px', padding: '0 8px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.82rem', textAlign: 'center' }} 
                />
              </div>
            )}
          </div>

          {/* Footer Row: Full Width Primary Button */}
          <div style={{ marginTop: '4px', display: 'flex' }}>
            <button 
              type="submit" 
              disabled={isSubmitting}
              style={{ 
                width: '100%', 
                height: '42px', 
                borderRadius: '8px', 
                background: '#2563eb', 
                color: '#ffffff', 
                border: 'none', 
                fontSize: '0.95rem', 
                fontWeight: 800, 
                cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              {primaryBtnText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;
