import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

// Simple event bus for toasts (no external deps)
const listeners = new Set<(t: ToastItem) => void>();
let nextId = 1;

function notify(type: ToastType, message: string) {
  const item: ToastItem = { id: nextId++, type, message };
  listeners.forEach((cb) => cb(item));
}

export const toast = {
  success: (message: string) => notify('success', message),
  error: (message: string) => notify('error', message),
  info: (message: string) => notify('info', message),
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onNotify = (item: ToastItem) => {
      setItems((prev) => [...prev, item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }, 3500);
    };
    listeners.add(onNotify);
    return () => { listeners.delete(onNotify); };
  }, []);

  const bg: Record<ToastType, string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-gray-800',
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`min-w-[260px] max-w-sm text-white shadow-lg rounded-lg px-4 py-3 ${bg[t.type]} animate-slide-in`}
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-medium">{t.message}</p>
        </div>
      ))}
      <style>
        {`
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-slide-in { animation: slide-in 120ms ease-out; }
        `}
      </style>
    </div>
  );
}
