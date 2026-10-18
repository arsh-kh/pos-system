import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Search, Plus, Edit2, Trash2, X, Barcode, Printer, Tag, Coins, AlertTriangle, Calendar, Package, Layers } from 'lucide-react';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import { useAuth } from '../context/AuthContext';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import './Dashboard.css';

// SVG Barcode Component for High-Quality Thermal Print
const BarcodeSVG = ({ value, width = 220, height = 65 }) => {
  // Deterministic bar widths pattern based on barcode string
  const bars = [];
  const str = String(value || '000000000000');
  
  // Guard start pattern
  bars.push(2, 1, 2, 1);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) % 7;
    if (code === 0) bars.push(1, 2, 1, 2);
    else if (code === 1) bars.push(2, 1, 1, 2);
    else if (code === 2) bars.push(1, 1, 2, 2);
    else if (code === 3) bars.push(2, 2, 1, 1);
    else if (code === 4) bars.push(1, 2, 2, 1);
    else if (code === 5) bars.push(3, 1, 1, 1);
    else bars.push(1, 1, 3, 1);
  }
  // Guard end pattern
  bars.push(2, 1, 2);

  let currentX = 10;
  const rects = [];
  bars.forEach((barWidth, index) => {
    if (index % 2 === 0) {
      rects.push(
        <rect
          key={index}
          x={currentX}
          y={0}
          width={barWidth * 1.5}
          height={height - 18}
          fill="#000000"
        />
      );
    }
    currentX += barWidth * 1.5;
  });

  return (
    <div style={{ textAlign: 'center', background: '#ffffff', padding: '6px 8px', borderRadius: '4px', display: 'inline-block' }}>
      <svg width={width} height={height} viewBox={`0 0 ${currentX + 10} ${height}`} style={{ display: 'block', margin: '0 auto' }}>
        {rects}
      </svg>
      <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold', color: '#000000', letterSpacing: '3px', marginTop: '2px' }}>
        {str}
      </div>
    </div>
  );
};

