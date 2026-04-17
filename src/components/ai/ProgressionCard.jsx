import React from 'react';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    ArrowRight,
    Lightbulb,
    Check,
} from 'lucide-react';
import clsx from 'clsx';
import { Card } from '../ui/Primitives';

const CONFIG = {
    increase: {
        icon: TrendingUp,
        label: 'Push',
        tone: 'text-emerald-300',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        gradient: 'from-emerald-500/10 via-transparent to-transparent',
    },
    maintain: {
        icon: Minus,
        label: 'Hold',
        tone: 'text-amber-300',
        bg: 'bg-amber-400/10',
        border: 'border-amber-400/30',
        gradient: 'from-amber-400/10 via-transparent to-transparent',
    },
    decrease: {
        icon: TrendingDown,
        label: 'Deload',
        tone: 'text-red-300',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        gradient: 'from-red-500/10 via-transparent to-transparent',
    },
};

export default function ProgressionCard({
    exercise,
    recommendation,
    previousSet,
    currentWeight,
    unit = 'kg',
    onAccept,
    onModify,
}) {
    const cfg = CONFIG[recommendation?.type || 'maintain'];
    const Icon = cfg.icon;
    const nextValue =
        recommendation?.suggestion?.match(/[\d.]+/)?.[0] || currentWeight || '';

    return (
        <Card className={clsx('bg-gradient-to-br', cfg.gradient)}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h4 className="truncate text-lg font-bold tracking-tight text-white">
                        {exercise}
                    </h4>
                    {previousSet && (
                        <p className="mt-1 text-xs text-zinc-500">
                            Last · {previousSet.weight}
                            {unit} × {previousSet.reps} @ RPE {previousSet.rpe}
                        </p>
                    )}
                </div>
                <span
                    className={clsx(
                        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest',
                        cfg.bg,
                        cfg.border,
                        cfg.tone,
                    )}
                >
                    <Icon className="h-3 w-3" /> {cfg.label}
                </span>
            </div>

            {nextValue && (
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
                    <div className="text-center">
                        <p className="eyebrow mb-1">Current</p>
                        <p className="font-mono text-lg font-bold tabular-nums text-white">
                            {previousSet?.weight ?? currentWeight}
                            {unit}
                        </p>
                    </div>
                    <div
                        className={clsx(
                            'flex h-8 w-8 items-center justify-center rounded-full',
                            cfg.bg,
                            cfg.tone,
                        )}
                    >
                        <ArrowRight className="h-4 w-4" />
                    </div>
                    <div className="text-center">
                        <p className="eyebrow mb-1">Target</p>
                        <p
                            className={clsx(
                                'font-mono text-lg font-bold tabular-nums',
                                cfg.tone,
                            )}
                        >
                            {nextValue}
                            {unit}
                        </p>
                    </div>
                </div>
            )}

            {recommendation?.reasoning && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-sm">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                    <p className="text-zinc-300">{recommendation.reasoning}</p>
                </div>
            )}

            {onAccept && onModify && (
                <div className="mt-4 flex gap-2">
                    <button type="button" onClick={onAccept} className="btn-primary flex-1">
                        <Check className="h-4 w-4" /> Accept
                    </button>
                    <button
                        type="button"
                        onClick={onModify}
                        className="btn-secondary flex-1"
                    >
                        Modify
                    </button>
                </div>
            )}
        </Card>
    );
}
