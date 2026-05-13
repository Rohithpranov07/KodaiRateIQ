'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, createContext, useContext } from 'react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none w-[90%] max-w-sm">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="clay-card px-6 py-4 flex items-center gap-4 shadow-[0_20px_40px_rgba(0,0,0,0.1)] pointer-events-auto border-t-2"
              style={{ borderTopColor: toast.type === 'success' ? 'var(--color-positive)' : toast.type === 'error' ? 'var(--color-negative)' : 'var(--color-gold)' }}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                toast.type === 'success' ? 'bg-positive/10 text-positive' : 
                toast.type === 'error' ? 'bg-negative/10 text-negative' : 'bg-gold/10 text-gold'
              }`}>
                <span className="material-symbols-outlined text-lg">
                  {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
                </span>
              </div>
              <p className="text-xs font-bold tracking-tight text-luxury-black">{toast.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
