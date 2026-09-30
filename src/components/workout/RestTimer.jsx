import React, { useEffect, useRef, useState } from 'react';
import { Plus, TimerOff, Check } from 'lucide-react';
import { hapticSuccess } from '../../lib/platform';

/** Uses a deadline so sleep, background tabs and input rerenders cannot slow rest. */
export default function RestTimer({ seconds = 120, endAt, exerciseName, onExtend, onDone }) {
    const [deadline, setDeadline] = useState(() => endAt ?? Date.now() + seconds * 1000);
    const [total, setTotal] = useState(seconds);
    const [now, setNow] = useState(() => Date.now());
    const notified = useRef(false);
    const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
    const ready = remaining === 0;

    useEffect(() => {
        const tick = () => setNow(Date.now());
        const id = setInterval(tick, 250);
        document.addEventListener('visibilitychange', tick);
        window.addEventListener('focus', tick);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', tick);
            window.removeEventListener('focus', tick);
        };
    }, []);
    useEffect(() => {
        if (ready && !notified.current) {
            notified.current = true;
            hapticSuccess();
        }
    }, [ready]);

    const extend = () => {
        const next = Math.max(deadline, Date.now()) + 30000;
        const nextTotal = ready ? 30 : total + 30;
        notified.current = false;
        setDeadline(next);
        setTotal(nextTotal);
        setNow(Date.now());
        onExtend?.(next, nextTotal);
    };
    const size = 56, radius = 24, circumference = 2 * Math.PI * radius;
    const fraction = total > 0 ? Math.min(1, remaining / total) : 0;

    return (
        <section aria-label="Rest timer" className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 mx-auto max-w-md md:left-72 md:right-8 md:bottom-8 md:mx-0 md:ml-auto">
            <div className={`rounded-2xl border p-3 shadow-card backdrop-blur-xl ${ready ? 'border-emerald-400/30 bg-ink-950/95' : 'border-accent/30 bg-ink-950/95'}`}>
                <div className="flex items-center gap-3">
                    <div className="relative h-14 w-14 shrink-0">
                        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                            <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                            <circle cx="28" cy="28" r={radius} fill="none" stroke={ready ? '#4ade80' : '#b8a0ff'} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={ready ? 0 : circumference * (1 - fraction)} transform="rotate(-90 28 28)" />
                        </svg>
                        <span role="timer" aria-label="Rest remaining" className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-white">{ready ? <Check aria-hidden="true" className="h-5 w-5 text-emerald-300" /> : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p role="status" className={`text-sm font-semibold ${ready ? 'text-emerald-300' : 'text-white'}`}>{ready ? 'Rest complete' : 'Rest between sets'}</p>
                        <p className="mt-1 truncate text-xs text-ink-400">{exerciseName || 'Take a breather'}</p>
                    </div>
                    <button type="button" onClick={extend} className="btn-secondary min-h-11 px-2.5 text-xs" aria-label="Add 30 seconds to rest"><Plus className="h-3.5 w-3.5" />30s</button>
                    <button type="button" onClick={onDone} className="btn-ghost min-h-11 min-w-11 px-2" aria-label={ready ? 'Dismiss rest timer' : 'Skip rest'}><TimerOff className="h-4 w-4" /></button>
                </div>
            </div>
        </section>
    );
}
