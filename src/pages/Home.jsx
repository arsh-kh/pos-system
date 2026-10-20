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
  // 1. فرۆشتن و کاشێر (Category POS - Royal Blue #2563eb)
  { id: 'cashier', permissionKey: 'pos_cashier', category: 'pos', path: '/cashier', label: 'شاشەی کاشێر و فرۆشتن', icon: <ShoppingCart size={28} />, color: '#2563eb', desc: 'خاڵی سەرەکی فرۆشتن، سکانی بارکۆد و پسووڵە' },
  { id: 'shifts', permissionKey: 'pos_shifts', category: 'pos', path: '/shifts', label: 'قاسە و شیفتەکان', icon: <Lock size={28} />, color: '#2563eb', desc: 'چاودێری باڵانسی قاسە و داخستنی شیفت' },
  { id: 'returns', permissionKey: 'pos_returns', category: 'pos', path: '/returns', label: 'گەڕاندنەوەی کاڵا', icon: <RotateCcw size={28} />, color: '#2563eb', desc: 'گەڕاندنەوە لە کڕیار و دانەوەی پارە' },
  { id: 'owes', permissionKey: 'pos_owes', category: 'pos', path: '/owes', label: 'قەرزی کڕیاران', icon: <Users size={28} />, color: '#ea580c', desc: 'قەرزی کڕیاران و وەرگرتنەوەی قیست' },

  // 2. کۆگا و کاڵاکان (Category Inventory - Sky Blue #0284c7)
  { id: 'products', permissionKey: 'inv_products', category: 'inventory', path: '/products', label: 'کاڵاکان و مەخزەن', icon: <Package size={28} />, color: '#0284c7', desc: 'مەخزەن، نرخەکان و خوێندنەوەی بارکۆد' },
  { id: 'needs', permissionKey: 'inv_needs', category: 'inventory', path: '/needs', label: 'پێداویستییە کەمبووەکان', icon: <ClipboardList size={28} />, color: '#0284c7', desc: 'لیستی کاڵا کەمبووەوەکانی مارکێت' },
  { id: 'promotions', permissionKey: 'inv_promotions', category: 'inventory', path: '/promotions', label: 'ئۆفەر و داشکاندن', icon: <Tag size={28} />, color: '#0284c7', desc: 'داشکاندن و ئۆفەری کاتی بۆ فرۆشتن' },
  { id: 'purchases', permissionKey: 'inv_purchases', category: 'inventory', path: '/purchases', label: 'پسووڵەی کڕین لە کۆمپانیا', icon: <FileText size={28} />, color: '#0284c7', desc: 'تۆمارکردنی کڕین لە دابینکەران' },
  { id: 'inventory-audit', permissionKey: 'inv_audit', category: 'inventory', path: '/inventory-audit', label: 'جەردکردنی کۆگا', icon: <ClipboardCheck size={28} />, color: '#0284c7', desc: 'پشکنینی مەخزەن و دۆزینەوەی نوقسانی' },
  { id: 'vendor-returns', permissionKey: 'inv_vendor_returns', category: 'inventory', path: '/vendor-returns', label: 'گەڕاندنەوە بۆ کۆمپانیا', icon: <Truck size={28} />, color: '#0284c7', desc: 'گەڕاندنەوەی کاڵا بۆ مەندوب (RTV)' },
  { id: 'wastage', permissionKey: 'inv_wastage', category: 'inventory', path: '/wastage', label: 'زیان و فەوتانی کاڵا', icon: <PackageX size={28} />, color: '#b91c1c', desc: 'تۆمارکردنی کاڵای بەسەرچوو و شکاو' },

  // 3. بەڕێوەبردن و دارایی (Category Management - Indigo #6366f1)
  { id: 'financials', category: 'management', path: '/financials', label: 'کۆمپانیا و قازانجی پوخت', icon: <Building2 size={28} />, color: '#6366f1', desc: 'حسابی دابینکەران و قازانجی پوخت', adminOnly: true },
  { id: 'this-month', category: 'management', path: '/this-month', label: 'ڕاپۆرتە گشتییەکان (ڕۆژ، هەفتە، مانگ، ساڵ)', icon: <TrendingUp size={28} />, color: '#6366f1', desc: 'شیکاری فرۆشتن بەپێی ڕۆژ، هەفتە، مانگ، ساڵ و ماوەی دیاریکراو', adminOnly: true },
  { id: 'total-sales', category: 'management', path: '/total-sales', label: 'کۆی فرۆشتنی گشتی', icon: <BarChart3 size={28} />, color: '#6366f1', desc: 'شیکاری فرۆشتنی ڕۆژانە بە ژمارە', adminOnly: true },
  { id: 'history', permissionKey: 'mgmt_history', category: 'management', path: '/history', label: 'مێژووی فرۆشتنە کۆنەکان', icon: <History size={28} />, color: '#6366f1', desc: 'گەڕان بەدوای پسووڵەکانی پێشوو' },
  { id: 'expenses', permissionKey: 'mgmt_expenses', category: 'management', path: '/expenses', label: 'خەرجییەکانی مارکێت', icon: <Wallet size={28} />, color: '#b91c1c', desc: 'تێچوو و خەرجییەکانی مارکێت' },
  { id: 'settings', category: 'management', path: '/settings', label: 'ڕێکخستن و دەسەڵاتەکان', icon: <SettingsIcon size={28} />, color: '#6366f1', desc: 'دەسەڵاتی کاشێر و پاراستنی داتا', adminOnly: true },
  { id: 'audit-logs', category: 'management', path: '/audit-logs', label: 'چاودێری چالاکییەکان', icon: <ShieldCheck size={28} />, color: '#6366f1', desc: 'تۆماری دەستکاریی کارمەندان', adminOnly: true },
];

