import React from 'react';
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
    Settings as SettingsIcon
} from 'lucide-react';
import './Home.css';

const modules = [
  { id: 'cashier', path: '/cashier', label: 'کاشێر', icon: <ShoppingCart size={32} />, color: '#3b82f6', desc: 'خاڵی فرۆشتن و پسووڵە' },
  { id: 'promotions', path: '/promotions', label: 'ئۆفەر و داشکاندن', icon: <Tag size={32} />, color: '#a855f7', desc: 'ئۆفەری کاتی و داشکاندنی بە سنوور' },
  { id: 'shifts', path: '/shifts', label: 'قاسە و داخستنی شیفت', icon: <Lock size={32} />, color: '#10b981', desc: 'چاودێری قاسە و دەرکردنی Z-Report' },
  { id: 'returns', path: '/returns', label: 'گەڕاندنەوەی کاڵا', icon: <RotateCcw size={32} />, color: '#f43f5e', desc: 'گەڕاندنەوە لە کڕیار و دانەوەی پارە' },
  { id: 'products', path: '/products', label: 'کاڵاکان', icon: <Package size={32} />, color: '#8b5cf6', desc: 'بەڕێوەبردنی کۆگا و نرخەکان' },
  { id: 'owes', path: '/owes', label: 'قەرزەکان', icon: <Users size={32} />, color: '#ef4444', desc: 'قەرزی کڕیارەکان و وەرگرتن' },
  { id: 'this-month', path: '/this-month', label: 'ئەم مانگە', icon: <TrendingUp size={32} />, color: '#059669', desc: 'ئاماری فرۆشتنی مانگانە' },
  { id: 'expenses', path: '/expenses', label: 'خەرجییەکان', icon: <Wallet size={32} />, color: '#fb7185', desc: 'مەساریف و تێچووەکانی مارکێت' },
  { id: 'total-sales', path: '/total-sales', label: 'کۆی فرۆشتن', icon: <BarChart3 size={32} />, color: '#ec4899', desc: 'شیکاری فرۆشتنی مانگانە و کاتژمێری' },
  { id: 'needs', path: '/needs', label: 'پێداویستیەکان', icon: <ClipboardList size={32} />, color: '#f59e0b', desc: 'لیستی کڕینی پێداویستی' },
  { id: 'financials', path: '/financials', label: 'کۆمپانیاکان', icon: <Building2 size={32} />, color: '#06b6d4', desc: 'ژمێریاری دابینکەران و گەڕاندنەوە' },
  { id: 'purchases', path: '/purchases', label: 'پسووڵەی کڕین', icon: <FileText size={32} />, color: '#f43f5e', desc: 'تۆمارکردنی کاڵای نوێ' },
  { id: 'history', path: '/history', label: 'مێژووی فرۆشتن', icon: <History size={32} />, color: '#64748b', desc: 'گەڕان بەدوای پسووڵەکان' },
  { id: 'settings', path: '/settings', label: 'ڕێکخستنەکان', icon: <SettingsIcon size={32} />, color: '#94a3b8', desc: 'ڕووکار و زمانی سیستەم' },
];

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>سیستەمی زیرەکی بەڕێوەبردنی مارکێت</h1>
        <p>تکایە بەشێک هەڵبژێرە بۆ دەستپێکردن</p>
      </div>
      
      <div className="modules-grid">
        {modules.map((mod) => (
          <button 
            key={mod.id} 
            className="module-card" 
            onClick={() => navigate(mod.path)}
            style={{ '--module-color': mod.color }}
          >
            <div className="module-icon-wrapper">
                <div className="module-icon">{mod.icon}</div>
            </div>
            <div className="module-content">
                <h2>{mod.label}</h2>
                <p>{mod.desc}</p>
            </div>
            <div className="module-glow"></div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Home;
