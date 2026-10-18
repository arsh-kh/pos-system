import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Plus, 
  CheckCircle, 
  Circle, 
  Trash2, 
  ClipboardList, 
  Search, 
  FolderPlus, 
  X, 
  Sparkles
} from 'lucide-react';
import { kurdishSearchMatch } from '../utils/kurdishSearch';
import './Dashboard.css';

const Needs = () => {
  const [needs, setNeeds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PENDING, FULFILLED
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL'); // ALL, CUSTOMER_REQUESTS, or categoryId
  
  // Add Need Form State
  const [newItemName, setNewItemName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [priority, setPriority] = useState('NORMAL'); // HIGH, MEDIUM, NORMAL
  const [isCustomerRequest, setIsCustomerRequest] = useState(false);
  const [notes, setNotes] = useState('');

  // Custom Category Modal State
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const fetchData = async () => {
    try {
      const [needsRes, catRes] = await Promise.all([
        axios.get('http://localhost:3001/api/needs'),
        axios.get('http://localhost:3001/api/needs/categories')
      ]);
      if (needsRes.data.status === 'SUCCESS') setNeeds(needsRes.data.data);
      if (catRes.data.status === 'SUCCESS') {
        const cats = catRes.data.data;
        setCategories(cats);
        if (cats.length > 0 && !selectedCategory) {
          setSelectedCategory(cats[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch needs data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddNeed = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    try {
      await axios.post('http://localhost:3001/api/needs', {
        item_name: newItemName.trim(),
        category_id: selectedCategory || (categories[0] ? categories[0].id : 1),
        priority,
        is_customer_request: isCustomerRequest,
        notes: notes.trim()
      });
      
      // Reset form
      setNewItemName('');
      setNotes('');
      setPriority('NORMAL');
      setIsCustomerRequest(false);
      fetchData();
    } catch {
      alert('هەڵەیەک ڕوویدا لە کاتی زیادکردنی پێداویستی');
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      const res = await axios.post('http://localhost:3001/api/needs/categories', {
        name: newCategoryName.trim()
      });
      if (res.data.status === 'SUCCESS') {
        setNewCategoryName('');
        setIsAddCatModalOpen(false);
        await fetchData();
        if (res.data.data && res.data.data.id) {
          setSelectedCategory(res.data.data.id);
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'هەڵەیەک ڕوویدا لە دروستکردنی بەش');
    }
  };

  const handleToggleFulfilled = async (id) => {
    try {
      await axios.put(`http://localhost:3001/api/needs/${id}/fulfill`);
      fetchData();
    } catch {
      alert('هەڵەیەک ڕوویدا');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('دڵنیایت لە سڕینەوەی ئەم پێداویستییە؟')) {
      try {
        await axios.delete(`http://localhost:3001/api/needs/${id}`);
        fetchData();
      } catch {
        alert('هەڵەیەک ڕوویدا');
      }
    }
  };

  // Filtered Needs
  const filteredNeeds = useMemo(() => {
    return needs.filter(n => {
      // Search with flawless Kurdish & Arabic matching
      const matchesSearch = kurdishSearchMatch([n.item_name, n.category_name, n.notes], searchTerm);

      if (!matchesSearch) return false;

      // Status Filter
      if (statusFilter === 'PENDING' && n.is_fulfilled) return false;
      if (statusFilter === 'FULFILLED' && !n.is_fulfilled) return false;

      // Category / Customer Requests Filter
      if (selectedCategoryFilter === 'CUSTOMER_REQUESTS') {
        return !!n.is_customer_request;
      } else if (selectedCategoryFilter !== 'ALL') {
        return String(n.category_id) === String(selectedCategoryFilter);
      }

      return true;
    });
  }, [needs, searchTerm, statusFilter, selectedCategoryFilter]);

  const pendingCount = needs.filter(n => !n.is_fulfilled).length;
  const fulfilledCount = needs.filter(n => n.is_fulfilled).length;
  const customerRequestsCount = needs.filter(n => n.is_customer_request).length;

  return (
    <div className="dashboard-page p-8" style={{ position: 'relative' }}>
      
      {/* Header */}
      <div className="header mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardList color="#f59e0b" size={32} />
            پێداویستیەکانی مارکێت
          </h1>
          <p className="text-secondary">بەڕێوەبردنی پێداویستی ١١ بەش، کاڵای نەبوو، و داواکاری کڕیاران</p>
        </div>

        {/* Quick Search & Status Filter */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 1rem', borderRadius: '12px' }}>
            <Search size={18} color="var(--text-secondary)" />
            <input 
              type="text" 
              placeholder="گەڕان لە پێداویستیەکان..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', marginRight: '8px', outline: 'none', width: '200px' }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => setStatusFilter('ALL')}
              style={{ padding: '8px 14px', borderRadius: '8px', background: statusFilter === 'ALL' ? 'var(--accent-color)' : 'transparent', color: statusFilter === 'ALL' ? 'white' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              هەموو ({needs.length})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              style={{ padding: '8px 14px', borderRadius: '8px', background: statusFilter === 'PENDING' ? '#f59e0b' : 'transparent', color: statusFilter === 'PENDING' ? 'black' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              پێویستە ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('FULFILLED')}
              style={{ padding: '8px 14px', borderRadius: '8px', background: statusFilter === 'FULFILLED' ? '#10b981' : 'transparent', color: statusFilter === 'FULFILLED' ? 'white' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              کڕدراوە ({fulfilledCount})
            </button>
          </div>
        </div>
      </div>

      {/* 11 Departments & Customer Requests Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '0.8rem', marginBottom: '1.5rem', scrollbarWidth: 'none' }}>
        <button
          onClick={() => setSelectedCategoryFilter('ALL')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: '1px solid ' + (selectedCategoryFilter === 'ALL' ? 'transparent' : 'var(--border-color)'),
            cursor: 'pointer',
            fontWeight: selectedCategoryFilter === 'ALL' ? 'bold' : 'normal',
            background: selectedCategoryFilter === 'ALL' ? '#3b82f6' : 'var(--bg-tertiary)',
            color: selectedCategoryFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          هەموو بەشەکان ({needs.length})
        </button>

        {/* Special Customer Requests Tab */}
        <button
          onClick={() => setSelectedCategoryFilter('CUSTOMER_REQUESTS')}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: selectedCategoryFilter === 'CUSTOMER_REQUESTS' ? 'bold' : 'normal',
            background: selectedCategoryFilter === 'CUSTOMER_REQUESTS' ? '#ec4899' : 'rgba(236, 72, 153, 0.15)',
            color: selectedCategoryFilter === 'CUSTOMER_REQUESTS' ? '#ffffff' : '#f472b6',
            transition: 'all 0.2s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Sparkles size={16} /> داواکاری کڕیاران ({customerRequestsCount})
        </button>

        {/* 11 Standard & Custom Departments */}
        {categories.map(cat => {
          const count = needs.filter(n => String(n.category_id) === String(cat.id)).length;
          const isActive = String(selectedCategoryFilter) === String(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryFilter(cat.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1px solid ' + (isActive ? 'transparent' : 'var(--border-color)'),
                cursor: 'pointer',
                fontWeight: isActive ? 'bold' : 'normal',
                background: isActive ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {cat.name} ({count})
            </button>
          );
        })}

        {/* Create Custom Category Button */}
        <button
          onClick={() => setIsAddCatModalOpen(true)}
          style={{
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px dashed rgba(255,255,255,0.2)',
            background: 'transparent',
            color: 'var(--accent-hover)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            fontWeight: 'bold'
          }}
        >
          <FolderPlus size={16} /> + بەشی نوێ
        </button>
      </div>

      {/* Add New Need Panel */}
      <form onSubmit={handleAddNeed} className="glass-panel mb-8" style={{ padding: '1.5rem', borderRadius: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus color="#10b981" size={20} /> زیادکردنی کاڵای پێویست بۆ مارکێت
          </h3>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            پۆلێنکردن بەپێی بەش، ئاستی گرنگی و داواکاری کڕیار
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {/* Item Name */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>ناوی کاڵا <span style={{ color: '#ef4444' }}>*</span></label>
            <input 
              type="text" 
              required
              placeholder="ناوی ئەو کاڵایەی کە کەمە یان پێویستە..."
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>

          {/* Department Selector with Custom Department Option */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>بەش / کەتەگۆری</label>
              <button 
                type="button" 
                onClick={() => setIsAddCatModalOpen(true)}
                style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                + بەشی نوێ
              </button>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Priority Selector (پەلە / گرنگ / ئاسایی) */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>ئاستی پێویستی (Priority)</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'HIGH', label: '🔴 پەلە', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
                { id: 'MEDIUM', label: '🟡 گرنگ', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
                { id: 'NORMAL', label: '🟢 ئاسایی', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.id)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: '8px',
                    border: `1px solid ${priority === p.id ? p.color : 'var(--border-color)'}`,
                    background: priority === p.id ? p.bg : 'var(--bg-tertiary)',
                    color: priority === p.id ? p.color : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: priority === p.id ? 'bold' : 'normal',
                    fontSize: '0.85rem'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes / Quantity */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>تێبینی (بڕ یان ناوی کڕیار)</label>
            <input 
              type="text" 
              placeholder="نموونە: ٥ کارتۆن، کڕیار کاک ئاراس..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
        </div>

        {/* Customer Request Checkbox & Submit */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
            <input 
              type="checkbox"
              checked={isCustomerRequest}
              onChange={(e) => setIsCustomerRequest(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#ec4899', cursor: 'pointer' }}
            />
            <span style={{ color: isCustomerRequest ? '#f472b6' : 'var(--text-secondary)', fontWeight: isCustomerRequest ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color={isCustomerRequest ? '#f472b6' : 'var(--text-secondary)'} />
              ئەم کاڵایە داواکاری کڕیارە (کاڵای نەبوو لە مارکێت)
            </span>
          </label>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ padding: '12px 28px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <Plus size={20} /> زیادکردن بۆ لیست
          </button>
        </div>
      </form>

      {/* Needs Items List */}
      <div className="glass-panel" style={{ borderRadius: '20px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-secondary)' }}>چاوەڕوان بە، باردەکرێت...</div>
        ) : filteredNeeds.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <ClipboardList size={48} style={{ opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: '1.1rem' }}>هیچ پێداویستیەک بەپێی ئەم فلتەرە نەدۆزرایەوە</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredNeeds.map((n) => {
              const isHigh = n.priority === 'HIGH';
              const isMedium = n.priority === 'MEDIUM';

              return (
                <div 
                  key={n.id} 
                  style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '16px 22px', 
                    borderBottom: '1px solid var(--border-color)',
                    background: n.is_fulfilled ? 'rgba(16, 185, 129, 0.03)' : (isHigh ? 'rgba(239, 68, 68, 0.04)' : 'transparent'),
                    transition: 'background 0.2s'
                  }}
                >
                  {/* Left Area: Toggle & Details */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                    <button 
                      onClick={() => handleToggleFulfilled(n.id)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: n.is_fulfilled ? '#10b981' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                      title={n.is_fulfilled ? 'هەڵوەشاندنەوەی کڕین' : 'تەواوکردنی کڕین'}
                    >
                      {n.is_fulfilled ? <CheckCircle size={26} color="#10b981" /> : <Circle size={26} />}
                    </button>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.1rem', textDecoration: n.is_fulfilled ? 'line-through' : 'none', color: n.is_fulfilled ? 'var(--text-secondary)' : 'var(--text-primary)', fontWeight: 'bold' }}>
                          {n.item_name}
                        </span>

                        {/* Department Pill */}
                        <span style={{ fontSize: '0.8rem', padding: '3px 10px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                          {n.category_name}
                        </span>

                        {/* Customer Request Badge */}
                        {n.is_customer_request && (
                          <span style={{ fontSize: '0.8rem', padding: '3px 10px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                            <Sparkles size={13} /> داواکاری کڕیار
                          </span>
                        )}

                        {/* Priority Badge */}
                        {isHigh && (
                          <span style={{ fontSize: '0.78rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 'bold' }}>
                            🔴 زۆر پەلە
                          </span>
                        )}
                        {isMedium && (
                          <span style={{ fontSize: '0.78rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontWeight: 'bold' }}>
                            🟡 گرنگ
                          </span>
                        )}
                      </div>

                      {/* Notes / Details */}
                      {n.notes && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          تێبینی: {n.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Area: Status & Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ fontSize: '0.9rem', color: n.is_fulfilled ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                      {n.is_fulfilled ? 'کڕدراوە' : 'پێویستە'}
                    </span>

                    <button 
                      onClick={() => handleDelete(n.id)}
                      style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="سڕینەوە"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Category Creation Modal */}
      {isAddCatModalOpen && (
        <div className="pos-modal-overlay" onClick={() => setIsAddCatModalOpen(false)}>
          <div className="pos-modal-card pos-modal-sm" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                <FolderPlus color="var(--accent-color)" /> دروستکردنی بەشی نوێ
              </h2>
              <button onClick={() => setIsAddCatModalOpen(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18}/>
              </button>
            </div>

            <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>ناوی بەش / پۆلێن <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="نموونە: بەشی گۆشت و مریشک..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button 
                  type="submit" 
                  style={{ flex: 1, minWidth: '140px', padding: '14px', borderRadius: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  پاشەکەوتکردن
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsAddCatModalOpen(false)}
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

export default Needs;
