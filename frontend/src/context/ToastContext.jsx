import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext(null);

// FIX #3: coalesce toast realtime — pesan identik (mis. "Data kasbon
// diperbarui" dari banyak event beruntun) digabung, maks 1 per 5 detik,
// agar tidak hujan pop-up + render ulang saat banyak user aktif bersamaan.
const COALESCE_WINDOW_MS = 5000;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const lastShownRef = useRef(new Map());

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const key = `${type}::${message}`;
    const now = Date.now();
    const last = lastShownRef.current.get(key) || 0;
    if (now - last < COALESCE_WINDOW_MS) return; // duplikat dalam window -> buang
    lastShownRef.current.set(key, now);
    // Batasi ukuran map agar tidak bocor memori
    if (lastShownRef.current.size > 50) {
      const oldest = [...lastShownRef.current.entries()].sort((a, b) => a[1] - b[1])[0];
      if (oldest) lastShownRef.current.delete(oldest[0]);
    }
    const id = now + Math.random();
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 pointer-events-none" style={{ maxWidth: '400px' }}>
        {toasts.map((toast, index) => (
          <div 
            key={toast.id} 
            className="pointer-events-auto mb-2"
            style={{ 
              marginTop: index * 8,
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            <Toast
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