const Products = () => {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');


  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  
  // Form State
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL'); // 'ALL', 'LOW_STOCK', 'EXPIRING'
  const [formData, setFormData] = useState({
    name: '', barcode: '', cost_price: '', selling_price: '', stock: '', category_id: '',
    wholesale_price: '', expiry_date: '', low_stock_threshold: '5',
    box_barcode: '', units_per_box: '1'
  });

  // Barcode Printing State
  const [printProduct, setPrintProduct] = useState(null);
  const [printCopies, setPrintCopies] = useState(1);
  const [storeName, setStoreName] = useState(() => {
    return localStorage.getItem('pos_store_name') || 'مارکێتی نموونەیی';
  });
  const printAreaRef = useRef(null);

  // FIFO Batches Modal State
  const [selectedBatchProduct, setSelectedBatchProduct] = useState(null);
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
    setSearchTerm(scannedBarcode);
  });

  const openAddModal = () => {
    setEditId(null);
    setFormData({ 
      name: '', barcode: '', cost_price: '', selling_price: '', stock: '', category_id: '',
      wholesale_price: '', expiry_date: '', low_stock_threshold: '5',
      box_barcode: '', units_per_box: '1' 
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p) => {
    setEditId(p.id);
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
      units_per_box: p.units_per_box ? p.units_per_box.toString() : '1'
    });
    setIsModalOpen(true);
  };

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
      const payload = {
        ...formData,
        cost_price: formData.cost_price ? Number(formData.cost_price) : 0,
        stock: formData.stock ? parseFloat(formData.stock) : 0,
        wholesale_price: formData.wholesale_price ? Number(formData.wholesale_price) : 0,
        expiry_date: formData.expiry_date || null,
        low_stock_threshold: formData.low_stock_threshold !== undefined && formData.low_stock_threshold !== '' ? parseInt(formData.low_stock_threshold) : 5,
        box_barcode: formData.box_barcode && formData.box_barcode.trim() !== '' ? formData.box_barcode.trim() : null,
        units_per_box: formData.units_per_box ? Math.max(1, parseFloat(formData.units_per_box)) : 1
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

  const handleDelete = async (id) => {
    if (window.confirm('دڵنیایت لە سڕینەوەی ئەم کاڵایە؟')) {
      try {
        await axios.delete(`http://localhost:3001/api/products/${id}`, getAuthConfig());
        fetchData();
      } catch {
        alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوەی کاڵاکە');
      }
    }
  };

  // Open Barcode Print Modal
  const openPrintModal = (p) => {
    setPrintProduct(p);
    setPrintCopies(1);
  };

  // Trigger Native Thermal Print
  const handlePrintLabels = () => {
    window.print();
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
    <div className="dashboard-page p-8" style={{ position: 'relative' }}>
      
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
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            padding: 2mm !important;
            direction: rtl !important;
            font-family: 'Noto Kufi Arabic', system-ui, sans-serif !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Tag color="var(--accent-color)" size={32} />
            بەشی کاڵاکان
          </h1>
          <p className="text-secondary">بینین، گەڕان، بەڕێوەبردنی نرخ و ئامادەکردنی بارکۆد بۆ چاپ</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Quick Search */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 1rem', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <Search size={20} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="گەڕان بە ناو یان بارکۆد..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', marginRight: '10px', outline: 'none', width: '220px', fontSize: '0.92rem' }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            )}
          </div>


          
          {/* Add New Product Button */}
          <button 
            className="btn-primary" 
            onClick={openAddModal} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <Plus size={20} /> کاڵای نوێ
          </button>
        </div>
      </div>

      {/* Quick Status Filters: All, Low Stock, Expiring */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setStockStatusFilter('ALL')}
          style={{
            padding: '8px 18px',
            borderRadius: '12px',
            border: stockStatusFilter === 'ALL' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
            background: stockStatusFilter === 'ALL' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-tertiary)',
            color: stockStatusFilter === 'ALL' ? 'var(--accent-hover)' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          هەموو کاڵاکان ({products.length})
        </button>

        <button
          onClick={() => setStockStatusFilter('LOW_STOCK')}
          style={{
            padding: '8px 18px',
            borderRadius: '12px',
            border: stockStatusFilter === 'LOW_STOCK' ? '2px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.2)',
            background: stockStatusFilter === 'LOW_STOCK' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.08)',
            color: '#f59e0b',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <AlertTriangle size={16} /> بەرەو تەواوبوون ({lowStockCount})
        </button>

        <button
          onClick={() => setStockStatusFilter('EXPIRING')}
          style={{
            padding: '8px 18px',
            borderRadius: '12px',
            border: stockStatusFilter === 'EXPIRING' ? '2px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.2)',
            background: stockStatusFilter === 'EXPIRING' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.08)',
            color: '#ef4444',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Calendar size={16} /> بەسەرچوون / نزیک ({expiringCount})
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '1rem', marginBottom: '1rem', scrollbarWidth: 'none' }}>
        <button
          onClick={() => setSelectedCategory('ALL')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: selectedCategory === 'ALL' ? 'bold' : 'normal',
            background: selectedCategory === 'ALL' ? '#3b82f6' : 'var(--bg-tertiary)',
            color: selectedCategory === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.2s'
          }}
        >
          هەموو کاڵاکان ({products.length})
        </button>
        {categories.map(cat => {
          const count = products.filter(p => String(p.category_id) === String(cat.id)).length;
          const isActive = String(selectedCategory) === String(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: isActive ? 'bold' : 'normal',
                background: isActive ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Products Table */}
      <div className="glass-panel" style={{ padding: '1px', borderRadius: '16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '1050px', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <thead style={{ background: 'var(--bg-tertiary)' }}>
            <tr>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>ناوی کاڵا</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>کەتەگۆری</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>بارکۆد (دانە / کارتۆن)</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>نرخی کڕین (دینار)</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>نرخی فرۆشتن (تاک)</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>نرخی جوملە (کارتۆن)</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>کۆگا</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>بەرواری بەسەرچوون</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>کردارەکان</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>باردەکرێت...</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>هیچ کاڵایەک نەدۆزرایەوە</td></tr>
            ) : (
              filteredProducts.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                  <td style={{ padding: '16px 20px', fontWeight: 'bold' }}>{p.name}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem' }}>
                      {p.category_name || 'بێ جۆر'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 'bold' }}>{p.barcode}</div>
                    {p.box_barcode && (
                      <div style={{ fontFamily: 'monospace', color: '#0284c7', fontSize: '0.75rem', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Package size={12} /> {p.box_barcode}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                    {Number(p.cost_price).toLocaleString()} دینار
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ color: '#10b981', fontWeight: 'bold' }}>{Number(p.selling_price).toLocaleString()} دینار</div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {p.wholesale_price > 0 ? (
                      <div>
                        <div style={{ color: '#0284c7', fontWeight: 'bold' }}>{Number(p.wholesale_price).toLocaleString()} دینار</div>
                        <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                          کارتۆنی {p.units_per_box ? Number(p.units_per_box) : 1} دانەیی
                        </small>
                      </div>
                    ) : (
                      <span style={{ color: '#64748b' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {(() => {
                      const threshold = p.low_stock_threshold !== undefined && p.low_stock_threshold !== null ? Number(p.low_stock_threshold) : 5;
                      const isLow = Number(p.stock) <= threshold;
                      const unitsPerBox = p.units_per_box ? Number(p.units_per_box) : 1;
                      const boxCount = unitsPerBox > 1 ? Math.floor(Number(p.stock) / unitsPerBox) : null;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ 
                            background: isLow ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)', 
                            color: isLow ? '#ef4444' : '#10b981', 
                            padding: '4px 10px', 
                            borderRadius: '6px', 
                            fontWeight: 'bold',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            width: 'fit-content'
                          }}>
                            {isLow && <AlertTriangle size={13} />}
                            {p.stock} دانە
                          </span>
                          {boxCount !== null && (
                            <small style={{ color: '#38bdf8', fontSize: '0.74rem', fontWeight: 'bold' }}>
                              ≈ {boxCount} کارتۆن
                            </small>
                          )}
                          {isLow && (
                            <small style={{ color: '#ef4444', fontSize: '0.72rem', fontWeight: 'bold' }}>بەرەو تەواوبوون</small>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {(() => {
                      if (!p.expiry_date) return <span style={{ color: '#64748b' }}>-</span>;
                      const now = new Date();
                      now.setHours(0,0,0,0);
                      const exp = new Date(p.expiry_date);
                      exp.setHours(0,0,0,0);
                      const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
                      const dateStr = p.expiry_date.split('T')[0];
                      if (diff < 0) {
                        return (
                          <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            ❌ بەسەرچووە ({dateStr})
                          </span>
                        );
                      } else if (diff <= 30) {
                        return (
                          <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            ⏳ {diff} ڕۆژ ماوە ({dateStr})
                          </span>
                        );
                      } else {
                        return (
                          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                            {dateStr}
                          </span>
                        );
                      }
                    })()}
                  </td>
                  <td style={{ padding: '16px 20px', display: 'flex', gap: '8px' }}>
                    {/* FIFO Batches Button */}
                    <button 
                      title="وەجبەکانی FIFO و تێچوون" 
                      onClick={() => openBatchesModal(p)} 
                      style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Layers size={16} /> وەجبەکان
                    </button>
                    {/* Print Barcode Label Button */}
                    <button 
                      title="چاپی لەزگەی بارکۆد" 
                      onClick={() => openPrintModal(p)} 
                      style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                    >
                      <Printer size={16} /> چاپ
                    </button>
                    {/* Edit Button */}
                    <button 
                      title="دەستکاریکردن"
                      onClick={() => openEditModal(p)} 
                      style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Edit2 size={16} />
                    </button>
                    {/* Delete Button (Admin Only) */}
                    {isAdmin && (
                      <button 
                        title="سڕینەوە"
                        onClick={() => handleDelete(p.id)} 
                        style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="pos-modal-card pos-modal-lg" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                <Tag color="var(--accent-color)" />
                {editId ? 'دەستکاریکردنی کاڵا' : 'زیادکردنی کاڵای نوێ'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18}/>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="responsive-grid-2">
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>ناوی کاڵا <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>کەتەگۆری</label>
                  <select 
                    value={formData.category_id} 
                    onChange={e => setFormData({ ...formData, category_id: e.target.value })} 
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="">هەڵبژێرە...</option>
                    {categories.map(c => <option key={c.id} value={c.id} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                  بارکۆد (Barcode) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    required 
                    placeholder="بارکۆد بنووسە یان سکانی بکە..."
                    value={formData.barcode} 
                    onChange={e => setFormData({ ...formData, barcode: e.target.value })} 
                    style={{ flex: '1 1 200px', minWidth: '150px', padding: '12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '1px' }} 
                  />
                  <button 
                    type="button" 
                    onClick={generateBarcode} 
                    style={{ background: 'rgba(37, 99, 235, 0.12)', color: 'var(--accent-color)', border: '1px solid rgba(37, 99, 235, 0.3)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', flexShrink: 0 }}
                  >
                    <Barcode size={18} /> دروستکردنی بارکۆد
                  </button>
                </div>
                <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  ئەگەر کاڵاکە بارکۆدی نییە، کلیک لەسەر «دروستکردنی بارکۆد» بکە بۆ دروستکردنی بارکۆدی ١٢ ژمارەیی.
                </small>
              </div>

              {/* Pricing Section (Iraqi Dinar Only) */}
              <div style={{ background: 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Coins size={18} color="#10b981" /> دیاریکردنی نرخەکان (دیناری عێراقی)
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>نرخی کڕین (دینار)</label>
                    <input 
                      type="number" 
                      step="250"
                      min="0"
                      placeholder="0"
                      value={formData.cost_price} 
                      onChange={e => setFormData({ ...formData, cost_price: e.target.value })} 
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }} 
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#059669', fontWeight: 'bold' }}>نرخی فرۆشتنی تاک (دینار) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input 
                      type="number" 
                      step="250"
                      min="0"
                      required 
                      value={formData.selling_price} 
                      onChange={e => setFormData({ ...formData, selling_price: e.target.value })} 
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1.5px solid rgba(16, 185, 129, 0.4)', color: '#059669', fontWeight: 'bold' }} 
                    />
                  </div>
                </div>
              </div>

              {/* Packaging & Wholesale / Carton Section */}
              <div style={{ background: 'rgba(2, 132, 199, 0.06)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(2, 132, 199, 0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Package size={18} color="#0284c7" /> فرۆشتنی فرە-جۆر / کارتۆن و سێت (Wholesale / Box)
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.88rem' }}>
                      بارکۆدی کارتۆن (Box Barcode)
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="بارکۆدی سەر کارتۆن..."
                        value={formData.box_barcode} 
                        onChange={e => setFormData({ ...formData, box_barcode: e.target.value })} 
                        style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1.5px solid rgba(2, 132, 199, 0.35)', color: '#0284c7', fontFamily: 'monospace' }} 
                      />
                      <button 
                        type="button" 
                        onClick={generateBoxBarcode} 
                        title="دروستکردنی بارکۆدی کارتۆن"
                        style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.35)', padding: '0 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold' }}
                      >
                        ⚡ دروستکردن
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      ژمارەی دانە لە کارتۆندا
                    </label>
                    <input 
                      type="number" 
                      min="1"
                      step="any"
                      placeholder="بۆ نموونە: 24"
                      value={formData.units_per_box} 
                      onChange={e => setFormData({ ...formData, units_per_box: e.target.value })} 
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1.5px solid rgba(2, 132, 199, 0.35)', color: 'var(--text-primary)', fontWeight: 'bold' }} 
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#0284c7', fontWeight: 'bold', fontSize: '0.88rem' }}>
                      نرخی فرۆشتنی کارتۆن (دینار)
                    </label>
                    <input 
                      type="number" 
                      step="250"
                      min="0"
                      placeholder="0"
                      value={formData.wholesale_price} 
                      onChange={e => setFormData({ ...formData, wholesale_price: e.target.value })} 
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.35)', color: '#0284c7', fontWeight: 'bold' }} 
                    />
                  </div>
                </div>

                <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', lineHeight: '1.4' }}>
                  💡 گەر کڕیار بە کارتۆن بیکڕێت، سیستەم ڕاستەوخۆ نرخی کارتۆن حیساب دەکات و بەپێی ژمارەی دانەکان لە کۆگا کەمی دەکاتەوە.
                </small>
              </div>

              {/* Stock and Expiry Section */}
              <div style={{ background: 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>دانە لە کۆگا</label>
                    <input 
                      type="number" 
                      placeholder="0"
                      value={formData.stock} 
                      onChange={e => setFormData({ ...formData, stock: e.target.value })} 
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }} 
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d97706' }}>ئاگاداری کەمبوونەوە لە</label>
                    <input 
                      type="number" 
                      placeholder="5"
                      value={formData.low_stock_threshold} 
                      onChange={e => setFormData({ ...formData, low_stock_threshold: e.target.value })} 
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }} 
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ef4444' }}>بەرواری بەسەرچوون</label>
                    <input 
                      type="date" 
                      value={formData.expiry_date} 
                      onChange={e => setFormData({ ...formData, expiry_date: e.target.value })} 
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)' }} 
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                style={{ marginTop: '0.5rem', width: '100%', padding: '15px', borderRadius: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(59,130,246,0.4)' }}
              >
                پاشەکەوتکردن
              </button>
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
                <BarcodeSVG value={printProduct.barcode} width={220} height={60} />
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
              <BarcodeSVG value={printProduct.barcode} width={160} height={46} />
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
                              {Number(batch.cost_price).toLocaleString()} د.ع
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

    </div>
  );
};

export default Products;
