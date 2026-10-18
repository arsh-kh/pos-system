import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Search, 
  Plus, 
  Phone, 
  Calendar as CalendarIcon, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  X, 
  Printer, 
  MessageCircle, 
  ArrowUpDown,
  Clock,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { formatDate, formatDateTime, formatCurrency } from '../utils/dateFormatter';
import './Dashboard.css';

const Owes = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Stats
  const [totalDebt, setTotalDebt] = useState(0);
  const [debtorsCount, setDebtorsCount] = useState(0);
  const [highestDebtor, setHighestDebtor] = useState(null);

  // Modals
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

  // Profile Overlay
  const [selectedProfile, setSelectedProfile] = useState(null);
  
  // Transaction State inside Profile
  const [transactionAmount, setTransactionAmount] = useState('');
  const [historyFilter, setHistoryFilter] = useState('ALL'); // ALL, TODAY, YESTERDAY, WEEK, MONTH, DATE
  const [specificDate, setSpecificDate] = useState('');
  const [historySort, setHistorySort] = useState('DESC'); // DESC, ASC

  // Thermal Voucher Print State
  const [printVoucher, setPrintVoucher] = useState(null);
  const storeName = localStorage.getItem('pos_store_name') || 'مارکێتی نموونەیی';
  const storePhone = localStorage.getItem('pos_store_phone') || '0750 000 0000';

  const fetchCustomers = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/customers');
      if (res.data.status === 'SUCCESS') {
        const data = res.data.data;
        setCustomers(data);
        
        let total = 0;
        let count = 0;
        let highest = null;
        
        data.forEach(c => {
          const debt = Number(c.total_debt) || 0;
          if (debt > 0) {
            total += debt;
            count++;
            if (!highest || debt > Number(highest.total_debt)) {
              highest = c;
            }
          }
        });
        
        setTotalDebt(total);
        setDebtorsCount(count);
        setHighestDebtor(highest);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/api/customers', newCustomer);
      setIsAddCustomerOpen(false);
      setNewCustomer({ name: '', phone: '' });
      fetchCustomers();
    } catch {
      alert('هەڵەیەک ڕوویدا لە کاتی زیادکردنی کڕیار');
    }
  };

  const openProfile = async (id) => {
    try {
      const res = await axios.get(`http://localhost:3001/api/customers/${id}`);
      if (res.data.status === 'SUCCESS') {
        setSelectedProfile(res.data.data);
      }
    } catch {
      alert('هەڵەیەک ڕوویدا لە کاتی بارکردنی پڕۆفایل');
    }
  };

  const handleTransaction = async (type) => {
    if (!transactionAmount || isNaN(transactionAmount) || Number(transactionAmount) <= 0) {
      return alert('تکایە بڕی پارەی دروست بنووسە');
    }
    
    const amountNum = Number(transactionAmount);
    try {
      await axios.post(`http://localhost:3001/api/customers/${selectedProfile.id}/debts`, {
        amount: amountNum,
        transaction_type: type
      });
      
      const currentDebt = Number(selectedProfile.total_debt) || 0;
      const newDebt = type === 'ADD' ? currentDebt + amountNum : Math.max(0, currentDebt - amountNum);

      // If customer repaid debt, offer receipt voucher and trigger print
      if (type === 'PAY') {
        setPrintVoucher({
          customerName: selectedProfile.name,
          customerPhone: selectedProfile.phone,
          amountPaid: amountNum,
          remainingDebt: newDebt,
          isStatement: false,
          date: formatDateTime(new Date(), { twelveHour: true })
        });
        setTimeout(() => window.print(), 100);
      }

      setTransactionAmount('');
      // Refresh profile and global list
      openProfile(selectedProfile.id);
      fetchCustomers();
    } catch {
      alert('هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی مامەڵە');
    }
  };

  const handlePrintCustomerDebt = (customer, paidAmount = null) => {
    if (!customer) return;
    setPrintVoucher({
      customerName: customer.name,
      customerPhone: customer.phone,
      amountPaid: paidAmount !== null ? paidAmount : 0,
      remainingDebt: Number(customer.total_debt || 0),
      isStatement: paidAmount === null,
      date: new Date().toLocaleString('en-US', { hour12: true })
    });
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handlePrintVoucher = (voucherData) => {
    setPrintVoucher(voucherData);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      kurdishSearchMatch([c.name, c.phone, c.notes], searchTerm)
    );
  }, [customers, searchTerm]);

  // Clean WhatsApp Number Formatter for Iraq (e.g. 0750... -> 964750...)
  const getWhatsAppLink = (phone, name, debt) => {
    if (!phone) return '#';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('07')) {
      clean = '964' + clean.substring(1);
    } else if (clean.startsWith('7')) {
      clean = '964' + clean;
    }
    const message = `سڵاو کڕیاری بەڕێز ${name}، ئاگادارت دەکەینەوە کە کۆی قەرزی ئێوە لە مارکێتەکەمان بریتییە لە ${Number(debt).toLocaleString()} دیناری عێراقی. سوپاس بۆ هاوکاریتان.`;
    return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  };

  // Filter & Sort History Logic
  const filteredHistory = useMemo(() => {
    if (!selectedProfile || !selectedProfile.history) return [];
    let list = [...selectedProfile.history];
    
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

    const weekAgoObj = new Date();
    weekAgoObj.setDate(weekAgoObj.getDate() - 7);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    list = list.filter(h => {
      const itemDate = new Date(h.created_at);
      const itemDateStr = itemDate.toISOString().split('T')[0];

      if (historyFilter === 'TODAY') {
        return itemDateStr === todayStr;
      } else if (historyFilter === 'YESTERDAY') {
        return itemDateStr === yesterdayStr;
      } else if (historyFilter === 'WEEK') {
        return itemDate >= weekAgoObj;
      } else if (historyFilter === 'MONTH') {
        return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
      } else if (historyFilter === 'DATE' && specificDate) {
        return itemDateStr === specificDate;
      }
      return true;
    });

    if (historySort === 'ASC') {
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return list;
  }, [selectedProfile, historyFilter, specificDate, historySort]);

  return (
    <div className="dashboard-page p-8" style={{ position: 'relative' }}>
      
      {/* Print Stylesheet for 80mm / 58mm Thermal Repayment Receipt Voucher */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-voucher-receipt, #thermal-voucher-receipt * {
            visibility: visible !important;
          }
          #thermal-voucher-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            background: white !important;
            color: black !important;
            padding: 8px !important;
            font-family: monospace, Tahoma, 'Noto Kufi Arabic', sans-serif !important;
            font-size: 13px !important;
            line-height: 1.4 !important;
            text-align: right !important;
            direction: rtl !important;
          }
          .voucher-divider {
            border-bottom: 1px dashed #000 !important;
            margin: 8px 0 !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle color="#ef4444" size={32} />
            قەرزەکانی کڕیارەکان
          </h1>
          <p className="text-secondary">بەڕێوەبردنی قەرز، تۆمارکردنی پارەدان، پەیوەندی و ئاگاداری وەتسئەپ</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 1rem', borderRadius: '12px' }}>
            <Search size={20} color="var(--text-secondary)" />
            <input 
              type="text" 
              placeholder="گەڕان بە ناو یان مۆبایل..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', marginRight: '10px', outline: 'none', width: '220px' }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            )}
          </div>
          <button 
            className="btn-primary" 
            onClick={() => setIsAddCustomerOpen(true)} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <Plus size={20} /> کڕیاری نوێ
          </button>
        </div>
      </div>

      {/* Key Metric KPI Cards */}
      <div className="stats-grid mb-8">
        <div className="stat-card glass-panel" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
          <h3>کۆی گشتی قەرزەکان</h3>
          <div className="value" style={{ color: '#ef4444' }}>{totalDebt.toLocaleString()} دینار</div>
          <div className="sub-text" style={{ color: '#94a3b8' }}>کۆی پارەی ماوە لای کڕیاران</div>
        </div>
        
        <div className="stat-card glass-panel">
          <h3>ژمارەی ئەو کڕیارانەی قەرزیان هەیە</h3>
          <div className="value highlight">{debtorsCount} کڕیار</div>
          <div className="sub-text" style={{ color: '#94a3b8' }}>لە کۆی {customers.length} کڕیاری تۆمارکراو</div>
        </div>
        
        <div className="stat-card glass-panel" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
          <h3>زۆرترین قەرزداری مارکێت</h3>
          <div className="value" style={{ color: '#f59e0b' }}>{highestDebtor ? highestDebtor.name : '-'}</div>
          <div className="sub-text" style={{ color: '#f59e0b', fontWeight: 'bold' }}>
            {highestDebtor ? `${Number(highestDebtor.total_debt).toLocaleString()} دینار` : 'هیچ نییە'}
          </div>
        </div>
      </div>

      {/* Customer List Table */}
      <div className="glass-panel" style={{ padding: '1px', borderRadius: '16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <thead style={{ background: 'var(--bg-tertiary)' }}>
            <tr>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>ڕیزبەندی</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>ناوی کڕیار</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>ژمارەی مۆبایل</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>کۆی قەرز (دینار)</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>پەیوەندی خێرا</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>کردار</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>باردەکرێت...</td></tr>
            ) : filteredCustomers.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>هیچ کڕیارێک نەدۆزرایەوە</td></tr>
            ) : (
              filteredCustomers.map((c, index) => {
                const debt = Number(c.total_debt) || 0;
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>#{index + 1}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.name}</td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600 }}>
                      {c.phone || '-'}
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 'bold', color: debt > 0 ? '#ef4444' : '#10b981' }}>
                      {debt.toLocaleString()} دینار
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {c.phone ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <a 
                            href={`tel:${c.phone}`} 
                            title="تەلەفۆنکردن"
                            style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '6px 10px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '0.85rem' }}
                          >
                            <Phone size={14} /> پەیوەندی
                          </a>
                          {debt > 0 && (
                            <a 
                              href={getWhatsAppLink(c.phone, c.name, debt)}
                              target="_blank"
                              rel="noreferrer"
                              title="ئاگاداری بە وەتسئەپ"
                              style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '6px 10px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '0.85rem' }}
                            >
                              <MessageCircle size={14} /> وەتسئەپ
                            </a>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>بێ ژمارە</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button 
                        onClick={() => openProfile(c.id)} 
                        style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        بینینی پڕۆفایل
                      </button>
                      {debt > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintCustomerDebt(c);
                          }}
                          title="چاپکردنی خێرای پسووڵەی قەرز"
                          style={{ background: 'var(--primary-color)', color: '#ffffff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '0.82rem' }}
                        >
                          <Printer size={14} /> پسووڵە
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Customer Modal */}
      {isAddCustomerOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsAddCustomerOpen(false)}>
          <div className="pos-modal-card pos-modal-sm" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                <UserCheck color="#3b82f6" /> زیادکردنی کڕیاری نوێ
              </h2>
              <button onClick={() => setIsAddCustomerOpen(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18}/>
              </button>
            </div>
            
            <form onSubmit={handleAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>ناوی کڕیار <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  required 
                  placeholder="ناوی چواری یان ناسراو..."
                  value={newCustomer.name} 
                  onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>ژمارەی مۆبایل</label>
                <input 
                  type="text" 
                  placeholder="0750 xxx xxxx"
                  value={newCustomer.phone} 
                  onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'monospace' }} 
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button 
                  type="submit" 
                  style={{ flex: 1, minWidth: '150px', padding: '14px', borderRadius: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(59,130,246,0.4)' }}
                >
                  پاشەکەوتکردنی کڕیار
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '14px 20px' }}
                >
                  داخستن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Profile Full-Screen Overlay */}
      {selectedProfile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', zIndex: 1100, animation: 'fadeIn 0.3s ease', overflowY: 'auto' }}>
          
          {/* Sticky Header */}
          <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button 
                onClick={() => setSelectedProfile(null)} 
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
              >
                <X size={24}/>
              </button>
              <h2 style={{ margin: 0 }}>پڕۆفایلی تەواوی کڕیار</h2>
            </div>
          </div>

          <div style={{ padding: 'clamp(1rem, 2.5vw, 2rem)', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            
            {/* Profile Info Header */}
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
              <div>
                <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2.4rem', color: 'var(--text-primary)' }}>{selectedProfile.name}</h1>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                  {selectedProfile.phone ? (
                    <>
                      <a 
                        href={`tel:${selectedProfile.phone}`} 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#60a5fa', textDecoration: 'none', background: 'rgba(59, 130, 246, 0.15)', padding: '8px 16px', borderRadius: '12px', fontWeight: 'bold' }}
                      >
                        <Phone size={18} /> پەیوەندی: {selectedProfile.phone}
                      </a>
                      {Number(selectedProfile.total_debt) > 0 && (
                        <a 
                          href={getWhatsAppLink(selectedProfile.phone, selectedProfile.name, selectedProfile.total_debt)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#10b981', textDecoration: 'none', background: 'rgba(16, 185, 129, 0.15)', padding: '8px 16px', borderRadius: '12px', fontWeight: 'bold' }}
                        >
                          <MessageCircle size={18} /> ناردنی ئاگاداری قەرز بە WhatsApp
                        </a>
                      )}
                      <button 
                        type="button"
                        onClick={() => handlePrintCustomerDebt(selectedProfile)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#ffffff', background: 'var(--primary-color)', padding: '8px 16px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', border: 'none' }}
                        title="چاپکردنی پسووڵەی قەرز بۆ کڕیار"
                      >
                        <Printer size={18} /> چاپکردنی پسووڵەی قەرز
                      </button>
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>ژمارەی مۆبایل تۆمار نەکراوە</span>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'center', padding: '1.5rem 2.5rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '1rem' }}>کۆی قەرزی ماوەی کڕیار</p>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ef4444' }}>
                  {Number(selectedProfile.total_debt).toLocaleString()} دینار
                </div>
              </div>
            </div>

            {/* Quick Add / Deduct Transaction Actions with 250 IQD Stepper & Currency Pills */}
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ margin: 0 }}>تۆمارکردنی مامەڵەی نوێ (زیادکردن یان کەمکردنەوەی قەرز)</h3>
                {Number(selectedProfile?.total_debt) > 0 && (
                  <button
                    type="button"
                    onClick={() => setTransactionAmount(String(selectedProfile.total_debt))}
                    style={{ padding: '6px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                  >
                    تەواوی قەرزەکە: {Number(selectedProfile.total_debt).toLocaleString()} دینار
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: '1', minWidth: '260px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const current = Math.max(0, parseInt(transactionAmount) || 0);
                        const nextVal = Math.max(0, current - 250);
                        setTransactionAmount(nextVal === 0 ? '' : String(nextVal));
                      }}
                      title="کەمکردنەوە بە ٢٥٠ دینار"
                      style={{ width: '48px', height: '52px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <span dir="ltr" style={{ display: 'inline-block' }}>-250</span>
                    </button>

                    <input 
                      type="number" 
                      step="250"
                      min="0"
                      placeholder="بڕی پارە بە دیناری عێراقی..." 
                      value={transactionAmount}
                      onChange={e => setTransactionAmount(e.target.value)}
                      style={{ flex: 1, padding: '14px', fontSize: '1.25rem', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold', textAlign: 'center', outline: 'none' }} 
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const current = Math.max(0, parseInt(transactionAmount) || 0);
                        const nextVal = current + 250;
                        setTransactionAmount(String(nextVal));
                      }}
                      title="زیادکردن بە ٢٥٠ دینار"
                      style={{ width: '48px', height: '52px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <span dir="ltr" style={{ display: 'inline-block' }}>+250</span>
                    </button>
                  </div>

                  {/* Currency Denominations Pills */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setTransactionAmount('')}
                      style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      0 ✕
                    </button>
                    {[250, 500, 1000, 5000, 10000, 25000, 50000].map(amt => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => {
                          const current = Math.max(0, parseInt(transactionAmount) || 0);
                          setTransactionAmount(String(current + amt));
                        }}
                        style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        <span dir="ltr" style={{ display: 'inline-block' }}>+{amt.toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-start', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => handleTransaction('ADD')} 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 24px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
                  >
                    <ArrowUpCircle size={20} /> زیادکردنی قەرز (+)
                  </button>
                  <button 
                    onClick={() => handleTransaction('PAY')} 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 24px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
                  >
                    <ArrowDownCircle size={20} /> وەرگرتنی قەرز (-)
                  </button>
                </div>
              </div>
            </div>

            {/* Transaction History Section */}
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>مێژووی تەواوی مامەڵەکانی قەرز</h3>
                  <small style={{ color: 'var(--text-secondary)' }}>بینین و فلتەرکردنی هەموو گۆڕانکارییەکانی قەرز</small>
                </div>
                
                {/* Sort Toggle Button */}
                <button
                  onClick={() => setHistorySort(prev => prev === 'DESC' ? 'ASC' : 'DESC')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  <ArrowUpDown size={16} />
                  {historySort === 'DESC' ? 'نوێترین بەرەو کۆنترین' : 'کۆنترین بەرەو نوێترین'}
                </button>
              </div>

              {/* Interactive Visual Date Filter Buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '14px' }}>
                {[
                  { id: 'ALL', label: 'هەموو کات' },
                  { id: 'TODAY', label: 'ئەمڕۆ' },
                  { id: 'YESTERDAY', label: 'دوێنێ' },
                  { id: 'WEEK', label: 'ئەم هەفتەیە' },
                  { id: 'MONTH', label: 'ئەم مانگە' },
                  { id: 'DATE', label: 'بەرواری دیاریکراو' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setHistoryFilter(tab.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid ' + (historyFilter === tab.id ? 'transparent' : 'var(--border-color)'),
                      cursor: 'pointer',
                      fontWeight: historyFilter === tab.id ? 'bold' : 'normal',
                      background: historyFilter === tab.id ? '#3b82f6' : 'var(--bg-secondary)',
                      color: historyFilter === tab.id ? '#ffffff' : 'var(--text-secondary)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}

                {historyFilter === 'DATE' && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '4px 10px', borderRadius: '8px' }}>
                    <CalendarIcon size={16} color="#60a5fa" />
                    <input 
                      type="date" 
                      value={specificDate} 
                      onChange={e => setSpecificDate(e.target.value)} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none' }} 
                    />
                  </div>
                )}
              </div>

              {/* History Table */}
              <div style={{ padding: '1px', borderRadius: '12px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <thead style={{ background: 'var(--bg-tertiary)' }}>
                    <tr>
                      <th style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>جۆری مامەڵە</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>بڕی پارە (دینار)</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>بەروار و کات</th>
                      <th style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>وەسڵی وەرگرتن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>هیچ مامەڵەیەک تۆمار نەکراوە بۆ ئەم فلتەرە</td></tr>
                    ) : (
                      filteredHistory.map(h => (
                        <tr key={h.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '16px 20px' }}>
                            {h.transaction_type === 'ADD' ? (
                              <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                                <ArrowUpCircle size={16}/> قەرز زیادکرا (+)
                              </span>
                            ) : (
                              <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                                <ArrowDownCircle size={16}/> قەرز وەرگیرا (-)
                              </span>
                            )}
                            {h.note && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '4px' }}>
                                📝 {h.note}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '16px 20px', fontWeight: 'bold', fontSize: '1.1rem', color: h.transaction_type === 'ADD' ? '#ef4444' : '#10b981' }}>
                            {Number(h.amount).toLocaleString()} دینار
                          </td>
                          <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <Clock size={14} color="var(--text-secondary)" />
                              {formatDateTime(h.created_at)}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px' }}>
                            {h.transaction_type === 'PAY' && (
                              <button 
                                onClick={() => handlePrintVoucher({
                                  customerName: selectedProfile.name,
                                  customerPhone: selectedProfile.phone,
                                  amountPaid: Number(h.amount),
                                  remainingDebt: Number(selectedProfile.total_debt),
                                  date: formatDateTime(h.created_at, { twelveHour: true })
                                })}
                                style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
                              >
                                <Printer size={15} /> چاپکردنی وەسڵ
                              </button>
                            )}
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

      {/* Thermal Print Receipt Style */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          #thermal-voucher-receipt, #thermal-voucher-receipt * {
            visibility: visible !important;
          }
          #thermal-voucher-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            background: white !important;
            color: black !important;
            padding: 8px 10px !important;
            font-family: monospace, Tahoma, 'Noto Kufi Arabic', sans-serif !important;
            font-size: 13px !important;
            direction: rtl !important;
            text-align: right !important;
          }
          .voucher-divider {
            border-bottom: 1px dashed #000 !important;
            margin: 6px 0 !important;
          }
        }
      `}</style>

      {/* Hidden Thermal Repayment Receipt Voucher Container (Targeted by @media print) */}
      {printVoucher && (
        <div id="thermal-voucher-receipt">
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>{storeName}</div>
          <div style={{ textAlign: 'center', fontSize: '11px', color: '#333' }}>پەیوەندی: {storePhone}</div>
          <div className="voucher-divider"></div>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
            {printVoucher.isStatement ? 'وەسڵی حسابی قەرزی کڕیار' : 'وەسڵی وەرگرتنی پارەی قەرز'}
          </div>
          <div className="voucher-divider"></div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ناوی کڕیار:</span>
            <span style={{ fontWeight: 'bold' }}>{printVoucher.customerName}</span>
          </div>
          {printVoucher.customerPhone && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ژمارەی مۆبایل:</span>
              <span>{printVoucher.customerPhone}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>بەروار و کات:</span>
            <span>{printVoucher.date}</span>
          </div>

          <div className="voucher-divider"></div>

          {!printVoucher.isStatement && printVoucher.amountPaid > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', margin: '4px 0' }}>
              <span>بڕی پارەی دراو:</span>
              <span>{printVoucher.amountPaid.toLocaleString()} دینار</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', margin: '4px 0' }}>
            <span>کۆی قەرزی ماوە:</span>
            <span>{printVoucher.remainingDebt.toLocaleString()} دینار</span>
          </div>

          <div className="voucher-divider"></div>
          <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '6px' }}>
            {printVoucher.isStatement ? 'سوپاس بۆ مامەڵەکردنتان لەگەڵمان' : 'سوپاس بۆ پاکتاوکردنی باڵانسەکەت'}
          </div>
          <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '4px', color: '#555' }}>سیستەمی خاڵی فرۆشتن</div>
        </div>
      )}

    </div>
  );
};

export default Owes;
