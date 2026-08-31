import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { Scale, Plus, Trash2 } from 'lucide-react';
import { db } from '../../data/db';
import { useUnit } from '../../contexts/UnitContext';
import { Card, Chip } from '../ui/Primitives';

/**
 * Bodyweight tracking card — fully self-contained.
 *
 * Owns its db subscription (no Progress.jsx coupling): the orchestrator can
 * mount it anywhere. All storage is KG; unit conversion happens at this edge
 * via UnitContext (toKg on input, displayWeight on render). The sparkline is
 * plain SVG — no chart dependency.
 */

function useBodyweightEntries() {
    const subscribe = useCallback((onChange) => db.subscribe(onChange), []);
    // Cache the sorted list against the doc reference; db.commit always
    // produces a new top-level document, so this is a stable snapshot.
    const getSnapshot = useMemo(() => {
        let cachedDoc = null;
        let cached = null;
        return () => {
            const current = db.get();
            if (current !== cachedDoc) {
                cachedDoc = current;
                cached = db.bodyweight.list();
            }
            return cached;
        };
    }, []);
    return useSyncExternalStore(subscribe, getSnapshot);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function Sparkline({ entries, days = 30, nowMs }) {
    const cutoff = nowMs - days * DAY_MS;
    const points = entries
        .filter((e) => new Date(e.date).getTime() >= cutoff)
        .map((e) => ({ t: new Date(e.date).getTime(), kg: e.weightKg }))
        .sort((a, b) => a.t - b.t);

    if (points.length < 2) return null;

    const W = 300;
    const H = 56;
    const pad = 4;
    const min = Math.min(...points.map((p) => p.kg));
    const max = Math.max(...points.map((p) => p.kg));
    const span = max - min || 1;
    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    const tSpan = t1 - t0 || 1;

    const coords = points.map((p) => ({
        x: pad + ((p.t - t0) / tSpan) * (W - pad * 2),
        y: pad + (1 - (p.kg - min) / span) * (H - pad * 2),
    }));
    const path = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const last = coords[coords.length - 1];

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-14 w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label={`Bodyweight trend, last ${days} days`}
        >
            <polyline
                points={path}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
            />
            <circle cx={last.x} cy={last.y} r="3" className="fill-accent" />
        </svg>
    );
}

export default function BodyweightCard({ className }) {
    const { unit, displayWeight, toKg } = useUnit();
    const entries = useBodyweightEntries();
    const [nowMs] = useState(() => Date.now());
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [weight, setWeight] = useState('');
    const [error, setError] = useState('');

    const latest = entries[0] ?? null;

    const add = (e) => {
        e.preventDefault();
        const n = Number(weight);
        if (!Number.isFinite(n) || n <= 0) {
            setError('Enter a valid weight.');
            return;
        }
        if (!date) {
            setError('Pick a date.');
            return;
        }
        db.bodyweight.add({ date: new Date(`${date}T12:00:00Z`).toISOString(), weightKg: toKg(n) });
        setWeight('');
        setError('');
    };

    return (
        <Card padded={false} className={className}>
            <div className="flex items-center justify-between p-5 pb-0 md:p-6 md:pb-0">
                <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-accent/10 text-accent">
                        <Scale className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="eyebrow">Bodyweight</div>
                        {latest ? (
                            <p className="text-sm text-ink-400">
                                Last logged{' '}
                                {new Date(latest.date).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </p>
                        ) : (
                            <p className="text-sm text-ink-500">No entries yet</p>
                        )}
                    </div>
                </div>
                {latest && (
                    <div className="text-right">
                        <span className="font-display text-3xl font-bold tabular-nums text-white">
                            {displayWeight(latest.weightKg)}
                        </span>
                        <span className="ml-1 text-sm text-ink-400">{unit}</span>
                    </div>
                )}
            </div>

            <div className="px-5 pt-3 md:px-6">
                <Sparkline entries={entries} nowMs={nowMs} />
                {entries.length < 2 && (
                    <p className="pb-1 text-xs text-ink-500">
                        Log at least two entries within 30 days to see a trend.
                    </p>
                )}
            </div>

            <form onSubmit={add} className="flex items-end gap-2 p-5 md:p-6">
                <label className="min-w-0 flex-1">
                    <span className="eyebrow mb-1 block">Weight ({unit})</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="0.0"
                        aria-label={`Weight in ${unit}`}
                        className="set-input"
                    />
                </label>
                <label>
                    <span className="eyebrow mb-1 block">Date</span>
                    <input
                        type="date"
                        value={date}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setDate(e.target.value)}
                        aria-label="Entry date"
                        className="set-input"
                    />
                </label>
                <button type="submit" className="btn-primary shrink-0" aria-label="Add bodyweight entry">
                    <Plus className="h-4 w-4" />
                </button>
            </form>
            {error && (
                <p className="-mt-3 px-5 pb-3 text-xs text-red-400 md:px-6" role="alert">
                    {error}
                </p>
            )}

            {entries.length > 0 && (
                <div className="border-t border-white/[0.07] p-5 pt-4 md:p-6 md:pt-4">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="eyebrow">Recent</span>
                        <Chip>{entries.length} total</Chip>
                    </div>
                    <ul className="space-y-1">
                        {entries.slice(0, 5).map((entry) => (
                            <li
                                key={entry.id}
                                className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2"
                            >
                                <span className="text-sm tabular-nums text-white">
                                    {displayWeight(entry.weightKg)} {unit}
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className="text-xs text-ink-500">
                                        {new Date(entry.date).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => db.bodyweight.remove(entry.id)}
                                        className="increment-btn h-7 w-7 text-red-400"
                                        aria-label="Delete entry"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Card>
    );
}
