import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const ToastContext = createContext(null);

let globalToast = {
  success: (msg) => console.log('[Toast Success]', msg),
  error: (msg) => console.error('[Toast Error]', msg),
  info: (msg) => console.log('[Toast Info]', msg)
};

export const toast = {
  success: (msg) => globalToast.success(msg),
  error: (msg) => globalToast.error(msg),
  info: (msg) => globalToast.info(msg)
};

export const useToast = () => {
  const context = useContext(ToastContext);
  return context || toast;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timerRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timerRef.current[id]) {
      clearTimeout(timerRef.current[id]);
      delete timerRef.current[id];
    }
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 2800) => {
    if (!message) return;
    const cleanMsg = typeof message === 'string' ? message : String(message?.message || message);
    const id = Date.now() + Math.random().toString(36).substring(2, 7);

    setToasts((prev) => [...prev.slice(-2), { id, message: cleanMsg, type }]);

    timerRef.current[id] = setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  useEffect(() => {
    globalToast.success = (msg) => addToast(msg, 'success');
    globalToast.error = (msg) => addToast(msg, 'error');
    globalToast.info = (msg) => addToast(msg, 'info');

    // Override native browser window.alert globally across Electron
    const originalAlert = window.alert;
    window.alert = (msg) => {
      if (!msg) return;
      const str = typeof msg === 'string' ? msg : String(msg?.message || msg);
      if (str.includes('سەرکەوتوویی') || str.includes('سەرکەوتوو')) {
        addToast(str, 'success');
      } else if (str.includes('هەڵە') || str.includes('نادروست') || str.includes('⚠️')) {
        addToast(str, 'error');
      } else {
        addToast(str, 'info');
      }
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{
      success: (msg) => addToast(msg, 'success'),
      error: (msg) => addToast(msg, 'error'),
      info: (msg) => addToast(msg, 'info')
    }}>
      {children}
      {/* Ultra-Minimalist Floating Toast Stack */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'none',
          direction: 'rtl'
        }}
      >
        {toasts.map((t) => {
          const accentColor = t.type === 'success' 
            ? '#10b981' 
            : (t.type === 'error' ? '#ef4444' : '#2563eb');

          return (
            <div
              key={t.id}
              onClick={() => removeToast(t.id)}
              style={{
                pointerEvents: 'auto',
                cursor: 'pointer',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRight: `3px solid ${accentColor}`,
                borderRadius: '8px',
                padding: '10px 20px',
                minWidth: '220px',
                maxWidth: '90vw',
                boxShadow: '0 8px 20px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.88rem',
                fontWeight: 700,
                color: '#1e293b',
                lineHeight: 1.4,
                userSelect: 'none',
                transition: 'transform 0.15s ease, opacity 0.15s ease'
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: accentColor,
                  flexShrink: 0
                }}
              />
              <span style={{ flex: 1, textAlign: 'right' }}>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
