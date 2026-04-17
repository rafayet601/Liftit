import React, { useCallback, useEffect, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { hapticLight } from '../../lib/platform';

/**
 * A cleaner workout timer — HH:MM:SS tabular numerals, subtle pulsing dot
 * while running, right-aligned secondary controls. Starts on first tap.
 */
export default function WorkoutTimer({ onTimeUpdate, initialTime = 0, autoStart = true }) {
    const [seconds, setSeconds] = useState(initialTime);
    const [running, setRunning] = useState(autoStart);

    useEffect(() => {
        if (!running) return undefined;
        const id = setInterval(() => {
            setSeconds((s) => {
                const next = s + 1;
                onTimeUpdate?.(next);
                return next;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [running, onTimeUpdate]);

    const toggle = () => {
        hapticLight();
        setRunning((r) => !r);
    };

    const reset = useCallback(() => {
        hapticLight();
        setRunning(false);
        setSeconds(0);
        onTimeUpdate?.(0);
    }, [onTimeUpdate]);

    return (
        <div className="glass-morphism inline-flex items-center gap-2 rounded-2xl px-3 py-1.5">
            <span
                className={clsx(
                    'h-1.5 w-1.5 rounded-full',
                    running ? 'bg-accent animate-pulse' : 'bg-zinc-600',
                )}
            />
            <span className="font-mono text-[15px] font-bold tabular-nums text-white">
                {formatTime(seconds)}
            </span>
            <button
                type="button"
                onClick={toggle}
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={running ? 'Pause timer' : 'Start timer'}
            >
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            {seconds > 0 && (
                <button
                    type="button"
                    onClick={reset}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Reset timer"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}

function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
