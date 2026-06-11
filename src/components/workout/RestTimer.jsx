import React, { useEffect, useRef, useState } from 'react';
import { TimerOff, Plus } from 'lucide-react';
import { hapticSuccess } from '../../lib/platform';

/**
 * Rest countdown bar. Mounts when a set is completed (key it by set id to
 * restart), ticks down, haptics + auto-dismiss at zero. Tap +30s to extend,
 * or skip.
 */
export default function RestTimer({ seconds = 120, onDone }) {
    const [remaining, setRemaining] = useState(seconds);
    const [total, setTotal] = useState(seconds);
    const doneRef = useRef(false);

    useEffect(() => {
        const id = setInterval(() => {
            setRemaining((r) => {
                if (r <= 1) {
                    clearInterval(id);
                    if (!doneRef.current) {
                        doneRef.current = true;
                        hapticSuccess();
                        // Let the 0:00 frame paint before dismissing.
                        setTimeout(() => onDone?.(), 600);
                    }
                    return 0;
                }
                return r - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [onDone]);

    const pct = total > 0 ? (remaining / total) * 100 : 0;
    const m = Math.floor(remaining / 60);
    const s = String(remaining % 60).padStart(2, '0');

    return (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 mx-auto max-w-md md:left-72 md:right-8 md:bottom-8 md:mx-0 md:ml-auto">
            <div className="surface-strong overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                        <div className="eyebrow">Rest</div>
                        <div className="font-display text-2xl font-bold tabular-nums text-white">
                            {m}:{s}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setRemaining((r) => r + 30);
                                setTotal((t) => t + 30);
                            }}
                            className="btn-secondary px-3 py-2 text-xs"
                        >
                            <Plus className="h-3.5 w-3.5" /> 30s
                        </button>
                        <button
                            type="button"
                            onClick={() => onDone?.()}
                            className="btn-ghost px-3 py-2 text-xs"
                            aria-label="Skip rest"
                        >
                            <TimerOff className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div className="h-1 w-full bg-white/5">
                    <div
                        className="h-full bg-gradient-ember transition-[width] duration-1000 ease-linear"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
