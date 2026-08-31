import React from 'react';
import clsx from 'clsx';
import { Info } from 'lucide-react';
import { Chip, Sheet } from '../ui/Primitives';

/**
 * "Why?" — the audit surface for engine suggestions. Renders ONLY values
 * from the engine's explanation object: rule id, the sessions analyzed,
 * volume/intensity deltas, plateau window. No prose is invented here;
 * the numbers are the engine's own kg values, shown verbatim.
 */

export function WhyButton({ onClick, className, label = 'Why this suggestion?' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className={clsx(
                'btn-ghost shrink-0 gap-1 px-2 py-1 text-[11px] font-bold text-accent',
                className,
            )}
        >
            <Info className="h-3.5 w-3.5" /> Why?
        </button>
    );
}

function DeltaTile({ label, value }) {
    return (
        <div className="rounded-lg bg-white/[0.02] p-2.5">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                {value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${value}%`}
            </p>
        </div>
    );
}

export default function SuggestionWhy({ open, onClose, explanation, reason }) {
    if (!explanation) return null;
    const { rule, sessionsAnalyzed, volumeDeltaPct, intensityDeltaPct, plateauWindowWeeks } = explanation;

    return (
        <Sheet open={open} onClose={onClose} title="Why this suggestion?">
            <div className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                    <Chip tone="accent">{rule}</Chip>
                    {plateauWindowWeeks != null && (
                        <Chip tone="warning">Plateau window: {plateauWindowWeeks} wk</Chip>
                    )}
                </div>

                {reason && <p className="text-sm leading-relaxed text-ink-300">{reason}</p>}

                <div className="grid grid-cols-2 gap-2">
                    <DeltaTile label="Volume change (analyzed span)" value={volumeDeltaPct} />
                    <DeltaTile label="Intensity change (analyzed span)" value={intensityDeltaPct} />
                </div>

                <div>
                    <div className="eyebrow mb-2">Sessions analyzed ({sessionsAnalyzed.length})</div>
                    {sessionsAnalyzed.length ? (
                        <ul className="space-y-1.5">
                            {sessionsAnalyzed.map((s, i) => (
                                <li
                                    key={i}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.01] px-3 py-2 text-xs"
                                >
                                    <span className="font-semibold text-ink-400">{s.date ?? '—'}</span>
                                    <span className="tabular-nums text-white">
                                        {s.topWeight} kg × {s.topReps} reps
                                        {s.avgRpe != null ? ` @ RPE ${s.avgRpe}` : ''}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-ink-500">
                            No sessions analyzed yet — log this lift once and the engine has data to show.
                        </p>
                    )}
                </div>

                <p className="text-[11px] leading-relaxed text-ink-600">
                    Weights are the engine's internal kg values, shown exactly as computed. Deltas
                    compare the newest vs oldest session of the analyzed span.
                </p>
            </div>
        </Sheet>
    );
}
