import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import { useUnit } from '../../contexts/UnitContext';
import { Stepper } from '../ui/Primitives';
import PlateCalculator from './PlateCalculator';
import { hapticLight, hapticSuccess } from '../../lib/platform';

const RPE_OPTIONS = [6, 7, 8, 9, 10];

/**
 * One set: weight + reps steppers, compact RPE picker, complete button.
 * Parent state stores KG; drafts mirror the visible text so typing decimals
 * never fights conversions. Ghost values show last session's matching set.
 */
export default function SetRow({ set, index, ghost, onChange, onComplete }) {
    const { unit, displayWeight, toKg } = useUnit();
    const [weightDraft, _setWeightDraft] = useState('');
    const [repsDraft, _setRepsDraft] = useState('');
    // Refs mirror the drafts so rapid stepper taps never read stale state
    // (effects don't run between two taps in the same frame).
    const weightRef = useRef('');
    const repsRef = useRef('');
    const setWeightDraft = (v) => {
        weightRef.current = v;
        _setWeightDraft(v);
    };
    const setRepsDraft = (v) => {
        repsRef.current = v;
        _setRepsDraft(v);
    };

    useEffect(() => {
        const v = set.weight > 0 ? String(displayWeight(set.weight)) : '';
        weightRef.current = v;
        _setWeightDraft(v);
    }, [set.weight, displayWeight]);

    useEffect(() => {
        const v = set.reps > 0 ? String(set.reps) : '';
        repsRef.current = v;
        _setRepsDraft(v);
    }, [set.reps]);

    const weightStep = unit === 'kg' ? 2.5 : 5;

    const stepWeight = (delta) => {
        hapticLight();
        const shown = Number(weightRef.current) || displayWeight(ghost?.weight ?? 0) || 0;
        const next = Math.max(0, Math.round((shown + delta) * 100) / 100);
        setWeightDraft(next ? String(next) : '');
        onChange({ weight: toKg(next) });
    };

    const stepReps = (delta) => {
        hapticLight();
        const next = Math.max(0, (Number(repsRef.current) || ghost?.reps || 0) + delta);
        setRepsDraft(next ? String(next) : '');
        onChange({ reps: next });
    };

    const commitWeight = () => {
        const n = Number(weightDraft);
        onChange({ weight: Number.isFinite(n) && n > 0 ? toKg(n) : 0 });
    };

    const commitReps = () => {
        const n = parseInt(repsDraft, 10);
        onChange({ reps: Number.isFinite(n) && n > 0 ? n : 0 });
    };

    const canComplete = set.reps > 0 && set.weight >= 0;

    const complete = () => {
        if (!canComplete) return;
        hapticSuccess();
        onComplete();
    };

    return (
        <div
            className={clsx(
                'rounded-2xl border p-3 transition-all duration-200',
                set.completed
                    ? 'border-emerald-500/25 bg-emerald-500/[0.05]'
                    : set.isWarmup
                    ? 'border-amber-400/20 bg-amber-400/[0.04]'
                    : canComplete
                    ? 'border-accent/20 bg-white/[0.02] shadow-[0_0_16px_-6px_rgba(139,92,246,0.2)]'
                    : 'border-white/[0.07] bg-white/[0.02]',
            )}
        >
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-ink-500">
                        {set.isWarmup ? 'Warmup' : `Set ${index + 1}`}
                    </span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={!!set.isWarmup}
                        aria-label={`Mark set ${index + 1} as warmup`}
                        onClick={() => {
                            hapticLight();
                            onChange({ isWarmup: !set.isWarmup });
                        }}
                        className={clsx(
                            'rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest transition-colors',
                            set.isWarmup
                                ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                                : 'border-white/[0.07] bg-white/[0.02] text-ink-600 hover:text-ink-400',
                        )}
                    >
                        W
                    </button>
                </div>
                {ghost && (
                    <span className="text-xs tabular-nums text-ink-500">
                        last: {displayWeight(ghost.weight)} {unit} × {ghost.reps}
                        {ghost.rpe ? ` @ ${ghost.rpe}` : ''}
                    </span>
                )}
            </div>

            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-ink-500">
                        {unit}
                    </label>
                    <Stepper
                        value={weightDraft}
                        label={`weight in ${unit}`}
                        step={weightStep}
                        onInput={setWeightDraft}
                        onBlur={commitWeight}
                        onStep={stepWeight}
                    />
                    <PlateCalculator weightKg={set.weight} />
                </div>
                <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-ink-500">
                        Reps
                    </label>
                    <Stepper
                        value={repsDraft}
                        label="reps"
                        step={1}
                        inputMode="numeric"
                        onInput={setRepsDraft}
                        onBlur={commitReps}
                        onStep={stepReps}
                    />
                </div>
                <button
                    type="button"
                    onClick={complete}
                    disabled={!canComplete || set.completed}
                    aria-label={`Complete set ${index + 1}`}
                    className={clsx(
                        'flex h-12 w-12 items-center justify-center rounded-xl border transition-all active:scale-90',
                        set.completed
                            ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300 shadow-[0_0_16px_-4px_rgba(74,222,128,0.4)]'
                            : canComplete
                              ? 'border-accent/50 bg-accent/15 text-accent hover:bg-accent/25 hover:shadow-[0_0_16px_-4px_rgba(139,92,246,0.4)] hover:scale-105'
                              : 'border-white/10 bg-white/[0.02] text-ink-600',
                    )}
                >
                    <Check
                        className={clsx('h-5 w-5', set.completed && 'animate-[set-complete_0.4s_cubic-bezier(0.34,1.56,0.64,1)_both]')}
                        strokeWidth={2.5}
                    />
                </button>
            </div>

            {/* RPE */}
            <div className="mt-2 flex items-center gap-1.5">
                <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-ink-500">
                    RPE
                </span>
                {RPE_OPTIONS.map((r) => (
                    <button
                        key={r}
                        type="button"
                        onClick={() => {
                            hapticLight();
                            onChange({ rpe: set.rpe === r ? 0 : r });
                        }}
                        className={clsx(
                            'h-8 flex-1 rounded-lg border text-xs font-bold tabular-nums transition-colors',
                            set.rpe === r
                                ? 'border-accent/50 bg-accent/15 text-accent'
                                : 'border-white/[0.07] bg-white/[0.02] text-ink-500 hover:text-white',
                        )}
                    >
                        {r}
                    </button>
                ))}
            </div>
        </div>
    );
}
