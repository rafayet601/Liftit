import React, { useMemo, useState } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from 'recharts';
import {
    TrendingUp,
    Trophy,
    BarChart3,
    Target,
    Sparkles,
    ChevronRight,
    Flame,
    Clock,
} from 'lucide-react';
import { useUnit } from '../contexts/UnitContext';
import { useModal } from '../contexts/ModalContext';
import { loadData } from '../lib/store';
import {
    Card,
    PageHeader,
    StatTile,
    Chip,
    EmptyState,
} from '../components/ui/Primitives';
import clsx from 'clsx';

/**
 * Analytics — blends real logs (when present) with evocative demo data so the
 * page always looks alive. Chart axes respect unit preference. PR and volume
 * tables are derived from the logs when they exist.
 */
export default function Analytics() {
    const { unit, convertWeight } = useUnit();
    const { openTrainer } = useModal();
    const [selected, setSelected] = useState('bench');

    const { has, strengthTrend, weeklyVolume, prs, stats } = useAnalytics();

    const lifts = useMemo(
        () => [
            { id: 'bench', name: 'Bench', key: 'bench', color: '#bef264' },
            { id: 'squat', name: 'Squat', key: 'squat', color: '#60a5fa' },
            { id: 'deadlift', name: 'Deadlift', key: 'deadlift', color: '#f472b6' },
            { id: 'ohp', name: 'OHP', key: 'ohp', color: '#fbbf24' },
        ],
        [],
    );
    const current = lifts.find((l) => l.id === selected) || lifts[0];

    const chartData = useMemo(
        () =>
            strengthTrend.map((d) => ({
                ...d,
                bench: convertWeight(d.bench),
                squat: convertWeight(d.squat),
                deadlift: convertWeight(d.deadlift),
                ohp: convertWeight(d.ohp),
            })),
        [strengthTrend, convertWeight],
    );

    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                eyebrow="Progress"
                title="Analytics"
                description="Strength curves, volume rhythm, and the milestones that earned them."
                icon={TrendingUp}
                actions={
                    <button
                        type="button"
                        onClick={openTrainer}
                        className="btn-outline"
                    >
                        <Sparkles className="h-4 w-4" /> Ask the coach
                    </button>
                }
            />

            {!has && (
                <Card className="border-amber-400/20 bg-amber-400/5">
                    <p className="text-sm text-amber-200">
                        You haven't logged workouts yet — charts use sample data. Log a session
                        in the Tracker to see your real trends here.
                    </p>
                </Card>
            )}

            {/* Overview */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <StatTile
                    label="Total PRs"
                    value={String(stats.prCount)}
                    delta={{ label: '+3 this meso', positive: true }}
                    icon={Trophy}
                    accent
                />
                <StatTile
                    label="Volume (4 wk)"
                    value={`${Math.round(stats.totalVolumeKg / 1000)}K`}
                    delta={{ label: `${unit}`, positive: true }}
                    icon={BarChart3}
                />
                <StatTile
                    label="Sessions"
                    value={String(stats.sessionCount)}
                    delta={{ label: 'last 28 days', positive: stats.sessionCount > 0 }}
                    icon={Flame}
                />
                <StatTile
                    label="Avg RPE"
                    value={stats.avgRpe ? stats.avgRpe.toFixed(1) : '—'}
                    delta={{ label: 'sustainable', positive: true }}
                    icon={Target}
                />
            </div>

            {/* Strength trend */}
            <Card>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="eyebrow mb-1">Strength · Estimated 1RM</div>
                        <h2 className="text-xl font-bold tracking-tight text-white">
                            {current.name} trajectory
                        </h2>
                    </div>
                    <div className="no-scrollbar flex gap-2 overflow-x-auto">
                        {lifts.map((l) => (
                            <button
                                type="button"
                                key={l.id}
                                onClick={() => setSelected(l.id)}
                                className={clsx(
                                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                                    selected === l.id
                                        ? 'border-accent/40 bg-accent/10 text-accent'
                                        : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-white',
                                )}
                            >
                                {l.name}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="strengthGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={current.color} stopOpacity={0.5} />
                                    <stop offset="95%" stopColor={current.color} stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="name"
                                stroke="#71717a"
                                tickLine={false}
                                axisLine={false}
                                style={{ fontSize: 11 }}
                            />
                            <YAxis
                                stroke="#71717a"
                                tickLine={false}
                                axisLine={false}
                                style={{ fontSize: 11 }}
                                tickFormatter={(v) => `${v}`}
                            />
                            <Tooltip content={<ChartTooltip unit={unit} />} />
                            <Area
                                type="monotone"
                                dataKey={current.key}
                                stroke={current.color}
                                strokeWidth={2.5}
                                fill="url(#strengthGrad)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Weekly volume */}
            <Card>
                <div className="mb-5 flex items-center justify-between">
                    <div>
                        <div className="eyebrow mb-1">This week</div>
                        <h2 className="text-xl font-bold tracking-tight text-white">
                            Volume rhythm
                        </h2>
                    </div>
                    <Chip tone="accent">
                        {unit}
                    </Chip>
                </div>
                <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyVolume}>
                            <defs>
                                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#bef264" stopOpacity={0.9} />
                                    <stop offset="100%" stopColor="#84cc16" stopOpacity={0.5} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="name"
                                stroke="#71717a"
                                tickLine={false}
                                axisLine={false}
                                style={{ fontSize: 11 }}
                            />
                            <YAxis
                                stroke="#71717a"
                                tickLine={false}
                                axisLine={false}
                                style={{ fontSize: 11 }}
                                tickFormatter={(v) => (v > 1000 ? `${Math.round(v / 1000)}k` : v)}
                            />
                            <Tooltip content={<ChartTooltip unit={unit} />} />
                            <Bar dataKey="volume" fill="url(#volGrad)" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* PR table */}
            <Card>
                <div className="mb-5 flex items-center justify-between">
                    <div>
                        <div className="eyebrow mb-1">Milestones</div>
                        <h2 className="text-xl font-bold tracking-tight text-white">
                            Personal records
                        </h2>
                    </div>
                    <Chip>last 90 days</Chip>
                </div>
                {prs.length === 0 ? (
                    <EmptyState
                        icon={Trophy}
                        title="No PRs yet"
                        description="Log a set heavier than before and it'll land here."
                    />
                ) : (
                    <div className="divide-y divide-white/5">
                        {prs.map((pr) => (
                            <div
                                key={pr.exercise}
                                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                                        <Trophy className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white">{pr.exercise}</p>
                                        <p className="text-xs text-zinc-500">{pr.date}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold tabular-nums text-white">
                                        {Math.round(convertWeight(pr.weight))}
                                        <span className="ml-1 text-sm font-semibold text-zinc-500">
                                            {unit}
                                        </span>
                                        <span className="ml-2 text-sm font-semibold text-zinc-500">
                                            × {pr.reps}
                                        </span>
                                    </p>
                                    <p className="text-xs font-semibold text-emerald-400">
                                        RPE {pr.rpe}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <button
                type="button"
                onClick={openTrainer}
                className="group flex w-full items-center justify-between rounded-2xl border border-accent/20 bg-accent/5 p-5 text-left transition-all hover:border-accent/40 hover:bg-accent/10"
            >
                <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="font-bold tracking-tight text-white">
                            Ask your coach about these numbers
                        </p>
                        <p className="text-sm text-zinc-400">
                            Get context on plateaus, next cycle deloads, or form cues.
                        </p>
                    </div>
                </div>
                <ChevronRight className="h-5 w-5 text-zinc-500 transition-transform group-hover:translate-x-1 group-hover:text-accent" />
            </button>
        </div>
    );
}

function ChartTooltip({ active, payload, label, unit }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass-morphism rounded-xl border border-white/10 px-3 py-2 text-xs">
            <p className="mb-1 font-bold uppercase tracking-widest text-zinc-500">{label}</p>
            {payload.map((item) => (
                <p key={item.dataKey} className="flex items-center gap-2">
                    <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: item.color }}
                    />
                    <span className="font-semibold text-white">
                        {Math.round(item.value).toLocaleString()}{' '}
                        <span className="text-zinc-500">{unit || ''}</span>
                    </span>
                </p>
            ))}
        </div>
    );
}

function useAnalytics() {
    return useMemo(() => {
        const stored = loadData();
        const logs = stored?.logs || [];
        const has = logs.length > 0;

        const demoTrend = [
            { name: 'Wk 1', bench: 100, squat: 140, deadlift: 160, ohp: 60 },
            { name: 'Wk 2', bench: 102.5, squat: 145, deadlift: 165, ohp: 62.5 },
            { name: 'Wk 3', bench: 105, squat: 150, deadlift: 170, ohp: 65 },
            { name: 'Wk 4', bench: 105, squat: 152.5, deadlift: 170, ohp: 65 },
            { name: 'Wk 5', bench: 107.5, squat: 155, deadlift: 175, ohp: 67.5 },
            { name: 'Wk 6', bench: 110, squat: 160, deadlift: 180, ohp: 70 },
        ];
        const demoPRs = [
            { exercise: 'Bench Press', weight: 110, reps: 5, date: 'Jan 15', rpe: 9 },
            { exercise: 'Squat', weight: 160, reps: 5, date: 'Jan 18', rpe: 9 },
            { exercise: 'Deadlift', weight: 180, reps: 3, date: 'Jan 20', rpe: 9 },
            { exercise: 'Overhead Press', weight: 70, reps: 5, date: 'Jan 12', rpe: 8 },
        ];

        // Dynamic Strength Trend from Logs
        const strengthTrend = (() => {
            if (!has) return demoTrend;
            const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
            if (!sortedLogs.length) return demoTrend;

            const getEpley1RM = (sets) => {
                let max1RM = 0;
                for (const s of sets || []) {
                    const w = Number(s.weight) || 0;
                    const r = Number(s.reps) || 0;
                    if (w > 0 && r > 0) {
                        const est = w * (1 + r / 30);
                        if (est > max1RM) max1RM = est;
                    }
                }
                return max1RM;
            };

            const getMaxForLift = (log, keywords) => {
                const exercises = log.workout?.filter(ex => 
                    keywords.some(kw => ex.name?.toLowerCase().includes(kw))
                ) || [];
                const allSets = exercises.flatMap(ex => ex.sets || []);
                return getEpley1RM(allSets);
            };

            const liftKeywords = {
                bench: ['bench press', 'bench'],
                squat: ['squat'],
                deadlift: ['deadlift', 'dead lift'],
                ohp: ['overhead press', 'ohp', 'shoulder press']
            };

            const weeksMap = new Map();
            for (const log of sortedLogs) {
                const dateObj = new Date(log.date);
                const day = dateObj.getDay();
                const sunday = new Date(dateObj);
                sunday.setDate(dateObj.getDate() - day);
                const weekKey = sunday.toISOString().slice(5, 10); // MM-DD
                if (!weeksMap.has(weekKey)) {
                    weeksMap.set(weekKey, []);
                }
                weeksMap.get(weekKey).push(log);
            }

            const trend = [];
            let lastVals = { bench: 0, squat: 0, deadlift: 0, ohp: 0 };
            
            for (const [weekKey, weekLogs] of weeksMap.entries()) {
                const weekVals = { ...lastVals };
                for (const lift of ['bench', 'squat', 'deadlift', 'ohp']) {
                    let maxThisWeek = 0;
                    for (const log of weekLogs) {
                        const logMax = getMaxForLift(log, liftKeywords[lift]);
                        if (logMax > maxThisWeek) maxThisWeek = logMax;
                    }
                    if (maxThisWeek > 0) {
                        weekVals[lift] = Math.round(maxThisWeek * 10) / 10;
                    }
                }
                lastVals = { ...weekVals };
                trend.push({
                    name: `Wk of ${weekKey}`,
                    bench: weekVals.bench || 0,
                    squat: weekVals.squat || 0,
                    deadlift: weekVals.deadlift || 0,
                    ohp: weekVals.ohp || 0
                });
            }
            return trend.length > 0 ? trend : demoTrend;
        })();

        // Weekly volume from logs
        const weekly = (() => {
            const out = [];
            const now = new Date();
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                const key = d.toISOString().slice(0, 10);
                const matching = logs.filter((l) => (l.date || '').startsWith(key));
                const volume = matching.reduce((sum, l) => {
                    const sets = (l.workout || []).flatMap((ex) => ex.sets || []);
                    return (
                        sum +
                        sets.reduce(
                            (s, set) =>
                                s + (Number(set.weight) || 0) * (Number(set.reps) || 0),
                            0,
                        )
                    );
                }, 0);
                out.push({
                    name: d.toLocaleDateString(undefined, { weekday: 'short' }),
                    volume: Math.round(volume),
                });
            }
            return out;
        })();

        // Stats
        const allSets = logs.flatMap((l) => (l.workout || []).flatMap((e) => e.sets || []));
        const totalVolumeKg = allSets.reduce(
            (s, set) => s + (Number(set.weight) || 0) * (Number(set.reps) || 0),
            0,
        );
        const rpes = allSets.filter((s) => s.rpe);
        const avgRpe = rpes.length
            ? rpes.reduce((a, s) => a + s.rpe, 0) / rpes.length
            : null;

        // PRs from logs: heaviest weight per exercise
        const prMap = new Map();
        for (const log of logs) {
            for (const ex of log.workout || []) {
                for (const s of ex.sets || []) {
                    const w = Number(s.weight) || 0;
                    if (!w || !s.reps) continue;
                    const prev = prMap.get(ex.name);
                    if (!prev || w > prev.weight) {
                        prMap.set(ex.name, {
                            exercise: ex.name,
                            weight: w,
                            reps: s.reps,
                            rpe: s.rpe || 8,
                            date: new Date(log.date).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                            }),
                        });
                    }
                }
            }
        }
        const prsFromLogs = [...prMap.values()].slice(0, 8);

        return {
            has,
            strengthTrend: strengthTrend,
            weeklyVolume: has
                ? weekly
                : [
                      { name: 'Mon', volume: 12500 },
                      { name: 'Tue', volume: 11200 },
                      { name: 'Wed', volume: 0 },
                      { name: 'Thu', volume: 15800 },
                      { name: 'Fri', volume: 8900 },
                      { name: 'Sat', volume: 0 },
                      { name: 'Sun', volume: 0 },
                  ],
            prs: has ? prsFromLogs : demoPRs,
            stats: {
                prCount: has ? prsFromLogs.length : 12,
                totalVolumeKg: has ? totalVolumeKg : 48400,
                sessionCount: has ? logs.length : 14,
                avgRpe,
            },
        };
    }, []);
}
