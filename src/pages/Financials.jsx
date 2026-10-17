import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Search, 
  Plus, 
  X, 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  Phone, 
  FileText, 
  CheckCircle2,
  CreditCard,
  Eye,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const Financials = () => {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('SUPPLIERS'); // 'SUPPLIERS', 'INVOICES', 'RETURNS'
  
  // Modals
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '' });

  // Purchase Return Modal
  const [isAddReturnOpen, setIsAddReturnOpen] = useState(false);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [newReturn, setNewReturn] = useState({
    supplier_id: '',
    product_id: '',
    quantity: '1',
    cost_price: '',
    refund_type: 'DEBT_DEDUCT', // 'DEBT_DEDUCT' or 'CASH_REFUND'
    reason: ''
  });

  // Company Profile Overlay
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [isPayingDebt, setIsPayingDebt] = useState(false);

  // Invoice Details Modal
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [_invoiceLoading, setInvoiceLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [supRes, invRes, retRes, prodRes] = await Promise.all([
        axios.get('http://localhost:3001/api/suppliers'),
        axios.get('http://localhost:3001/api/purchase-invoices'),
        axios.get('http://localhost:3001/api/purchase-returns'),
        axios.get('http://localhost:3001/api/products')
      ]);

      if (supRes.data.status === 'SUCCESS') setSuppliers(supRes.data.data);
      if (invRes.data.status === 'SUCCESS') setAllInvoices(invRes.data.data);
      if (retRes.data.status === 'SUCCESS') setPurchaseReturns(retRes.data.data);
      if (prodRes.data.status === 'SUCCESS') setProducts(prodRes.data.data);
    } catch (err) {
      console.error('Failed to fetch financials data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (window.location.hash.includes('tab=RETURNS')) {
      setActiveTab('RETURNS');
    }
  }, []);

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/api/suppliers', newSupplier);
      setIsAddSupplierOpen(false);
      setNewSupplier({ name: '', phone: '' });
      fetchData();
    } catch {
      alert('هەڵەیەک ڕوویدا لە کاتی زیادکردنی کۆمپانیا');
    }
  };

  const handleProductSelectForReturn = (prodId) => {
    const prod = products.find(p => String(p.id) === String(prodId));
    setNewReturn(prev => ({
      ...prev,
      product_id: prodId,
      cost_price: prod ? (prod.cost_price || 0).toString() : prev.cost_price
    }));
  };

  const handleCreatePurchaseReturn = async (e) => {
    e.preventDefault();
    if (!newReturn.product_id) {
      return alert('تکایە کاڵایەک دیاریبکە');
    }
    const qty = parseFloat(newReturn.quantity);
    const cost = parseFloat(newReturn.cost_price);
    if (!qty || qty <= 0 || isNaN(cost) || cost < 0) {
      return alert('تکایە بڕ و نرخێکی دروست بنووسە');
    }

    setIsSubmittingReturn(true);
    try {
      const res = await axios.post('http://localhost:3001/api/purchase-returns', newReturn);
      if (res.data.status === 'SUCCESS') {
        alert('کاڵاکە بە سەرکەوتوویی بۆ کۆمپانیا گەڕێندرایەوە و لە کۆگا کەمکرایەوە!');
        setIsAddReturnOpen(false);
        setNewReturn({
          supplier_id: '',
          product_id: '',
          quantity: '1',
          cost_price: '',
          refund_type: 'DEBT_DEDUCT',
          reason: ''
        });
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی گەڕاندنەوە');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const openProfile = async (id) => {
    try {
      const res = await axios.get(`http://localhost:3001/api/suppliers/${id}`);
      if (res.data.status === 'SUCCESS') {
        setSelectedProfile(res.data.data);
      }
    } catch {
      alert('هەڵەیەک ڕوویدا لە کاتی کردنەوەی پڕۆفایل');
    }
  };

  const handlePaySupplierDebt = async () => {
    if (!payAmount || isNaN(payAmount) || Number(payAmount) <= 0) {
      return alert('تکایە بڕی پارەی دروست بنووسە');
    }

    setIsPayingDebt(true);
    try {
      const res = await axios.post(`http://localhost:3001/api/suppliers/${selectedProfile.id}/pay`, {
        amount: Number(payAmount)
      });
      if (res.data.status === 'SUCCESS') {
        alert('پارەدان بە سەرکەوتوویی تۆمارکرا');
        setPayAmount('');
        openProfile(selectedProfile.id);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی پارەدان');
    } finally {
      setIsPayingDebt(false);
    }
  };

  const openInvoiceDetails = async (invoiceId) => {
    setInvoiceLoading(true);
    try {
      const res = await axios.get(`http://localhost:3001/api/purchase-invoices/${invoiceId}`);
      if (res.data.status === 'SUCCESS') {
        setSelectedInvoice(res.data.data);
      }
    } catch {
      alert('هەڵەیەک ڕوویدا لە کاتی بارکردنی وردەکاری پسووڵە');
    } finally {
      setInvoiceLoading(false);
    }
  };

  // Aggregated Stats
  const { totalPurchases, totalPaid, totalRemaining, totalReturnsRefund } = useMemo(() => {
    let purchases = 0;
    let paid = 0;
    let remaining = 0;

    suppliers.forEach(s => {
      paid += Number(s.total_paid) || 0;
      remaining += Number(s.total_remaining) || 0;
      purchases += (Number(s.total_paid) || 0) + (Number(s.total_remaining) || 0);
    });

    const refunds = purchaseReturns.reduce((acc, r) => acc + (Number(r.total_refund) || 0), 0);

    return { totalPurchases: purchases, totalPaid: paid, totalRemaining: remaining, totalReturnsRefund: refunds };
  }, [suppliers, purchaseReturns]);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.phone && s.phone.includes(searchTerm))
    );
  }, [suppliers, searchTerm]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter(inv => 
      (inv.supplier_name && inv.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      String(inv.id).includes(searchTerm)
    );
  }, [allInvoices, searchTerm]);

  // Filtered Purchase Returns
  const filteredReturns = useMemo(() => {
    return purchaseReturns.filter(r => 
      (r.supplier_name && r.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.product_name && r.product_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.product_barcode && r.product_barcode.includes(searchTerm)) ||
      String(r.id).includes(searchTerm)
    );
  }, [purchaseReturns, searchTerm]);

  // Chart data for company profile
  const profileChartData = useMemo(() => {
    if (!selectedProfile || !selectedProfile.invoices || selectedProfile.invoices.length === 0) return [];
    
    const dataMap = {};
    selectedProfile.invoices.forEach(inv => {
      const d = new Date(inv.created_at).toLocaleDateString('en-GB');
      if (!dataMap[d]) {
        dataMap[d] = { date: d, paid: 0, remaining: 0, total: 0 };
      }
      dataMap[d].paid += Number(inv.paid_amount) || 0;
      dataMap[d].remaining += Number(inv.remaining_amount) || 0;
      dataMap[d].total += Number(inv.total_amount) || 0;
    });

    return Object.values(dataMap);
  }, [selectedProfile]);

  if (!isAdmin) {
    return (
      <div className="dashboard-page p-8" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <AlertTriangle size={40} color="#f87171" />
        </div>
        <h2 style={{ fontSize: '1.6rem', color: '#f87171', marginBottom: '10px' }}>دەسەڵاتی بینینی ئەم بەشەت نییە</h2>
        <p style={{ color: '#94a3b8', maxWidth: '500px', margin: '0 auto' }}>
          بەشی دارایی و قازانجی کۆمپانیاکان تایبەتە بە بەڕێوەبەر (Admin). تکایە لە شریتی سەرەوە بە هەژماری ئەدمین بچۆ ژوورەوە.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-page p-8" style={{ position: 'relative' }}>
      
      {/* Header */}
      <div className="header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building2 color="#06b6d4" size={32} />
            ژمێریاری بەشی دارایی و کۆمپانیاکان
          </h1>
          <p className="text-secondary">کۆی کڕینەکان، قەرزی کۆمپانیاکان، پسووڵەکان و گەڕاندنەوەی کاڵا بۆ دابینکەران</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 1rem', borderRadius: '12px' }}>
            <Search size={20} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="گەڕان بە ناوی کۆمپانیا، کاڵا یان پسووڵە..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'white', marginRight: '10px', outline: 'none', width: '230px' }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            )}
          </div>

          <button 
            className="btn-primary" 
            onClick={() => setIsAddReturnOpen(true)} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <RotateCcw size={18} /> گەڕاندنەوە بۆ کۆمپانیا ↩️
          </button>

          <button 
            className="btn-primary" 
            onClick={() => setIsAddSupplierOpen(true)} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <Plus size={20} /> کۆمپانیای نوێ
          </button>
        </div>
      </div>

      {/* Global Financial KPI Metric Grid */}
      <div className="stats-grid mb-8">
        <div className="stat-card glass-panel" style={{ background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.25)' }}>
          <h3>کۆی گشتی کڕین لە کۆمپانیاکان</h3>
          <div className="value" style={{ color: '#60a5fa' }}>{totalPurchases.toLocaleString()} دینار</div>
          <div className="sub-text" style={{ color: '#94a3b8' }}>کۆی پارەی مامەڵەی دابینکەران</div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
          <h3>کۆی پارەی دراو</h3>
          <div className="value highlight" style={{ color: '#10b981' }}>{totalPaid.toLocaleString()} دینار</div>
          <div className="sub-text" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={14} /> کۆی پارەی نەقدی دراو بە کۆمپانیاکان
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
          <h3>کۆی پارەی ماوە (قەرزی کۆمپانیاکان)</h3>
          <div className="value" style={{ color: '#ef4444' }}>{totalRemaining.toLocaleString()} دینار</div>
          <div className="sub-text" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingDown size={14} /> باڵانسی قەرزی ماوەی مارکێت
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
          <h3>کۆی گەڕاندنەوە بۆ کۆمپانیاکان</h3>
          <div className="value" style={{ color: '#f59e0b' }}>{totalReturnsRefund.toLocaleString()} دینار</div>
          <div className="sub-text" style={{ color: '#94a3b8' }}>{purchaseReturns.length} کاڵای گەڕێندراوە</div>
        </div>
      </div>

      {/* Navigation Tabs (کۆمپانیاکان vs پسووڵەکان vs گەڕاندنەوەکان) */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '14px', width: 'fit-content', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('SUPPLIERS')}
          style={{
            padding: '10px 22px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            background: activeTab === 'SUPPLIERS' ? '#3b82f6' : 'transparent',
            color: activeTab === 'SUPPLIERS' ? 'white' : '#94a3b8',
            transition: 'all 0.2s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Building2 size={18} /> کۆمپانیاکان ({suppliers.length})
        </button>

        <button
          onClick={() => setActiveTab('INVOICES')}
          style={{
            padding: '10px 22px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            background: activeTab === 'INVOICES' ? '#3b82f6' : 'transparent',
            color: activeTab === 'INVOICES' ? 'white' : '#94a3b8',
            transition: 'all 0.2s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileText size={18} /> هەموو پسووڵەکانی کڕین ({allInvoices.length})
        </button>

        <button
          onClick={() => setActiveTab('RETURNS')}
          style={{
            padding: '10px 22px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            background: activeTab === 'RETURNS' ? '#ef4444' : 'transparent',
            color: activeTab === 'RETURNS' ? 'white' : '#94a3b8',
            transition: 'all 0.2s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <RotateCcw size={18} /> گەڕاندنەوە بۆ کۆمپانیا ({purchaseReturns.length})
        </button>
      </div>

      {/* Tab 1: Suppliers List Table */}
      {activeTab === 'SUPPLIERS' && (
        <div className="glass-panel" style={{ padding: '1px', borderRadius: '16px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
            <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>ناوی کۆمپانیا/دابینکەر</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>مۆبایل</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>ژمارەی پسووڵە</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>کۆی دراو (دینار)</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>کۆی ماوە (قەرز)</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>کردارەکان</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>باردەکرێت...</td></tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>هیچ کۆمپانیایەک نەدۆزرایەوە</td></tr>
              ) : (
                filteredSuppliers.map(s => {
                  const remaining = Number(s.total_remaining) || 0;
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding: '16px 20px', fontWeight: 'bold' }}>{s.name}</td>
                      <td style={{ padding: '16px 20px', color: '#a78bfa', fontFamily: 'monospace' }}>
                        {s.phone ? (
                          <a href={`tel:${s.phone}`} style={{ color: '#a78bfa', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={14} /> {s.phone}
                          </a>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#38bdf8' }}>
                        {s.total_invoices || 0} پسووڵە
                      </td>
                      <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: 'bold' }}>
                        {Number(s.total_paid).toLocaleString()} دینار
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '8px', 
                          fontSize: '0.9rem', 
                          fontWeight: 'bold',
                          background: remaining > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: remaining > 0 ? '#ef4444' : '#10b981'
                        }}>
                          {remaining.toLocaleString()} دینار
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <button 
                          onClick={() => openProfile(s.id)} 
                          style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          پڕۆفایل و مێژوو
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: All Purchase Invoices Table */}
      {activeTab === 'INVOICES' && (
        <div className="glass-panel" style={{ padding: '1px', borderRadius: '16px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
            <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>ژمارەی پسووڵە</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>کۆمپانیا / دابینکەر</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>بەروار</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>کۆی گشتی (دینار)</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>پارەی دراو</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>پارەی ماوە (قەرز)</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>جۆری پارەدان</th>
                <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>کردارەکان</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>باردەکرێت...</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>هیچ پسووڵەیەک نەدۆزرایەوە</td></tr>
              ) : (
                filteredInvoices.map(inv => {
                  const rem = Number(inv.remaining_amount) || 0;
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding: '16px 20px', fontFamily: 'monospace', fontWeight: 'bold', color: '#38bdf8' }}>
                        #{inv.invoice_number || inv.id}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 'bold' }}>
                        {inv.supplier_name}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#94a3b8', fontSize: '0.9rem' }}>
                        {new Date(inv.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 'bold', color: '#f8fafc' }}>
                        {Number(inv.total_amount).toLocaleString()} دینار
                      </td>
                      <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: 'bold' }}>
                        {Number(inv.paid_amount).toLocaleString()} دینار
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '8px', 
                          fontSize: '0.85rem', 
                          fontWeight: 'bold',
                          background: rem > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: rem > 0 ? '#ef4444' : '#10b981'
                        }}>
                          {rem.toLocaleString()} دینار
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          background: inv.payment_method === 'DEBT' ? 'rgba(239, 68, 68, 0.15)' : inv.payment_method === 'PARTIAL' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: inv.payment_method === 'DEBT' ? '#ef4444' : inv.payment_method === 'PARTIAL' ? '#f59e0b' : '#10b981'
                        }}>
                          {inv.payment_method === 'DEBT' ? 'قەرز' : inv.payment_method === 'PARTIAL' ? 'بەشێک قەرز' : 'نەقد'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <button 
                          onClick={() => openInvoiceDetails(inv.id)} 
                          style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Eye size={15} /> بینینی وردەکاری
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Purchase Returns (گەڕاندنەوە بۆ کۆمپانیاکان) */}
      {activeTab === 'RETURNS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw color="#ef4444" size={20} /> مێژووی کاڵا گەڕێندراوەکان بۆ کۆمپانیاکان
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                ئەو کاڵایانەی بەهۆی بەسەرچوون یان خراپبوونەوە دراونەتەوە بە کۆمپانیا و لە کۆگا کەمکراونەتەوە
              </p>
            </div>

            <button
              onClick={() => setIsAddReturnOpen(true)}
              style={{
                padding: '10px 20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: 'white',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)'
              }}
            >
              <Plus size={18} /> تۆمارکردنی گەڕاندنەوەی نوێ ↩️
            </button>
          </div>

          <div className="glass-panel" style={{ padding: '1px', borderRadius: '16px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
              <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                <tr>
                  <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>بەروار</th>
                  <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>ناوی کاڵا</th>
                  <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>بارکۆد</th>
                  <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>کۆمپانیا / دابینکەر</th>
                  <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>بڕی گەڕاوە</th>
                  <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>نرخی کڕین (یەکە)</th>
                  <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>کۆی پارەی گەڕاوە</th>
                  <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>شێوازی قەرەبوو</th>
                  <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>هۆکار</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>باردەکرێت...</td></tr>
                ) : filteredReturns.length === 0 ? (
                  <tr><td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>هیچ گەڕاندنەوەیەک تۆمار نەکراوە</td></tr>
                ) : (
                  filteredReturns.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                      <td style={{ padding: '16px 20px', color: '#94a3b8', fontSize: '0.85rem' }}>
                        {new Date(r.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 'bold' }}>
                        {r.product_name}
                      </td>
                      <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#a78bfa' }}>
                        {r.product_barcode}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#38bdf8' }}>
                        {r.supplier_name}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 'bold' }}>
                        <span style={{ color: '#ef4444' }}>-{Number(r.quantity)} دانە</span>
                      </td>
                      <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                        {Number(r.cost_price).toLocaleString()} دینار
                      </td>
                      <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: 'bold', fontSize: '1rem' }}>
                        {Number(r.total_refund).toLocaleString()} دینار
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          background: r.refund_type === 'DEBT_DEDUCT' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: r.refund_type === 'DEBT_DEDUCT' ? '#60a5fa' : '#10b981'
                        }}>
                          {r.refund_type === 'DEBT_DEDUCT' ? 'کەمکردنەوە لە قەرز' : 'وەرگرتنەوەی کاش'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', color: '#cbd5e1', fontSize: '0.9rem' }}>
                        {r.reason || 'بێ هۆکار'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Add Supplier Modal */}
      {isAddSupplierOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', borderRadius: '24px', padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 color="#06b6d4" /> زیادکردنی کۆمپانیای نوێ
              </h2>
              <button onClick={() => setIsAddSupplierOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={24}/>
              </button>
            </div>
            
            <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>ناوی کۆمپانیا / دابینکەر <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  required 
                  placeholder="نموونە: کۆمپانیای ئارام بۆ خۆراک..."
                  value={newSupplier.name} 
                  onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>ژمارەی مۆبایل / پەیوەندی</label>
                <input 
                  type="text" 
                  placeholder="0750 xxx xxxx"
                  value={newSupplier.phone} 
                  onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontFamily: 'monospace' }} 
                />
              </div>

              <button 
                type="submit" 
                style={{ marginTop: '0.5rem', width: '100%', padding: '15px', borderRadius: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(59,130,246,0.4)' }}
              >
                پاشەکەوتکردنی کۆمپانیا
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Purchase Return Modal */}
      {isAddReturnOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', borderRadius: '24px', padding: '2rem', animation: 'fadeIn 0.3s ease', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                <RotateCcw color="#ef4444" size={24} /> گەڕاندنەوەی کاڵا بۆ کۆمپانیا
              </h2>
              <button onClick={() => setIsAddReturnOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={24}/>
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              ئەم کردارە کاڵاکە لە کۆگا کەم دەکاتەوە و بەپێی هەڵبژاردن لە قەرزی کۆمپانیا دەشکێنرێت یان وەک کاش وەردەگیرێتەوە.
            </p>

            <form onSubmit={handleCreatePurchaseReturn} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              {/* Supplier Selection */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>کۆمپانیا / دابینکەر:</label>
                <select
                  value={newReturn.supplier_id}
                  onChange={e => setNewReturn({ ...newReturn, supplier_id: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                >
                  <option value="">کڕینی لۆکاڵی / بێ کۆمپانیا</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (قەرز: {Number(s.total_remaining || 0).toLocaleString()} دینار)
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Selection */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>کاڵا <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  required
                  value={newReturn.product_id}
                  onChange={e => handleProductSelectForReturn(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                >
                  <option value="">کاڵایەک هەڵبژێرە...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} • کۆگا: {p.stock} دانە • کڕین: {Number(p.cost_price || 0).toLocaleString()} دینار
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>بڕی گەڕاوە <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={newReturn.quantity}
                    onChange={e => setNewReturn({ ...newReturn, quantity: e.target.value })}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>نرخی کڕینی یەکە (دینار) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="number"
                    required
                    value={newReturn.cost_price}
                    onChange={e => setNewReturn({ ...newReturn, cost_price: e.target.value })}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold' }}
                  />
                </div>
              </div>

              {/* Refund Type */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>شێوازی قەرەبووکردنەوە:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setNewReturn({ ...newReturn, refund_type: 'DEBT_DEDUCT' })}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: newReturn.refund_type === 'DEBT_DEDUCT' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                      background: newReturn.refund_type === 'DEBT_DEDUCT' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.2)',
                      color: newReturn.refund_type === 'DEBT_DEDUCT' ? '#60a5fa' : '#94a3b8',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}
                  >
                    کەمکردنەوە لە قەرز
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewReturn({ ...newReturn, refund_type: 'CASH_REFUND' })}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: newReturn.refund_type === 'CASH_REFUND' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                      background: newReturn.refund_type === 'CASH_REFUND' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0,0,0,0.2)',
                      color: newReturn.refund_type === 'CASH_REFUND' ? '#10b981' : '#94a3b8',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}
                  >
                    وەرگرتنەوەی کاش
                  </button>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8' }}>هۆکاری گەڕاندنەوە:</label>
                <input 
                  type="text"
                  placeholder="بۆ نموونە: بەروار بەسەرچووە، زیانلێکەوتوو بوو، فرۆشی نەبوو..."
                  value={newReturn.reason}
                  onChange={e => setNewReturn({ ...newReturn, reason: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                />
              </div>

              {/* Live Preview Card */}
              {newReturn.quantity && newReturn.cost_price && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>کۆی پارەی گەڕاوە: </span>
                  <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1.25rem' }}>
                    {Math.round((parseFloat(newReturn.quantity) || 0) * (parseFloat(newReturn.cost_price) || 0)).toLocaleString()} دینار
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '1.05rem', cursor: isSubmittingReturn ? 'not-allowed' : 'pointer', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}
                >
                  {isSubmittingReturn ? 'تۆمار دەکرێت...' : 'پاشەکەوتکردنی گەڕاندنەوە ↩️'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddReturnOpen(false)}
                  style={{ padding: '14px 20px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: '#94a3b8', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  داخستن
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Supplier Profile Full-Screen Overlay */}
      {selectedProfile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', zIndex: 1100, animation: 'fadeIn 0.3s ease', overflowY: 'auto' }}>
          
          {/* Sticky Header */}
          <div style={{ padding: '1.5rem 2rem', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
            <div>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 color="#06b6d4" size={28} />
                پڕۆفایلی کۆمپانیا: {selectedProfile.name}
              </h2>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>
                مۆبایل: {selectedProfile.phone || 'دیارینەکراوە'}
              </div>
            </div>
            
            <button 
              onClick={() => setSelectedProfile(null)}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
            >
              <X size={18} /> داخستنی پڕۆفایل
            </button>
          </div>

          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
            
            {/* KPI Cards inside Profile */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>کۆی پارەی کڕین لەم کۆمپانیایە</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#60a5fa', marginTop: '6px' }}>
                  {((Number(selectedProfile.total_paid) || 0) + (Number(selectedProfile.total_remaining) || 0)).toLocaleString()} دینار
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>کۆی پارەی دراو (نەقد)</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#10b981', marginTop: '6px' }}>
                  {Number(selectedProfile.total_paid || 0).toLocaleString()} دینار
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 'bold' }}>کۆی پارەی ماوە (قەرزی ماوە)</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#ef4444', marginTop: '6px' }}>
                  {Number(selectedProfile.total_remaining || 0).toLocaleString()} دینار
                </div>
              </div>
            </div>

            {/* Pay Debt Section */}
            {Number(selectedProfile.total_remaining) > 0 && (
              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                  <CreditCard size={20} /> دانەوەی قەرزی ئەم کۆمپانیایە
                </h3>
                
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input 
                    type="number"
                    placeholder="بڕی پارەی دراو بنووسە (دینار)..."
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    style={{ flex: '1 1 250px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '1rem' }}
                  />

                  <button
                    onClick={handlePaySupplierDebt}
                    disabled={isPayingDebt}
                    style={{ padding: '12px 24px', borderRadius: '10px', background: '#10b981', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <CheckCircle2 size={18} /> {isPayingDebt ? 'چاوەڕێبە...' : 'تۆمارکردنی پارەدان'}
                  </button>

                  <button
                    onClick={() => setPayAmount(selectedProfile.total_remaining.toString())}
                    style={{ padding: '12px 18px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                  >
                    دانەوەی هەموو قەرزەکە
                  </button>
                </div>
              </div>
            )}

            {/* Profile Chart */}
            {profileChartData.length > 0 && (
              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                <h3 style={{ margin: '0 0 1.25rem 0' }}>هێڵکاری پارەدان و قەرزەکانی ئەم کۆمپانیایە بەپێی کات</h3>
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <AreaChart data={profileChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip 
                        contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        formatter={(val) => [`${Number(val).toLocaleString()} دینار`]}
                      />
                      <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="rgba(59, 130, 246, 0.2)" name="کۆی کڕین" />
                      <Area type="monotone" dataKey="paid" stroke="#10b981" fill="rgba(16, 185, 129, 0.2)" name="پارەی دراو" />
                      <Area type="monotone" dataKey="remaining" stroke="#ef4444" fill="rgba(239, 68, 68, 0.2)" name="قەرز" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Invoices List under Profile */}
            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
              <h3 style={{ margin: '0 0 1.25rem 0' }}>پسووڵەکانی کڕین لەم کۆمپانیایە ({selectedProfile.invoices?.length || 0})</h3>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', color: '#94a3b8' }}>ژمارەی پسووڵە</th>
                      <th style={{ padding: '12px 16px', color: '#94a3b8' }}>بەروار</th>
                      <th style={{ padding: '12px 16px', color: '#94a3b8' }}>کۆی پسووڵە</th>
                      <th style={{ padding: '12px 16px', color: '#94a3b8' }}>پارەی دراو</th>
                      <th style={{ padding: '12px 16px', color: '#94a3b8' }}>پارەی ماوە (قەرز)</th>
                      <th style={{ padding: '12px 16px', color: '#94a3b8' }}>شێوازی پارەدان</th>
                      <th style={{ padding: '12px 16px', color: '#94a3b8' }}>کردار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedProfile.invoices || selectedProfile.invoices.length === 0 ? (
                      <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>هیچ پسووڵەیەک نییە</td></tr>
                    ) : (
                      selectedProfile.invoices.map(inv => (
                        <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 'bold' }}>
                            #{inv.invoice_number || inv.id}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                            {new Date(inv.created_at).toLocaleDateString('en-GB')}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>
                            {Number(inv.total_amount).toLocaleString()} دینار
                          </td>
                          <td style={{ padding: '12px 16px', color: '#10b981' }}>
                            {Number(inv.paid_amount).toLocaleString()} دینار
                          </td>
                          <td style={{ padding: '12px 16px', color: Number(inv.remaining_amount) > 0 ? '#ef4444' : '#10b981' }}>
                            {Number(inv.remaining_amount).toLocaleString()} دینار
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                              {inv.payment_method === 'DEBT' ? 'قەرز' : inv.payment_method === 'PARTIAL' ? 'بەشێک قەرز' : 'نەقد'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <button
                              onClick={() => openInvoiceDetails(inv.id)}
                              style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                            >
                              وردەکاری
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '780px', borderRadius: '24px', padding: '2rem', animation: 'fadeIn 0.3s ease', maxHeight: '90vh', overflowY: 'auto' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText color="#38bdf8" /> وردەکاری پسووڵەی کڕین #{selectedInvoice.id}
                </h2>
                <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>
                  کۆمپانیا: <strong style={{ color: '#f8fafc' }}>{selectedInvoice.supplier_name}</strong> • {new Date(selectedInvoice.created_at).toLocaleString('en-US', { hour12: true })}
                </div>
              </div>
              <button onClick={() => setSelectedInvoice(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={24}/>
              </button>
            </div>

            {/* Financial Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: Number(selectedInvoice.additional_cost) > 0 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>کۆی تێچووی پسووڵە</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f8fafc', marginTop: '4px' }}>
                  {Number(selectedInvoice.total_amount).toLocaleString()} دینار
                </div>
              </div>

              {Number(selectedInvoice.additional_cost) > 0 && (
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                  <div style={{ color: '#fbbf24', fontSize: '0.85rem' }}>تێچووی زیادە (بار و حەماڵی)</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fbbf24', marginTop: '4px' }}>
                    +{Number(selectedInvoice.additional_cost).toLocaleString()} دینار
                  </div>
                </div>
              )}

              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ color: '#10b981', fontSize: '0.85rem' }}>پارەی دراو</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981', marginTop: '4px' }}>
                  {Number(selectedInvoice.paid_amount).toLocaleString()} دینار
                </div>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>پارەی ماوە (قەرز)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444', marginTop: '4px' }}>
                  {Number(selectedInvoice.remaining_amount).toLocaleString()} دینار
                </div>
              </div>
            </div>

            {/* Items Table */}
            <h4 style={{ margin: '0 0 1rem 0', color: '#94a3b8' }}>لیستی کاڵاکانی ناو ئەم پسووڵەیە:</h4>
            <div style={{ padding: '1px', borderRadius: '12px', overflowX: 'auto', background: 'rgba(0,0,0,0.2)', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.9rem' }}>ناوی کاڵا</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.9rem' }}>بارکۆد</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.9rem' }}>بڕ (دانە)</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.9rem' }}>نرخی کڕین (خام)</th>
                    {Number(selectedInvoice.additional_cost) > 0 && (
                      <th style={{ padding: '12px 16px', color: '#fbbf24', fontSize: '0.9rem' }}>تێچووی گەیشتن (Landed)</th>
                    )}
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.9rem' }}>نرخی فرۆشتن</th>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.9rem' }}>کۆی تێچوو</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedInvoice.items || selectedInvoice.items.length === 0 ? (
                    <tr><td colSpan={Number(selectedInvoice.additional_cost) > 0 ? "7" : "6"} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>هیچ کاڵایەک نەدۆزرایەوە</td></tr>
                  ) : (
                    selectedInvoice.items.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{it.product_name}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#a78bfa' }}>{it.barcode}</td>
                        <td style={{ padding: '12px 16px' }}>{it.quantity} دانە</td>
                        <td style={{ padding: '12px 16px' }}>{Number(it.cost_price).toLocaleString()} دینار</td>
                        {Number(selectedInvoice.additional_cost) > 0 && (
                          <td style={{ padding: '12px 16px', color: '#fbbf24', fontWeight: 'bold' }}>
                            {Number(it.landed_cost_price || it.cost_price).toLocaleString()} دینار
                          </td>
                        )}
                        <td style={{ padding: '12px 16px', color: '#10b981' }}>{Number(it.selling_price).toLocaleString()} دینار</td>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{(Number(it.cost_price) * Number(it.quantity)).toLocaleString()} دینار</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setSelectedInvoice(null)}
                style={{ padding: '12px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                داخستن
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Financials;
