import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Search, Plus, Trash2, X, Barcode, Printer, Tag, Coins, Package, Layers, Scale, ChevronDown } from 'lucide-react';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import { useAuth } from '../context/AuthContext';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { normalizeBarcode } from '../utils/barcodeNormalizer';
import BarcodeSVG from '../components/BarcodeSVG';
import ProductModal from '../components/ProductModal';
import './Dashboard.css';

const cleanQty = (val, isWeighted = false) => {
  if (val === undefined || val === null || val === '') return '0';
  const num = parseFloat(val);
  if (isNaN(num)) return '0';
  if (isWeighted) {
    return parseFloat(num.toFixed(2)).toLocaleString('en-US');
  }
  return Math.round(num).toLocaleString('en-US');
};

const Products = () => {
  const { isAdmin, canCashier } = useAuth();
  const canViewCost = isAdmin || (canCashier ? canCashier('allow_view_cost_price') : false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');


  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Filter State
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL'); // 'ALL', 'LOW_STOCK', 'EXPIRING'
  const [formData, setFormData] = useState({
    name: '', barcode: '', cost_price: '', selling_price: '', stock: '', category_id: '',
    wholesale_price: '', expiry_date: '', low_stock_threshold: '5',
    box_barcode: '', units_per_box: '1', box_cost_price: '',
    is_weighted: false, unit: 'دانە'
  });

  // Barcode Printing State
  const [printProduct, setPrintProduct] = useState(null);
  const [printCopies, setPrintCopies] = useState(1);
  const [storeName, setStoreName] = useState(() => {
    const saved = localStorage.getItem('pos_store_name');
    if (saved && saved !== 'مارکێتی حاجی ئاکۆ') {
      return saved;
    }
    try { localStorage.setItem('pos_store_name', 'مارکێتی شارەکەم'); } catch (_) {}
    return 'مارکێتی شارەکەم';
  });
  const printAreaRef = useRef(null);

  // FIFO Batches Modal State
  const [selectedBatchProduct, setSelectedBatchProduct] = useState(null);

  // Custom Delete Modal State
  const [productToDelete, setProductToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [productBatches, setProductBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const openBatchesModal = async (product) => {
    setSelectedBatchProduct(product);
    setLoadingBatches(true);
    try {
      const config = getAuthConfig();
      const res = await axios.get(`http://localhost:3001/api/products/${product.id}/batches`, config);
      if (res.data.status === 'SUCCESS') {
        setProductBatches(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  const getAuthConfig = () => {
    const token = localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  const fetchData = async () => {
    try {
      const config = getAuthConfig();
      const [prodRes, catRes] = await Promise.all([
        axios.get('http://localhost:3001/api/products', config),
        axios.get('http://localhost:3001/api/categories', config)
      ]);
      if (prodRes.data.status === 'SUCCESS') setProducts(prodRes.data.data);
      if (catRes.data.status === 'SUCCESS') setCategories(catRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Hardware Wedge Barcode Scanner Listener
  useBarcodeScanner((scannedBarcode) => {
    const cleaned = normalizeBarcode(scannedBarcode);
    if (!isModalOpen) {
      setSearchTerm(cleaned);
    }
  });

  const openAddModal = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p) => {
    setEditingProduct(p);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      await axios.delete(`http://localhost:3001/api/products/${productToDelete.id}`, getAuthConfig());
      setProductToDelete(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی سڕینەوەی کاڵاکە');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Barcode Print Modal
  const openPrintModal = (p) => {
    setPrintProduct(p);
    setPrintCopies(1);
  };

  // Trigger Native Thermal Print
  const handlePrintLabels = () => {
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Low Stock and Expiry counts
  const lowStockCount = useMemo(() => {
    return products.filter(p => {
      const threshold = p.low_stock_threshold !== undefined && p.low_stock_threshold !== null ? Number(p.low_stock_threshold) : 5;
      return Number(p.stock) <= threshold;
    }).length;
  }, [products]);

  const expiringCount = useMemo(() => {
    const now = new Date();
    now.setHours(0,0,0,0);
    return products.filter(p => {
      if (!p.expiry_date) return false;
      const exp = new Date(p.expiry_date);
      exp.setHours(0,0,0,0);
      const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      return diffDays <= 30;
    }).length;
  }, [products]);

  // Filter Products by Category and Search Term (Name or Barcode)
  const filteredProducts = products.filter(p => {
    const matchesSearch = kurdishSearchMatch([p.name, p.barcode, p.box_barcode], searchTerm);
    
    const matchesCategory = 
      selectedCategory === 'ALL' || 
      String(p.category_id) === String(selectedCategory);

    let matchesStatus = true;
    if (stockStatusFilter === 'LOW_STOCK') {
      const threshold = p.low_stock_threshold !== undefined && p.low_stock_threshold !== null ? Number(p.low_stock_threshold) : 5;
      matchesStatus = Number(p.stock) <= threshold;
    } else if (stockStatusFilter === 'EXPIRING') {
      if (!p.expiry_date) {
        matchesStatus = false;
      } else {
        const now = new Date();
        now.setHours(0,0,0,0);
        const exp = new Date(p.expiry_date);
        exp.setHours(0,0,0,0);
        const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
        matchesStatus = diffDays <= 30;
      }
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="dashboard-page" style={{ position: 'relative', padding: '10px 14px 20px 14px' }}>
      
      {/* Print-Only Style Sheet for Barcode Thermal Sticker Roll */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-print-container, #thermal-print-container * {
            visibility: visible !important;
          }
          #thermal-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .barcode-sticker {
            width: 50mm !important;
            height: 30mm !important;
            page-break-inside: avoid !important;
            border: 1px dashed #ccc !important;
            padding: 2mm !important;
            direction: rtl !important;
            font-family: 'Noto Kufi Arabic', system-ui, sans-serif !important;
          }
        }
      `}</style>

      {/* Header & Balanced Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
        {/* Right side: Title + Search Input + Category Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            بەشی کاڵاکان
          </h1>

          {/* Quick Search (36px) */}
          <div style={{ 
            position: 'relative', 
            display: 'flex', 
            alignItems: 'center', 
            height: '36px', 
            background: 'var(--bg-secondary)', 
            border: isSearchFocused ? '1.5px solid #2563eb' : '1px solid var(--border-color)', 
            borderRadius: '8px', 
            padding: '0 10px',
            width: '210px',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease'
          }}>
            <Search size={15} color={isSearchFocused ? '#2563eb' : 'var(--text-muted)'} style={{ flexShrink: 0, transition: 'color 0.15s ease' }} />
            <input 
              type="text" 
              className="input-seamless"
              placeholder="گەڕان بە ناو یان بارکۆد..." 
              value={searchTerm}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                boxShadow: 'none',
                outline: 'none',
                color: 'var(--text-primary)', 
                marginRight: '6px', 
                padding: 0,
                width: '100%', 
                height: '100%',
                fontSize: '0.84rem' 
              }}
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Add Product Button (Unified DRY Style matching Purchases) */}
          <button
            type="button"
            onClick={openAddModal}
            style={{
              height: '36px',
              padding: '0 16px',
              borderRadius: '6px',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.84rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box'
            }}
          >
            + کاڵای نوێ
          </button>
        </div>

        {/* Left side: Status Filters (Pills) + "+ کاڵای نوێ" Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Compact Status Filter Pills (Small Segmented Control) */}
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '8px', 
            padding: '2px',
            height: '36px',
            boxSizing: 'border-box'
          }}>
            <button
              type="button"
              onClick={() => setStockStatusFilter('ALL')}
              style={{
                height: '30px',
                padding: '0 10px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: stockStatusFilter === 'ALL' ? 'var(--primary-color)' : 'transparent',
                color: stockStatusFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              هەموو ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setStockStatusFilter('LOW_STOCK')}
              style={{
                height: '30px',
                padding: '0 10px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: stockStatusFilter === 'LOW_STOCK' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                color: stockStatusFilter === 'LOW_STOCK' ? '#f59e0b' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              بەرەو تەواوبوون ({lowStockCount})
            </button>
            <button
              type="button"
              onClick={() => setStockStatusFilter('EXPIRING')}
              style={{
                height: '30px',
                padding: '0 10px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: stockStatusFilter === 'EXPIRING' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                color: stockStatusFilter === 'EXPIRING' ? '#ef4444' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              بەسەرچوون ({expiringCount})
            </button>
          </div>
        </div>
      </div>

      {/* Products Table (Strict RTL Compact Data Grid Standards, 8 Columns, 38px Row Height) */}
      <div style={{ borderRadius: '10px', border: '1px solid var(--border-color)', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
        <table style={{ width: '100%', tableLayout: 'auto', borderCollapse: 'collapse', border: '1px solid var(--border-color)', direction: 'rtl' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)', height: '36px' }}>
              <th style={{ border: '1px solid var(--border-color)', width: '24%', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>کاڵا</th>
              <th style={{ border: '1px solid var(--border-color)', width: '130px', maxWidth: '140px', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>بارکۆد</th>
              <th style={{ border: '1px solid var(--border-color)', width: '12%', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>جۆر</th>
              <th style={{ border: '1px solid var(--border-color)', width: '10%', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>نرخی کڕین</th>
              <th style={{ border: '1px solid var(--border-color)', width: '10%', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>نرخی فرۆشتن</th>
              <th style={{ border: '1px solid var(--border-color)', width: '10%', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>کۆگا</th>
              <th style={{ border: '1px solid var(--border-color)', width: '11%', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>بەرواری بەسەرچوون</th>
              <th style={{ border: '1px solid var(--border-color)', width: '11%', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>کردارەکان</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ border: '1px solid var(--border-color)', padding: '25px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>باردەکرێت...</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan="8" style={{ border: '1px solid var(--border-color)', padding: '25px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>هیچ کاڵایەک نەدۆزرایەوە</td></tr>
            ) : (
              filteredProducts.map(p => {
                const isWeighted = Boolean(p.is_weighted || p.unit === 'کگم');
                const unitLabel = isWeighted ? 'کگم' : (p.unit || 'دانە');
                const rawStock = Number(p.stock) || 0;
                const threshold = p.low_stock_threshold !== undefined && p.low_stock_threshold !== null ? Number(p.low_stock_threshold) : 5;
                const isLow = rawStock <= threshold;

                let formattedStock = '';
                if (isWeighted) {
                  const cleanNum = parseFloat(rawStock.toFixed(2));
                  formattedStock = cleanNum.toLocaleString('en-US', { maximumFractionDigits: 2 });
                } else {
                  const roundedInt = Math.round(rawStock);
                  formattedStock = roundedInt.toLocaleString('en-US');
                }

                let isExpired = false;
                let isNearExpiry = false;
                if (p.expiry_date) {
                  const now = new Date(); now.setHours(0,0,0,0);
                  const exp = new Date(p.expiry_date); exp.setHours(0,0,0,0);
                  const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
                  if (diffDays <= 0) isExpired = true;
                  else if (diffDays <= 30) isNearExpiry = true;
                }

                return (
                  <tr 
                    key={p.id} 
                    onClick={() => openEditModal(p)}
                    style={{ 
                      height: 'auto',
                      minHeight: '38px',
                      cursor: 'pointer',
                      transition: 'background 0.12s ease'
                    }} 
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'} 
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* 1. کاڵا (Center-aligned with multi-line text wrapping) */}
                    <td style={{ 
                      border: '1px solid var(--border-color)', 
                      padding: '6px 10px', 
                      verticalAlign: 'middle', 
                      textAlign: 'center', 
                      whiteSpace: 'normal', 
                      wordWrap: 'break-word', 
                      overflowWrap: 'anywhere', 
                      lineHeight: 1.4 
                    }}>
                      <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                        {p.name}
                      </span>
                    </td>

                    {/* 2. بارکۆد (Compact 130px max 140px, 12px font) */}
                    <td style={{ 
                      border: '1px solid var(--border-color)', 
                      width: '130px', 
                      maxWidth: '140px', 
                      padding: '6px 8px', 
                      verticalAlign: 'middle', 
                      textAlign: 'center', 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis' 
                    }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {p.barcode}
                      </span>
                    </td>

                    {/* 3. جۆر */}
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', color: 'var(--text-secondary)', fontSize: '0.82rem', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.category_name || 'بێ جۆر'}
                    </td>

                    {/* 4. نرخی کڕین */}
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', color: 'var(--text-secondary)', fontSize: '0.84rem', fontWeight: 600, verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {canViewCost ? Number(p.cost_price || 0).toLocaleString() : '••••••'}
                    </td>

                    {/* 5. نرخی فرۆشتن */}
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--success-color)', fontWeight: 800, fontSize: '0.86rem' }}>
                        {Number(p.selling_price).toLocaleString()}
                      </span>
                    </td>

                    {/* 6. کۆگا (Formatted with thousand separators & integer piece rounding) */}
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.84rem', color: isLow ? '#ef4444' : 'var(--text-primary)' }}>
                        {formattedStock} {unitLabel}
                      </span>
                    </td>

                    {/* 7. بەرواری بەسەرچوون */}
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {p.expiry_date ? (
                        <span style={{ 
                          fontFamily: 'monospace', 
                          fontSize: '0.82rem', 
                          fontWeight: 600, 
                          color: isExpired ? '#ef4444' : isNearExpiry ? '#f59e0b' : 'var(--text-secondary)' 
                        }}>
                          {String(p.expiry_date).split('T')[0]}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>-</span>
                      )}
                    </td>

                    {/* 8. کردارەکان */}
                    <td 
                      onClick={e => e.stopPropagation()}
                      style={{ border: '1px solid var(--border-color)', padding: '6px 8px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}
                    >
                      <div style={{ display: 'inline-flex', gap: '3px', alignItems: 'center', justifyContent: 'center' }}>
                        {/* FIFO Batches Button */}
                        <button 
                          type="button"
                          title="وەجبەکانی FIFO" 
                          onClick={(e) => { e.stopPropagation(); openBatchesModal(p); }} 
                          style={{ 
                            width: '28px', 
                            height: '28px', 
                            borderRadius: '6px', 
                            border: 'none', 
                            background: 'transparent', 
                            color: 'var(--text-muted)', 
                            cursor: 'pointer', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            transition: 'all 0.12s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#10b981'; e.currentTarget.style.background = 'rgba(16, 185, 129, 0.12)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        >
                          <Layers size={15} />
                        </button>

                        {/* Print Barcode Label Button */}
                        <button 
                          type="button"
                          title="چاپی لەزگەی بارکۆد" 
                          onClick={(e) => { e.stopPropagation(); openPrintModal(p); }} 
                          style={{ 
                            width: '28px', 
                            height: '28px', 
                            borderRadius: '6px', 
                            border: 'none', 
                            background: 'transparent', 
                            color: 'var(--text-muted)', 
                            cursor: 'pointer', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            transition: 'all 0.12s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#0284c7'; e.currentTarget.style.background = 'rgba(2, 132, 199, 0.12)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        >
                          <Printer size={15} />
                        </button>

                        {/* Delete Button (Admin Only) */}
                        {isAdmin && (
                          <button 
                            type="button"
                            title="سڕینەوە"
                            onClick={(e) => { e.stopPropagation(); setProductToDelete(p); }} 
                            style={{ 
                              width: '28px', 
                              height: '28px', 
                              borderRadius: '6px', 
                              border: 'none', 
                              background: 'transparent', 
                              color: 'var(--text-muted)', 
                              cursor: 'pointer', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              transition: 'all 0.12s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                          >
                            <Trash2 size={15} />
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

      {/* Add / Edit Product Modal (Unified DRY Reusable ProductModal) */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
          fetchData();
        }}
        mode="full"
        editProduct={editingProduct}
        categories={categories}
        onCategoriesUpdate={(newCat) => {
          setCategories(prev => {
            if (prev.some(x => x.id === newCat.id)) return prev;
            return [...prev, newCat];
          });
        }}
      />

      {/* Barcode Sticker Label Print Modal */}
      {printProduct && (
        <div className="pos-modal-overlay" onClick={() => setPrintProduct(null)}>
          <div className="pos-modal-card pos-modal-md" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                <Printer color="var(--accent-color)" />
                ئامادەکردنی بارکۆد بۆ چاپ
              </h2>
              <button onClick={() => setPrintProduct(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18}/>
              </button>
            </div>

            {/* Print Parameters Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>ناوی مارکێت لەسەر لەزگە:</label>
                <input 
                  type="text" 
                  value={storeName} 
                  onChange={(e) => {
                    setStoreName(e.target.value);
                    localStorage.setItem('pos_store_name', e.target.value);
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>ژمارەی کۆپییەکانی لەزگە:</label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input 
                    type="number" 
                    min="1" 
                    max="500"
                    value={printCopies} 
                    onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: '100px', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 'bold' }}
                  />
                  {[1, 5, 10, 20, 50].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setPrintCopies(cnt)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: printCopies === cnt ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                        color: printCopies === cnt ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sticker Live Preview Box */}
            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '16px', color: '#000000', textAlign: 'center', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', letterSpacing: '1px' }}>
                {storeName}
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#0f172a', margin: '4px 0 8px 0' }}>
                {printProduct.name}
              </div>
              <div style={{ margin: '4px auto' }}>
                <BarcodeSVG value={printProduct.barcode} maxWidth="48mm" barHeight={42} />
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 'bold', color: '#0f172a', marginTop: '6px' }}>
                {Number(printProduct.selling_price).toLocaleString()} دینار
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={handlePrintLabels}
                style={{ flex: 1, minWidth: '160px', padding: '14px', borderRadius: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '1.05rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(37, 99, 235, 0.35)' }}
              >
                <Printer size={20} /> چاپکردنی {printCopies} دانە لەزگە
              </button>
              <button 
                onClick={() => setPrintProduct(null)}
                style={{ padding: '14px 20px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold' }}
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Container specifically targeted by @media print */}
      {printProduct && (
        <div id="thermal-print-container" ref={printAreaRef}>
          {Array.from({ length: printCopies }).map((_, idx) => (
            <div key={idx} className="barcode-sticker" style={{ textAlign: 'center', padding: '6px', background: '#fff', color: '#000', width: '50mm', height: '30mm', boxSizing: 'border-box' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{storeName}</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '46mm' }}>
                {printProduct.name}
              </div>
              <BarcodeSVG value={printProduct.barcode} maxWidth="45mm" barHeight={38} />
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '2px' }}>
                {Number(printProduct.selling_price).toLocaleString()} دینار
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FIFO Batches Transparency Modal */}
      {selectedBatchProduct && (() => {
        const isWeighted = Boolean(selectedBatchProduct.is_weighted || selectedBatchProduct.unit === 'کگم');
        const unitLabel = isWeighted ? 'کگم' : (selectedBatchProduct.unit || 'دانە');
        const activeBatches = productBatches.filter(b => b.status === 'ACTIVE' && Number(b.remaining_quantity) > 0);
        const totalProfit = productBatches
          .filter(b => b.status === 'ACTIVE')
          .reduce((sum, b) => {
            const sellPrice = Number(selectedBatchProduct.selling_price || b.selling_price || 0);
            const costPrice = Number(b.cost_price || 0);
            const profitPerUnit = sellPrice > costPrice ? (sellPrice - costPrice) : costPrice;
            return sum + (Number(b.remaining_quantity) * profitPerUnit);
          }, 0);
        const totalRemaining = productBatches
          .filter(b => b.status === 'ACTIVE')
          .reduce((sum, b) => sum + Number(b.remaining_quantity), 0);

        return (
          <div 
            onClick={() => setSelectedBatchProduct(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1100,
              direction: 'rtl',
              padding: '16px'
            }}
          >
            <div 
              onClick={e => e.stopPropagation()}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #cbd5e1',
                boxShadow: '0 20px 45px rgba(0, 0, 0, 0.15)',
                maxWidth: '920px',
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc'
              }}>
                <div style={{
                  color: '#475569',
                  fontSize: '0.88rem',
                  display: 'flex',
                  gap: '20px',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}>
                  <span>
                    بارکۆد: <code style={{ fontFamily: 'monospace', color: '#0f172a', fontWeight: 700 }}>{selectedBatchProduct.barcode}</code>
                  </span>
                  <span style={{ color: '#cbd5e1' }}>•</span>
                  <span>
                    کۆی مەخزەنی ئێستا: <b style={{ color: '#0f172a', fontWeight: 800 }}>{cleanQty(selectedBatchProduct.stock, isWeighted)} {unitLabel}</b>
                  </span>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedBatchProduct(null)} 
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* KPI Summary Cards - Clean Neutral Style */}
              <div style={{
                padding: '16px 24px 0 24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px'
              }}>
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '14px 18px',
                  borderRadius: '10px'
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                    وەجبە چالاکەکان (ماوە لە کۆگا)
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                    {activeBatches.length} وەجبە
                  </div>
                </div>

                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '14px 18px',
                  borderRadius: '10px'
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                    کۆی قازانجی وەجبە ماوەکان
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                    {totalProfit.toLocaleString()} د.ع
                  </div>
                </div>

                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '14px 18px',
                  borderRadius: '10px'
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                    کۆی بڕی ماوە لە وەجبەکان
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                    {cleanQty(totalRemaining, isWeighted)} {unitLabel}
                  </div>
                </div>
              </div>

              {/* Content / Table Area */}
              <div style={{ padding: '16px 24px 20px 24px', overflowY: 'auto', flex: 1 }}>
                {loadingBatches ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                    چاوەڕوان بە... زانیاری وەجبەکان باردەکرێن
                  </div>
                ) : productBatches.length === 0 ? (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#64748b',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px dashed #cbd5e1',
                    fontSize: '0.9rem'
                  }}>
                    هیچ وەجبەیەکی تۆمارکراو بۆ ئەم کاڵایە نییە.
                  </div>
                ) : (
                  <div style={{
                    overflowX: 'auto',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                      <thead style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                        <tr>
                          <th style={{ padding: '10px 12px', color: '#475569', fontSize: '0.82rem', fontWeight: 600 }}>ڕیزبەندی (FIFO)</th>
                          <th style={{ padding: '10px 12px', color: '#475569', fontSize: '0.82rem', fontWeight: 600 }}>کۆد / پسووڵە</th>
                          <th style={{ padding: '10px 12px', color: '#475569', fontSize: '0.82rem', fontWeight: 600 }}>دابینکەر</th>
                          <th style={{ padding: '10px 12px', color: '#475569', fontSize: '0.82rem', fontWeight: 600 }}>بەرواری هاتن</th>
                          <th style={{ padding: '10px 12px', color: '#475569', fontSize: '0.82rem', fontWeight: 600 }}>تێچوونی دانە</th>
                          <th style={{ padding: '10px 12px', color: '#475569', fontSize: '0.82rem', fontWeight: 600 }}>بڕی سەرەتایی</th>
                          <th style={{ padding: '10px 12px', color: '#475569', fontSize: '0.82rem', fontWeight: 600 }}>بڕی ماوە</th>
                          <th style={{ padding: '10px 12px', color: '#475569', fontSize: '0.82rem', fontWeight: 600 }}>دۆخ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productBatches.map((batch, idx) => {
                          const isActive = batch.status === 'ACTIVE' && Number(batch.remaining_quantity) > 0;
                          return (
                            <tr 
                              key={batch.id} 
                              style={{ 
                                borderBottom: '1px solid #f1f5f9', 
                                background: '#ffffff',
                                transition: 'background 0.12s ease'
                              }}
                            >
                              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#475569' }}>
                                #{idx + 1}
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.84rem' }}>
                                <div style={{ color: '#0f172a', fontWeight: 600 }}>{batch.batch_number || `BATCH-${batch.id}`}</div>
                                {batch.invoice_number && (
                                  <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>
                                    پسووڵە: {batch.invoice_number}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: '0.84rem', color: '#334155' }}>
                                {batch.supplier_name || 'کڕینی ناوخۆیی'}
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#64748b' }}>
                                {new Date(batch.created_at).toLocaleDateString('en-GB')}
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>
                                {canViewCost ? `${Number(batch.cost_price).toLocaleString()} د.ع` : '••••••'}
                              </td>
                              <td style={{ padding: '10px 12px', color: '#64748b' }}>
                                {cleanQty(batch.initial_quantity, isWeighted)} {unitLabel}
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                                {cleanQty(batch.remaining_quantity, isWeighted)} {unitLabel}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                {isActive ? (
                                  <span style={{ 
                                    background: '#f1f5f9', 
                                    color: '#1e293b', 
                                    border: '1px solid #cbd5e1', 
                                    padding: '3px 10px', 
                                    borderRadius: '6px', 
                                    fontSize: '0.76rem', 
                                    fontWeight: 600,
                                    display: 'inline-block'
                                  }}>
                                    ماوە
                                  </span>
                                ) : (
                                  <span style={{ 
                                    background: '#ffffff', 
                                    color: '#94a3b8', 
                                    border: '1px solid #e2e8f0', 
                                    padding: '3px 10px', 
                                    borderRadius: '6px', 
                                    fontSize: '0.76rem', 
                                    fontWeight: 500,
                                    display: 'inline-block'
                                  }}>
                                    تەواو بوو
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Custom Delete Confirmation Modal */}
      {productToDelete && (
        <div 
          className="pos-modal-overlay" 
          onClick={() => !isDeleting && setProductToDelete(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            direction: 'rtl'
          }}
        >
          <div 
            className="pos-modal-card" 
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '24px',
              width: '90%',
              maxWidth: '420px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
              textAlign: 'center'
            }}
          >
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <Trash2 size={26} />
            </div>

            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              دڵنیایت لە سڕینەوەی ئەم کاڵایە؟
            </h3>

            <div style={{ 
              fontSize: '0.95rem', 
              fontWeight: 700, 
              color: 'var(--text-secondary)', 
              background: 'var(--bg-tertiary)', 
              padding: '10px 14px', 
              borderRadius: '10px', 
              marginBottom: '20px',
              wordBreak: 'break-word'
            }}>
              «{productToDelete.name}»
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {isDeleting ? 'دەسڕدرێتەوە...' : 'سڕینەوە'}
              </button>
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                پاشگەزبوونەوە
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Products;