const categoryLabels = {
  pos: { title: '🛒 فرۆشتن و قاسەی ڕۆژانە', desc: 'خاڵی سەرەکی کاشێر و مامەڵەی فرۆشتن' },
  inventory: { title: '📦 کۆگا و کاڵاکان', desc: 'بەڕێوەبردنی مەخزەن، بارکۆد و کڕین' },
  management: { title: '📊 بەڕێوەبردن و دارایی (ئەدمین)', desc: 'قازانج، ڕاپۆرتەکان و پاراستنی داتا' }
};

const Home = () => {
  const navigate = useNavigate();
  const { isAdmin, setIsSwitchModalOpen, canCashier } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const handleCardClick = (mod) => {
    if (mod.adminOnly && !isAdmin) {
      alert('ئەم بەشە تایبەتە بە بەڕێوەبەر (Admin). تکایە لە شریتی سەرەوە بە هەژماری ئەدمین بچۆ ژوورەوە.');
      setIsSwitchModalOpen(true);
      return;
    }
    if (!isAdmin && mod.permissionKey && !canCashier(mod.permissionKey)) {
      alert(`دەسەڵاتی بینینی بەشی «${mod.label}»ت نییە. پێویستە بەڕێوەبەر لە ڕێکخستنەکاندا ڕێگەت پێبدات.`);
      return;
    }
    navigate(mod.path);
  };

  // Filter modules: Admin sees all, Cashier only sees permitted modules
  const visibleModules = allModules.filter(m => {
    if (!isAdmin) {
      if (m.adminOnly) return false;
      if (m.permissionKey && !canCashier(m.permissionKey)) return false;
    }
    if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
    return true;
  });

  const filteredModules = visibleModules.filter(m => 
    kurdishSearchMatch([m.label, m.desc], searchQuery)
  );

  return (
    <div className="home-container">
      {/* Clean Category Tabs for Admin */}
      {isAdmin && (
        <div style={{ width: '100%', maxWidth: '920px', display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.8rem' }}>
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
