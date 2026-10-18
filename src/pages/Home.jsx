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
    Settings as SettingsIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import './Home.css';

const modules = [
  { id: 'cashier', path: '/cashier', label: 'کاشێر', icon: <ShoppingCart size={28} />, color: '#2563eb', desc: 'خاڵی فرۆشتن و دەرکردنی پسووڵە' },
  { id: 'products', path: '/products', label: 'کاڵاکان', icon: <Package size={28} />, color: '#0284c7', desc: 'بەڕێوەبردنی کۆگا و نرخەکان' },
  { id: 'owes', path: '/owes', label: 'قەرزەکان', icon: <Users size={28} />, color: '#dc2626', desc: 'قەرزی کڕیاران و وەرگرتنەوە' },
  { id: 'shifts', path: '/shifts', label: 'قاسە و شیفت', icon: <Lock size={28} />, color: '#059669', desc: 'چاودێری قاسە و داخستنی ڕۆژانە' },
  { id: 'returns', path: '/returns', label: 'گەڕاندنەوەی کاڵا', icon: <RotateCcw size={28} />, color: '#e11d48', desc: 'گەڕاندنەوە لە کڕیار و دانەوەی پارە' },
  { id: 'promotions', path: '/promotions', label: 'ئۆفەر و داشکاندن', icon: <Tag size={28} />, color: '#d97706', desc: 'ئۆفەری کاتی و داشکاندنی دیاریکراو' },
  { id: 'inventory-audit', path: '/inventory-audit', label: 'جەردکردنی کۆگا', icon: <ClipboardCheck size={28} />, color: '#0d9488', desc: 'سکانی ڕەفەکان و دۆزینەوەی نوقسانی' },
  { id: 'vendor-returns', path: '/vendor-returns', label: 'گەڕاندنەوە بۆ کۆمپانیا', icon: <Truck size={28} />, color: '#0284c7', desc: 'گەڕاندنەوە بۆ مەندوب و لێدەرکردنی قەرز' },
  { id: 'wastage', path: '/wastage', label: 'زیان و فەوتان', icon: <PackageX size={28} />, color: '#b91c1c', desc: 'تۆمارکردنی کاڵای بەسەرچوو و شکاو' },
  { id: 'purchases', path: '/purchases', label: 'پسووڵەی کڕین', icon: <FileText size={28} />, color: '#ea580c', desc: 'تۆمارکردنی پسووڵەی کڕینی نوێ' },
  { id: 'needs', path: '/needs', label: 'پێداویستیەکان', icon: <ClipboardList size={28} />, color: '#d97706', desc: 'لیستی کاڵا کەمبووەوەکانی مارکێت' },
  { id: 'expenses', path: '/expenses', label: 'خەرجییەکان', icon: <Wallet size={28} />, color: '#e11d48', desc: 'خەرجی و تێچووەکانی فرۆشگا' },
  { id: 'this-month', path: '/this-month', label: 'ئەم مانگە', icon: <TrendingUp size={28} />, color: '#16a34a', desc: 'ئامار و داتای فرۆشتنی مانگانە' },
  { id: 'total-sales', path: '/total-sales', label: 'کۆی فرۆشتن', icon: <BarChart3 size={28} />, color: '#0f766e', desc: 'شیکاری فرۆشتنی کاتژمێری و ڕۆژانە' },
  { id: 'history', path: '/history', label: 'مێژووی فرۆشتن', icon: <History size={28} />, color: '#475569', desc: 'گەڕان بەدوای پسووڵەکانی پێشوو' },
  { id: 'financials', path: '/financials', label: 'کۆمپانیا و قازانج', icon: <Building2 size={28} />, color: '#0891b2', desc: 'حسابی دابینکەران و قازانجی پوخت', adminOnly: true },
  { id: 'audit-logs', path: '/audit-logs', label: 'چاودێری و لۆگەکان', icon: <ShieldCheck size={28} />, color: '#334155', desc: 'تۆماری تەواوی کردارەکانی بەکارهێنەران', adminOnly: true },
  { id: 'settings', path: '/settings', label: 'ڕێکخستنەکان', icon: <SettingsIcon size={28} />, color: '#64748b', desc: 'ڕێکخستنی سیستەم و بەکارهێنەران', adminOnly: true },
];

const Home = () => {
  const navigate = useNavigate();
  const { isAdmin, setIsSwitchModalOpen } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const handleCardClick = (mod) => {
    if (mod.adminOnly && !isAdmin) {
      alert('ئەم بەشە تایبەتە بە بەڕێوەبەر (Admin). تکایە لە شریتی سەرەوە بە هەژماری ئەدمین بچۆ ژوورەوە.');
      setIsSwitchModalOpen(true);
      return;
    }
    navigate(mod.path);
  };

  const filteredModules = modules.filter(m => 
    kurdishSearchMatch([m.label, m.desc], searchQuery)
  );

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>سیستەمی بەڕێوەبردنی مارکێت</h1>
        <p>بەشێک هەڵبژێرە یان ناوی بەشەکە بگەڕێ بۆ دەستپێکردن</p>
      </div>

      {/* Instant Search Bar */}
      <div className="home-search-wrapper">
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
      
      <div className="modules-grid">
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
