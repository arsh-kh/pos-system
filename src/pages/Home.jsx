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
    ShieldCheck,
    Settings as SettingsIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
  { id: 'purchases', path: '/purchases', label: 'پسووڵەی کڕین', icon: <FileText size={32} />, color: '#f43f5e', desc: 'تۆمارکردنی کاڵای نوێ' },
  { id: 'history', path: '/history', label: 'مێژووی فرۆشتن', icon: <History size={32} />, color: '#64748b', desc: 'گەڕان بەدوای پسووڵەکان' },
  { id: 'audit-logs', path: '/audit-logs', label: 'چاودێری و لۆگەکان', icon: <ShieldCheck size={32} />, color: '#a855f7', desc: 'تۆماری گۆڕانکارییەکان بۆ ئەدمین', adminOnly: true },
  { id: 'financials', path: '/financials', label: 'کۆمپانیاکان و قازانج', icon: <Building2 size={32} />, color: '#06b6d4', desc: 'قازانجی پوخت و دابینکەران', adminOnly: true },
  { id: 'settings', path: '/settings', label: 'ڕێکخستنەکان', icon: <SettingsIcon size={32} />, color: '#94a3b8', desc: 'ڕووکار و بەکارهێنەران', adminOnly: true },
];

const Home = () => {
  const navigate = useNavigate();
  const { isAdmin, setIsSwitchModalOpen } = useAuth();

  const handleCardClick = (mod) => {
    if (mod.adminOnly && !isAdmin) {
      alert('⚠️ ئەم بەشە تایبەتە بە بەڕێوەبەر (Admin). تکایە لە شریتی سەرەوە بە هەژماری ئەدمین بچۆ ژوورەوە.');
      setIsSwitchModalOpen(true);
      return;
    }
    navigate(mod.path);
  };

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>سیستەمی زیرەکی بەڕێوەبردنی مارکێت</h1>
        <p>تکایە بەشێک هەڵبژێرە بۆ دەستپێکردن</p>
      </div>
      
      <div className="modules-grid">
        {modules.map((mod) => {
          const isLocked = mod.adminOnly && !isAdmin;

          return (
            <button 
              key={mod.id} 
              className="module-card" 
              onClick={() => handleCardClick(mod)}
              style={{ 
                '--module-color': mod.color,
                opacity: isLocked ? 0.75 : 1,
                border: isLocked ? '1px dashed rgba(245, 158, 11, 0.4)' : undefined,
                position: 'relative'
              }}
            >
              {isLocked && (
                <span 
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: 'rgba(239, 68, 68, 0.25)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  🔒 تەنها ئەدمین
                </span>
              )}

              <div className="module-icon-wrapper">
                  <div className="module-icon">{mod.icon}</div>
              </div>
              <div className="module-content">
                  <h2>{mod.label}</h2>
                  <p>{mod.desc}</p>
              </div>
              <div className="module-glow"></div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Home;
