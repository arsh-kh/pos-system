import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Wallet, 
  Plus, 
  Search, 
  Trash2, 
  X 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { formatDate, formatDateTime, formatCurrency } from '../utils/dateFormatter';
import './Dashboard.css';

const CATEGORIES = [
  { id: 'ALL', name: 'هەموو جۆرەکان' },
  { id: 'کرێی دوکان', name: 'کرێی دوکان 🏢', color: '#38bdf8' },
  { id: 'مووچەی کارمەندان', name: 'مووچەی کارمەندان 👥', color: '#818cf8' },
  { id: 'کارەبا و مۆلیدە', name: 'کارەبا و مۆلیدە ⚡', color: '#f59e0b' },
  { id: 'خواردن و میوانداری', name: 'خواردن و میوانداری 🥪', color: '#ec4899' },
  { id: 'پاککردنەوە و پێداویستی', name: 'پاککردنەوە و پێداویستی 🧹', color: '#10b981' },
  { id: 'هەمەجۆر / تر', name: 'هەمەجۆر / تر 📦', color: '#94a3b8' }
];

const Expenses = () => {
  const { isAdmin } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Add Expense Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: 'کرێی دوکان',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const fetchData = async () => {
    try {
      const [listRes, sumRes] = await Promise.all([
        axios.get('http://localhost:3001/api/expenses'),
        axios.get('http://localhost:3001/api/expenses/summary')
      ]);

      if (listRes.data.status === 'SUCCESS') setExpenses(listRes.data.data);
      if (sumRes.data.status === 'SUCCESS') setSummary(sumRes.data.data);
    } catch (err) {
      console.error('Failed to load expenses data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    const amountNum = Math.max(0, parseInt(formData.amount) || 0);
    if (!formData.title.trim() || amountNum <= 0) {
      return alert('تکایە ناوی خەرجی و بڕی پارەی دروست بنووسە');
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post('http://localhost:3001/api/expenses', {
        ...formData,
        amount: amountNum
      });
      if (res.data.status === 'SUCCESS') {
        alert('خەرجی بە سەرکەوتوویی تۆمارکرا');
        setIsAddModalOpen(false);
        setFormData({
          title: '',
          category: 'کرێی دوکان',
          amount: '',
          expense_date: new Date().toISOString().split('T')[0],
          notes: ''
        });
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی تۆمارکردنی خەرجی');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm('دڵنیایت لە سڕینەوەی ئەم خەرجییە؟')) {
      try {
        await axios.delete(`http://localhost:3001/api/expenses/${id}`);
        fetchData();
      } catch {
        alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوە');
      }
    }
  };

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchesSearch = kurdishSearchMatch([exp.title, exp.category, exp.notes], searchTerm);

      const matchesCat = 
        selectedCategory === 'ALL' || exp.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [expenses, searchTerm, selectedCategory]);

  const topCategory = useMemo(() => {
    if (!summary || !summary.categories || summary.categories.length === 0) return 'دیارینەکراوە';
    return summary.categories[0].category;
  }, [summary]);

  return (
    <div className="dashboard-page p-8" style={{ position: 'relative' }}>
      
      {/* Header */}
      <div className="header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wallet color="#f43f5e" size={32} />
            بەشی خەرجییەکان و تێچووەکان
          </h1>
          <p className="text-secondary">تۆمارکردن و بەڕێوەبردنی خەرجییەکانی مارکێت و دەرکەوتنی قازانجی ڕاستەقینە</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 1rem', borderRadius: '12px' }}>
            <Search size={20} color="var(--text-secondary)" />
            <input 
              type="text" 
              placeholder="گەڕان بە ناوی خەرجی یان تێبینی..." 
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
            onClick={() => setIsAddModalOpen(true)} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(244, 63, 94, 0.35)' }}
          >
            <Plus size={20} /> تۆمارکردنی خەرجی نوێ
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="stats-grid mb-8">
        <div className="stat-card glass-panel" style={{ background: 'rgba(244, 63, 94, 0.08)', borderColor: 'rgba(244, 63, 94, 0.25)' }}>
          <h3>کۆی خەرجییەکانی ئەم مانگە</h3>
          <div className="value" style={{ color: '#fb7185' }}>
            {Number(summary?.this_month?.month_expenses || 0).toLocaleString()} دینار
          </div>
          <div className="sub-text" style={{ color: '#94a3b8' }}>
            {summary?.this_month?.month_count || 0} بڕگەی خەرجی لەم مانگەدا
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
          <h3>خەرجی ئەمڕۆ</h3>
          <div className="value" style={{ color: '#fbbf24' }}>
            {Number(summary?.today?.today_expenses || 0).toLocaleString()} دینار
          </div>
          <div className="sub-text" style={{ color: 'var(--text-secondary)' }}>
            {summary?.today?.today_count || 0} خەرجی تۆمارکراوی ئەمڕۆ
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(129, 140, 248, 0.08)', borderColor: 'rgba(129, 140, 248, 0.25)' }}>
          <h3>زۆرترین جۆری خەرجی</h3>
          <div className="value" style={{ color: '#a5b4fc', fontSize: '1.4rem' }}>
            {topCategory}
          </div>
          <div className="sub-text" style={{ color: 'var(--text-secondary)' }}>
            گەورەترین بەشی تێچووی مانگ
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(148, 163, 184, 0.08)', borderColor: 'rgba(148, 163, 184, 0.25)' }}>
          <h3>کۆی گشتی خەرجییەکان (هەموو کات)</h3>
          <div className="value" style={{ color: 'var(--text-primary)' }}>
            {Number(summary?.lifetime?.lifetime_expenses || 0).toLocaleString()} دینار
          </div>
          <div className="sub-text" style={{ color: 'var(--text-secondary)' }}>
            {summary?.lifetime?.lifetime_count || 0} کۆی هەموو خەرجییەکان
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '1.5rem', scrollbarWidth: 'none' }}>
        {CATEGORIES.map(cat => {
          const isActive = selectedCategory === cat.id;
          const count = cat.id === 'ALL' 
            ? expenses.length 
            : expenses.filter(e => e.category === cat.id).length;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: isActive ? 'bold' : 'normal',
                background: isActive ? '#f43f5e' : 'var(--bg-tertiary)',
                color: isActive ? 'white' : 'var(--text-secondary)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                fontSize: '0.9rem'
              }}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Expenses Table */}
      <div className="glass-panel" style={{ padding: '1px', borderRadius: '16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <thead style={{ background: 'var(--bg-tertiary)' }}>
            <tr>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>بەروار</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>ناوی خەرجی</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>جۆری خەرجی</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>بڕی پارە (دینار)</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>تێبینی</th>
              <th style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontWeight: 500 }}>کردارەکان</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>باردەکرێت...</td></tr>
            ) : filteredExpenses.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>هیچ خەرجییەک نەدۆزرایەوە</td></tr>
            ) : (
              filteredExpenses.map(exp => {
                const catObj = CATEGORIES.find(c => c.id === exp.category);
                const badgeColor = catObj ? catObj.color : '#94a3b8';
                return (
                  <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {exp.expense_date ? formatDate(exp.expense_date) : '-'}
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      {exp.title}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        background: `${badgeColor}20`,
                        color: badgeColor,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold'
                      }}>
                        {exp.category}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: 'bold', color: '#fb7185', fontSize: '1.05rem' }}>
                      {Number(exp.amount).toLocaleString()} دینار
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-primary)', fontSize: '0.9rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {exp.notes || '-'}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {isAdmin && (
                        <button 
                          onClick={() => handleDeleteExpense(exp.id)}
                          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="سڕینەوە"
                        >
                          <Trash2 size={16} />
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

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="pos-modal-card pos-modal-md" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#f43f5e', fontSize: '1.2rem', fontWeight: 800 }}>
                <Wallet color="#f43f5e" size={22} /> تۆمارکردنی خەرجی نوێ
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18}/>
              </button>
            </div>

            <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                  ناوی خەرجی <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input 
                  type="text" 
                  required 
                  autoFocus
                  placeholder="بۆ نموونە: کرێی مانگی ١٠، پارەی مۆلیدە..."
                  value={formData.title} 
                  onChange={e => setFormData({ ...formData, title: e.target.value })} 
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} 
                />
              </div>

              <div className="responsive-grid-2">
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    جۆری خەرجی <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select 
                    value={formData.category} 
                    onChange={e => setFormData({ ...formData, category: e.target.value })} 
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    {CATEGORIES.filter(c => c.id !== 'ALL').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>بەروار</label>
                  <input 
                    type="date" 
                    value={formData.expense_date} 
                    onChange={e => setFormData({ ...formData, expense_date: e.target.value })} 
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} 
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#fb7185', fontWeight: 'bold' }}>
                  بڕی پارە (دینار) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const current = Math.max(0, parseInt(formData.amount) || 0);
                      const nextVal = Math.max(0, current - 250);
                      setFormData({ ...formData, amount: nextVal === 0 ? '' : String(nextVal) });
                    }}
                    title="کەمکردنەوە بە ٢٥٠ دینار"
                    style={{ width: '48px', height: '46px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    -٢٥٠
                  </button>

                  <input 
                    type="number" 
                    required
                    step="250"
                    min="0"
                    placeholder="بۆ نموونە: ٥٠٠٠٠"
                    value={formData.amount} 
                    onChange={e => setFormData({ ...formData, amount: e.target.value })} 
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#fb7185', fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center' }} 
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const current = Math.max(0, parseInt(formData.amount) || 0);
                      const nextVal = current + 250;
                      setFormData({ ...formData, amount: String(nextVal) });
                    }}
                    title="زیادکردن بە ٢٥٠ دینار"
                    style={{ width: '48px', height: '46px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    +٢٥٠
                  </button>
                </div>

                {/* Iraqi Currency Denominations Pills */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, amount: '' })}
                    style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    0 ✕
                  </button>
                  {[250, 500, 1000, 5000, 10000, 25000, 50000].map(amt => (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => {
                        const current = Math.max(0, parseInt(formData.amount) || 0);
                        setFormData({ ...formData, amount: String(current + amt) });
                      }}
                      style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      +{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>تێبینی زیاتر (ئارەزوومەندانە)</label>
                <textarea 
                  rows="2"
                  placeholder="هەر ڕوونکردنەوەیەک سەبارەت بەم مەسروفە..."
                  value={formData.notes} 
                  onChange={e => setFormData({ ...formData, notes: e.target.value })} 
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', resize: 'none' }} 
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ flex: 1, minWidth: '160px', padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '1.05rem', cursor: isSubmitting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 15px rgba(244, 63, 94, 0.4)' }}
                >
                  {isSubmitting ? 'پاشەکەوت دەکرێت...' : 'پاشەکەوتکردنی خەرجی'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
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

    </div>
  );
};

export default Expenses;
