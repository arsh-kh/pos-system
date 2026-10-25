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
    PackageX,
    Truck,
    ClipboardCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Home.css';

const allModules = [
  // ڕیزی ١: فرۆشتن و قاسە (4 دوگمە)
  { id: 'cashier', permissionKey: 'pos_cashier', category: 'pos', path: '/cashier', label: 'شاشەی کاشێر و فرۆشتن', icon: <ShoppingCart size={28} />, color: '#2563eb' },
  { id: 'shifts', permissionKey: 'pos_shifts', category: 'pos', path: '/shifts', label: 'قاسە و شیفتەکان', icon: <Lock size={28} />, color: '#2563eb' },
  { id: 'returns', permissionKey: 'pos_returns', category: 'pos', path: '/returns', label: 'گەڕاندنەوەی کاڵا', icon: <RotateCcw size={28} />, color: '#2563eb' },
  { id: 'owes', permissionKey: 'pos_owes', category: 'pos', path: '/owes', label: 'قەرزی کڕیاران', icon: <Users size={28} />, color: '#ea580c' },

  // ڕیزی ٢: کۆگا و کاڵاکان (4 دوگمە)
  { id: 'products', permissionKey: 'inv_products', category: 'inventory', path: '/products', label: 'کاڵاکان و مەخزەن', icon: <Package size={28} />, color: '#0284c7' },
  { id: 'needs', permissionKey: 'inv_needs', category: 'inventory', path: '/needs', label: 'پێداویستییە کەمبووەکان', icon: <ClipboardList size={28} />, color: '#0284c7' },
  { id: 'promotions', permissionKey: 'inv_promotions', category: 'inventory', path: '/promotions', label: 'ئۆفەر و داشکاندن', icon: <Tag size={28} />, color: '#0284c7' },
  { id: 'purchases', permissionKey: 'inv_purchases', category: 'inventory', path: '/purchases', label: 'پسووڵەی کڕین لە کۆمپانیا', icon: <FileText size={28} />, color: '#0284c7' },

  // ڕیزی ٣: جەرد، جوڵە و خەرجی (4 دوگمە)
  { id: 'inventory-audit', permissionKey: 'inv_audit', category: 'inventory', path: '/inventory-audit', label: 'جەردکردنی کۆگا', icon: <ClipboardCheck size={28} />, color: '#0284c7' },
  { id: 'vendor-returns', permissionKey: 'inv_vendor_returns', category: 'inventory', path: '/vendor-returns', label: 'گەڕاندنەوە بۆ کۆمپانیا', icon: <Truck size={28} />, color: '#0284c7' },
  { id: 'wastage', permissionKey: 'inv_wastage', category: 'inventory', path: '/wastage', label: 'زیان و فەوتانی کاڵا', icon: <PackageX size={28} />, color: '#b91c1c' },
  { id: 'expenses', permissionKey: 'mgmt_expenses', category: 'management', path: '/expenses', label: 'خەرجییەکانی مارکێت', icon: <Wallet size={28} />, color: '#b91c1c' },

  // ڕیزی ٤: بەڕێوەبردن، دارایی و ڕاپۆرتەکان (4 دوگمە)
  { id: 'financials', category: 'management', path: '/financials', label: 'کۆمپانیا و قازانجی پوخت', icon: <Building2 size={28} />, color: '#6366f1', adminOnly: true },
  { id: 'this-month', category: 'management', path: '/this-month', label: 'ڕاپۆرتە گشتییەکان', icon: <TrendingUp size={28} />, color: '#6366f1', adminOnly: true },
  { id: 'total-sales', category: 'management', path: '/total-sales', label: 'کۆی فرۆشتنی گشتی', icon: <BarChart3 size={28} />, color: '#6366f1', adminOnly: true },
  { id: 'history', permissionKey: 'mgmt_history', category: 'management', path: '/history', label: 'مێژووی فرۆشتنە کۆنەکان', icon: <History size={28} />, color: '#6366f1' },
];

const Home = () => {
  const navigate = useNavigate();
  const { isAdmin, setIsSwitchModalOpen, canCashier } = useAuth();

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

  // Filter modules: Admin sees all (16 in 4x4), Cashier only sees permitted modules
  const visibleModules = allModules.filter(m => {
    if (!isAdmin) {
      if (m.adminOnly) return false;
      if (m.permissionKey && !canCashier(m.permissionKey)) return false;
    }
    return true;
  });

  return (
    <div className="home-container">
      <div className="modules-grid">
        {visibleModules.map((mod) => {
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
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Home;
