import React, { useEffect, useRef, useState } from 'react';
import { TimerOff, Plus } from 'lucide-react';
import { hapticSuccess } from '../../lib/platform';

/**
 * Rest countdown with circular SVG ring. Mounts when a set is completed
 * (key it by set id to restart), ticks down, haptics + auto-dismiss at zero.
 * Tap +30s to extend, or skip.
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
                        setTimeout(() => onDone?.(), 600);
                    }
                    return 0;
                }
                return r - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [onDone]);

    const pct = total > 0 ? remaining / total : 0;
    const m = Math.floor(remaining / 60);
    const s = String(remaining % 60).padStart(2, '0');

    // SVG ring dimensions
    const SIZE = 72;
    const STROKE = 5;
    const R = (SIZE - STROKE) / 2;
    const CIRC = 2 * Math.PI * R;
    const offset = CIRC * (1 - pct);

    // Color: green when plenty of time, purple when low, red when very low
    const ringColor =
        pct > 0.4 ? '#4ade80' : pct > 0.2 ? '#8b5cf6' : '#f87171';

    return (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 mx-auto max-w-md md:left-72 md:right-8 md:bottom-8 md:mx-0 md:ml-auto">
            <div
                className="overflow-hidden rounded-2xl"
                style={{
                    background: 'rgba(11, 11, 12, 0.92)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: `1px solid ${ringColor}30`,
                    boxShadow: `0 0 0 1px ${ringColor}15 inset, 0 8px 32px rgba(0,0,0,0.5), 0 0 24px -8px ${ringColor}40`,
                }}
            >
                <div className="flex items-center gap-4 px-4 py-3">
                    {/* Circular ring */}
                    <div className="relative flex-shrink-0">
                        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                            <defs>
                                <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor={ringColor} />
                                    <stop offset="100%" stopColor={pct > 0.4 ? '#22c55e' : pct > 0.2 ? '#a78bfa' : '#ef4444'} />
                                </linearGradient>
                            </defs>
                            {/* Track */}
                            <circle
                                cx={SIZE / 2}
                                cy={SIZE / 2}
                                r={R}
                                fill="none"
                                stroke="rgba(255,255,255,0.06)"
                                strokeWidth={STROKE}
                            />
                            {/* Fill */}
                            <circle
                                cx={SIZE / 2}
                                cy={SIZE / 2}
                                r={R}
                                fill="none"
                                stroke="url(#timerGrad)"
                                strokeWidth={STROKE}
                                strokeLinecap="round"
                                strokeDasharray={CIRC}
                                strokeDashoffset={offset}
                                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                                style={{
                                    transition: 'stroke-dashoffset 1s linear',
                                    filter: `drop-shadow(0 0 4px ${ringColor}70)`,
                                }}
                            />
                            {/* Center text */}
                            <text
                                x={SIZE / 2}
                                y={SIZE / 2 + 1}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize="14"
                                fontWeight="700"
                                fill="#f7f6f4"
                                fontFamily="Space Grotesk"
                            >
                                {m}:{s}
                            </text>
                        </svg>
                    </div>

                    {/* Labels + controls */}
                    <div className="flex flex-1 items-center justify-between">
                        <div>
                            <div className="eyebrow mb-0.5">Rest</div>
                            <div className="text-sm text-ink-400">
                                {remaining > 0 ? 'Recovery time' : 'Done — get after it!'}
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
                </div>
            </div>
        </div>
    );
}
