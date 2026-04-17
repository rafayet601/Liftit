import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';

const ToastContext = createContext({
    showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

const toneFor = {
    success: {
        icon: CheckCircle2,
        cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    },
    error: {
        icon: AlertCircle,
        cls: 'border-red-500/30 bg-red-500/10 text-red-300',
    },
    info: {
        icon: Info,
        cls: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    },
    warning: {
        icon: AlertTriangle,
        cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    },
};

function ToastItem({ toast, onClose }) {
    const [visible, setVisible] = useState(false);
    const tone = toneFor[toast.type] || toneFor.info;
    const Icon = tone.icon;

    useEffect(() => {
        const t = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(t);
    }, []);

    useEffect(() => {
        if (!toast.duration) return;
        const t = setTimeout(() => {
            setVisible(false);
            setTimeout(() => onClose(toast.id), 220);
        }, toast.duration);
        return () => clearTimeout(t);
    }, [toast.duration, toast.id, onClose]);

    return (
        <div
            role="status"
            className={clsx(
                'glass-morphism pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-card transition-all duration-200',
                tone.cls,
                visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
            )}
        >
            <Icon className="h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1 text-sm font-medium text-white">{toast.message}</div>
            <button
                type="button"
                onClick={() => {
                    setVisible(false);
                    setTimeout(() => onClose(toast.id), 220);
                }}
                className="ml-1 rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Dismiss"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'info', duration = 3600) => {
        const id = Math.random().toString(36).slice(2);
        setToasts((prev) => [...prev, { id, message, type, duration }]);
        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div
                aria-live="polite"
                className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[60] mx-auto flex w-full max-w-md flex-col-reverse gap-2 px-4 md:bottom-6 md:right-6 md:left-auto md:mx-0 md:max-w-sm md:px-0"
            >
                {toasts.map((t) => (
                    <ToastItem key={t.id} toast={t} onClose={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export default ToastProvider;
