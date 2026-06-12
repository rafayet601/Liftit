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
import { TrendingUp, Trophy, Dumbbell, Flame } from 'lucide-react';
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
} from '../engine/analytics';
import { MUSCLE_GROUPS } from '../data/exercises';
import { Card, Chip, EmptyState, PageHeader } from '../components/ui/Primitives';

/**
 * Progress — e1RM trend for any logged exercise, muscle-group balance,
 * PR timeline, and a frequency heatmap. 100% derived from real logs.
 */
export default function Progress() {
    const workouts = useWorkouts();
    const { unit, displayWeight } = useUnit();

    const trackedExercises = useMemo(
        () =>
            recentExerciseIds(workouts, 30)
                .map((id) => db.exercises.byId(id))
                .filter(Boolean),
        [workouts],
    );
    const [selectedId, setSelectedId] = useState(null);
    const activeId = selectedId ?? trackedExercises[0]?.id ?? null;

    const trend = useMemo(
        () =>
            activeId
                ? e1rmTrend(workouts, activeId, 30).map((p) => ({
                      ...p,
                      e1rmDisplay: displayWeight(p.e1rm),
                      label: new Date(p.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                      }),
                  }))
                : [],
        [workouts, activeId, displayWeight],
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

            {/* e1RM trend */}
            <Card className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-display text-lg font-bold text-white">
                        Estimated 1RM
                    </h2>
                    <Chip>Epley + Brzycki blend</Chip>
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
                                    ? 'border-accent/50 bg-accent/15 text-accent'
                                    : 'border-white/10 bg-white/[0.03] text-ink-400 hover:text-white',
                            )}
                        >
                            {e.name}
                        </button>
                    ))}
                </div>
                {trend.length < 2 ? (
                    <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-ink-500">
                        Log this lift in at least two sessions to draw a trend line.
                    </p>
                ) : (
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                <defs>
                                    <linearGradient id="emberFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ff6b3a" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#ff6b3a" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fill: '#7c7a75', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fill: '#7c7a75', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={['auto', 'auto']}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: '#1b1b1f',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 12,
                                        color: '#f7f6f4',
                                    }}
                                    formatter={(v) => [`${v} ${unit}`, 'e1RM']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="e1rmDisplay"
                                    stroke="#ff6b3a"
                                    strokeWidth={2.5}
                                    fill="url(#emberFill)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Muscle balance — weekly sets per group */}
                <Card className="space-y-4">
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
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                                        <div
                                            className={clsx(
                                                'h-full rounded-full',
                                                sets > 0 ? 'bg-gradient-ember' : '',
                                            )}
                                            style={{ width: `${(sets / maxMuscle) * 100}%` }}
                                        />
                                    </div>
                                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-ink-500">
                                        {Math.round(sets)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </Card>

                {/* PR timeline */}
                <Card className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                            <Trophy className="h-5 w-5 text-amber-300" /> PR timeline
                        </h2>
                    </div>
                    {prs.length === 0 ? (
                        <p className="text-sm text-ink-500">
                            Beat any previous best and it lands here automatically.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {prs.map((event) => {
                                const exercise = db.exercises.byId(event.exerciseId);
                                return (
                                    <li
                                        key={`${event.workoutId}-${event.exerciseId}`}
                                        className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-white">
                                                {exercise?.name}
                                            </p>
                                            <p className="text-xs text-ink-500">
                                                {event.prs
                                                    .map((pr) =>
                                                        pr.type === 'weight'
                                                            ? `${displayWeight(pr.value)} ${unit} top set`
                                                            : pr.type === 'e1rm'
                                                              ? `e1RM ${displayWeight(pr.value)} ${unit}`
                                                              : `${pr.value} reps @ ${displayWeight(pr.weight)} ${unit}`,
                                                    )
                                                    .join(' · ')}
                                            </p>
                                        </div>
                                        <span className="shrink-0 text-xs text-ink-500">
                                            {new Date(event.date).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>
            </div>

            {/* Frequency heatmap */}
            <Card className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                        <Flame className="h-5 w-5 text-accent" /> Consistency
                    </h2>
                    <Chip>Last 12 weeks</Chip>
                </div>
                <Heatmap data={heatmap} weeks={12} />
            </Card>
        </div>
    );
}

function Heatmap({ data, weeks }) {
    const days = weeks * 7;
    const today = new Date();
    const cells = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
        const key = d.toISOString().slice(0, 10);
        cells.push({ key, count: data[key] ?? 0 });
    }
    return (
        <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-1">
            {cells.map((c) => (
                <div
                    key={c.key}
                    title={`${c.key}: ${c.count} workout${c.count === 1 ? '' : 's'}`}
                    className={clsx(
                        'h-3.5 w-3.5 rounded-[4px]',
                        c.count === 0 && 'bg-white/[0.04]',
                        c.count === 1 && 'bg-accent/45',
                        c.count >= 2 && 'bg-accent',
                    )}
                />
            ))}
        </div>
    );
}
