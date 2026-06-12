import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    PlayCircle,
    Flame,
    Trophy,
    Calendar,
    BarChart3,
    ChevronRight,
    Sparkles,
    Dumbbell,
    MessageCircle,
} from 'lucide-react';
import { db } from '../data/db';
import { useWorkouts, useActiveProgram, useSettings } from '../data/DataProvider';
import { useUnit } from '../contexts/UnitContext';
import { useModal } from '../contexts/ModalContext';
import {
    dailyVolumeSeries,
    weeklyVolumeComparison,
    trainingStreak,
    prTimeline,
} from '../engine/analytics';
import { currentProgramWeek, phaseForWeek } from '../engine/generator';
import { Card, Chip, StatTile, ProgressBar } from '../components/ui/Primitives';
import { WeeklyVolumeBarChart } from '../components/charts/VolumeChart';

/**
 * Home — everything is computed from real logs. New users see honest
 * empty states with clear next actions, never fabricated numbers.
 */
function formatVolume(v) {
    if (!(v > 0)) return '—';
    if (v >= 10000) return `${Math.round(v / 1000)}k`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(Math.round(v));
}

export default function Home() {
    const workouts = useWorkouts();
    const program = useActiveProgram();
    const settings = useSettings();
    const { unit, displayWeight } = useUnit();
    const { openTrainer } = useModal();

    const firstName = (settings.name || 'Athlete').split(' ')[0];
    const greeting = useMemo(() => {
        const h = new Date().getHours();
        if (h < 5 || h >= 22) return 'Late night';
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    }, []);

    const streak = useMemo(() => trainingStreak(workouts), [workouts]);
    const weekCmp = useMemo(() => weeklyVolumeComparison(workouts), [workouts]);
    const series = useMemo(
        () =>
            dailyVolumeSeries(workouts, 7).map((d) => ({
                name: d.label,
                actual: Math.round(displayWeight(d.volume)),
                target: 0,
            })),
        [workouts, displayWeight],
    );
    const recentPRs = useMemo(() => prTimeline(workouts, 4), [workouts]);

    const week = program ? currentProgramWeek(program) : null;
    const phase = program ? phaseForWeek(week, program.durationWeeks) : null;
    const thisWeekCount = useMemo(() => {
        const weekAgo = new Date().getTime() - 7 * 24 * 3600 * 1000;
        return workouts.filter((w) => new Date(w.startedAt).getTime() >= weekAgo).length;
    }, [workouts]);

    const volumeDelta =
        weekCmp.previous > 0
            ? Math.round(((weekCmp.current - weekCmp.previous) / weekCmp.previous) * 100)
            : null;

    return (
        <div className="space-y-8 animate-fade-in">
            {db.meta.isDemo() && (
                <div className="surface flex flex-wrap items-center gap-3 border-amber-400/20 bg-amber-400/5 p-3 text-amber-200">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">Sample data</span>
                    <span className="text-xs text-amber-100/70">
                        You're browsing demo workouts. Wipe them anytime in Settings.
                    </span>
                </div>
            )}

            {/* Hero */}
            <header className="flex flex-wrap items-end justify-between gap-6">
                <div>
                    <div className="eyebrow mb-2">{greeting}</div>
                    <h1 className="font-display text-[36px] font-bold leading-tight tracking-tight text-white md:text-5xl">
                        Hey, <span className="text-gradient-ember">{firstName}</span>.
                    </h1>
                    <p className="mt-2 max-w-xl text-[15px] text-ink-400">
                        {program
                            ? `Week ${week} of ${program.durationWeeks} · ${phase.name}. ${phase.blurb}`
                            : workouts.length
                              ? 'No active program — freestyle is fine, but a plan compounds.'
                              : 'Log your first session and the engine starts working for you.'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {streak > 0 && (
                        <Card padded={false} className="flex items-center gap-3 px-4 py-3">
                            <Flame className="h-5 w-5 text-accent" strokeWidth={2.4} />
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500">
                                    Streak
                                </p>
                                <p className="font-display text-2xl font-bold tabular-nums text-white">
                                    {streak}
                                    <span className="ml-1 text-xs font-bold text-ink-500">days</span>
                                </p>
                            </div>
                        </Card>
                    )}
                    <Link to="/workout" className="btn-primary btn-lg">
                        <PlayCircle className="h-5 w-5" /> Start Workout
                    </Link>
                </div>
            </header>

            {/* Stat tiles — all real */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <StatTile
                    label="This week"
                    value={`${thisWeekCount}×`}
                    delta={{ label: 'sessions', positive: thisWeekCount > 0 }}
                    icon={Calendar}
                    accent
                />
                <StatTile
                    label="7-day volume"
                    value={formatVolume(displayWeight(weekCmp.current))}
                    delta={
                        volumeDelta === null
                            ? { label: unit, positive: false }
                            : { label: `${volumeDelta >= 0 ? '+' : ''}${volumeDelta}% vs last wk`, positive: volumeDelta >= 0 }
                    }
                    icon={BarChart3}
                />
                <StatTile
                    label="All-time"
                    value={String(workouts.length)}
                    delta={{ label: 'workouts', positive: workouts.length > 0 }}
                    icon={Dumbbell}
                />
                <StatTile
                    label="Program"
                    value={program ? `W${week}` : 'Off'}
                    delta={{ label: program ? phase.name : 'none active', positive: Boolean(program) }}
                    icon={Sparkles}
                />
            </div>

            {/* Main columns */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="space-y-6 lg:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="eyebrow mb-1">Program</div>
                            <h2 className="font-display text-xl font-bold tracking-tight text-white">
                                {program?.name || 'No active program'}
                            </h2>
                        </div>
                        <Link
                            to="/program"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
                        >
                            {program ? 'View program' : 'Create one'} <ChevronRight className="h-4 w-4" />
                        </Link>
                    </div>

                    {program && (
                        <div>
                            <div className="mb-2 flex items-center justify-between text-xs text-ink-400">
                                <span>
                                    Week {week} of {program.durationWeeks}
                                </span>
                                <Chip tone="accent">{phase.name}</Chip>
                            </div>
                            <ProgressBar value={(week / program.durationWeeks) * 100} />
                        </div>
                    )}

                    <div>
                        <div className="eyebrow mb-3">Volume · last 7 days ({unit})</div>
                        {weekCmp.current === 0 && weekCmp.previous === 0 ? (
                            <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-ink-500">
                                No sets logged yet this week — the chart fills in as you train.
                            </p>
                        ) : (
                            <div className="h-44">
                                <WeeklyVolumeBarChart data={series} height={170} />
                            </div>
                        )}
                    </div>
                </Card>

                {/* Recent PRs + coach */}
                <Card className="space-y-5">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-accent" />
                        <h2 className="font-display text-lg font-bold tracking-tight text-white">
                            Recent PRs
                        </h2>
                    </div>
                    {recentPRs.length === 0 ? (
                        <p className="text-sm text-ink-500">
                            PRs show up here once you beat a previous best — log a few sessions of the
                            same lift to set your baseline.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {recentPRs.map((event) => {
                                const exercise = db.exercises.byId(event.exerciseId);
                                const pr = event.prs[0];
                                return (
                                    <li
                                        key={`${event.workoutId}-${event.exerciseId}`}
                                        className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5"
                                    >
                                        <p className="text-sm font-semibold text-white">{exercise?.name}</p>
                                        <p className="text-xs text-ink-500">
                                            {pr.type === 'weight' && `Heaviest: ${displayWeight(pr.value)} ${unit}`}
                                            {pr.type === 'e1rm' && `Est. 1RM: ${displayWeight(pr.value)} ${unit}`}
                                            {pr.type === 'reps' && `${pr.value} reps @ ${displayWeight(pr.weight)} ${unit}`}
                                            {' · '}
                                            {new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </p>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    <button
                        type="button"
                        onClick={openTrainer}
                        className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-accent/30"
                    >
                        <span className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                                <MessageCircle className="h-4 w-4" />
                            </span>
                            <span>
                                <span className="block text-sm font-semibold text-white">Ask Coach</span>
                                <span className="block text-xs text-ink-500">
                                    Programming, form, recovery
                                </span>
                            </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-ink-500 transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                    </button>
                </Card>
            </div>
        </div>
    );
}
