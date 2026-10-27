import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { formatDate, formatDateTime } from '../utils/dateFormatter';
import BarcodeSVG from '../components/BarcodeSVG';
import useBarcodeScanner from '../hooks/useBarcodeScanner';
import { cleanReceiptBarcode } from '../utils/barcodeNormalizer';
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
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', notes: '' });

  // Profile Overlay
  const [selectedProfile, setSelectedProfile] = useState(null);
  
  // Transaction State inside Profile
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionNote, setTransactionNote] = useState('');

  // Thermal Voucher Print State
  const [printVoucher, setPrintVoucher] = useState(null);
  const storeName = localStorage.getItem('pos_store_name') || 'مارکێتی شارەکەم';
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
      setNewCustomer({ name: '', phone: '', notes: '' });
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

  // Hardware Barcode Scanner & Receipt Lookup Handler
  const handleBarcodeScan = async (scannedCode) => {
    if (!scannedCode) return;
    const normalized = cleanReceiptBarcode(scannedCode).trim();

    // 1. Receipt / Voucher Barcode check (e.g. shrm/2026/0059 or SHRM/2026/0059)
    if (/shrm\/\d+\/(\d+)/i.test(normalized) || /^shrm/i.test(normalized)) {
      const parts = normalized.split('/');
      const lastPart = parts[parts.length - 1];
      const targetId = parseInt(lastPart, 10);

      if (targetId) {
        setSearchTerm('');

        // A. Check if targetId is directly a Customer ID
        const customerDirect = customers.find(c => c.id === targetId);
        if (customerDirect) {
          openProfile(customerDirect.id);
          return;
        }

        // B. Check if targetId is a Sale ID with a customer attached
        try {
          const res = await axios.get(`http://localhost:3001/api/sales/${targetId}`);
          if (res.data?.status === 'SUCCESS' && res.data.data) {
            const saleData = res.data.data;
            if (saleData.customer_id) {
              openProfile(saleData.customer_id);
              return;
            } else {
              alert(`پسووڵەی #${targetId} فرۆشی نەقدییە (کاش) و لەسەر قەرزی کڕیار تۆمار نەکراوە.`);
              return;
            }
          }
        } catch (err) {
          console.log('Sale lookup failed:', err);
        }

        alert(`هیچ کڕیار یان پسووڵەیەکی قەرز بە ژمارەی #${targetId} نەدۆزرایەوە.`);
        return;
      }
    }

    // 2. Direct Customer Phone or ID match
    const cleanDigits = normalized.replace(/\D/g, '');
    const matchedCust = customers.find(c => 
      String(c.id) === normalized ||
      (cleanDigits && String(c.id) === cleanDigits) ||
      (cleanDigits && c.phone && c.phone.replace(/\D/g, '') === cleanDigits)
    );

    if (matchedCust) {
      setSearchTerm('');
      openProfile(matchedCust.id);
      return;
    }

    // 3. Fallback: filter list
    setSearchTerm(normalized);
  };

  // Global Hardware Barcode Scanner Listener
  useBarcodeScanner((scannedCode) => {
    handleBarcodeScan(scannedCode);
  });

  const handleTransaction = async (type) => {
    if (!transactionAmount || isNaN(transactionAmount) || Number(transactionAmount) <= 0) {
      return alert('تکایە بڕی پارەی دروست بنووسە');
    }
    
    const amountNum = Number(transactionAmount);
    try {
      await axios.post(`http://localhost:3001/api/customers/${selectedProfile.id}/debts`, {
        amount: amountNum,
        transaction_type: type,
        note: transactionNote.trim() || undefined
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
        setTimeout(() => window.print(), 300);
      }

      setTransactionAmount('');
      setTransactionNote('');
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
    if (!searchTerm) return customers;
    const cleanSearch = cleanReceiptBarcode(searchTerm).trim().toLowerCase();

    // Check if search term is a receipt barcode (e.g. shrm/2026/0059)
    if (/shrm\/\d+\/(\d+)/i.test(cleanSearch)) {
      const parts = cleanSearch.split('/');
      const idNum = parseInt(parts[parts.length - 1], 10);
      if (idNum) {
        const matching = customers.filter(c => c.id === idNum);
        if (matching.length > 0) return matching;
      }
    }

    return customers.filter(c => 
      String(c.id) === cleanSearch ||
      kurdishSearchMatch([c.name, c.phone, c.notes], cleanSearch)
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

  // Format phone numbers cleanly as e.g. 0770-321-7654 / 0750-123-4567
  const formatPhoneNumber = (phone) => {
    if (!phone) return '-';
    const cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('07')) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10 && cleaned.startsWith('7')) {
      return `0${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 13 && cleaned.startsWith('964')) {
      return `0${cleaned.slice(3, 6)}-${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length > 7) {
      const p1 = cleaned.slice(0, 4);
      const p2 = cleaned.slice(4, 7);
      const p3 = cleaned.slice(7);
      return `${p1}-${p2}${p3 ? '-' + p3 : ''}`;
    }
    return phone;
  };

  // Compute running balance chronologically from oldest to newest
  const historyWithBalance = useMemo(() => {
    if (!selectedProfile?.history) return [];
    const chrono = [...selectedProfile.history].sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id - b.id);
    let balance = 0;
    const balanceMap = new Map();
    chrono.forEach(item => {
      const amt = Number(item.amount) || 0;
      if (item.transaction_type === 'ADD') {
        balance += amt;
      } else {
        balance = Math.max(0, balance - amt);
      }
      balanceMap.set(item.id, balance);
    });

    return selectedProfile.history.map(item => ({
      ...item,
      running_balance: balanceMap.get(item.id) ?? 0
    }));
  }, [selectedProfile]);

  // Print receipt for any transaction in the debt history (both previous POS sales and cash repayments/additions)
  const handlePrintHistoryReceipt = async (h) => {
    if (h.sale_id) {
      try {
        const res = await axios.get(`http://localhost:3001/api/sales/${h.sale_id}`);
        if (res.data.status === 'SUCCESS') {
          const sale = res.data.data;
          setPrintVoucher({
            isSale: true,
            saleId: h.sale_id,
            customerName: selectedProfile.name,
            customerPhone: selectedProfile.phone,
            date: formatDateTime(h.created_at, { twelveHour: true }),
            items: sale.items || [],
            totalAmount: Number(sale.total_amount),
            paidAmount: Number(sale.paid_amount || 0),
            debtAmount: Number(h.amount),
            paymentMethod: sale.payment_method,
            runningBalance: Number(h.running_balance)
          });
          setTimeout(() => {
            window.print();
          }, 150);
          return;
        }
      } catch (err) {
        console.error('Failed to fetch sale details:', err);
      }

      setPrintVoucher({
        isSale: true,
        saleId: h.sale_id,
        customerName: selectedProfile.name,
        customerPhone: selectedProfile.phone,
        date: formatDateTime(h.created_at, { twelveHour: true }),
        itemsSummary: h.sale_items_summary,
        totalAmount: Number(h.amount),
        paidAmount: 0,
        debtAmount: Number(h.amount),
        runningBalance: Number(h.running_balance)
      });
      setTimeout(() => {
        window.print();
      }, 150);
    } else {
      setPrintVoucher({
        isSale: false,
        transactionType: h.transaction_type,
        customerName: selectedProfile.name,
        customerPhone: selectedProfile.phone,
        date: formatDateTime(h.created_at, { twelveHour: true }),
        amountPaid: Number(h.amount),
        remainingDebt: Number(h.running_balance),
        note: h.note
      });
      setTimeout(() => {
        window.print();
      }, 150);
    }
  };

  return (
    <div className="dashboard-page p-8" style={{ position: 'relative', direction: 'rtl' }}>
      
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
            width: 71mm !important;
            max-width: 71mm !important;
            box-sizing: border-box !important;
            background: white !important;
            color: black !important;
            padding: 4px 5px !important;
            font-family: monospace, Tahoma, 'Noto Kufi Arabic', sans-serif !important;
            font-size: 12px !important;
            line-height: 1.4 !important;
            text-align: right !important;
            direction: rtl !important;
          }
          #thermal-voucher-receipt * {
            box-sizing: border-box !important;
          }
          .voucher-divider {
            border-bottom: 1px dashed #000 !important;
            margin: 8px 0 !important;
          }
        }
      `}</style>

      {/* Compact Single-Line Top Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '12px', flexWrap: 'wrap' }}>
        {/* Right side: Page Title + Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            قەرزەکانی کڕیارەکان
          </h1>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="گەڕان بە ناو، مۆبایل، یان سکانی باڕکۆد..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(cleanReceiptBarcode(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchTerm) {
                  e.preventDefault();
                  handleBarcodeScan(searchTerm);
                }
              }}
              style={{ 
                width: '320px', 
                height: '38px', 
                padding: '0 28px 0 12px', 
                borderRadius: '8px', 
                border: '1px solid #cbd5e1', 
                background: '#ffffff', 
                color: 'var(--text-primary)', 
                fontSize: '0.88rem', 
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')} 
                style={{ 
                  position: 'absolute', 
                  left: '8px', 
                  background: 'transparent', 
                  border: 'none', 
                  color: '#64748b', 
                  cursor: 'pointer', 
                  fontSize: '14px', 
                  fontWeight: 700 
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Center / Left side: Compact Inline Stat Pills + Add Customer Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ 
            height: '38px', 
            padding: '0 14px', 
            borderRadius: '8px', 
            background: 'rgba(239, 68, 68, 0.08)', 
            border: '1px solid rgba(239, 68, 68, 0.25)', 
            color: '#ef4444', 
            fontWeight: 800, 
            fontSize: '0.86rem', 
            display: 'inline-flex', 
            alignItems: 'center', 
            whiteSpace: 'nowrap' 
          }}>
            کۆی گشتی قەرز: {totalDebt.toLocaleString('en-US')} د.ع
          </div>

          <div style={{ 
            height: '38px', 
            padding: '0 14px', 
            borderRadius: '8px', 
            background: 'var(--bg-tertiary)', 
            border: '1px solid var(--border-color)', 
            color: 'var(--text-primary)', 
            fontWeight: 800, 
            fontSize: '0.86rem', 
            display: 'inline-flex', 
            alignItems: 'center', 
            whiteSpace: 'nowrap' 
          }}>
            کڕیارە قەرزدارەکان: {debtorsCount}
          </div>

          <button 
            type="button"
            className="btn-primary" 
            onClick={() => setIsAddCustomerOpen(true)} 
            style={{ 
              height: '38px', 
              padding: '0 18px', 
              borderRadius: '8px', 
              background: '#2563eb', 
              color: '#ffffff', 
              border: 'none', 
              cursor: 'pointer', 
              fontWeight: 700, 
              fontSize: '0.88rem', 
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            + کڕیاری نوێ
          </button>
        </div>
      </div>

      {/* Bordered Compact Customer List Table (7 Columns, 38px Row Height) */}
      <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', background: '#ffffff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0', direction: 'rtl' }}>
          <thead>
            <tr style={{ background: '#f8fafc', height: '38px' }}>
              <th style={{ border: '1px solid #e2e8f0', width: '50px', padding: '6px 10px', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>#</th>
              <th style={{ border: '1px solid #e2e8f0', width: '220px', padding: '6px 14px', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', textAlign: 'right', whiteSpace: 'nowrap' }}>ناوی کڕیار</th>
              <th style={{ border: '1px solid #e2e8f0', width: '140px', padding: '6px 12px', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>ژمارەی مۆبایل</th>
              <th style={{ border: '1px solid #e2e8f0', width: '130px', padding: '6px 12px', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>کۆی قەرز</th>
              <th style={{ border: '1px solid #e2e8f0', width: '110px', padding: '6px 12px', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>دۆخی قەرز</th>
              <th style={{ border: '1px solid #e2e8f0', padding: '6px 14px', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', textAlign: 'right', whiteSpace: 'nowrap' }}>تێبینی</th>
              <th style={{ border: '1px solid #e2e8f0', width: '140px', padding: '6px 12px', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>کردارەکان</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ border: '1px solid #e2e8f0', padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>باردەکرێت...</td></tr>
            ) : filteredCustomers.length === 0 ? (
              <tr><td colSpan="7" style={{ border: '1px solid #e2e8f0', padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>هیچ کڕیارێک نەدۆزرایەوە</td></tr>
            ) : (
              filteredCustomers.map((c, index) => {
                const debt = Number(c.total_debt) || 0;
                return (
                  <tr 
                    key={c.id} 
                    style={{ height: '38px', transition: 'background 0.12s ease' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* 1. # */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>
                      #{index + 1}
                    </td>

                    {/* 2. ناوی کڕیار (Clickable to open profile) */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '6px 14px', textAlign: 'right' }}>
                      <span 
                        onClick={() => openProfile(c.id)} 
                        style={{ fontWeight: 800, color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.88rem' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#2563eb'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-primary)'}
                      >
                        {c.name}
                      </span>
                    </td>

                    {/* 3. ژمارەی مۆبایل */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center' }}>
                      <span 
                        dir="ltr"
                        style={{ 
                          fontFamily: 'monospace', 
                          fontWeight: 600, 
                          fontSize: '13px', 
                          color: c.phone ? 'var(--text-primary)' : '#94a3b8',
                          display: 'inline-block'
                        }}
                      >
                        {formatPhoneNumber(c.phone)}
                      </span>
                    </td>

                    {/* 4. کۆی قەرز (Formatted without repeating دینار) */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: '0.9rem', color: debt > 0 ? '#ef4444' : '#10b981' }}>
                        {debt.toLocaleString('en-US')}
                      </span>
                    </td>

                    {/* 5. دۆخی قەرز (قەرزدار / واسڵکراو) */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: debt > 0 ? '#ef4444' : '#10b981' }}>
                        {debt > 0 ? 'قەرزدار' : 'واسڵکراو'}
                      </span>
                    </td>

                    {/* 6. تێبینی */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '6px 14px', textAlign: 'right', color: c.notes ? 'var(--text-primary)' : '#94a3b8', fontSize: '0.84rem' }}>
                      {c.notes || '-'}
                    </td>

                    {/* 7. کردارەکان: پڕۆفایل و پسووڵە لەسەر دوو ستوونی ڕێک و دیاریکراو */}
                    <td style={{ border: '1px solid #e2e8f0', padding: '4px 8px', textAlign: 'center' }}>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '62px 62px', 
                        gap: '6px', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        margin: '0 auto',
                        width: '130px'
                      }}>
                        <button 
                          type="button"
                          onClick={() => openProfile(c.id)} 
                          style={{ 
                            width: '62px', 
                            height: '28px', 
                            padding: '0', 
                            borderRadius: '6px', 
                            border: '1px solid #cbd5e1', 
                            background: '#f8fafc', 
                            color: '#2563eb', 
                            cursor: 'pointer', 
                            fontWeight: 700, 
                            fontSize: '0.78rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box'
                          }}
                        >
                          پرۆفایل
                        </button>
                        {debt > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintCustomerDebt(c);
                            }}
                            style={{ 
                              width: '62px', 
                              height: '28px', 
                              padding: '0', 
                              borderRadius: '6px', 
                              border: '1px solid #bfdbfe', 
                              background: '#eff6ff', 
                              color: '#2563eb', 
                              cursor: 'pointer', 
                              fontWeight: 700, 
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxSizing: 'border-box'
                            }}
                          >
                            پسووڵە
                          </button>
                        ) : (
                          <div style={{ width: '62px', height: '28px' }} />
                        )}
                      </div>
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
          <div className="pos-modal-card pos-modal-sm" onClick={e => e.stopPropagation()} style={{ background: '#ffffff', direction: 'rtl', padding: '20px', borderRadius: '14px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b', fontWeight: 800 }}>
                زیادکردنی کڕیاری نوێ
              </h2>
              <button 
                type="button"
                onClick={() => setIsAddCustomerOpen(false)} 
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#64748b', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                  ناوی کڕیار <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text" 
                  required 
                  placeholder="ناوی کڕیار بنووسە..."
                  value={newCustomer.name} 
                  onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} 
                  style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                  ژمارەی مۆبایل
                </label>
                <input 
                  type="text" 
                  placeholder="0750 xxx xxxx"
                  value={newCustomer.phone} 
                  onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} 
                  style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '0.88rem' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                  تێبینی
                </label>
                <input 
                  type="text" 
                  placeholder="تێبینی یان ناونیشان بنووسە..."
                  value={newCustomer.notes} 
                  onChange={e => setNewCustomer({ ...newCustomer, notes: e.target.value })} 
                  style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', boxSizing: 'border-box', fontSize: '0.88rem' }} 
                />
              </div>

              <div style={{ marginTop: '4px' }}>
                <button 
                  type="submit" 
                  style={{ width: '100%', height: '40px', borderRadius: '8px', background: '#2563eb', color: '#ffffff', border: 'none', fontSize: '0.92rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  پاشەکەوتکردن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Profile & Itemized Debt Ledger Modal */}
      {selectedProfile && (
        <div 
          className="pos-modal-overlay" 
          onClick={() => setSelectedProfile(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            direction: 'rtl',
            padding: '16px'
          }}
        >
          <div 
            style={{ 
              background: '#ffffff', 
              border: '1px solid #cbd5e1', 
              borderRadius: '16px', 
              width: '95%', 
              maxWidth: '1120px', 
              maxHeight: '92vh', 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden', 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)' 
            }} 
            onClick={e => e.stopPropagation()}
          >
            {/* 1. Compact Customer Header Bar */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>
                  {selectedProfile.name}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#64748b', fontWeight: 600 }} dir="ltr">
                  {formatPhoneNumber(selectedProfile.phone)}
                </span>
                <span style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '4px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '0.88rem' }}>
                  کۆی قەرزی ماوە: {Number(selectedProfile.total_debt).toLocaleString('en-US')} دینار
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  type="button"
                  onClick={() => setSelectedProfile(null)}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#64748b', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, lineHeight: 1 }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Profile Content Body */}
            <div style={{ padding: '16px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* 2. Streamlined 1-Row Transaction Form */}
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr auto auto', gap: '10px', alignItems: 'center' }}>
                  {/* Amount Input with inline auto-fill button */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input 
                      type="number"
                      step="any"
                      min="0"
                      placeholder="بڕی پارە..."
                      value={transactionAmount}
                      onChange={e => setTransactionAmount(e.target.value)}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 85px 0 10px',
                        borderRadius: '8px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#1e293b',
                        fontSize: '0.88rem',
                        boxSizing: 'border-box'
                      }}
                    />
                    {Number(selectedProfile?.total_debt) > 0 && (
                      <button
                        type="button"
                        onClick={() => setTransactionAmount(String(selectedProfile.total_debt))}
                        style={{
                          position: 'absolute',
                          left: '4px',
                          top: '4px',
                          bottom: '4px',
                          padding: '0 8px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        تەواوی قەرز
                      </button>
                    )}
                  </div>

                  {/* Details/Note Input */}
                  <input 
                    type="text"
                    placeholder="وردەکاری یان تێبینی بنووسە..."
                    value={transactionNote}
                    onChange={e => setTransactionNote(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#1e293b',
                      fontSize: '0.88rem',
                      boxSizing: 'border-box'
                    }}
                  />

                  {/* Button: وەرگرتنی قەرز (-) */}
                  <button
                    type="button"
                    onClick={() => handleTransaction('PAY')}
                    style={{
                      height: '38px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    وەرگرتنی قەرز (-)
                  </button>

                  {/* Button: زیادکردنی قەرز (+) */}
                  <button
                    type="button"
                    onClick={() => handleTransaction('ADD')}
                    style={{
                      height: '38px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    زیادکردنی قەرز (+)
                  </button>
                </div>
              </div>

              {/* 3. Itemized Debt History Table */}
              <div>
                {/* Bordered Data Grid */}
                <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', background: '#ffffff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0', direction: 'rtl' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', height: '36px' }}>
                        <th style={{ border: '1px solid #e2e8f0', width: '145px', padding: '6px 10px', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>بەروار و کات</th>
                        <th style={{ border: '1px solid #e2e8f0', width: '120px', padding: '6px 10px', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>جۆری مامەڵە</th>
                        <th style={{ border: '1px solid #e2e8f0', padding: '6px 12px', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', textAlign: 'right' }}>وردەکاری قەرز و کاڵاکان</th>
                        <th style={{ border: '1px solid #e2e8f0', width: '110px', padding: '6px 10px', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>بڕی پارە</th>
                        <th style={{ border: '1px solid #e2e8f0', width: '110px', padding: '6px 10px', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>ماوەی قەرز</th>
                        <th style={{ border: '1px solid #e2e8f0', width: '110px', padding: '6px 8px', color: '#64748b', fontWeight: 700, fontSize: '0.82rem', textAlign: 'center', whiteSpace: 'nowrap' }}>وەسڵ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyWithBalance.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ border: '1px solid #e2e8f0', padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>
                            هیچ مامەڵەیەک نەدۆزرایەوە
                          </td>
                        </tr>
                      ) : (
                        historyWithBalance.map(h => {
                          const isAdd = h.transaction_type === 'ADD';
                          
                          // Construct detailed itemized invoice string or manual note
                          let detailsText = '';
                          if (h.sale_items_summary) {
                            detailsText = `پسووڵەی #${h.invoice_id || h.sale_id}: ${h.sale_items_summary}`;
                          } else if (h.sale_id) {
                            detailsText = `پسووڵەی #${h.sale_id}${h.note ? ` (${h.note})` : ''}`;
                          } else {
                            detailsText = h.note || (isAdd ? 'زیادکردنی قەرز بە دەستی' : 'دانەوەی قەرز بە دەستی');
                          }

                          return (
                            <tr 
                              key={h.id}
                              style={{ height: 'auto', minHeight: '38px', transition: 'background 0.12s ease' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              {/* 1. بەروار و کات */}
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'center', fontSize: '0.82rem', color: '#64748b', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                                {formatDateTime(h.created_at)}
                              </td>

                              {/* 2. جۆری مامەڵە (Plain text without icons) */}
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.84rem', color: isAdd ? '#ef4444' : '#10b981' }}>
                                  {isAdd ? 'بردنی قەرز (+)' : 'دانەوەی قەرز (-)'}
                                </span>
                              </td>

                              {/* 3. وردەکاری قەرز و کاڵاکان (Itemized product list or manual note) */}
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 12px', textAlign: 'right', fontSize: '0.84rem', color: '#1e293b', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.45 }}>
                                {detailsText}
                              </td>

                              {/* 4. بڕی پارە (Formatted number without repeating دینار) */}
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: '0.88rem', color: isAdd ? '#ef4444' : '#10b981' }}>
                                  {isAdd ? `+${Number(h.amount).toLocaleString('en-US')}` : `-${Number(h.amount).toLocaleString('en-US')}`}
                                </span>
                              </td>

                              {/* 5. ماوەی قەرز (Running Balance) */}
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: '0.88rem', color: '#1e293b' }}>
                                  {Number(h.running_balance).toLocaleString('en-US')}
                                </span>
                              </td>

                              {/* 6. وەسڵ (چاپکردنی وەسڵ بۆ هەموو مامەڵەکان) */}
                              <td style={{ border: '1px solid #e2e8f0', padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <button
                                  type="button"
                                  onClick={() => handlePrintHistoryReceipt(h)}
                                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}
                                >
                                  چاپکردنی وەسڵ
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Thermal Receipt Container (Targeted by @media print) */}
      {printVoucher && (
        <div id="thermal-voucher-receipt">
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>مارکێتی شارەکەم</div>

          {/* Unique Barcode directly below store name */}
          <div style={{ textAlign: 'center', margin: '4px 0 6px 0' }}>
            <BarcodeSVG 
              value={printVoucher.isSale ? `shrm/2026/${String(printVoucher.saleId || '0').padStart(4, '0')}` : `shrm/2026/${String(printVoucher.customerId || '0').padStart(4, '0')}`} 
              maxWidth="62mm" 
              barHeight={52} 
            />
          </div>

          <div className="voucher-divider"></div>

          {printVoucher.isStatement ? (
            /* Customer Debt Statement Voucher */
            <>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>
                وەسڵی حسابی قەرزی کڕیار
              </div>
              <div className="voucher-divider"></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>ناوی کڕیار:</span>
                <span style={{ fontWeight: 'bold' }}>{printVoucher.customerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>بەروار و کات:</span>
                <span>{printVoucher.date}</span>
              </div>
              <div className="voucher-divider"></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', margin: '4px 0' }}>
                <span>کۆی قەرزی ماوە:</span>
                <span>{Number(printVoucher.remainingDebt).toLocaleString()} دینار</span>
              </div>
            </>
          ) : printVoucher.isSale ? (
            /* Previous POS Credit Sale Invoice */
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>ژمارەی وەسڵ:</span>
                <span style={{ fontWeight: 'bold' }}>#{printVoucher.saleId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>بەروار و کات:</span>
                <span>{printVoucher.date}</span>
              </div>
              <div className="voucher-divider"></div>

              {/* 5-Column Grid Table matching Cashier screen (#، کاڵا، دانە، نرخ، کۆ) with vertical borders */}
              <table style={{ 
                width: '100%', 
                tableLayout: 'fixed',
                borderCollapse: 'collapse', 
                border: '1px solid #000000', 
                direction: 'rtl',
                fontSize: '10.5px',
                margin: '5px 0',
                boxSizing: 'border-box'
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000000', background: '#f5f5f5' }}>
                    <th style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', width: '20px' }}>#</th>
                    <th style={{ border: '1px solid #000000', padding: '3px 3px', textAlign: 'right' }}>کاڵا</th>
                    <th style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', width: '38px' }}>دانە</th>
                    <th style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', width: '44px' }}>نرخ</th>
                    <th style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', width: '48px' }}>کۆ</th>
                  </tr>
                </thead>
                <tbody>
                  {printVoucher.items && printVoucher.items.length > 0 ? (
                    printVoucher.items.map((it, idx) => {
                      const qtyVal = Number(it.quantity) || 0;
                      const cleanQty = Number.isInteger(qtyVal) ? qtyVal : parseFloat(qtyVal.toFixed(3));
                      const isGramOrWeight = it.unit === 'گم' || it.unit === 'کگم' || it.unit === 'گرام' || it.unit === 'کیلۆ' || it.unit_type === 'WEIGHT' || String(it.unit || '').includes('گم') || String(it.unit || '').includes('کێش');
                      const isBox = it.unit_type === 'BOX' || it.unit === 'کارتۆن';
                      const displayQty = isGramOrWeight ? `${cleanQty} گم` : (isBox ? `${cleanQty} کارتۆن` : cleanQty);
                      const itemPrice = Number(it.price_at_sale || it.price_per_unit || it.price || 0);
                      const itemTotal = itemPrice * Number(it.quantity || 1);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #000000' }}>
                          <td style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 3px', textAlign: 'right', fontWeight: 600, overflow: 'hidden', wordBreak: 'break-word' }}>{it.product_name || it.name}</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', whiteSpace: 'nowrap' }}>{displayQty}</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', whiteSpace: 'nowrap' }}>{itemPrice.toLocaleString()}</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 1px', textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{itemTotal.toLocaleString()}</td>
                        </tr>
                      );
                    })
                  ) : printVoucher.itemsSummary ? (
                    <tr>
                      <td colSpan="5" style={{ border: '1px solid #000000', padding: '4px', textAlign: 'center' }}>
                        {printVoucher.itemsSummary}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>

              <div className="voucher-divider"></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold' }}>
                <span>کۆی گشتی:</span>
                <span>{Number(printVoucher.totalAmount).toLocaleString()} دینار</span>
              </div>
              {printVoucher.paidAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '2px 0' }}>
                  <span>بڕی پارەی دراو:</span>
                  <span>{Number(printVoucher.paidAmount).toLocaleString()} دینار</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', margin: '2px 0' }}>
                <span>بڕی قەرزکراو:</span>
                <span>{Number(printVoucher.debtAmount).toLocaleString()} دینار</span>
              </div>
              {printVoucher.runningBalance !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', borderTop: '1px dashed #000', paddingTop: '4px', marginTop: '4px' }}>
                  <span>قەرزی ماوە لەو کاتەدا:</span>
                  <span>{Number(printVoucher.runningBalance).toLocaleString()} دینار</span>
                </div>
              )}
            </>
          ) : (
            /* Debt Repayment or Manual Debt Addition */
            <>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                {printVoucher.transactionType === 'ADD' ? 'وەسڵی زیادکردنی قەرز' : 'وەسڵی وەرگرتنی پارەی قەرز'}
              </div>
              <div className="voucher-divider"></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>ناوی کڕیار:</span>
                <span style={{ fontWeight: 'bold' }}>{printVoucher.customerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>بەروار و کات:</span>
                <span>{printVoucher.date}</span>
              </div>
              {printVoucher.note && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span>تێبینی:</span>
                  <span>{printVoucher.note}</span>
                </div>
              )}
              <div className="voucher-divider"></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', margin: '4px 0' }}>
                <span>{printVoucher.transactionType === 'ADD' ? 'بڕی زیادکراو:' : 'بڕی پارەی وەرگیراو:'}</span>
                <span>{Number(printVoucher.amountPaid || printVoucher.amount).toLocaleString()} دینار</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', margin: '4px 0' }}>
                <span>کۆی قەرزی ماوە:</span>
                <span>{Number(printVoucher.remainingDebt).toLocaleString()} دینار</span>
              </div>
            </>
          )}

          <div className="voucher-divider"></div>
          <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '6px' }}>
            بەخێربێن بۆ مارکێتی شارەکەم
          </div>
          <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '4px', color: '#555' }}>سیستەمی خاڵی فرۆشتن</div>
        </div>
      )}

    </div>
  );
};

export default Owes;
