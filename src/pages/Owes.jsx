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

      // If customer repaid debt, offer receipt voucher
      if (type === 'PAY') {
        setPrintVoucher({
          customerName: selectedProfile.name,
          customerPhone: selectedProfile.phone,
          amountPaid: amountNum,
          remainingDebt: newDebt,
          date: new Date().toLocaleString('en-US', { hour12: true })
        });
      }

      setTransactionAmount('');
      // Refresh profile and global list
      openProfile(selectedProfile.id);
      fetchCustomers();
    } catch {
      alert('هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی مامەڵە');
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.phone && c.phone.includes(searchTerm))
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

  const handlePrintVoucher = (voucher) => {
    setPrintVoucher(voucher);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="dashboard-page p-8" style={{ position: 'relative' }}>
      
      {/* Print Stylesheet for 80mm / 58mm Thermal Repayment Receipt Voucher */}
      <style>{`
        @media print {
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
            font-family: monospace !important;
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
            <Search size={20} color="#94a3b8" />
            <input 
              type="text" 
              placeholder="گەڕان بە ناو یان مۆبایل..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'white', marginRight: '10px', outline: 'none', width: '220px' }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
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
          <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
            <tr>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>ڕیزبەندی</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>ناوی کڕیار</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>ژمارەی مۆبایل</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>کۆی قەرز (دینار)</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>پەیوەندی خێرا</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 500 }}>کردار</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>باردەکرێت...</td></tr>
            ) : filteredCustomers.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>هیچ کڕیارێک نەدۆزرایەوە</td></tr>
            ) : (
              filteredCustomers.map((c, index) => {
                const debt = Number(c.total_debt) || 0;
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding: '16px 20px', color: '#64748b' }}>#{index + 1}</td>
                    <td style={{ padding: '16px 20px', fontWeight: 'bold' }}>{c.name}</td>
                    <td style={{ padding: '16px 20px', color: '#a78bfa', fontFamily: 'monospace' }}>
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
                        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>بێ ژمارە</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <button 
                        onClick={() => openProfile(c.id)} 
                        style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        بینینی پڕۆفایل
                      </button>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', borderRadius: '24px', padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck color="#3b82f6" /> زیادکردنی کڕیاری نوێ
              </h2>
              <button onClick={() => setIsAddCustomerOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={24}/>
              </button>
            </div>
            
            <form onSubmit={handleAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>ناوی کڕیار <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  required 
                  placeholder="ناوی چواری یان ناسراو..."
                  value={newCustomer.name} 
                  onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>ژمارەی مۆبایل</label>
                <input 
                  type="text" 
                  placeholder="0750 xxx xxxx"
                  value={newCustomer.phone} 
                  onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontFamily: 'monospace' }} 
                />
              </div>

              <button 
                type="submit" 
                style={{ marginTop: '0.5rem', width: '100%', padding: '15px', borderRadius: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(59,130,246,0.4)' }}
              >
                پاشەکەوتکردنی کڕیار
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Customer Profile Full-Screen Overlay */}
      {selectedProfile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', zIndex: 1100, animation: 'fadeIn 0.3s ease', overflowY: 'auto' }}>
          
          {/* Sticky Header */}
          <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.95)', position: 'sticky', top: 0, zIndex: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button 
                onClick={() => setSelectedProfile(null)} 
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
              >
                <X size={24}/>
              </button>
              <h2 style={{ margin: 0 }}>پڕۆفایلی تەواوی کڕیار</h2>
            </div>
          </div>

          <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            
            {/* Profile Info Header */}
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
              <div>
                <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2.4rem', color: '#f8fafc' }}>{selectedProfile.name}</h1>
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
                    </>
                  ) : (
                    <span style={{ color: '#64748b' }}>ژمارەی مۆبایل تۆمار نەکراوە</span>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'center', padding: '1.5rem 2.5rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', fontSize: '1rem' }}>کۆی قەرزی ماوەی کڕیار</p>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ef4444' }}>
                  {Number(selectedProfile.total_debt).toLocaleString()} دینار
                </div>
              </div>
            </div>

            {/* Quick Add / Deduct Transaction Actions */}
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', marginBottom: '2rem' }}>
              <h3 style={{ margin: '0 0 1.25rem 0' }}>تۆمارکردنی مامەڵەی نوێ (زیادکردن یان کەمکردنەوەی قەرز)</h3>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: '1', minWidth: '260px' }}>
                  <input 
                    type="number" 
                    placeholder="بڕی پارە بە دیناری عێراقی..." 
                    value={transactionAmount}
                    onChange={e => setTransactionAmount(e.target.value)}
                    style={{ width: '100%', padding: '16px', fontSize: '1.2rem', borderRadius: '12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold' }} 
                  />
                </div>
                <button 
                  onClick={() => handleTransaction('ADD')} 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 28px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.05rem' }}
                >
                  <ArrowUpCircle size={22} /> زیادکردنی قەرز (+)
                </button>
                <button 
                  onClick={() => handleTransaction('PAY')} 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 28px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.05rem' }}
                >
                  <ArrowDownCircle size={22} /> وەرگرتنی قەرز / پارەدان (-)
                </button>
              </div>
            </div>

            {/* Transaction History Section */}
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>مێژووی تەواوی مامەڵەکانی قەرز</h3>
                  <small style={{ color: '#94a3b8' }}>بینین و فلتەرکردنی هەموو گۆڕانکارییەکانی قەرز</small>
                </div>
                
                {/* Sort Toggle Button */}
                <button
                  onClick={() => setHistorySort(prev => prev === 'DESC' ? 'ASC' : 'DESC')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#a78bfa', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  <ArrowUpDown size={16} />
                  {historySort === 'DESC' ? 'نوێترین بەرەو کۆنترین' : 'کۆنترین بەرەو نوێترین'}
                </button>
              </div>

              {/* Interactive Visual Date Filter Buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '14px' }}>
                {[
                  { id: 'ALL', label: 'هەموو کات' },
                  { id: 'TODAY', label: 'ئەمڕۆ' },
                  { id: 'YESTERDAY', label: 'دوێنێ' },
                  { id: 'WEEK', label: 'ئەم هەفتەیە' },
                  { id: 'MONTH', label: 'ئەم مانگە' },
                  { id: 'DATE', label: 'ڕۆژێک لە Calendar' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setHistoryFilter(tab.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: historyFilter === tab.id ? 'bold' : 'normal',
                      background: historyFilter === tab.id ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                      color: historyFilter === tab.id ? '#ffffff' : '#94a3b8',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}

                {historyFilter === 'DATE' && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '8px' }}>
                    <CalendarIcon size={16} color="#60a5fa" />
                    <input 
                      type="date" 
                      value={specificDate} 
                      onChange={e => setSpecificDate(e.target.value)} 
                      style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none' }} 
                    />
                  </div>
                )}
              </div>

              {/* History Table */}
              <div style={{ padding: '1px', borderRadius: '12px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <tr>
                      <th style={{ padding: '16px 20px', color: '#94a3b8' }}>جۆری مامەڵە</th>
                      <th style={{ padding: '16px 20px', color: '#94a3b8' }}>بڕی پارە (دینار)</th>
                      <th style={{ padding: '16px 20px', color: '#94a3b8' }}>بەروار و کات</th>
                      <th style={{ padding: '16px 20px', color: '#94a3b8' }}>وەسڵی وەرگرتن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>هیچ مامەڵەیەک تۆمار نەکراوە بۆ ئەم فلتەرە</td></tr>
                    ) : (
                      filteredHistory.map(h => (
                        <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
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
                              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '4px' }}>
                                📝 {h.note}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '16px 20px', fontWeight: 'bold', fontSize: '1.1rem', color: h.transaction_type === 'ADD' ? '#ef4444' : '#10b981' }}>
                            {Number(h.amount).toLocaleString()} دینار
                          </td>
                          <td style={{ padding: '16px 20px', color: '#94a3b8' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <Clock size={14} color="#64748b" />
                              {new Date(h.created_at).toLocaleString('en-US', { hour12: true })}
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
                                  date: new Date(h.created_at).toLocaleString('en-US', { hour12: true })
                                })}
                                style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#c084fc', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Printer size={15} /> چاپی وەسڵ
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

      {/* Hidden Thermal Repayment Receipt Voucher Container (Targeted by @media print) */}
      {printVoucher && (
        <div id="thermal-voucher-receipt">
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>{storeName}</div>
          <div style={{ textAlign: 'center', fontSize: '11px', color: '#333' }}>پەیوەندی: {storePhone}</div>
          <div className="voucher-divider"></div>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>وەسڵی وەرگرتنی پارەی قەرز</div>
          <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '2px' }}>Payment Voucher</div>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', margin: '4px 0' }}>
            <span>بڕی پارەی دراو:</span>
            <span>{printVoucher.amountPaid.toLocaleString()} دینار</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', margin: '4px 0' }}>
            <span>قەرزی ماوە لە ئێستادا:</span>
            <span>{printVoucher.remainingDebt.toLocaleString()} دینار</span>
          </div>

          <div className="voucher-divider"></div>
          <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '6px' }}>سوپاس بۆ پاکتاوکردنی باڵانسەکەت</div>
          <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '4px', color: '#555' }}>سیستەمی زیرەکی مارکێت</div>
        </div>
      )}

    </div>
  );
};

export default Owes;
