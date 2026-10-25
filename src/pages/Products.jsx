import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Search, Plus, Edit2, Trash2, X, Barcode, Printer, Tag, Coins, Package, Layers, Scale, ChevronDown } from 'lucide-react';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import { useAuth } from '../context/AuthContext';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { normalizeBarcode } from '../utils/barcodeNormalizer';
import BarcodeSVG from '../components/BarcodeSVG';
import './Dashboard.css';

const Products = () => {
  const { isAdmin, canCashier } = useAuth();
  const canViewCost = isAdmin || (canCashier ? canCashier('allow_view_cost_price') : false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');


  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [categoryInput, setCategoryInput] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryContainerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (categoryContainerRef.current && !categoryContainerRef.current.contains(e.target)) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Form State
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL'); // 'ALL', 'LOW_STOCK', 'EXPIRING'
  const [formData, setFormData] = useState({
    name: '', barcode: '', cost_price: '', selling_price: '', stock: '', category_id: '',
    wholesale_price: '', expiry_date: '', low_stock_threshold: '5',
    box_barcode: '', units_per_box: '1',
    is_weighted: false, unit: 'دانە'
  });

  // Barcode Printing State
  const [printProduct, setPrintProduct] = useState(null);
  const [printCopies, setPrintCopies] = useState(1);
  const [storeName, setStoreName] = useState(() => {
    return localStorage.getItem('pos_store_name') || 'مارکێتی حاجی ئاکۆ';
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
    if (isModalOpen) {
      setFormData(prev => ({ ...prev, barcode: cleaned }));
    } else {
      setSearchTerm(cleaned);
    }
  });

  const openAddModal = () => {
    setEditId(null);
    setCategoryInput('');
    setIsCategoryOpen(false);
    setFormData({ 
      name: '', barcode: '', cost_price: '', selling_price: '', stock: '', category_id: '',
      wholesale_price: '', expiry_date: '', low_stock_threshold: '5',
      box_barcode: '', units_per_box: '1',
      is_weighted: false, unit: 'دانە'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p) => {
    setEditId(p.id);
    const isW = Boolean(p.is_weighted || p.unit === 'کگم');
    const existingCat = categories.find(c => String(c.id) === String(p.category_id));
    setCategoryInput(existingCat ? existingCat.name : (p.category_name || ''));
    setIsCategoryOpen(false);
    setFormData({
      name: p.name, 
      barcode: p.barcode, 
      cost_price: p.cost_price || '', 
      selling_price: p.selling_price || '', 
      stock: p.stock !== undefined ? p.stock : '', 
      category_id: p.category_id || '',
      wholesale_price: p.wholesale_price || '',
      expiry_date: p.expiry_date ? p.expiry_date.split('T')[0] : '',
      low_stock_threshold: p.low_stock_threshold !== undefined && p.low_stock_threshold !== null ? p.low_stock_threshold.toString() : '5',
      box_barcode: p.box_barcode || '',
      units_per_box: p.units_per_box ? p.units_per_box.toString() : '1',
      is_weighted: isW,
      unit: isW ? 'کگم' : (p.unit || 'دانە')
    });
    setIsModalOpen(true);
  };

  const filteredCategories = useMemo(() => {
    if (!categoryInput.trim()) return categories;
    return categories.filter(c => kurdishSearchMatch(c.name, categoryInput));
  }, [categories, categoryInput]);

  const generateBarcode = () => {
    // Generates a random 12-digit barcode for unbarcoded items
    const randomBarcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setFormData(prev => ({ ...prev, barcode: randomBarcode }));
  };

  const generateBoxBarcode = () => {
    // Generates a random box barcode
    const randomBox = 'BOX' + Math.floor(100000000 + Math.random() * 900000000).toString();
    setFormData(prev => ({ ...prev, box_barcode: randomBox }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
              setCategories(prev => {
                if (prev.some(x => x.id === catRes.data.data.id)) return prev;
                return [...prev, catRes.data.data];
              });
            }
          } catch (catErr) {
            console.error('Failed to auto-create category:', catErr);
          }
        }
      } else {
        finalCategoryId = null;
      }

      let finalBarcode = formData.barcode ? String(formData.barcode).trim() : '';
      if (!finalBarcode) {
        alert('تکایە بارکۆد بنووسە یان دروستی بکە');
        return;
      }

      const payload = {
        ...formData,
        category_id: finalCategoryId,
        barcode: finalBarcode,
        cost_price: formData.cost_price ? Number(formData.cost_price) : 0,
        stock: formData.stock ? parseFloat(formData.stock) : 0,
        wholesale_price: (!formData.is_weighted && formData.wholesale_price) ? Number(formData.wholesale_price) : 0,
        expiry_date: (!formData.is_weighted && formData.expiry_date) ? formData.expiry_date : null,
        low_stock_threshold: formData.low_stock_threshold !== undefined && formData.low_stock_threshold !== '' ? parseInt(formData.low_stock_threshold) : 5,
        box_barcode: (!formData.is_weighted && formData.box_barcode && formData.box_barcode.trim() !== '') ? formData.box_barcode.trim() : null,
        units_per_box: (!formData.is_weighted && formData.units_per_box) ? Math.max(1, parseFloat(formData.units_per_box)) : 1,
        is_weighted: formData.is_weighted ? 1 : 0,
        unit: formData.is_weighted ? 'کگم' : 'دانە'
      };
      if (editId) {
        await axios.put(`http://localhost:3001/api/products/${editId}`, payload, config);
      } else {
        await axios.post('http://localhost:3001/api/products', payload, config);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردنی کاڵاکە');
    }
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
            border: '1px solid var(--border-color)', 
            borderRadius: '8px', 
            padding: '0 10px',
            width: '210px',
            boxSizing: 'border-box'
          }}>
            <Search size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input 
              type="text" 
              placeholder="گەڕان بە ناو یان بارکۆد..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--text-primary)', 
                marginRight: '6px', 
                outline: 'none', 
                width: '100%', 
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

          {/* Category Select Dropdown (36px) */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              height: '36px',
              padding: '0 10px',
              borderRadius: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.84rem',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
              boxSizing: 'border-box'
            }}
          >
            <option value="ALL">هەموو جۆرەکان ({products.length})</option>
            {categories.map(cat => {
              const count = products.filter(p => String(p.category_id) === String(cat.id)).length;
              return (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({count})
                </option>
              );
            })}
          </select>
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

          {/* Add New Product Button (36px) */}
          <button 
            type="button"
            onClick={openAddModal} 
            style={{ 
              height: '36px',
              padding: '0 14px', 
              borderRadius: '8px', 
              background: 'var(--primary-color)', 
              color: '#ffffff', 
              border: 'none', 
              cursor: 'pointer', 
              fontWeight: 800,
              fontSize: '0.86rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box'
            }}
          >
            <Plus size={16} /> کاڵای نوێ
          </button>
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
                    style={{ 
                      height: 'auto',
                      minHeight: '38px',
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
                    <td style={{ border: '1px solid var(--border-color)', padding: '6px 8px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '3px', alignItems: 'center', justifyContent: 'center' }}>
                        {/* FIFO Batches Button */}
                        <button 
                          type="button"
                          title="وەجبەکانی FIFO" 
                          onClick={() => openBatchesModal(p)} 
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
                          onClick={() => openPrintModal(p)} 
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

                        {/* Edit Button */}
                        <button 
                          type="button"
                          title="دەستکاریکردن"
                          onClick={() => openEditModal(p)} 
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
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-color)'; e.currentTarget.style.background = 'rgba(37, 99, 235, 0.12)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        >
                          <Edit2 size={15} />
                        </button>

                        {/* Delete Button (Admin Only) */}
                        {isAdmin && (
                          <button 
                            type="button"
                            title="سڕینەوە"
                            onClick={() => setProductToDelete(p)} 
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

      {/* Add / Edit Product Modal (Ultra-Clean Wide Zero-Scroll Layout) */}
      {isModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsModalOpen(false)}>
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
                {editId ? 'دەستکاریکردنی کاڵا' : 'زیادکردنی کاڵای نوێ'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Compact segmented toggle for unit type (height: 34px, no icons) */}
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
                  onClick={() => setIsModalOpen(false)} 
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
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                    style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem' }} 
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
                        padding: '0 26px 0 10px', 
                        borderRadius: '8px', 
                        background: '#ffffff', 
                        border: isCategoryOpen ? '1px solid #2563eb' : '1px solid #cbd5e1', 
                        color: '#1e293b',
                        boxSizing: 'border-box',
                        fontSize: '0.88rem'
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
                                setCategories(prev => {
                                  if (prev.some(x => x.id === createdCat.id)) return prev;
                                  return [...prev, createdCat];
                                });
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
                        padding: '0 80px 0 10px', 
                        borderRadius: '8px', 
                        background: '#ffffff', 
                        border: '1px solid #cbd5e1', 
                        color: '#1e293b', 
                        fontFamily: 'monospace', 
                        fontSize: '0.86rem', 
                        boxSizing: 'border-box' 
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

              {/* Row 2: Pricing & Inventory (4 Columns for Weight, 5 Columns for Piece) */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: formData.is_weighted ? 'repeat(4, 1fr)' : 'repeat(5, 1fr)', 
                gap: '12px' 
              }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                    {formData.is_weighted ? 'نرخی کڕینی ١ کیلۆ' : 'نرخی کڕینی تاک'}
                  </label>
                  <input 
                    type="number" 
                    step="250"
                    min="0"
                    placeholder="0"
                    value={formData.cost_price} 
                    onChange={e => setFormData({ ...formData, cost_price: e.target.value })} 
                    style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem' }} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                    {formData.is_weighted ? 'نرخی فرۆشتنی ١ کیلۆ' : 'نرخی فرۆشتنی تاک'} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="number" 
                    step="250"
                    min="0"
                    required 
                    placeholder="0"
                    value={formData.selling_price} 
                    onChange={e => setFormData({ ...formData, selling_price: e.target.value })} 
                    style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem' }} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                    {formData.is_weighted ? 'کێش لە کۆگا (کگم)' : 'دانە لە کۆگا'}
                  </label>
                  <input 
                    type="number" 
                    step={formData.is_weighted ? '0.001' : '1'}
                    placeholder="0"
                    value={formData.stock} 
                    onChange={e => setFormData({ ...formData, stock: e.target.value })} 
                    style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem' }} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                    {formData.is_weighted ? 'ئاگاداری کەمبوونەوە (کگم)' : 'ئاگاداری کەمبوونەوە (دانە)'}
                  </label>
                  <input 
                    type="number" 
                    placeholder="5"
                    value={formData.low_stock_threshold} 
                    onChange={e => setFormData({ ...formData, low_stock_threshold: e.target.value })} 
                    style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem' }} 
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

              {/* Row 3: Wholesale / Carton (3-Column Grid: 1fr 1fr 1.5fr, gap 12px — ONLY visible when "بە دانە" is selected) */}
              {!formData.is_weighted && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                      نرخی فرۆشتنی کارتۆن
                    </label>
                    <input 
                      type="number" 
                      step="250"
                      min="0"
                      placeholder="0"
                      value={formData.wholesale_price} 
                      onChange={e => setFormData({ ...formData, wholesale_price: e.target.value })} 
                      style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem' }} 
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                      ژمارەی دانە لە کارتۆندا
                    </label>
                    <input 
                      type="number" 
                      min="1"
                      step="any"
                      placeholder="24"
                      value={formData.units_per_box} 
                      onChange={e => setFormData({ ...formData, units_per_box: e.target.value })} 
                      style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem' }} 
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
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
                          padding: '0 80px 0 10px', 
                          borderRadius: '8px', 
                          background: '#ffffff', 
                          border: '1px solid #cbd5e1', 
                          color: '#1e293b', 
                          fontFamily: 'monospace', 
                          fontSize: '0.86rem', 
                          boxSizing: 'border-box' 
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
              )}

              {/* Footer Row: Single Full-Width Primary Button */}
              <div style={{ marginTop: '4px' }}>
                <button 
                  type="submit" 
                  style={{ 
                    width: '100%', 
                    height: '42px', 
                    borderRadius: '8px', 
                    background: '#2563eb', 
                    color: '#ffffff', 
                    border: 'none', 
                    fontSize: '0.95rem', 
                    fontWeight: 800, 
                    cursor: 'pointer', 
                    boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  پاشەکەوتکردن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
      {selectedBatchProduct && (
        <div className="pos-modal-overlay" onClick={() => setSelectedBatchProduct(null)}>
          <div className="pos-modal-card pos-modal-xl" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 800 }}>
                  <Layers color="#10b981" />
                  وەجبەکانی کۆگا (حیساباتی وردی FIFO): {selectedBatchProduct.name}
                </h2>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span>بارکۆد: <code style={{ color: '#38bdf8' }}>{selectedBatchProduct.barcode}</code></span>
                  <span>کۆی مەخزەنی ئێستا: <b style={{ color: '#10b981' }}>{selectedBatchProduct.stock} دانە</b></span>
                </div>
              </div>
              <button onClick={() => setSelectedBatchProduct(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            {loadingBatches ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                چاوەڕوان بە... باردەکرێت
              </div>
            ) : productBatches.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: 'rgba(255,255,255,0.02)', borderRadius: '14px' }}>
                هیچ وەجبەیەکی تۆمارکراو بۆ ئەم کاڵایە نییە.
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '1rem', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#10b981' }}>وەجبە چالاکەکان (ماوە لە کۆگا)</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#10b981', marginTop: '4px' }}>
                      {productBatches.filter(b => b.status === 'ACTIVE' && Number(b.remaining_quantity) > 0).length} وەجبە
                    </div>
                  </div>
                  <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', padding: '1rem', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#38bdf8' }}>کۆی سەرمایەی وەجبە چالاکەکان</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '4px' }}>
                      {productBatches
                        .filter(b => b.status === 'ACTIVE')
                        .reduce((sum, b) => sum + (Number(b.remaining_quantity) * Number(b.cost_price)), 0)
                        .toLocaleString()} د.ع
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead style={{ background: 'var(--bg-tertiary)' }}>
                      <tr>
                        <th style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ڕیزبەندی (FIFO)</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>کۆد / پسووڵە</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>دابینکەر</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>بەرواری هاتن</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>تێچوونی دانە</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>بڕی سەرەتایی</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>بڕی ماوە</th>
                        <th style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>دۆخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productBatches.map((batch, idx) => {
                        const isActive = batch.status === 'ACTIVE' && Number(batch.remaining_quantity) > 0;
                        return (
                          <tr key={batch.id} style={{ borderBottom: '1px solid var(--border-color)', background: isActive ? 'rgba(16,185,129,0.03)' : 'transparent' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 'bold', color: isActive ? '#10b981' : 'var(--text-secondary)' }}>
                              #{idx + 1} {isActive ? '⚡' : '✓'}
                            </td>
                            <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                              {batch.batch_number || `BATCH-${batch.id}`}
                              {batch.invoice_number && <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>پسووڵە: {batch.invoice_number}</div>}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                              {batch.supplier_name || 'کڕینی ناوخۆیی'}
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              {new Date(batch.created_at).toLocaleDateString('en-GB')}
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#fbbf24' }}>
                              {canViewCost ? `${Number(batch.cost_price).toLocaleString()} د.ع` : '••••••'}
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                              {Number(batch.initial_quantity)} دانە
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: 'bold', color: isActive ? '#34d399' : 'var(--text-secondary)' }}>
                              {Number(batch.remaining_quantity)} دانە
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              {isActive ? (
                                <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                  چالاک (لە سەرەتادایە)
                                </span>
                              ) : (
                                <span style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                  تەواوبوو (فرۆشراو)
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => setSelectedBatchProduct(null)}
                    className="btn-secondary"
                    style={{ padding: '10px 24px' }}
                  >
                    داخستن
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
