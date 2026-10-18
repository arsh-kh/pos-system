import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ShoppingCart, 
    Package, 
    Users, 
    FileText, 
    TrendingUp, 
    ClipboardList,
    Building2,
    History,
    BarChart3,
    Wallet,
    Lock,
    RotateCcw,
    Tag,
    ShieldCheck,
    PackageX,
    Truck,
    ClipboardCheck,
    Search,
    X,
    Settings as SettingsIcon,
    ArrowLeft,
    Sparkles,
    LayoutGrid
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import './Home.css';

const allModules = [
  // 1. فرۆشتن و کاشێر
  { id: 'cashier', category: 'pos', path: '/cashier', label: 'کاشێر', icon: <ShoppingCart size={28} />, color: '#2563eb', desc: 'خاڵی فرۆشتن، سکانی بارکۆد و پسووڵە' },
  { id: 'shifts', category: 'pos', path: '/shifts', label: 'قاسە و شیفت', icon: <Lock size={28} />, color: '#059669', desc: 'چاودێری باڵانسی قاسە و داخستنی شیفت' },
  { id: 'owes', category: 'pos', path: '/owes', label: 'قەرزەکان', icon: <Users size={28} />, color: '#dc2626', desc: 'قەرزی کڕیاران و وەرگرتنەوەی قیست' },
  { id: 'returns', category: 'pos', path: '/returns', label: 'گەڕاندنەوەی کاڵا', icon: <RotateCcw size={28} />, color: '#e11d48', desc: 'گەڕاندنەوە لە کڕیار و دانەوەی پارە' },

  // 2. کۆگا و کاڵاکان
  { id: 'products', category: 'inventory', path: '/products', label: 'کاڵاکان', icon: <Package size={28} />, color: '#0284c7', desc: 'مەخزەن، نرخەکان و خوێندنەوەی بارکۆد' },
  { id: 'promotions', category: 'inventory', path: '/promotions', label: 'ئۆفەر و داشکاندن', icon: <Tag size={28} />, color: '#d97706', desc: 'داشکاندن و ئۆفەری کاتی' },
  { id: 'purchases', category: 'inventory', path: '/purchases', label: 'پسووڵەی کڕین', icon: <FileText size={28} />, color: '#ea580c', desc: 'تۆمارکردنی کڕین لە کۆمپانیا' },
  { id: 'inventory-audit', category: 'inventory', path: '/inventory-audit', label: 'جەردکردنی کۆگا', icon: <ClipboardCheck size={28} />, color: '#0d9488', desc: 'پشکنینی مەخزەن و دۆزینەوەی نوقسانی' },
  { id: 'needs', category: 'inventory', path: '/needs', label: 'پێداویستیەکان', icon: <ClipboardList size={28} />, color: '#d97706', desc: 'لیستی کاڵا کەمبووەوەکانی مارکێت' },
  { id: 'wastage', category: 'inventory', path: '/wastage', label: 'زیان و فەوتان', icon: <PackageX size={28} />, color: '#b91c1c', desc: 'کاڵای بەسەرچوو و شکاو' },
  { id: 'vendor-returns', category: 'inventory', path: '/vendor-returns', label: 'گەڕاندنەوە بۆ کۆمپانیا', icon: <Truck size={28} />, color: '#0284c7', desc: 'گەڕاندنەوەی کاڵا بۆ مەندوب' },

  // 3. بەڕێوەبردن و دارایی (تایبەت بە ئەدمین)
  { id: 'financials', category: 'management', path: '/financials', label: 'کۆمپانیا و قازانج', icon: <Building2 size={28} />, color: '#0891b2', desc: 'حسابی دابینکەران و قازانجی پوخت', adminOnly: true },
  { id: 'this-month', category: 'management', path: '/this-month', label: 'ئەم مانگە', icon: <TrendingUp size={28} />, color: '#16a34a', desc: 'ئامار و ڕاپۆرتی فرۆشتنی مانگانە', adminOnly: true },
  { id: 'total-sales', category: 'management', path: '/total-sales', label: 'کۆی فرۆشتن', icon: <BarChart3 size={28} />, color: '#0f766e', desc: 'شیکاری فرۆشتنی ڕۆژانە', adminOnly: true },
  { id: 'history', category: 'management', path: '/history', label: 'مێژووی فرۆشتن', icon: <History size={28} />, color: '#475569', desc: 'گەڕان بەدوای پسووڵەکانی پێشوو', adminOnly: true },
  { id: 'expenses', category: 'management', path: '/expenses', label: 'خەرجییەکان', icon: <Wallet size={28} />, color: '#e11d48', desc: 'تێچوو و خەرجییەکانی مارکێت', adminOnly: true },
  { id: 'settings', category: 'management', path: '/settings', label: 'ڕێکخستنەکان', icon: <SettingsIcon size={28} />, color: '#64748b', desc: 'ڕێکخستنی سیستەم و باکئەپ', adminOnly: true },
  { id: 'audit-logs', category: 'management', path: '/audit-logs', label: 'چاودێری چالاکییەکان', icon: <ShieldCheck size={28} />, color: '#334155', desc: 'تۆماری دەستکاریی کارمەندان', adminOnly: true },
];

