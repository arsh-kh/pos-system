import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
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
import { formatDate, formatDateTime, formatCurrency } from '../utils/dateFormatter';
import './Dashboard.css';

const Financials = () => {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
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
      kurdishSearchMatch([s.name, s.phone], searchTerm)
    );
  }, [suppliers, searchTerm]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter(inv => 
      kurdishSearchMatch([inv.supplier_name, inv.id], searchTerm)
    );
  }, [allInvoices, searchTerm]);

  // Filtered Purchase Returns
  const filteredReturns = useMemo(() => {
    return purchaseReturns.filter(r => 
      kurdishSearchMatch([r.supplier_name, r.product_name, r.product_barcode, r.id], searchTerm)
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
      
      {/* Top Toolbar: Title + Search + Compact Inline Summary Pills + Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px', direction: 'rtl' }}>
        {/* Right side: Page Title + Search Input + Summary Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            کۆمپانیاکان
          </h1>

          {/* Search Input (height: 38px, no icons) */}
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            height: '38px',
            background: '#ffffff',
            border: isSearchFocused ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '0 10px',
            width: '210px',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease'
          }}>
            <input 
              type="text" 
              className="input-seamless"
              placeholder="گەڕان بە ناوی کۆمپانیا..." 
              value={searchTerm}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                boxShadow: 'none',
                outline: 'none',
                color: '#1e293b', 
                padding: 0,
                width: '100%', 
                height: '100%',
                fontSize: '0.84rem' 
              }}
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')} 
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex', fontSize: '14px', lineHeight: 1 }}
              >
                ×
              </button>
            )}
          </div>

          {/* Compact Inline Summary Pills (height: 38px, no background boxes, plain text with subtle borders) */}
          <div style={{
            height: '38px',
            padding: '0 12px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            color: '#475569',
            boxSizing: 'border-box',
            whiteSpace: 'nowrap'
          }}>
            <span>کۆی دراو:</span>
            <strong style={{ color: '#10b981', fontWeight: 700 }}>{totalPaid.toLocaleString()} دینار</strong>
          </div>

          <div style={{
            height: '38px',
            padding: '0 12px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            color: '#475569',
            boxSizing: 'border-box',
            whiteSpace: 'nowrap'
          }}>
            <span>کۆی قەرز:</span>
            <strong style={{ color: totalRemaining > 0 ? '#ef4444' : '#1e293b', fontWeight: 700 }}>{totalRemaining.toLocaleString()} دینار</strong>
          </div>
        </div>

        {/* Far Left Actions: "+ پسووڵەی کڕین", "گەڕاندنەوە بۆ کۆمپانیا", "+ کۆمپانیای نوێ" */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href="#/purchases"
            style={{ 
              height: '38px', 
              padding: '0 14px', 
              borderRadius: '8px', 
              background: '#0284c7', 
              color: '#ffffff', 
              textDecoration: 'none',
              fontWeight: 700, 
              fontSize: '0.82rem', 
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer' 
            }}
          >
            + پسووڵەی کڕین
          </a>

          <button 
            type="button"
            onClick={() => setIsAddReturnOpen(true)} 
            style={{ 
              height: '38px', 
              padding: '0 14px', 
              borderRadius: '8px', 
              background: '#ffffff', 
              color: '#ef4444', 
              border: '1px solid #fecaca', 
              fontWeight: 700, 
              fontSize: '0.82rem', 
              cursor: 'pointer' 
            }}
          >
            گەڕاندنەوە بۆ کۆمپانیا
          </button>

          <button 
            type="button"
            onClick={() => setIsAddSupplierOpen(true)} 
            style={{ 
              height: '38px', 
              padding: '0 16px', 
              borderRadius: '8px', 
              background: '#2563eb', 
              color: '#ffffff', 
              border: 'none', 
              fontWeight: 700, 
              fontSize: '0.85rem', 
              cursor: 'pointer' 
            }}
          >
            + کۆمپانیای نوێ
          </button>
        </div>
      </div>

      {/* Segment Control Filter Tabs (Above table, no big blue backgrounds, no icons) */}
      <div style={{ 
        display: 'inline-flex', 
        background: '#f1f5f9', 
        border: '1px solid #e2e8f0', 
        borderRadius: '8px', 
        padding: '3px', 
        height: '34px', 
        boxSizing: 'border-box', 
        marginBottom: '12px',
        direction: 'rtl'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('SUPPLIERS')}
          style={{
            padding: '0 14px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.80rem',
            fontWeight: 700,
            background: activeTab === 'SUPPLIERS' ? '#2563eb' : 'transparent',
            color: activeTab === 'SUPPLIERS' ? '#ffffff' : '#64748b',
            transition: 'all 0.15s ease'
          }}
        >
          کۆمپانیاکان ({suppliers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('INVOICES')}
          style={{
            padding: '0 14px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.80rem',
            fontWeight: 700,
            background: activeTab === 'INVOICES' ? '#2563eb' : 'transparent',
            color: activeTab === 'INVOICES' ? '#ffffff' : '#64748b',
            transition: 'all 0.15s ease'
          }}
        >
          هەموو پسووڵەکانی کڕین ({allInvoices.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('RETURNS')}
          style={{
            padding: '0 14px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.80rem',
            fontWeight: 700,
            background: activeTab === 'RETURNS' ? '#2563eb' : 'transparent',
            color: activeTab === 'RETURNS' ? '#ffffff' : '#64748b',
            transition: 'all 0.15s ease'
          }}
        >
          گەڕاندنەوە بۆ کۆمپانیا ({purchaseReturns.length})
        </button>
      </div>

      {/* Tab 1: Suppliers List Table (Ultra-Compact Bordered Data Grid) */}
      {activeTab === 'SUPPLIERS' && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: '#ffffff', direction: 'rtl' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '25%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr style={{ height: '38px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0 14px', textAlign: 'right' }}>ناوی کۆمپانیا</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>مۆبایل</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>ژمارەی پسووڵە</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>کۆی دراو</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>کۆی ماوە (قەرز)</th>
                <th style={{ padding: '0 14px', textAlign: 'left' }}>کردارەکان</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ height: '38px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>باردەکرێت...</td></tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr><td colSpan="6" style={{ height: '38px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>هیچ کۆمپانیایەک نەدۆزرایەوە</td></tr>
              ) : (
                filteredSuppliers.map(s => {
                  const remaining = Number(s.total_remaining) || 0;
                  return (
                    <tr 
                      key={s.id} 
                      style={{ height: '38px', borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s ease' }} 
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} 
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0 14px', textAlign: 'right', fontWeight: 700, color: '#1e293b', fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', color: '#475569', fontFamily: 'monospace', fontSize: '0.84rem' }}>
                        {s.phone ? (
                          <a href={`tel:${s.phone}`} style={{ color: '#475569', textDecoration: 'none' }}>
                            {s.phone}
                          </a>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', color: '#0284c7', fontSize: '0.84rem' }}>
                        {s.total_invoices || 0}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', color: '#10b981', fontWeight: 600, fontSize: '0.86rem' }}>
                        {Number(s.total_paid || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', color: remaining > 0 ? '#ef4444' : '#64748b', fontWeight: remaining > 0 ? 700 : 500, fontSize: '0.86rem' }}>
                        {remaining.toLocaleString()}
                      </td>
                      <td style={{ padding: '0 14px', textAlign: 'left' }}>
                        <button 
                          type="button"
                          onClick={() => openProfile(s.id)} 
                          style={{ 
                            background: '#ffffff', 
                            color: '#0284c7', 
                            border: '1px solid #cbd5e1', 
                            padding: '3px 12px', 
                            borderRadius: '6px', 
                            cursor: 'pointer', 
                            fontSize: '0.78rem', 
                            fontWeight: 700,
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.borderColor = '#93c5fd'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                        >
                          پڕۆفایل
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
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: '#ffffff', direction: 'rtl' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ height: '38px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '0 14px', textAlign: 'right' }}>ژمارەی پسووڵە</th>
                <th style={{ padding: '0 10px', textAlign: 'right' }}>کۆمپانیا / دابینکەر</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>بەروار</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>کۆی گشتی</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>پارەی دراو</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>پارەی ماوە (قەرز)</th>
                <th style={{ padding: '0 10px', textAlign: 'center' }}>جۆری پارەدان</th>
                <th style={{ padding: '0 14px', textAlign: 'left' }}>کردارەکان</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ height: '38px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>باردەکرێت...</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan="8" style={{ height: '38px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>هیچ پسووڵەیەک نەدۆزرایەوە</td></tr>
              ) : (
                filteredInvoices.map(inv => {
                  const rem = Number(inv.remaining_amount) || 0;
                  return (
                    <tr 
                      key={inv.id} 
                      style={{ height: '38px', borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s ease' }} 
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} 
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0 14px', fontFamily: 'monospace', fontWeight: 'bold', color: '#0284c7', fontSize: '0.84rem' }}>
                        #{inv.invoice_number || inv.id}
                      </td>
                      <td style={{ padding: '0 10px', fontWeight: 'bold', color: '#1e293b', fontSize: '0.86rem' }}>
                        {inv.supplier_name}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                        {formatDate(inv.created_at)}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b', fontSize: '0.86rem' }}>
                        {Number(inv.total_amount).toLocaleString()}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', color: '#10b981', fontWeight: 600, fontSize: '0.86rem' }}>
                        {Number(inv.paid_amount).toLocaleString()}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', color: rem > 0 ? '#ef4444' : '#64748b', fontWeight: rem > 0 ? 700 : 500, fontSize: '0.86rem' }}>
                        {rem.toLocaleString()}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', fontSize: '0.82rem' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          background: inv.payment_method === 'DEBT' ? '#fef2f2' : inv.payment_method === 'PARTIAL' ? '#fffbeb' : '#f0fdf4',
                          color: inv.payment_method === 'DEBT' ? '#ef4444' : inv.payment_method === 'PARTIAL' ? '#b45309' : '#16a34a'
                        }}>
                          {inv.payment_method === 'DEBT' ? 'قەرز' : inv.payment_method === 'PARTIAL' ? 'بەشێک قەرز' : 'نەقد'}
                        </span>
                      </td>
                      <td style={{ padding: '0 14px', textAlign: 'left' }}>
                        <button 
                          type="button"
                          onClick={() => openInvoiceDetails(inv.id)} 
                          style={{ 
                            background: '#ffffff', 
                            color: '#0284c7', 
                            border: '1px solid #cbd5e1', 
                            padding: '3px 12px', 
                            borderRadius: '6px', 
                            cursor: 'pointer', 
                            fontSize: '0.78rem', 
                            fontWeight: 700 
                          }}
                        >
                          وردەکاری
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              مێژووی کاڵا گەڕێندراوەکان بۆ کۆمپانیاکان
            </h3>

            <button
              type="button"
              onClick={() => setIsAddReturnOpen(true)}
              style={{
                height: '34px',
                padding: '0 16px',
                borderRadius: '8px',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              + تۆمارکردنی گەڕاندنەوەی نوێ
            </button>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: '#ffffff', direction: 'rtl' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ height: '38px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '0 12px', textAlign: 'right' }}>بەروار</th>
                  <th style={{ padding: '0 10px', textAlign: 'right' }}>ناوی کاڵا</th>
                  <th style={{ padding: '0 10px', textAlign: 'center' }}>بارکۆد</th>
                  <th style={{ padding: '0 10px', textAlign: 'right' }}>کۆمپانیا / دابینکەر</th>
                  <th style={{ padding: '0 10px', textAlign: 'center' }}>بڕی گەڕاوە</th>
                  <th style={{ padding: '0 10px', textAlign: 'center' }}>نرخی کڕین (یەکە)</th>
                  <th style={{ padding: '0 10px', textAlign: 'center' }}>کۆی پارەی گەڕاوە</th>
                  <th style={{ padding: '0 10px', textAlign: 'center' }}>شێوازی قەرەبوو</th>
                  <th style={{ padding: '0 12px', textAlign: 'left' }}>هۆکار</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" style={{ height: '38px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>باردەکرێت...</td></tr>
                ) : filteredReturns.length === 0 ? (
                  <tr><td colSpan="9" style={{ height: '38px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>هیچ گەڕاندنەوەیەک تۆمار نەکراوە</td></tr>
                ) : (
                  filteredReturns.map(r => (
                    <tr 
                      key={r.id} 
                      style={{ height: '38px', borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s ease' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} 
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0 12px', color: '#64748b', fontSize: '0.82rem' }}>
                        {formatDate(r.created_at)}
                      </td>
                      <td style={{ padding: '0 10px', fontWeight: 700, color: '#1e293b', fontSize: '0.86rem' }}>
                        {r.product_name}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', fontFamily: 'monospace', color: '#475569', fontSize: '0.82rem' }}>
                        {r.product_barcode}
                      </td>
                      <td style={{ padding: '0 10px', color: '#0284c7', fontSize: '0.84rem' }}>
                        {r.supplier_name}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', fontWeight: 700, color: '#ef4444', fontSize: '0.84rem' }}>
                        -{Number(r.quantity)}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                        {Number(r.cost_price).toLocaleString()}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', color: '#10b981', fontWeight: 700, fontSize: '0.86rem' }}>
                        {Number(r.total_refund).toLocaleString()}
                      </td>
                      <td style={{ padding: '0 10px', textAlign: 'center', fontSize: '0.80rem' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          background: r.refund_type === 'DEBT_DEDUCT' ? '#eff6ff' : '#f0fdf4',
                          color: r.refund_type === 'DEBT_DEDUCT' ? '#2563eb' : '#16a34a'
                        }}>
                          {r.refund_type === 'DEBT_DEDUCT' ? 'شکاندن لە قەرز' : 'وەرگرتنەوەی کاش'}
                        </span>
                      </td>
                      <td style={{ padding: '0 12px', color: '#64748b', fontSize: '0.82rem', textAlign: 'left' }}>
                        {r.reason || '-'}
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
        <div className="pos-modal-overlay" onClick={() => setIsAddSupplierOpen(false)}>
          <div 
            className="pos-modal-card" 
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '480px',
              width: '92%',
              padding: '20px',
              borderRadius: '16px',
              background: '#ffffff',
              direction: 'rtl',
              border: '1px solid #cbd5e1',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b', fontWeight: 800 }}>
                زیادکردنی کۆمپانیای نوێ
              </h2>
              <button 
                type="button"
                onClick={() => setIsAddSupplierOpen(false)} 
                style={{ 
                  background: '#f1f5f9', 
                  border: '1px solid #cbd5e1', 
                  color: '#64748b', 
                  cursor: 'pointer', 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '18px', 
                  fontWeight: 700 
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                  ناوی کۆمپانیا / دابینکەر <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text" 
                  required 
                  value={newSupplier.name} 
                  onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} 
                  style={{ 
                    width: '100%', 
                    height: '38px', 
                    padding: '0 10px', 
                    borderRadius: '8px', 
                    background: '#ffffff', 
                    border: '1px solid #cbd5e1', 
                    color: '#1e293b', 
                    boxSizing: 'border-box', 
                    fontSize: '0.88rem' 
                  }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                  ژمارەی مۆبایل / پەیوەندی
                </label>
                <input 
                  type="text" 
                  value={newSupplier.phone} 
                  onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} 
                  style={{ 
                    width: '100%', 
                    height: '38px', 
                    padding: '0 10px', 
                    borderRadius: '8px', 
                    background: '#ffffff', 
                    border: '1px solid #cbd5e1', 
                    color: '#1e293b', 
                    boxSizing: 'border-box', 
                    fontSize: '0.88rem', 
                    fontFamily: 'monospace' 
                  }} 
                />
              </div>

              <div style={{ marginTop: '4px' }}>
                <button 
                  type="submit" 
                  style={{ 
                    width: '100%', 
                    height: '42px', 
                    borderRadius: '8px', 
                    background: '#2563eb', 
                    color: '#ffffff', 
                    border: 'none', 
                    fontSize: '0.95rem', 
                    fontWeight: 800, 
                    cursor: 'pointer', 
                    boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                    transition: 'all 0.15s ease' 
                  }}
                >
                  پاشەکەوتکردنی کۆمپانیا
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Purchase Return Modal */}
      {isAddReturnOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsAddReturnOpen(false)}>
          <div className="pos-modal-card pos-modal-md" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', color: '#ef4444', fontWeight: 800 }}>
                <RotateCcw color="#ef4444" size={22} /> گەڕاندنەوەی کاڵا بۆ کۆمپانیا
              </h2>
              <button onClick={() => setIsAddReturnOpen(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18}/>
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              ئەم کردارە کاڵاکە لە کۆگا کەم دەکاتەوە و بەپێی هەڵبژاردن لە قەرزی کۆمپانیا دەشکێنرێت یان وەک کاش وەردەگیرێتەوە.
            </p>

            <form onSubmit={handleCreatePurchaseReturn} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              {/* Supplier Selection */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>کۆمپانیا / دابینکەر:</label>
                <select
                  value={newReturn.supplier_id}
                  onChange={e => setNewReturn({ ...newReturn, supplier_id: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">کڕینی ناوخۆیی / بێ کۆمپانیا</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (قەرز: {Number(s.total_remaining || 0).toLocaleString()} دینار)
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Selection */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>کاڵا <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  required
                  value={newReturn.product_id}
                  onChange={e => handleProductSelectForReturn(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
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
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>بڕی گەڕاوە <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={newReturn.quantity}
                    onChange={e => setNewReturn({ ...newReturn, quantity: e.target.value })}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>نرخی کڕینی یەکە (دینار) <span style={{ color: '#ef4444' }}>*</span></label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Math.max(0, parseInt(newReturn.cost_price) || 0);
                        const next = Math.max(0, cur - 250);
                        setNewReturn({ ...newReturn, cost_price: next === 0 ? '' : String(next) });
                      }}
                      style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}
                    >
                      -٢٥٠
                    </button>
                    <input 
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={newReturn.cost_price}
                      onChange={e => setNewReturn({ ...newReturn, cost_price: e.target.value })}
                      style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold', textAlign: 'center' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Math.max(0, parseInt(newReturn.cost_price) || 0);
                        setNewReturn({ ...newReturn, cost_price: String(cur + 250) });
                      }}
                      style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 800, cursor: 'pointer' }}
                    >
                      +٢٥٠
                    </button>
                  </div>
                </div>
              </div>

              {/* Refund Type */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>شێوازی قەرەبووکردنەوە:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setNewReturn({ ...newReturn, refund_type: 'DEBT_DEDUCT' })}
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: newReturn.refund_type === 'DEBT_DEDUCT' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                      background: newReturn.refund_type === 'DEBT_DEDUCT' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-tertiary)',
                      color: newReturn.refund_type === 'DEBT_DEDUCT' ? '#60a5fa' : 'var(--text-secondary)',
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
                      border: newReturn.refund_type === 'CASH_REFUND' ? '2px solid #10b981' : '1px solid var(--border-color)',
                      background: newReturn.refund_type === 'CASH_REFUND' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-tertiary)',
                      color: newReturn.refund_type === 'CASH_REFUND' ? '#10b981' : 'var(--text-secondary)',
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
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>هۆکاری گەڕاندنەوە:</label>
                <input 
                  type="text"
                  placeholder="بۆ نموونە: بەروار بەسەرچووە، زیانلێکەوتوو بوو، فرۆشی نەبوو..."
                  value={newReturn.reason}
                  onChange={e => setNewReturn({ ...newReturn, reason: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Live Preview Card */}
              {newReturn.quantity && newReturn.cost_price && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>کۆی پارەی گەڕاوە: </span>
                  <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1.25rem' }}>
                    {Math.round((parseFloat(newReturn.quantity) || 0) * (parseFloat(newReturn.cost_price) || 0)).toLocaleString()} دینار
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  style={{ flex: 1, minWidth: '160px', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '1.05rem', cursor: isSubmittingReturn ? 'not-allowed' : 'pointer', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}
                >
                  {isSubmittingReturn ? 'تۆمار دەکرێت...' : 'پاشەکەوتکردنی گەڕاندنەوە ↩️'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAddReturnOpen(false)}
                  style={{ padding: '14px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
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
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: '#ffffff', 
          display: 'flex', 
          flexDirection: 'column', 
          zIndex: 1100, 
          animation: 'fadeIn 0.2s ease', 
          direction: 'rtl',
          overflowY: 'auto'
        }}>
          
          {/* Compact Header Bar */}
          <div style={{ 
            padding: '12px 16px', 
            borderBottom: '1px solid #e2e8f0', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            flexWrap: 'wrap',
            gap: '12px',
            background: '#ffffff',
            position: 'sticky', 
            top: 0, 
            zIndex: 10 
          }}>
            {/* Right Side: Company Name + Mobile Number */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>
                {selectedProfile.name}
              </span>
              <span style={{ color: '#cbd5e1', fontSize: '14px' }}>•</span>
              <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#64748b' }}>
                {selectedProfile.phone || 'دیارینەکراوە'}
              </span>
            </div>

            {/* Center: Inline text pills for the financials */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{
                height: '34px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                color: '#475569'
              }}>
                <span>کۆی کڕین:</span>
                <strong style={{ color: '#2563eb', fontWeight: 700 }}>
                  {((Number(selectedProfile.total_paid) || 0) + (Number(selectedProfile.total_remaining) || 0)).toLocaleString()}
                </strong>
              </div>

              <div style={{
                height: '34px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                color: '#475569'
              }}>
                <span>دراو:</span>
                <strong style={{ color: '#10b981', fontWeight: 700 }}>
                  {(Number(selectedProfile.total_paid) || 0).toLocaleString()}
                </strong>
              </div>

              <div style={{
                height: '34px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                color: '#475569'
              }}>
                <span>ماوە (قەرز):</span>
                <strong style={{ color: (Number(selectedProfile.total_remaining) || 0) > 0 ? '#ef4444' : '#1e293b', fontWeight: 700 }}>
                  {(Number(selectedProfile.total_remaining) || 0).toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Left Side: Close Button (Plain text 'داخستن' with no icon) */}
            <button 
              type="button"
              onClick={() => setSelectedProfile(null)}
              style={{ 
                height: '34px', 
                padding: '0 16px', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                border: '1px solid #cbd5e1', 
                background: '#ffffff', 
                color: '#475569', 
                fontWeight: 700, 
                fontSize: '0.84rem',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#475569'; }}
            >
              داخستن
            </button>
          </div>

          {/* Profile Body Content */}
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
            
            {/* Pay Debt Section (Only if debt > 0) */}
            {Number(selectedProfile.total_remaining) > 0 && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                flexWrap: 'wrap', 
                padding: '8px 12px', 
                background: '#fef2f2', 
                border: '1px solid #fecaca', 
                borderRadius: '8px', 
                fontSize: '0.84rem' 
              }}>
                <span style={{ fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap' }}>
                  دانەوەی قەرز:
                </span>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const current = Math.max(0, parseInt(payAmount) || 0);
                      const nextVal = Math.max(0, current - 250);
                      setPayAmount(nextVal === 0 ? '' : String(nextVal));
                    }}
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', fontWeight: 700, cursor: 'pointer' }}
                  >
                    -٢٥٠
                  </button>

                  <input 
                    type="number"
                    step="any"
                    min="0"
                    placeholder="بڕی پارە..."
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    style={{ width: '130px', height: '32px', padding: '0 8px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', fontSize: '0.86rem', fontWeight: 700, textAlign: 'center', boxSizing: 'border-box' }}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const current = Math.max(0, parseInt(payAmount) || 0);
                      setPayAmount(String(current + 250));
                    }}
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', fontWeight: 700, cursor: 'pointer' }}
                  >
                    +٢٥٠
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handlePaySupplierDebt}
                  disabled={isPayingDebt || !payAmount || parseFloat(payAmount) <= 0}
                  style={{ height: '32px', padding: '0 14px', borderRadius: '6px', background: '#10b981', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: isPayingDebt ? 'not-allowed' : 'pointer' }}
                >
                  {isPayingDebt ? 'چاوەڕێبە...' : 'تۆمارکردنی پارەدان'}
                </button>

                <button
                  type="button"
                  onClick={() => setPayAmount(selectedProfile.total_remaining.toString())}
                  style={{ height: '32px', padding: '0 12px', borderRadius: '6px', background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}
                >
                  دانەوەی هەمووی
                </button>

                <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setPayAmount('')}
                    style={{ height: '30px', padding: '0 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#ffffff', color: '#ef4444', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    0
                  </button>
                  {[1000, 5000, 10000, 25000].map(amt => (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => {
                        const current = Math.max(0, parseInt(payAmount) || 0);
                        setPayAmount(String(current + amt));
                      }}
                      style={{ height: '30px', padding: '0 8px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#ffffff', color: '#475569', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      +{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Invoices List under Profile: Strict Bordered Data Grid */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff', width: '100%', boxSizing: 'border-box' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', direction: 'rtl' }}>
                <colgroup>
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr style={{ height: '38px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#475569', fontWeight: 700 }}>
                    <th style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center' }}>ژمارەی پسووڵە</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center' }}>بەروار</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center' }}>کۆی پسووڵە</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center' }}>پارەی دراو</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center' }}>پارەی ماوە (قەرز)</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center' }}>شێوازی پارەدان</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center' }}>کردار</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedProfile.invoices || selectedProfile.invoices.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ border: '1px solid #e2e8f0', height: '48px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                        هیچ پسووڵەیەک نییە
                      </td>
                    </tr>
                  ) : (
                    selectedProfile.invoices.map(inv => {
                      const rem = Number(inv.remaining_amount) || 0;
                      return (
                        <tr 
                          key={inv.id} 
                          style={{ height: '38px', borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s ease' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#0284c7', fontWeight: 700, fontSize: '0.84rem' }}>
                            #{inv.invoice_number || inv.id}
                          </td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                            {formatDate(inv.created_at)}
                          </td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center', fontWeight: 700, color: '#1e293b', fontSize: '0.86rem' }}>
                            {Number(inv.total_amount).toLocaleString()}
                          </td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center', color: '#10b981', fontWeight: 600, fontSize: '0.86rem' }}>
                            {Number(inv.paid_amount).toLocaleString()}
                          </td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center', color: rem > 0 ? '#ef4444' : '#64748b', fontWeight: rem > 0 ? 700 : 500, fontSize: '0.86rem' }}>
                            {rem.toLocaleString()}
                          </td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center', fontSize: '0.80rem' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              fontSize: '0.78rem',
                              background: inv.payment_method === 'DEBT' ? '#fef2f2' : inv.payment_method === 'PARTIAL' ? '#fffbeb' : '#f0fdf4',
                              color: inv.payment_method === 'DEBT' ? '#ef4444' : inv.payment_method === 'PARTIAL' ? '#b45309' : '#16a34a'
                            }}>
                              {inv.payment_method === 'DEBT' ? 'قەرز' : inv.payment_method === 'PARTIAL' ? 'بەشێک قەرز' : 'نەقد'}
                            </span>
                          </td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => openInvoiceDetails(inv.id)}
                              style={{
                                background: '#ffffff',
                                color: '#0284c7',
                                border: '1px solid #cbd5e1',
                                padding: '2px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.borderColor = '#93c5fd'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                            >
                              وردەکاری
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Profile Chart (Below table, only if data exists) */}
            {profileChartData.length > 0 && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#ffffff', marginTop: '4px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.86rem', color: '#475569', fontWeight: 700 }}>هێڵکاری پارەدان و قەرزەکانی ئەم کۆمپانیایە بەپێی کات</h4>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <AreaChart data={profileChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip 
                        contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                        formatter={(val) => [`${Number(val).toLocaleString()}`]}
                      />
                      <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="rgba(59, 130, 246, 0.1)" name="کۆی کڕین" />
                      <Area type="monotone" dataKey="paid" stroke="#10b981" fill="rgba(16, 185, 129, 0.1)" name="پارەی دراو" />
                      <Area type="monotone" dataKey="remaining" stroke="#ef4444" fill="rgba(239, 68, 68, 0.1)" name="قەرز" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="pos-modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="pos-modal-card pos-modal-xl" onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                  <FileText color="#38bdf8" /> وردەکاری پسووڵەی کڕین #{selectedInvoice.id}
                </h2>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                  کۆمپانیا: <strong style={{ color: 'var(--text-primary)' }}>{selectedInvoice.supplier_name}</strong> • {formatDateTime(selectedInvoice.created_at, { twelveHour: true })}
                </div>
              </div>
              <button onClick={() => setSelectedInvoice(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18}/>
              </button>
            </div>

            {/* Financial Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>کۆی تێچووی پسووڵە</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '4px' }}>
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
            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>لیستی کاڵاکانی ناو ئەم پسووڵەیە:</h4>
            <div style={{ padding: '1px', borderRadius: '12px', overflowX: 'auto', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <thead style={{ background: 'var(--bg-secondary)' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>ناوی کاڵا</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>بارکۆد</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>بڕ (دانە)</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>نرخی کڕین (خام)</th>
                    {Number(selectedInvoice.additional_cost) > 0 && (
                      <th style={{ padding: '12px 16px', color: '#fbbf24', fontSize: '0.9rem' }}>تێچووی گەیشتن (Landed)</th>
                    )}
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>نرخی فرۆشتن</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>کۆی تێچوو</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedInvoice.items || selectedInvoice.items.length === 0 ? (
                    <tr><td colSpan={Number(selectedInvoice.additional_cost) > 0 ? "7" : "6"} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>هیچ کاڵایەک نەدۆزرایەوە</td></tr>
                  ) : (
                    selectedInvoice.items.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{it.product_name}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 600 }}>{it.barcode}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{it.quantity} دانە</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{Number(it.cost_price).toLocaleString()} دینار</td>
                        {Number(selectedInvoice.additional_cost) > 0 && (
                          <td style={{ padding: '12px 16px', color: '#fbbf24', fontWeight: 'bold' }}>
                            {Number(it.landed_cost_price || it.cost_price).toLocaleString()} دینار
                          </td>
                        )}
                        <td style={{ padding: '12px 16px', color: '#10b981' }}>{Number(it.selling_price).toLocaleString()} دینار</td>
                        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{(Number(it.cost_price) * Number(it.quantity)).toLocaleString()} دینار</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="btn-secondary"
                style={{ padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}
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
