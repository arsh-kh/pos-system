import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { 
  Wallet, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  X, 
  ChevronDown 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import { formatDate } from '../utils/dateFormatter';
import './Dashboard.css';

const Expenses = () => {
  const { isAdmin } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modal State (Add & Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Dynamic Combobox State for Category
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const catDropdownRef = useRef(null);

  const fetchData = async () => {
    try {
      const [listRes, sumRes, catRes] = await Promise.all([
        axios.get('http://localhost:3001/api/expenses'),
        axios.get('http://localhost:3001/api/expenses/summary'),
        axios.get('http://localhost:3001/api/expenses/categories')
      ]);

      if (listRes.data?.status === 'SUCCESS') setExpenses(listRes.data.data || []);
      if (sumRes.data?.status === 'SUCCESS') setSummary(sumRes.data.data || null);
      if (catRes.data?.status === 'SUCCESS') {
        setCategories(catRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load expenses data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Close category combobox dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (catDropdownRef.current && !catDropdownRef.current.contains(event.target)) {
        setIsCatDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Open Modal for Create
  const handleOpenAddModal = () => {
    setEditingExpenseId(null);
    setFormData({
      title: '',
      category: categories[0] || 'هەمەجۆر / تر',
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setIsCatDropdownOpen(false);
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (exp) => {
    setEditingExpenseId(exp.id);
    let dateStr = '';
    if (exp.expense_date) {
      const d = new Date(exp.expense_date);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString().split('T')[0];
      }
    }
    setFormData({
      title: exp.title || '',
      category: exp.category || '',
      amount: exp.amount ? String(exp.amount) : '',
      expense_date: dateStr || new Date().toISOString().split('T')[0],
      notes: exp.notes || ''
    });
    setIsCatDropdownOpen(false);
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    const amountNum = Math.max(0, Math.round(Number(formData.amount) || 0));
    const cleanTitle = formData.title.trim();
    const cleanCategory = formData.category.trim() || 'هەمەجۆر / تر';

    if (!cleanTitle || amountNum <= 0) {
      return alert('تکایە ناوی خەرجی و بڕی پارەی دروست بنووسە');
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: cleanTitle,
        category: cleanCategory,
        amount: amountNum,
        expense_date: formData.expense_date,
        notes: formData.notes
      };

      let res;
      if (editingExpenseId) {
        res = await axios.put(`http://localhost:3001/api/expenses/${editingExpenseId}`, payload);
      } else {
        res = await axios.post('http://localhost:3001/api/expenses', payload);
      }

      if (res.data?.status === 'SUCCESS') {
        setIsModalOpen(false);
        setEditingExpenseId(null);
        await fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردنی خەرجی');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm('دڵنیایت لە سڕینەوەی ئەم خەرجییە؟')) {
      try {
        await axios.delete(`http://localhost:3001/api/expenses/${id}`);
        fetchData();
      } catch (err) {
        alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە کاتی سڕینەوە');
      }
    }
  };

  // Filtered dynamic categories matching input in combobox
  const filteredCategoryOptions = useMemo(() => {
    const query = (formData.category || '').trim().toLowerCase();
    if (!query) return categories;
    return categories.filter(c => c.toLowerCase().includes(query));
  }, [categories, formData.category]);

  // Filtered Expenses for the table
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchesSearch = kurdishSearchMatch([exp.title, exp.category, exp.notes], searchTerm);
      const matchesCat = selectedCategory === 'ALL' || exp.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [expenses, searchTerm, selectedCategory]);

  // Top category computation (Rule: Never show 'دیاری نەکراوە')
  const topCategory = useMemo(() => {
    if (!summary || !summary.categories || summary.categories.length === 0) return '—';
    return summary.categories[0].category || '—';
  }, [summary]);

  return (
    <div className="dashboard-page p-8" style={{ position: 'relative' }}>
      
      {/* Header */}
      <div className="header mb-8" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Wallet color="#f43f5e" size={28} />
            بەشی خەرجییەکان
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 1rem', borderRadius: '12px' }}>
            <Search size={18} color="var(--text-secondary)" />
            <input 
              type="text" 
              placeholder="گەڕان..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', marginRight: '10px', outline: 'none', width: '200px' }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}>
                <X size={16} />
              </button>
            )}
          </div>

          <button 
            className="btn-primary" 
            onClick={handleOpenAddModal} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 20px', 
              borderRadius: '12px', 
              background: '#f43f5e', 
              color: 'white', 
              border: 'none', 
              cursor: 'pointer', 
              fontWeight: 'bold', 
              boxShadow: '0 4px 15px rgba(244, 63, 94, 0.25)' 
            }}
          >
            <Plus size={18} /> تۆمارکردنی خەرجی نوێ
          </button>
        </div>
      </div>

      {/* KPI Stats Cards - Clean & Minimalist without helper clutter */}
      <div className="stats-grid mb-8">
        <div className="stat-card glass-panel" style={{ background: 'rgba(245, 158, 11, 0.06)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
          <h3>خەرجی ئەمڕۆ</h3>
          <div className="value" style={{ color: '#fbbf24', marginTop: '8px' }}>
            {Number(summary?.today?.today_expenses || 0).toLocaleString()} دینار
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(244, 63, 94, 0.06)', borderColor: 'rgba(244, 63, 94, 0.2)' }}>
          <h3>خەرجی ئەم مانگە</h3>
          <div className="value" style={{ color: '#fb7185', marginTop: '8px' }}>
            {Number(summary?.this_month?.month_expenses || 0).toLocaleString()} دینار
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(148, 163, 184, 0.06)', borderColor: 'rgba(148, 163, 184, 0.2)' }}>
          <h3>کۆی گشتی خەرجییەکان</h3>
          <div className="value" style={{ color: 'var(--text-primary)', marginTop: '8px' }}>
            {Number(summary?.lifetime?.lifetime_expenses || 0).toLocaleString()} دینار
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ background: 'rgba(129, 140, 248, 0.06)', borderColor: 'rgba(129, 140, 248, 0.2)' }}>
          <h3>زۆرترین جۆری خەرجی</h3>
          <div className="value" style={{ color: '#a5b4fc', fontSize: '1.35rem', marginTop: '8px' }}>
            {topCategory}
          </div>
        </div>
      </div>

      {/* Dynamic Category Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '1.25rem', scrollbarWidth: 'none' }}>
        <button
          onClick={() => setSelectedCategory('ALL')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: selectedCategory === 'ALL' ? 'bold' : 'normal',
            background: selectedCategory === 'ALL' ? '#f43f5e' : 'var(--bg-tertiary)',
            color: selectedCategory === 'ALL' ? 'white' : 'var(--text-secondary)',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
            fontSize: '0.9rem'
          }}
        >
          هەموو جۆرەکان ({expenses.length})
        </button>

        {categories.map(cat => {
          const isActive = selectedCategory === cat;
          const count = expenses.filter(e => e.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
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
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Expenses Table */}
      <div className="glass-panel" style={{ padding: '1px', borderRadius: '16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <thead style={{ background: 'var(--bg-tertiary)' }}>
            <tr>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 500 }}>بەروار</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 500 }}>ناوی خەرجی</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 500 }}>جۆری خەرجی</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 500 }}>بڕی پارە (دینار)</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 500 }}>تێبینی</th>
              <th style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontWeight: 500, width: '100px' }}>کردارەکان</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>باردەکرێت...</td></tr>
            ) : filteredExpenses.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>هیچ خەرجییەک نەدۆزرایەوە</td></tr>
            ) : (
              filteredExpenses.map(exp => (
                <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                  <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {exp.expense_date ? formatDate(exp.expense_date) : '-'}
                  </td>
                  <td style={{ padding: '14px 18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    {exp.title}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      background: 'rgba(244, 63, 94, 0.12)',
                      color: '#fb7185',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}>
                      {exp.category}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', fontWeight: 'bold', color: '#fb7185', fontSize: '1rem' }}>
                    {Number(exp.amount).toLocaleString()} دینار
                  </td>
                  <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {exp.notes || '-'}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button 
                        onClick={() => handleOpenEditModal(exp)}
                        style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: 'none', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="دەستکاریکردن"
                      >
                        <Edit2 size={15} />
                      </button>
                      {isAdmin && (
                        <button 
                          onClick={() => handleDeleteExpense(exp.id)}
                          style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: 'none', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="سڕینەوە"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Minimalist Add / Edit Expense Modal */}
      {isModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="pos-modal-card pos-modal-md" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#f43f5e', fontSize: '1.15rem', fontWeight: 700 }}>
                <Wallet color="#f43f5e" size={20} />
                {editingExpenseId ? 'دەستکاریکردنی خەرجی' : 'تۆمارکردنی خەرجی نوێ'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16}/>
              </button>
            </div>

            <form onSubmit={handleSaveExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Expense Title */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  ناوی خەرجی
                </label>
                <input 
                  type="text" 
                  required 
                  autoFocus
                  placeholder="ناوی خەرجی..."
                  value={formData.title} 
                  onChange={e => setFormData({ ...formData, title: e.target.value })} 
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }} 
                />
              </div>

              {/* Dynamic Self-Learning Category (Combobox / Free Typing) */}
              <div ref={catDropdownRef} style={{ position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  جۆری خەرجی
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    required
                    placeholder="جۆری خەرجی بنووسە یان هەڵبژێرە..."
                    value={formData.category} 
                    onChange={e => {
                      setFormData({ ...formData, category: e.target.value });
                      setIsCatDropdownOpen(true);
                    }}
                    onFocus={() => setIsCatDropdownOpen(true)}
                    style={{ 
                      width: '100%', 
                      padding: '12px 36px 12px 12px', 
                      borderRadius: '10px', 
                      background: 'var(--bg-tertiary)', 
                      border: '1px solid var(--border-color)', 
                      color: 'var(--text-primary)', 
                      outline: 'none' 
                    }} 
                  />
                  <button
                    type="button"
                    onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                    style={{
                      position: 'absolute',
                      left: '8px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                {/* Combobox Dropdown Menu */}
                {isCatDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    background: 'var(--bg-secondary, #1e293b)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    zIndex: 99,
                    padding: '4px 0'
                  }}>
                    {filteredCategoryOptions.length === 0 ? (
                      <div style={{ padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        جۆری نوێ: «{formData.category}» تۆمار دەکرێت
                      </div>
                    ) : (
                      filteredCategoryOptions.map(cat => (
                        <div
                          key={cat}
                          onClick={() => {
                            setFormData({ ...formData, category: cat });
                            setIsCatDropdownOpen(false);
                          }}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            color: formData.category === cat ? '#f43f5e' : 'var(--text-primary)',
                            fontWeight: formData.category === cat ? 'bold' : 'normal',
                            background: formData.category === cat ? 'rgba(244, 63, 94, 0.08)' : 'transparent',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                          onMouseLeave={e => e.currentTarget.style.background = formData.category === cat ? 'rgba(244, 63, 94, 0.08)' : 'transparent'}
                        >
                          {cat}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Amount & Date in 2 columns */}
              <div className="responsive-grid-2">
                {/* Clean Amount Input - Per AGENTS.md rules: No button clutter, clean single number input */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    بڕی پارە (دینار)
                  </label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    placeholder="0"
                    value={formData.amount} 
                    onChange={e => setFormData({ ...formData, amount: e.target.value })} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      borderRadius: '10px', 
                      background: 'var(--bg-tertiary)', 
                      border: '1px solid var(--border-color)', 
                      color: '#fb7185', 
                      fontWeight: 'bold', 
                      fontSize: '1.1rem', 
                      outline: 'none' 
                    }} 
                  />
                </div>

                {/* Expense Date */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    بەروار
                  </label>
                  <input 
                    type="date" 
                    lang="en-GB"
                    value={formData.expense_date} 
                    onChange={e => setFormData({ ...formData, expense_date: e.target.value })} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      borderRadius: '10px', 
                      background: 'var(--bg-tertiary)', 
                      border: '1px solid var(--border-color)', 
                      color: 'var(--text-primary)', 
                      outline: 'none' 
                    }} 
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  تێبینی
                </label>
                <textarea 
                  rows="2"
                  placeholder="تێبینی..."
                  value={formData.notes} 
                  onChange={e => setFormData({ ...formData, notes: e.target.value })} 
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', resize: 'none', outline: 'none' }} 
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    borderRadius: '10px', 
                    background: '#f43f5e', 
                    color: 'white', 
                    border: 'none', 
                    fontWeight: 'bold', 
                    fontSize: '1rem', 
                    cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                    boxShadow: '0 4px 15px rgba(244, 63, 94, 0.3)' 
                  }}
                >
                  {isSubmitting ? 'پاشەکەوت دەکرێت...' : (editingExpenseId ? 'نوێکردنەوەی خەرجی' : 'پاشەکەوتکردن')}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '12px 20px', borderRadius: '10px' }}
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
