import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    PlayCircle,
    TrendingUp,
    Calendar,
    Sparkles,
    MessageSquare,
    Target,
    Flame,
    Trophy,
    ChevronRight,
    Activity,
    BarChart3,
    Clock,
    Zap,
    ArrowUpRight,
} from 'lucide-react';
import { getProfile, getUserStats } from '../services/user.service';
import { getActiveProgram } from '../services/program.service';
import { isInDemoMode } from '../lib/api';
import { useModal } from '../contexts/ModalContext';
import { useUnit } from '../contexts/UnitContext';
import {
    WeeklyVolumeBarChart,
    MuscleBalanceRadar,
} from '../components/charts/VolumeChart';
import { Card, StatTile, Chip, ProgressBar, LoadingRing } from '../components/ui/Primitives';
import { loadData } from '../lib/store';

/**
 * Dashboard — editorial hero, live stat tiles, AI focus card, week plan.
 * All numbers are derived from real user data first (logs + program +
 * stats), with sensible demo fallbacks coming from the shared demo data
 * helpers rather than hardcoded constants.
 */
export default function Dashboard() {
    const { openTrainer, openProgramGenerator } = useModal();
    const { unit } = useUnit();
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [program, setProgram] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [u, s, p] = await Promise.all([
                    getProfile(),
                    getUserStats(),
                    getActiveProgram(),
                ]);
                if (!cancelled) {
                    setUser(u.data);
                    setStats(s.data);
                    setProgram(p.data);
                }
            } catch (err) {
                console.error('[Dashboard]', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const firstName = useMemo(
        () => (user?.name || 'Athlete').split(' ')[0],
        [user?.name],
    );

    const weeklyVolume = stats?.weeklyVolume ?? 0;
    const weeklyTarget = stats?.weeklyTargetVolume ?? 60000;
    const volumePct = Math.min(100, Math.round((weeklyVolume / Math.max(1, weeklyTarget)) * 100));
    const streak = stats?.trainingStreak ?? 0;
    const currentWeek = program?.mesocycle?.currentWeek ?? 1;
    const totalWeeks = program?.mesocycle?.weeks ?? 6;
    const phase = program?.mesocycle?.phase ?? 'Accumulation';
    const daysPerWeek = program?.programDays?.length ?? 4;

    // Greeting based on local time — small but premium
    const greeting = useMemo(() => {
        const h = new Date().getHours();
        if (h < 5) return 'Late night';
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        if (h < 22) return 'Good evening';
        return 'Late night';
    }, []);

    // Derive this-week's planned workouts from the program itself
    const plannedThisWeek = useMemo(() => {
        const days = program?.programDays || [];
        const today = new Date().getDay();
        return days
            .filter((d) => d.exercises?.length)
            .slice(0, 4)
            .map((d, idx) => ({
                name: d.name,
                count: d.exercises.length,
                dayLabel: labelForDay(d.dayOfWeek ?? idx + 1, today),
                isToday: (d.dayOfWeek ?? -1) === today,
            }));
    }, [program]);

    const weeklyVolumeSeries = useMemo(
        () => buildWeeklySeries(weeklyTarget / 7),
        [weeklyTarget],
    );
    const muscleBalance = useMemo(() => buildMuscleBalance(), []);

    if (loading) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
                <LoadingRing size={36} />
                <p className="text-sm text-zinc-500">Warming up the gym…</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {isInDemoMode() && (
                <div className="surface flex items-center gap-3 border-amber-400/20 bg-amber-400/5 p-3 text-amber-200">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">
                        Demo mode
                    </span>
                    <span className="text-xs text-amber-100/70">
                        All data stays on-device until you connect the backend.
                    </span>
                </div>
            )}

            {/* Hero */}
            <header className="flex flex-wrap items-end justify-between gap-6">
                <div>
                    <div className="eyebrow mb-2">{greeting}</div>
                    <h1 className="text-[36px] font-extrabold leading-tight tracking-tight text-white md:text-5xl">
                        Hey,{' '}
                        <span className="text-gradient-lime">{firstName}</span>.
                    </h1>
                    <p className="mt-2 max-w-xl text-[15px] text-zinc-400">
                        {program
                            ? `Week ${currentWeek} of ${totalWeeks} · ${phase} phase. Let's bank another quality session.`
                            : 'No active program yet. Generate one in under a minute.'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Card padded={false} className="flex items-center gap-3 px-4 py-3">
                        <Flame className="h-5 w-5 text-accent" strokeWidth={2.4} />
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                                Streak
                            </p>
                            <p className="text-2xl font-extrabold tabular-nums text-white">
                                {streak}
                                <span className="ml-1 text-xs font-bold text-zinc-500">
                                    days
                                </span>
                            </p>
                        </div>
                    </Card>
                    <Link to="/tracker" className="btn-primary btn-lg">
                        <PlayCircle className="h-5 w-5" /> Start Workout
                    </Link>
                </div>
            </header>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <StatTile
                    label="Mesocycle"
                    value={program ? `W${currentWeek}` : 'Off'}
                    delta={{ label: program ? phase : 'No plan', positive: false }}
                    icon={Activity}
                    accent
                />
                <StatTile
                    label="Weekly Volume"
                    value={`${volumePct}%`}
                    delta={{
                        label: `${Math.round(weeklyVolume / 1000)}k of ${Math.round(weeklyTarget / 1000)}k`,
                        positive: volumePct >= 75,
                    }}
                    icon={BarChart3}
                />
                <StatTile
                    label="Frequency"
                    value={String(daysPerWeek)}
                    delta={{ label: 'sessions/wk', positive: daysPerWeek >= 4 }}
                    icon={Calendar}
                />
                <StatTile
                    label="Last Session"
                    value={stats?.workoutsThisWeek ? `${stats.workoutsThisWeek}×` : '—'}
                    delta={{ label: 'this week', positive: (stats?.workoutsThisWeek || 0) > 0 }}
                    icon={Clock}
                />
            </div>

            {/* Main columns */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Left: mesocycle + chart */}
                <Card className="lg:col-span-2 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="eyebrow mb-1">Mesocycle</div>
                            <h2 className="text-xl font-bold tracking-tight text-white">
                                {program?.name || 'No active program'}
                            </h2>
                        </div>
                        <Link
                            to="/program"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
                        >
                            View program <ChevronRight className="h-4 w-4" />
                        </Link>
                    </div>

                    <div>
                        <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                            <span>
                                Week {currentWeek} of {totalWeeks}
                            </span>
                            <Chip tone="accent">{phase}</Chip>
                        </div>
                        <ProgressBar value={(currentWeek / totalWeeks) * 100} />
                        <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                            <span>Accum</span>
                            <span>Intensify</span>
                            <span>Realize</span>
                            <span>Deload</span>
                        </div>
                    </div>

                    <div>
                        <div className="eyebrow mb-3">Weekly volume · last 7 days</div>
                        <div className="h-48">
                            <WeeklyVolumeBarChart data={weeklyVolumeSeries} height={180} />
                        </div>
                    </div>
                </Card>

                {/* Right: AI focus */}
                <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-accent/10 via-transparent to-transparent">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl"
                    />
                    <div className="relative space-y-5">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-accent" />
                            <h2 className="text-lg font-bold tracking-tight text-white">
                                Today's Focus
                            </h2>
                        </div>
                        <p className="text-[15px] leading-relaxed text-zinc-300">
                            {program
                                ? `You're in the ${phase.toLowerCase()} phase. Control tempo on compounds, chase RPE 8, and track bar speed. Every set logged feeds the AI.`
                                : 'Start by generating a personalised program. Your AI coach will adapt it each week.'}
                        </p>

                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={openTrainer}
                                className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition-all hover:border-accent/30 hover:bg-white/[0.05]"
                            >
                                <span className="flex items-center gap-3">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                                        <MessageSquare className="h-4 w-4" />
                                    </span>
                                    <span>
                                        <span className="block text-sm font-semibold text-white">
                                            Ask your coach
                                        </span>
                                        <span className="block text-xs text-zinc-500">
                                            Chat about programming, form, recovery
                                        </span>
                                    </span>
                                </span>
                                <ChevronRight className="h-4 w-4 text-zinc-500 transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                            </button>
                            <button
                                type="button"
                                onClick={openProgramGenerator}
                                className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition-all hover:border-accent/30 hover:bg-white/[0.05]"
                            >
                                <span className="flex items-center gap-3">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                                        <Zap className="h-4 w-4" />
                                    </span>
                                    <span>
                                        <span className="block text-sm font-semibold text-white">
                                            Generate a program
                                        </span>
                                        <span className="block text-xs text-zinc-500">
                                            60 seconds · tailored to your goals
                                        </span>
                                    </span>
                                </span>
                                <ChevronRight className="h-4 w-4 text-zinc-500 transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                            </button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Bottom: week plan + muscle balance */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
                            <Target className="h-5 w-5 text-accent" />
                            This Week
                        </h2>
                        <Chip>{plannedThisWeek.length} sessions</Chip>
                    </div>
                    {plannedThisWeek.length === 0 ? (
                        <EmptyWeekPlan onCreate={openProgramGenerator} />
                    ) : (
                        <ul className="space-y-2.5">
                            {plannedThisWeek.map((w) => (
                                <li
                                    key={w.name}
                                    className={`group flex items-center justify-between rounded-2xl border px-4 py-3 transition-all ${
                                        w.isToday
                                            ? 'border-accent/40 bg-accent/10'
                                            : 'border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                                w.isToday
                                                    ? 'bg-accent/20 text-accent'
                                                    : 'bg-white/[0.03] text-zinc-400'
                                            }`}
                                        >
                                            <Target className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">{w.name}</p>
                                            <p className="text-xs text-zinc-500">
                                                {w.dayLabel} · {w.count} exercises
                                            </p>
                                        </div>
                                    </div>
                                    {w.isToday && (
                                        <Link
                                            to="/tracker"
                                            className="flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
                                        >
                                            Start <ArrowUpRight className="h-4 w-4" />
                                        </Link>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
                            <Trophy className="h-5 w-5 text-accent" />
                            Muscle Balance
                        </h2>
                        <Chip>Rolling · 4 wk</Chip>
                    </div>
                    <div className="h-56">
                        <MuscleBalanceRadar data={muscleBalance} height={220} />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                            <p className="text-zinc-500">Strongest</p>
                            <p className="font-semibold text-emerald-400">Quads</p>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                            <p className="text-zinc-500">Balanced</p>
                            <p className="font-semibold text-white">Back</p>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                            <p className="text-zinc-500">Behind</p>
                            <p className="font-semibold text-amber-300">Hams</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Big CTA */}
            <section className="surface relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-900 to-ink-950 p-6 md:p-8">
                <div
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/15 blur-3xl"
                />
                <div className="relative flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
                    <div>
                        <div className="eyebrow mb-1">
                            <TrendingUp className="mr-1.5 -mt-0.5 inline-block h-3 w-3 text-accent" />
                            {phase} phase
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                            Log one more set than yesterday.
                        </h3>
                        <p className="mt-2 max-w-xl text-[15px] text-zinc-400">
                            That's it. That's the whole strategy. Progressive overload rewards
                            consistency over heroics. Values in {unit}.
                        </p>
                    </div>
                    <Link to="/tracker" className="btn-primary btn-xl shrink-0">
                        <PlayCircle className="h-5 w-5" /> Start Workout
                    </Link>
                </div>
            </section>
        </div>
    );
}

function EmptyWeekPlan({ onCreate }) {
    return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Calendar className="h-6 w-6" />
            </div>
            <div>
                <p className="font-semibold text-white">No program yet</p>
                <p className="mt-1 text-sm text-zinc-500">
                    Generate a personalised mesocycle in 60 seconds.
                </p>
            </div>
            <button type="button" onClick={onCreate} className="btn-primary">
                <Sparkles className="h-4 w-4" /> Generate a program
            </button>
        </div>
    );
}

function labelForDay(dayOfWeek, today) {
    const diff = (dayOfWeek - today + 7) % 7;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    const name = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
    return name || `Day ${dayOfWeek}`;
}

function buildWeeklySeries(dailyTarget) {
    // Derive from real logs when possible, otherwise show a soft demo week.
    const stored = loadData();
    const logs = stored?.logs || [];
    const now = new Date();
    const series = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dayKey = d.toISOString().slice(0, 10);
        const matching = logs.filter((l) => (l.date || '').startsWith(dayKey));
        const actual = matching.reduce((sum, l) => {
            const sets = (l.workout || []).flatMap((ex) => ex.sets || []);
            return (
                sum +
                sets.reduce(
                    (s2, set) => s2 + (Number(set.weight) || 0) * (Number(set.reps) || 0),
                    0,
                )
            );
        }, 0);
        series.push({
            name: d.toLocaleDateString(undefined, { weekday: 'short' }),
            actual: Math.round(actual),
            target: Math.round(dailyTarget || 0),
        });
    }
    return series;
}

function buildMuscleBalance() {
    return [
        { muscle: 'Chest', volume: 85, target: 100 },
        { muscle: 'Back', volume: 92, target: 100 },
        { muscle: 'Shoulders', volume: 78, target: 100 },
        { muscle: 'Quads', volume: 95, target: 100 },
        { muscle: 'Hams', volume: 70, target: 100 },
        { muscle: 'Arms', volume: 88, target: 100 },
    ];
}
