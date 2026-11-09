import React from 'react';
import { Trash2 } from 'lucide-react';

/**
 * Reusable ConfirmDeleteModal Component (DRY Architecture)
 * Standardized across the application for deleting products, categories, promotions, etc.
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onConfirm: () => void
 * - title: string (default: 'دڵنیایت لە سڕینەوە؟')
 * - itemName: string (optional, e.g. «شکلێت»)
 * - isDeleting: boolean (optional)
 * - confirmText: string (default: 'سڕینەوە')
 * - cancelText: string (default: 'پاشگەزبوونەوە')
 * - zIndex: number (default: 1300)
 */
const ConfirmDeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'دڵنیایت لە سڕینەوە؟',
  itemName = '',
  isDeleting = false,
  confirmText = 'سڕینەوە',
  cancelText = 'پاشگەزبوونەوە',
  zIndex = 1300
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="pos-modal-overlay" 
      onClick={() => !isDeleting && onClose()}
      style={{ zIndex }}
    >
      <div 
        className="pos-modal-card" 
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '16px',
          padding: '24px',
          width: '90%',
          maxWidth: '420px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
          textAlign: 'center'
        }}
      >
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.12)',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto'
        }}>
          <Trash2 size={26} />
        </div>

        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
          {title}
        </h3>

        {itemName && (
          <div style={{ 
            fontSize: '0.95rem', 
            fontWeight: 700, 
            color: 'var(--text-secondary, #475569)', 
            background: 'var(--bg-tertiary, #f1f5f9)', 
            padding: '10px 14px', 
            borderRadius: '10px', 
            marginBottom: '20px',
            wordBreak: 'break-word'
          }}>
            «{itemName}»
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              background: '#ef4444',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {isDeleting ? 'دەسڕدرێتەوە...' : confirmText}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'var(--bg-tertiary, #f1f5f9)',
              color: 'var(--text-primary, #0f172a)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;

