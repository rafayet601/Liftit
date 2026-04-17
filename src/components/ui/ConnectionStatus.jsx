import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

/**
 * Subtle, non-intrusive connection pill. Hides itself after a brief window
 * when everything is healthy and we've already shown a "back online"
 * confirmation — avoids competing with the MobileNav on phones.
 */
export default function ConnectionStatus({ isOnline, isSyncing }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!isOnline || isSyncing) {
            setVisible(true);
            return undefined;
        }
        // When we flip back online, flash success briefly then hide.
        setVisible(true);
        const t = setTimeout(() => setVisible(false), 2400);
        return () => clearTimeout(t);
    }, [isOnline, isSyncing]);

    if (!visible) return null;

    return (
        <div
            className={clsx(
                'glass-morphism pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+0.6rem)] z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-tight backdrop-blur-xl transition-all md:left-6 md:top-auto md:bottom-6 md:translate-x-0',
                !isOnline
                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : isSyncing
                      ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                      : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
            )}
            role="status"
        >
            {!isOnline ? (
                <>
                    <WifiOff className="h-3.5 w-3.5" />
                    <span>Offline — changes saved locally</span>
                </>
            ) : isSyncing ? (
                <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Syncing…</span>
                </>
            ) : (
                <>
                    <Wifi className="h-3.5 w-3.5" />
                    <span>Synced</span>
                </>
            )}
        </div>
    );
}