const categoryLabels = {
  pos: { title: '🛒 فرۆشتن و قاسەی ڕۆژانە', desc: 'خاڵی سەرەکی کاشێر و مامەڵەی فرۆشتن' },
  inventory: { title: '📦 کۆگا و کاڵاکان', desc: 'بەڕێوەبردنی مەخزەن، بارکۆد و کڕین' },
  management: { title: '📊 بەڕێوەبردن و دارایی (ئەدمین)', desc: 'قازانج، ڕاپۆرتەکان و پاراستنی داتا' }
};

const Home = () => {
  const navigate = useNavigate();
  const { isAdmin, setIsSwitchModalOpen } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const handleCardClick = (mod) => {
    if (mod.adminOnly && !isAdmin) {
      alert('ئەم بەشە تایبەتە بە بەڕێوەبەر (Admin). تکایە لە شریتی سەرەوە بە هەژماری ئەدمین بچۆ ژوورەوە.');
      setIsSwitchModalOpen(true);
      return;
    }
    navigate(mod.path);
  };

  // Cashiers only see POS + Products (for stock/price lookup)
  const visibleModules = allModules.filter(m => {
    if (!isAdmin && m.category === 'management') return false;
    if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
    return true;
  });

  const filteredModules = visibleModules.filter(m => 
    kurdishSearchMatch([m.label, m.desc], searchQuery)
  );

  return (
    <div className="home-container">
      {/* Prominent Hero Cashier Launcher */}
      <div 
        onClick={() => navigate('/cashier')}
        style={{
          width: '100%',
          maxWidth: '920px',
          background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
          borderRadius: '24px',
          padding: '1.5rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#ffffff',
          cursor: 'pointer',
          boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)',
          marginBottom: '1.8rem',
          transition: 'all 0.2s ease',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShoppingCart size={34} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '9999px', background: 'rgba(255,255,255,0.2)', fontSize: '0.78rem', fontWeight: 'bold', marginBottom: '4px' }}>
              <Sparkles size={13} /> دەستپێکردنی خێرا (POS)
            </div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
              کردنەوەی شاشەی کاشێر و فرۆشتن
            </h2>
            <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.9rem' }}>
              سکانی بارکۆد بە کەرتە چرکەیەک، پڕکردنی سەلە، و دەرکردنی پسووڵەی کڕیار
            </p>
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#ffffff',
          color: '#1e3a8a',
          padding: '10px 18px',
          borderRadius: '14px',
          fontWeight: 'bold',
          fontSize: '0.95rem'
        }}>
          <span>دەستپێکردن</span>
          <ArrowLeft size={18} />
        </div>
      </div>

      {/* Instant Search Bar & Category Filter */}
      <div style={{ width: '100%', maxWidth: '920px', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.8rem' }}>
        <div className="home-search-wrapper" style={{ maxWidth: '100%', margin: 0 }}>
          <Search size={18} className="search-icon" />
          <input 
            type="text"
            placeholder="گەڕانی خێرا لە بەشەکاندا (کاشێر، کۆگا، قەرز، جەرد، خەرجی...)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="home-search-input"
          />
          {searchQuery && (
            <button 
              type="button" 
              onClick={() => setSearchQuery('')}
              className="search-clear-btn"
              title="سڕینەوەی گەڕان"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Clean Category Tabs for Admin */}
        {isAdmin && !searchQuery && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                border: 'none',
                background: selectedCategory === 'all' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 'bold',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              هەموو بەشەکان ({allModules.length})
            </button>
            <button
              onClick={() => setSelectedCategory('pos')}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                border: 'none',
                background: selectedCategory === 'pos' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: selectedCategory === 'pos' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 'bold',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              🛒 فرۆشتن و قاسە
            </button>
            <button
              onClick={() => setSelectedCategory('inventory')}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                border: 'none',
                background: selectedCategory === 'inventory' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: selectedCategory === 'inventory' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 'bold',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              📦 کۆگا و کاڵاکان
            </button>
            <button
              onClick={() => setSelectedCategory('management')}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                border: 'none',
                background: selectedCategory === 'management' ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: selectedCategory === 'management' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 'bold',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              📊 ڕاپۆرت و بەڕێوەبردن
            </button>
          </div>
        )}
      </div>
      
      {/* Cards Grid */}
      <div className="modules-grid" style={{ width: '100%', maxWidth: '920px' }}>
        {filteredModules.map((mod) => {
          const isLocked = mod.adminOnly && !isAdmin;

          return (
            <button 
              key={mod.id} 
              className={`module-card ${isLocked ? 'is-locked' : ''}`}
              onClick={() => handleCardClick(mod)}
            >
              {isLocked && (
                <span className="admin-lock-badge">
                  <Lock size={12} />
                  <span>تەنها ئەدمین</span>
                </span>
              )}

              <div className="module-icon-box" style={{ color: mod.color, background: `${mod.color}15` }}>
                {mod.icon}
              </div>

              <div className="module-content">
                <h2>{mod.label}</h2>
                <p>{mod.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {filteredModules.length === 0 && (
        <div className="no-modules-found">
          <p>هیچ بەشێک نەدۆزرایەوە بە ناوی "<strong>{searchQuery}</strong>"</p>
          <button onClick={() => setSearchQuery('')} className="btn-secondary">
            پیشاندانی هەموو بەشەکان
          </button>
        </div>
      )}
    </div>
  );
};

export default Home;
