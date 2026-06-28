import React, { Suspense, useMemo } from 'react';
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
    TrendingUp,
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
const LazyWeeklyVolumeBarChart = React.lazy(() =>
    import('../components/charts/VolumeChart').then(m => ({ default: m.WeeklyVolumeBarChart }))
);
import WaveDistortion from '../components/ui/WaveDistortion';
import LinearGradient from '../components/ui/LinearGradient';
import Glass from '../components/ui/Glass';

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

/** Animated progress ring for weekly volume target */
const ProgressRing = React.memo(function ProgressRing({ value = 0, max = 100, size = 72, strokeWidth = 5 }) {
    const r = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * r;
    const pct = Math.min(1, value / (max || 1));
    const offset = circumference * (1 - pct);

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            aria-label={`${Math.round(pct * 100)}% of weekly volume goal`}
        >
            <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
            </defs>
            {/* Track */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={strokeWidth}
            />
            {/* Fill */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="url(#ringGrad)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
            />
            {/* Center text */}
            <text
                x={size / 2}
                y={size / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="700"
                fill="#f7f6f4"
                fontFamily="Space Grotesk"
            >
                {Math.round(pct * 100)}%
            </text>
        </svg>
    );
})

/** Phase name → badge color map */
function getPhaseBadgeClass(phaseName = '') {
    const n = phaseName.toLowerCase();
    if (n.includes('accumul')) return 'phase-badge phase-badge-accumulation';
    if (n.includes('intensif')) return 'phase-badge phase-badge-intensification';
    if (n.includes('peak')) return 'phase-badge phase-badge-peaking';
    if (n.includes('deload')) return 'phase-badge phase-badge-deload';
    return 'chip chip-accent';
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

    // Weekly volume ring — compare to previous week or a default target
    const weeklyTarget = weekCmp.previous > 0 ? weekCmp.previous * 1.05 : weekCmp.current || 1;

    return (
        <div className="space-y-8 animate-fade-in">
            {db.meta.isDemo() && (
                <div className="glass-card-glow-steel flex flex-wrap items-center gap-3 border-amber-400/30 bg-amber-400/10 p-3 text-amber-200 rounded-2xl">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">Sample data</span>
                    <span className="text-xs text-amber-100/70">
                        You're browsing demo workouts. Wipe them anytime in Settings.
                    </span>
                </div>
            )}

            {/* ── Hero Section ── */}
            <header className="relative overflow-hidden rounded-3xl">
                <WaveDistortion
                    preset="aurora"
                    amplitude={0.1}
                    frequency={2.5}
                    speed={0.5}
                    opacity={0.7}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 0,
                        borderRadius: '24px',
                    }}
                />

                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-8 -left-4 h-48 w-64 rounded-full opacity-20"
                    style={{
                        background: 'radial-gradient(ellipse, rgba(139,92,246,0.5) 0%, transparent 70%)',
                        filter: 'blur(32px)',
                    }}
                />

                <div className="relative z-10 flex flex-wrap items-end justify-between gap-6 p-6 md:p-8">
                    <div>
                        <div className="eyebrow mb-2 flex items-center gap-2">
                            <span
                                className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
                                style={{ boxShadow: '0 0 6px rgba(139,92,246,0.8)' }}
                            />
                            {greeting}
                        </div>
                        <h1 className="font-display text-[38px] font-bold leading-[1.1] tracking-tight md:text-5xl text-aurora">
                            Hey,{' '}
                            <span
                                className="text-gradient-purple"
                                style={{ textShadow: 'none' }}
                            >
                                {firstName}
                            </span>
                            <span className="text-accent">.</span>
                        </h1>
                        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-400">
                            {program
                                ? `Week ${week} of ${program.durationWeeks} · ${phase.name}. ${phase.blurb}`
                                : workouts.length
                                  ? 'No active program — freestyle is fine, but a plan compounds.'
                                  : 'Log your first session and the engine starts working for you.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {streak > 0 && (
                            <Glass
                                tint="purple"
                                glow
                                hover
                                padded={false}
                                className="flex items-center gap-3 px-4 py-3 animate-pulse-glow"
                                style={{ animationPlayState: 'running' }}
                            >
                                <span
                                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                                    style={{ background: 'rgba(139,92,246,0.15)' }}
                                >
                                    <Flame className="h-4 w-4 text-accent" strokeWidth={2.5} />
                                </span>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500">
                                        Streak
                                    </p>
                                    <p className="font-display text-2xl font-bold tabular-nums text-white leading-tight">
                                        {streak}
                                        <span className="ml-1 text-xs font-bold text-ink-500">days</span>
                                    </p>
                                </div>
                            </Glass>
                        )}
                        <Link
                            to="/workout"
                            className="btn-cta gap-2.5"
                            id="home-start-workout-btn"
                        >
                            <PlayCircle className="h-5 w-5" strokeWidth={2.2} />
                            Start Workout
                        </Link>
                    </div>
                </div>

                <LinearGradient
                    preset="purpleToSteel"
                    animated
                    glow
                    variant="strip"
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        borderRadius: 0,
                    }}
                />
            </header>

            {/* ── Stat Tiles ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <Glass tint="purple" hover gradientBorder gradientPreset="purple" className="holo-card">
                    <StatTile
                        label="This week"
                        value={`${thisWeekCount}×`}
                        delta={{ label: 'sessions', positive: thisWeekCount > 0 }}
                        icon={Calendar}
                        accent
                    />
                </Glass>
                <Glass tint="neutral" hover gradientBorder gradientPreset="purpleToSteel" className="holo-card">
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
                </Glass>
                <Glass tint="neutral" hover gradientBorder gradientPreset="steel" className="holo-card">
                    <StatTile
                        label="All-time"
                        value={String(workouts.length)}
                        delta={{ label: 'workouts', positive: workouts.length > 0 }}
                        icon={Dumbbell}
                    />
                </Glass>
                <Glass tint="neutral" hover gradientBorder gradientPreset="aurora" className="holo-card">
                    <StatTile
                        label="Program"
                        value={program ? `W${week}` : 'Off'}
                        delta={{ label: program ? phase.name : 'none active', positive: Boolean(program) }}
                        icon={Sparkles}
                    />
                </Glass>
            </div>

            <div className="gradient-divider" />

            {/* ── Main Content Grid ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Left: Program overview + Volume chart */}
                <Glass
                    tint="steel"
                    glow
                    hover
                    wave
                    wavePreset="steel"
                    gradientBorder
                    gradientPreset="purpleToSteel"
                    className="lg:col-span-2"
                >
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
                        <div className="mt-5">
                            <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-ink-400">
                                        Week {week} of {program.durationWeeks}
                                    </span>
                                    <span className={getPhaseBadgeClass(phase?.name)}>
                                        {phase?.name}
                                    </span>
                                </div>
                                <ProgressRing
                                    value={weekCmp.current}
                                    max={weeklyTarget}
                                    size={56}
                                    strokeWidth={4}
                                />
                            </div>
                            <ProgressBar value={(week / program.durationWeeks) * 100} />
                        </div>
                    )}

                    <div className="mt-6">
                        <div className="eyebrow mb-3">Volume · last 7 days ({unit})</div>
                        {weekCmp.current === 0 && weekCmp.previous === 0 ? (
                            <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-ink-500">
                                No sets logged yet this week — the chart fills in as you train.
                            </p>
                        ) : (
                            <div className="h-44">
                                <Suspense fallback={<div className="h-44 rounded-2xl bg-white/[0.03] animate-pulse" />}>
                                <LazyWeeklyVolumeBarChart data={series} height={170} />
                            </Suspense>
                            </div>
                        )}
                    </div>
                </Glass>

                {/* Right: Recent PRs + Coach */}
                <Glass tint="gold" glow hover className="glass-prismatic">
                    <div className="flex items-center gap-2 mb-5">
                        <span
                            className="flex h-7 w-7 items-center justify-center rounded-lg"
                            style={{ background: 'rgba(251,191,36,0.12)' }}
                        >
                            <Trophy className="h-4 w-4 text-amber-300" />
                        </span>
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
                            {recentPRs.map((event, idx) => {
                                const exercise = db.exercises.byId(event.exerciseId);
                                const pr = event.prs[0];
                                return (
                                    <li
                                        key={`${event.workoutId}-${event.exerciseId}`}
                                        className="pr-timeline-item"
                                        style={{ animationDelay: `${idx * 60}ms` }}
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">
                                                {exercise?.name}
                                            </p>
                                            <p className="text-xs text-ink-500 mt-0.5">
                                                {pr.type === 'weight' && `Heaviest: ${displayWeight(pr.value)} ${unit}`}
                                                {pr.type === 'e1rm' && `Est. 1RM: ${displayWeight(pr.value)} ${unit}`}
                                                {pr.type === 'reps' && `${pr.value} reps @ ${displayWeight(pr.weight)} ${unit}`}
                                                {' · '}
                                                {new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                        <span className="pr-badge flex-shrink-0">
                                            <Trophy className="h-3 w-3" />
                                            PR
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    <LinearGradient preset="gold" variant="strip" className="my-5" style={{ opacity: 0.4 }} />

                    <button
                        type="button"
                        onClick={openTrainer}
                        className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition-all hover:border-accent/30 hover:bg-accent/[0.03]"
                        id="home-ask-coach-btn"
                    >
                        <span className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent transition-transform group-hover:scale-110">
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
                </Glass>
            </div>
        </div>
    );
}
