import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Trophy, Dumbbell, AlertCircle, CheckCircle2, Zap, Coffee, Activity } from 'lucide-react';
import clsx from 'clsx';
import { db } from '../data/db';
import { useWorkouts } from '../data/DataProvider';
import { useUnit } from '../contexts/UnitContext';
import {
    e1rmTrend,
    muscleGroupSets,
    prTimeline,
    frequencyHeatmap,
    recentExerciseIds,
    volumeTrend,
} from '../engine/analytics';
import {
    sessionsForExercise,
    analyzeDoubleProgression,
    getDeloadRecommendation,
    getProgressionRecommendation,
    explainProgression
} from '../engine/progression';
import { acwr, applyFatigueContext, applyReadinessContext } from '../engine/fatigue';
import { useRecovery } from '../contexts/RecoveryContext';
import { MUSCLE_GROUPS } from '../data/exercises';
import { Card, Chip, EmptyState, PageHeader } from '../components/ui/Primitives';
import SuggestionWhy, { WhyButton } from '../components/workout/SuggestionWhy';
import BodyweightCard from '../components/progress/BodyweightCard';
import Glass from '../components/ui/Glass';

/**
 * Progress — e1RM trend for any logged exercise, muscle-group balance,
 * PR timeline, and a frequency heatmap. 100% derived from real logs.
 * 
 * ENHANCED: Now includes double-progression analysis with deload recommendations.
 */

function ProgressionBadge({ trend, priority }) {
    const bgMap = {
        success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    };
    
    const iconMap = {
        success: CheckCircle2,
        warning: AlertCircle,
        info: Zap,
    };
    
    const Icon = iconMap[priority] || Zap;
    const className = bgMap[priority] || bgMap.info;
    
    return (
        <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${className}`}>
            <Icon className="h-3.5 w-3.5" />
            <span className="capitalize">{trend}</span>
        </div>
    );
}

function ProgressionRecommendationCard({ recommendation, exerciseName, onWhy }) {
    if (!recommendation) return null;

    const bgMap = {
        success: 'border-emerald-500/20 bg-emerald-500/5',
        warning: 'border-amber-500/20 bg-amber-500/5',
        info: 'border-blue-500/20 bg-blue-500/5',
    };

    return (
        <Card className={`space-y-3 border ${bgMap[recommendation.priority]}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">{recommendation.title}</h3>
                        <ProgressionBadge trend={recommendation.action} priority={recommendation.priority} />
                        {exerciseName && <Chip>{exerciseName}</Chip>}
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">{recommendation.description}</p>
                    {recommendation.details && (
                        <p className="mt-2 text-xs text-zinc-500">{recommendation.details}</p>
                    )}
                </div>
                {onWhy && <WhyButton onClick={onWhy} label="Why this recommendation?" />}
            </div>
        </Card>
    );
}

function DeloadCard({ recommendation }) {
    if (!recommendation?.shouldDeload) return null;
    return (
        <Card
            className="flex items-start gap-3 border-amber-500/25 bg-amber-500/[0.06]"
            data-testid="deload-card"
        >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                <Coffee className="h-4 w-4" />
            </span>
            <div>
                <h3 className="font-semibold text-amber-200">Deload recommended</h3>
                <p className="mt-0.5 text-sm text-zinc-400">{recommendation.reason}</p>
                <p className="mt-1.5 text-xs text-amber-300/80">
                    Run a lighter week: cut weights to ~
                    {Math.round(recommendation.suggestedIntensityReduction * 100)}% and keep the
                    movements. Then come back and push.
                </p>
            </div>
        </Card>
    );
}

