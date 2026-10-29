import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import UserBar from './components/UserBar';

import Home from './pages/Home';
import Cashier from './pages/Cashier';
import ThisMonth from './pages/ThisMonth';
import Products from './pages/Products';
import Owes from './pages/Owes';
import Needs from './pages/Needs';
import Financials from './pages/Financials';
import Purchases from './pages/Purchases';
import Expenses from './pages/Expenses';
import CashDrawer from './pages/CashDrawer';
import Returns from './pages/Returns';
import Wastage from './pages/Wastage';
import VendorReturns from './pages/VendorReturns';
import InventoryAudit from './pages/InventoryAudit';
import Promotions from './pages/Promotions';
import SalesHistory from './pages/SalesHistory';
import TotalSales from './pages/TotalSales';
import Settings from './pages/Settings';
import AuditLogs from './pages/AuditLogs';
import Login from './pages/Login';
import './Layout.css';

// PageWrapper adds back nav and top user status bar
const PageWrapper = ({ children }) => {
  const location = useLocation();
  const isCashier = location.pathname === '/cashier';
  const isHome = location.pathname === '/';

  if (isCashier) {
    return (
      <div className="page-wrapper cashier-wrapper" style={{ height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
        {children}
      </div>
    );
  }

  const isPurchases = location.pathname === '/purchases';

  if (isHome || isPurchases) {
    return (
      <div className={`page-wrapper ${isHome ? 'home-wrapper' : 'purchases-wrapper'}`} style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
        <UserBar />
        <main className="page-content" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      <UserBar />
      <main className="page-content" style={{ flex: 1 }}>
        {children}
      </main>
    </div>
  );
};

function AppContent() {
  const { currentUser } = useAuth();

  useEffect(() => {
    const savedTheme = localStorage.getItem('pos_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (savedTheme === 'light') {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    } else {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    }
  }, []);

  // Mandatory Authentication: If no user is logged in, show Login page!
  if (!currentUser) {
    return <Login />;
  }

  return (
    <PageWrapper>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cashier" element={<Cashier />} />
        <Route path="/products" element={<Products />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/owes" element={<Owes />} />
        <Route path="/this-month" element={<ThisMonth />} />
        <Route path="/reports" element={<ThisMonth />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/shifts" element={<CashDrawer />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/wastage" element={<Wastage />} />
        <Route path="/vendor-returns" element={<VendorReturns />} />
        <Route path="/inventory-audit" element={<InventoryAudit />} />
        <Route path="/needs" element={<Needs />} />
        <Route path="/financials" element={<Financials />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/history" element={<SalesHistory />} />
        <Route path="/total-sales" element={<TotalSales />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
      </Routes>
    </PageWrapper>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
