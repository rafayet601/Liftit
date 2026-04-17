import React, { useEffect, useRef, useState } from 'react';
import { Check, Minus, Plus, TrendingDown, TrendingUp, Equal } from 'lucide-react';
import clsx from 'clsx';
import { useUnit } from '../../contexts/UnitContext';
import { hapticLight, hapticSuccess } from '../../lib/platform';

/**
 * Redesigned SetLogger — big-touch weight/reps steppers, clean RPE picker,
 * unambiguous "Complete" action. Fixes the previous double-unit conversion
 * bug: we now track the displayed value in the user's unit and convert once
 * when updating parent state (which stores KG).
 */
export default function SetLogger({
    set,
    setIndex,
    exerciseId,
    onUpdate,
    onComplete,
    previousSet,
    targetReps,
    targetWeight,
}) {
    const { unit, displayWeight, toKg } = useUnit();
    const [celebrate, setCelebrate] = useState(false);
    const weightRef = useRef(null);
    const repsRef = useRef(null);

    // Local draft mirrors the input text so typing "12.5" doesn't fight with
    // parent state conversions on every keystroke.
    const [weightDraft, setWeightDraft] = useState('');
    const [repsDraft, setRepsDraft] = useState('');

    useEffect(() => {
        const shown = set.weight ? displayWeight(set.weight) : '';
        setWeightDraft(shown === 0 || shown === '' ? '' : String(shown));
    }, [set.weight, displayWeight]);

    useEffect(() => {
        setRepsDraft(set.reps ? String(set.reps) : '');
    }, [set.reps]);

    const increment = unit === 'kg' ? 2.5 : 5;

    const bumpWeight = (delta) => {
        hapticLight();
        const shown = Number(weightDraft || displayWeight(set.weight) || displayWeight(targetWeight || 0)) || 0;
        const next = Math.max(0, Math.round((shown + delta * increment) * 100) / 100);
        setWeightDraft(String(next));
        onUpdate(exerciseId, setIndex, 'weight', toKg(next));
    };

    const bumpReps = (delta) => {
        hapticLight();
        const current = Number(repsDraft || set.reps || 0);
        const next = Math.max(0, current + delta);
        setRepsDraft(String(next));
        onUpdate(exerciseId, setIndex, 'reps', next);
    };

    const onWeightBlur = () => {
        const n = Number(weightDraft);
        if (!Number.isFinite(n)) {
            setWeightDraft('');
            onUpdate(exerciseId, setIndex, 'weight', 0);
            return;
        }
        onUpdate(exerciseId, setIndex, 'weight', toKg(n));
    };

    const onRepsBlur = () => {
        const n = parseInt(repsDraft, 10);
        onUpdate(exerciseId, setIndex, 'reps', Number.isFinite(n) ? Math.max(0, n) : 0);
    };

    const handleComplete = () => {
        if (!set.reps || set.reps <= 0) return;
        hapticSuccess();
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 900);
        onComplete?.(exerciseId, setIndex);
    };

    const completed = !!set.completed;
    const progress = progressVs(set, previousSet);

    return (
        <div
            className={clsx(
                'relative rounded-2xl border p-3 transition-all duration-300 md:p-4',
                completed
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-white/5 bg-white/[0.02] hover:border-white/10',
                celebrate && 'animate-scale-in shadow-glow',
            )}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div
                        className={clsx(
                            'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black',
                            completed
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-white/[0.04] text-zinc-400',
                        )}
                    >
                        {completed ? <Check className="h-4 w-4" /> : `#${setIndex + 1}`}
                    </div>
                    {progress && (
                        <span
                            className={clsx(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em]',
                                progress.tone === 'up' &&
                                    'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
                                progress.tone === 'same' &&
                                    'border-amber-400/30 bg-amber-400/10 text-amber-300',
                                progress.tone === 'down' &&
                                    'border-red-500/30 bg-red-500/10 text-red-300',
                            )}
                        >
                            {progress.tone === 'up' ? (
                                <TrendingUp className="h-3 w-3" />
                            ) : progress.tone === 'same' ? (
                                <Equal className="h-3 w-3" />
                            ) : (
                                <TrendingDown className="h-3 w-3" />
                            )}
                            {progress.label}
                        </span>
                    )}
                </div>
                {previousSet && (
                    <span className="text-[11px] text-zinc-500">
                        Last:{' '}
                        <span className="font-semibold text-zinc-300">
                            {displayWeight(previousSet.weight)} {unit} × {previousSet.reps}
                        </span>
                    </span>
                )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                {/* Weight */}
                <div className="col-span-1">
                    <label className="eyebrow mb-1.5 block">Weight ({unit})</label>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => bumpWeight(-1)}
                            aria-label="Decrease weight"
                            className="increment-btn"
                        >
                            <Minus className="h-4 w-4" />
                        </button>
                        <input
                            ref={weightRef}
                            inputMode="decimal"
                            type="number"
                            step={increment}
                            value={weightDraft}
                            onChange={(e) => setWeightDraft(e.target.value)}
                            onBlur={onWeightBlur}
                            placeholder={
                                targetWeight ? String(displayWeight(targetWeight)) : '0'
                            }
                            className="set-input"
                        />
                        <button
                            type="button"
                            onClick={() => bumpWeight(1)}
                            aria-label="Increase weight"
                            className="increment-btn"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Reps */}
                <div className="col-span-1">
                    <label className="eyebrow mb-1.5 block">Reps</label>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => bumpReps(-1)}
                            aria-label="Decrease reps"
                            className="increment-btn"
                        >
                            <Minus className="h-4 w-4" />
                        </button>
                        <input
                            ref={repsRef}
                            inputMode="numeric"
                            type="number"
                            step={1}
                            value={repsDraft}
                            onChange={(e) => setRepsDraft(e.target.value)}
                            onBlur={onRepsBlur}
                            placeholder={targetReps ? String(targetReps) : '0'}
                            className="set-input"
                        />
                        <button
                            type="button"
                            onClick={() => bumpReps(1)}
                            aria-label="Increase reps"
                            className="increment-btn"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* RPE */}
                <div className="col-span-2 md:col-span-1">
                    <label className="eyebrow mb-1.5 block">RPE</label>
                    <div className="rpe-selector">
                        {[7, 8, 9, 10].map((rpe) => (
                            <button
                                key={rpe}
                                type="button"
                                onClick={() => {
                                    hapticLight();
                                    onUpdate(exerciseId, setIndex, 'rpe', rpe);
                                }}
                                className={clsx('rpe-btn', set.rpe === rpe && 'active')}
                                aria-label={`RPE ${rpe}`}
                                aria-pressed={set.rpe === rpe}
                            >
                                {rpe}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Complete */}
                <div className="col-span-2 md:col-span-1">
                    <label className="eyebrow mb-1.5 block md:text-right">Action</label>
                    <button
                        type="button"
                        onClick={handleComplete}
                        disabled={!set.reps || set.reps <= 0}
                        className={clsx(
                            'flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
                            completed
                                ? 'bg-emerald-500 text-ink-950 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.6)]'
                                : 'bg-accent text-ink-950 hover:bg-accent-300 shadow-[0_10px_30px_-10px_rgba(190,242,100,0.6)]',
                        )}
                    >
                        {completed ? (
                            <>
                                <Check className="h-4 w-4" /> Logged
                            </>
                        ) : (
                            'Complete Set'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

function progressVs(cur, prev) {
    if (!prev || !cur?.reps) return null;
    const curVol = (Number(cur.weight) || 0) * (Number(cur.reps) || 0);
    const prevVol = (Number(prev.weight) || 0) * (Number(prev.reps) || 0);
    if (!prevVol) return null;
    const delta = curVol - prevVol;
    if (delta > 0) return { tone: 'up', label: 'Ahead' };
    if (delta < 0) return { tone: 'down', label: 'Behind' };
    return { tone: 'same', label: 'Match' };
}