export default function Progress() {
    const workouts = useWorkouts();
    const { unit, displayWeight } = useUnit();
    const [timeframe, setTimeframe] = useState('30days');
    const [metric, setMetric] = useState('e1rm'); // 'e1rm' | 'volume'
    const [whyOpen, setWhyOpen] = useState(false);

    const fatigue = useMemo(() => acwr(workouts), [workouts]);
    const { readiness } = useRecovery();
    const acwrChip = {
        spike: { tone: 'danger', label: fatigue.ratio ? `Load spike · ACWR ${fatigue.ratio}` : 'Load spike' },
        detrend: { tone: 'warning', label: fatigue.ratio ? `Load taper · ACWR ${fatigue.ratio}` : 'Load taper' },
        balanced: { tone: 'success', label: fatigue.ratio ? `Balanced load · ACWR ${fatigue.ratio}` : 'Balanced load' },
        insufficient_data: { tone: 'steel', label: 'Building load history' },
    }[fatigue.status] ?? { tone: 'default', label: fatigue.status };
    const readinessChip = readiness && readiness.status !== 'insufficient_data'
        ? {
              fatigued: { tone: 'danger', label: `Readiness ${readiness.score} · fatigued` },
              caution: { tone: 'warning', label: `Readiness ${readiness.score} · caution` },
              ready: { tone: 'success', label: `Readiness ${readiness.score} · ready` },
          }[readiness.status] ?? null
        : null;

    const trackedExercises = useMemo(
        () =>
            recentExerciseIds(workouts, 30)
                .map((id) => db.exercises.byId(id))
                .filter(Boolean),
        [workouts],
    );
    const [selectedId, setSelectedId] = useState(null);
    const activeId = selectedId ?? trackedExercises[0]?.id ?? null;

    const trendLimit = timeframe === '30days' ? 30 : timeframe === '12weeks' ? 84 : 365;

    const trend = useMemo(
        () =>
            activeId
                ? e1rmTrend(workouts, activeId, trendLimit).map((p) => ({
                      ...p,
                      e1rmDisplay: displayWeight(p.e1rm),
                      label: new Date(p.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                      }),
                  }))
                : [],
        [workouts, activeId, displayWeight, trendLimit],
    );

    const progressionData = useMemo(() => {
        if (!activeId) return { analysis: null, recommendation: null, deloadRec: null, explanation: null };

        const sessions = sessionsForExercise(workouts, activeId, 12);
        if (!sessions.length) return { analysis: null, recommendation: null, deloadRec: null, explanation: null };

        const analysis = analyzeDoubleProgression(sessions);
        const recommendation = getProgressionRecommendation(sessions, analysis, unit);
        const deloadRec = applyReadinessContext(
            applyFatigueContext(getDeloadRecommendation(analysis), fatigue),
            readiness,
        );
        const explanation = explainProgression(sessions);

        return { analysis, recommendation, deloadRec, explanation };
    }, [workouts, activeId, unit, fatigue, readiness]);

    const volumeSeries = useMemo(
        () =>
            metric === 'volume' && activeId
                ? volumeTrend(workouts, activeId, trendLimit).map((p) => ({
                      ...p,
                      volumeDisplay: Math.round(displayWeight(p.volume)),
                      label: new Date(p.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                      }),
                  }))
                : [],
        [metric, workouts, activeId, displayWeight, trendLimit],
    );

    const muscles = useMemo(
        () => muscleGroupSets(workouts, (id) => db.exercises.byId(id), 28),
        [workouts],
    );
    const maxMuscle = Math.max(1, ...Object.values(muscles));
    const prs = useMemo(() => prTimeline(workouts, 12), [workouts]);
    const heatmap = useMemo(() => frequencyHeatmap(workouts, 84), [workouts]);

    if (!workouts.length) {
        return (
            <EmptyState
                icon={TrendingUp}
                title="Nothing to chart yet"
                description="Progress charts are built from your logged sets — no fake data here. Train once and come back."
                action={
                    <Link to="/workout" className="btn-primary">
                        <Dumbbell className="h-4 w-4" /> Start training
                    </Link>
                }
            />
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                eyebrow="Progress"
                title="Progress"
                description="Strength trends, balance, and the records that prove it's working."
                icon={TrendingUp}
            />

            <div className="flex flex-wrap items-center gap-2">
                <Chip tone={acwrChip.tone} icon={Activity}>
                    {acwrChip.label}
                </Chip>
                {readinessChip && (
                    <Chip tone={readinessChip.tone} icon={Activity}>
                        {readinessChip.label}
                    </Chip>
                )}
                {fatigue.status === 'spike' && !progressionData.deloadRec?.shouldDeload && (
                    <span className="text-xs text-zinc-500">Escalates a deload if a stall appears.</span>
                )}
            </div>

            <DeloadCard recommendation={progressionData.deloadRec} />

            {activeId && progressionData.recommendation && (
                <ProgressionRecommendationCard
                    recommendation={progressionData.recommendation}
                    exerciseName={trackedExercises.find(e => e.id === activeId)?.name}
                    onWhy={progressionData.explanation ? () => setWhyOpen(true) : null}
                />
            )}

            {progressionData.explanation && (
                <SuggestionWhy
                    open={whyOpen}
                    onClose={() => setWhyOpen(false)}
                    explanation={progressionData.explanation}
                    reason={progressionData.recommendation?.details ?? progressionData.recommendation?.description}
                />
            )}

            <Glass tint="neutral" glow wave wavePreset="purple" style={{ background: 'rgba(139,92,246,0.04)', borderColor: 'rgba(139,92,246,0.2)' }}>
            <Card className="space-y-4 glass-card-glow border-accent/20 mesh-border">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-display text-lg font-bold text-white">
                        {metric === 'e1rm' ? 'Estimated 1RM' : 'Volume per session'}
                    </h2>
                    <div className="flex gap-1.5">
                        <Chip>Epley + Brzycki blend</Chip>
                        {progressionData.analysis && (
                            <ProgressionBadge 
                                trend={progressionData.analysis.trend} 
                                priority={progressionData.recommendation?.priority}
                            />
                        )}
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 border-b border-white/10 pb-3">
                    <div className="flex gap-1.5">
                        {[
                            { key: 'e1rm', label: 'Strength' },
                            { key: 'volume', label: 'Volume' },
                        ].map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setMetric(key)}
                                className={clsx(
                                    'text-xs font-semibold px-2 py-1 rounded transition-colors',
                                    metric === key
                                        ? 'text-accent border-b-2 border-accent'
                                        : 'text-zinc-400 hover:text-zinc-300'
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-1.5">
                        {[
                            { key: '30days', label: '30 days' },
                            { key: '12weeks', label: '12 weeks' },
                            { key: 'alltime', label: 'All time' }
                        ].map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setTimeframe(key)}
                                className={clsx(
                                    'text-xs font-semibold px-2 py-1 rounded transition-colors',
                                    timeframe === key
                                        ? 'text-accent border-b-2 border-accent'
                                        : 'text-zinc-400 hover:text-zinc-300'
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                    {trackedExercises.slice(0, 12).map((e) => (
                        <button
                            key={e.id}
                            type="button"
                            onClick={() => setSelectedId(e.id)}
                            className={clsx(
                                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                                e.id === activeId
                                    ? 'border-accent/40 bg-accent/20 text-accent shadow-glass-glow-purple'
                                    : 'border-white/[0.06] bg-white/[0.01] text-ink-400 hover:border-white/20 hover:bg-white/[0.04]',
                            )}
                        >
                            {e.name}
                        </button>
                    ))}
                </div>
                {(() => {
                    const chartData = metric === 'e1rm' ? trend : volumeSeries;
                    if (chartData.length < 2) {
                        return (
                            <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-ink-500">
                                Log this lift in at least two sessions to draw a trend line.
                            </p>
                        );
                    }
                    const dataKey = metric === 'e1rm' ? 'e1rmDisplay' : 'volumeDisplay';
                    const stroke = metric === 'e1rm' ? '#8b5cf6' : '#38bdf8';
                    const gradientId = metric === 'e1rm' ? 'purpleFill' : 'skyFill';
                    return (
                        <>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                        <defs>
                                            <linearGradient id="purpleFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                                <stop offset="55%" stopColor="#8b5cf6" stopOpacity={0.08} />
                                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="skyFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                                                <stop offset="55%" stopColor="#38bdf8" stopOpacity={0.08} />
                                                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid stroke="rgba(143,176,207,0.07)" vertical={false} strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="label"
                                            tick={{ fill: '#55534f', fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            tick={{ fill: '#55534f', fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            domain={['auto', 'auto']}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(11, 11, 12, 0.88)',
                                                border: '1px solid rgba(139,92,246,0.2)',
                                                borderRadius: 12,
                                                color: '#f7f6f4',
                                                backdropFilter: 'blur(16px)',
                                                WebkitBackdropFilter: 'blur(16px)',
                                                boxShadow: '0 8px 32px 0 rgba(0,0,0,0.55), 0 0 20px -8px rgba(139,92,246,0.15)',
                                                fontFamily: 'Space Grotesk',
                                            }}
                                            formatter={(v) => [`${v} ${unit}`, metric === 'e1rm' ? 'e1RM' : 'Volume']}
                                            cursor={{ stroke: 'rgba(139,92,246,0.3)', strokeWidth: 1 }}
                                        />
                                        <Area
                                            type="monotoneX"
                                            dataKey={dataKey}
                                            stroke={stroke}
                                            strokeWidth={3}
                                            fill={`url(#${gradientId})`}
                                            dot={{ fill: stroke, strokeWidth: 0, r: 3 }}
                                            activeDot={{ r: 5, fill: stroke, strokeWidth: 2, stroke: 'rgba(139,92,246,0.3)' }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        
                        {progressionData.analysis && (
                            <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
                                <div className="rounded-lg bg-white/[0.02] p-2.5">
                                    <p className="text-xs text-zinc-500">Volume change</p>
                                    <p className="mt-0.5 text-sm font-semibold text-white">
                                        {progressionData.analysis.volumeProgressionPercent.toFixed(1)}%
                                    </p>
                                </div>
                                <div className="rounded-lg bg-white/[0.02] p-2.5">
                                    <p className="text-xs text-zinc-500">Intensity change</p>
                                    <p className="mt-0.5 text-sm font-semibold text-white">
                                        {progressionData.analysis.intensityProgressionPercent.toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        )}
                        </>
                    );
                })()}
            </Card>
            </Glass>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="space-y-4 mesh-border">
                    <div className="flex items-center justify-between">
                        <h2 className="font-display text-lg font-bold text-white">Muscle balance</h2>
                        <Chip>Sets · last 4 weeks</Chip>
                    </div>
                    <ul className="space-y-2.5">
                        {MUSCLE_GROUPS.map((m) => {
                            const sets = muscles[m] ?? 0;
                            return (
                                <li key={m} className="flex items-center gap-3">
                                    <span className="w-24 shrink-0 text-xs font-semibold capitalize text-ink-400">
                                        {m}
                                    </span>
                                    <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                        <div
                                            className="h-full rounded-full transition-all duration-300"
                                            style={{
                                                width: `${(sets / maxMuscle) * 100}%`,
                                                background: 'linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)',
                                            }}
                                        />
                                    </div>
                                    <span className="w-12 shrink-0 text-right text-xs font-semibold text-zinc-500">
                                        {Math.round(sets)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </Card>

                <Card className="space-y-4 mesh-border">
                    <div className="flex items-center justify-between">
                        <h2 className="font-display text-lg font-bold text-white">Recent PRs</h2>
                        <Chip>Last 12 sessions</Chip>
                    </div>
                    {prs.length ? (
                        <ul className="space-y-2.5">
                            {prs.map((pr, i) => (
                                <li key={i} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.01] p-2.5">
                                    <div className="flex-1 text-sm">
                                        <p className="font-semibold text-white">{db.exercises.byId(pr.exerciseId)?.name ?? 'Unknown'}</p>
                                        <p className="text-xs text-zinc-500">
                                            {new Date(pr.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <Trophy className="h-4 w-4 text-amber-400" />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-ink-500">
                            No PRs yet. Keep training!
                        </p>
                    )}
                </Card>

                <BodyweightCard />
            </div>

            <Card className="space-y-4 mesh-border">
                <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold text-white">Consistency</h2>
                    <Chip>Last 12 weeks</Chip>
                </div>
                {(() => {
                    const DAY = 86400000;
                    const CELL = '0.85rem';
                    const LEVELS = [
                        'rgba(255,255,255,0.05)',
                        'rgba(139,92,246,0.32)',
                        'rgba(139,92,246,0.55)',
                        'rgba(139,92,246,0.80)',
                        'rgba(139,92,246,1)',
                    ];
                    const levelOf = (c) =>
                        c <= 0 ? 0 : c === 1 ? 1 : c === 2 ? 2 : c === 3 ? 3 : 4;

                    // GitHub-style: weekday rows (Sun→Sat), week columns. Start on
                    // the Sunday on/before the 12-week window so weekdays align.
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const start = new Date(today.getTime() - 83 * DAY);
                    start.setDate(start.getDate() - start.getDay());

                    const cells = [];
                    for (let t = start.getTime(); t <= today.getTime(); t += DAY) {
                        const d = new Date(t);
                        const key = d.toISOString().slice(0, 10);
                        cells.push({ key, date: d, count: heatmap[key] ?? 0 });
                    }
                    const weeks = Math.ceil(cells.length / 7);

                    // One label per week column; print the month name when it changes.
                    let lastMonth = -1;
                    const monthLabels = Array.from({ length: weeks }, (_, w) => {
                        const first = cells[w * 7]?.date;
                        if (!first) return '';
                        const m = first.getMonth();
                        if (m !== lastMonth) {
                            lastMonth = m;
                            return first.toLocaleString('en-US', { month: 'short' });
                        }
                        return '';
                    });

                    return (
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <div
                                    className="grid shrink-0 pt-[1.15rem]"
                                    style={{ gridTemplateRows: `repeat(7, ${CELL})`, gap: '3px' }}
                                >
                                    {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((l, i) => (
                                        <span
                                            key={i}
                                            className="text-[9px] font-medium leading-[0.85rem] text-ink-500"
                                        >
                                            {l}
                                        </span>
                                    ))}
                                </div>
                                <div className="no-scrollbar overflow-x-auto">
                                    <div
                                        className="grid"
                                        style={{
                                            gridTemplateColumns: `repeat(${weeks}, ${CELL})`,
                                            gap: '3px',
                                            marginBottom: '0.25rem',
                                        }}
                                    >
                                        {monthLabels.map((m, i) => (
                                            <span
                                                key={i}
                                                className="whitespace-nowrap text-[9px] font-medium text-ink-500"
                                            >
                                                {m}
                                            </span>
                                        ))}
                                    </div>
                                    <div
                                        className="grid"
                                        style={{
                                            gridTemplateRows: `repeat(7, ${CELL})`,
                                            gridAutoFlow: 'column',
                                            gridAutoColumns: CELL,
                                            gap: '3px',
                                        }}
                                    >
                                        {cells.map((c) => (
                                            <div
                                                key={c.key}
                                                title={`${c.key}: ${c.count} workout${c.count !== 1 ? 's' : ''}`}
                                                style={{
                                                    width: CELL,
                                                    height: CELL,
                                                    borderRadius: '3px',
                                                    background: LEVELS[levelOf(c.count)],
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 text-[10px] text-ink-500">
                                <span>Less</span>
                                {LEVELS.map((bg, i) => (
                                    <span
                                        key={i}
                                        className="inline-block"
                                        style={{ width: '0.7rem', height: '0.7rem', borderRadius: '2px', background: bg }}
                                    />
                                ))}
                                <span>More</span>
                            </div>
                        </div>
                    );
                })()}
            </Card>
        </div>
    );
}
