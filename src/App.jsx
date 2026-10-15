import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
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
import Promotions from './pages/Promotions';
import SalesHistory from './pages/SalesHistory';
import TotalSales from './pages/TotalSales';
import Settings from './pages/Settings';
import './Layout.css'; // Keep if you have global styles

// PageWrapper adds a back button to all pages except Home
const PageWrapper = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/') {
    return children;
  }

  return (
    <div className="page-wrapper">
      <nav className="back-nav">
        <button className="btn-back" onClick={() => navigate('/')}>
          <ArrowRight size={20} />
          گەڕانەوە بۆ سەرەکی
        </button>
      </nav>
      <main className="page-content">
        {children}
      </main>
    </div>
  );
};

function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('pos_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (savedTheme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
  }, []);
  return (
    <PageWrapper>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cashier" element={<Cashier />} />
        <Route path="/products" element={<Products />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/owes" element={<Owes />} />
        <Route path="/this-month" element={<ThisMonth />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/shifts" element={<CashDrawer />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/needs" element={<Needs />} />
        <Route path="/financials" element={<Financials />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/history" element={<SalesHistory />} />
        <Route path="/total-sales" element={<TotalSales />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </PageWrapper>
  );
}

export default App;
