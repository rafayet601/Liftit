import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Plus,
    Zap,
    Target,
    CheckCircle2,
    Sparkles,
    ChevronDown,
    Dumbbell,
    Coffee,
    Flame,
    Check,
} from 'lucide-react';
import clsx from 'clsx';
import { loadData, saveData } from '../lib/store';
import { useUnit } from '../contexts/UnitContext';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { createWorkout } from '../services/workout.service';
import { getActiveProgram } from '../services/program.service';
import { useAuth } from '../contexts/AuthContext';
import WorkoutTimer from '../components/tracker/WorkoutTimer';
import SetLogger from '../components/tracker/SetLogger';
import { CircularProgress } from '../components/charts/VolumeChart';
import ProgressionCard from '../components/ai/ProgressionCard';
import { useToast } from '../components/ui/Toast';
import {
    Card,
    PageHeader,
    EmptyState,
    Chip,
    ProgressBar,
    LoadingRing,
} from '../components/ui/Primitives';
import { hapticSuccess, hapticMedium } from '../lib/platform';

import { sampleWorkout } from '../services/demoData';

export default function Tracker() {
    const [workout, setWorkout] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exercises, setExercises] = useState([]);
    const [timer, setTimer] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [expanded, setExpanded] = useState({});
    const [showProgression, setShowProgression] = useState(true);

    const { unit, displayWeight, toKg, convertWeight } = useUnit();
    const { isOnline } = useOfflineSync();
    const { isAuthenticated } = useAuth();
    const isAuthValue =
        typeof isAuthenticated === 'function' ? isAuthenticated() : Boolean(isAuthenticated);
    const { showToast } = useToast();

    /* ---------- Load program ---------- */
    const normalizeReps = useCallback((target) => {
        if (typeof target === 'number' && Number.isFinite(target)) return target;
        if (typeof target !== 'string') return 10;
        const matches = target.match(/\d+(?:\.\d+)?/g);
        return matches?.length ? Number(matches[matches.length - 1]) : 10;
    }, []);
    const normalizeWeight = useCallback((w) => {
        const n = Number(w);
        return Number.isFinite(n) ? n : 0;
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getActiveProgram();
                if (cancelled) return;
                if (res.data && res.data.programDays?.length) {
                    const today = new Date().getDay();
                    const idx = today === 0 ? 6 : today - 1;
                    const day = res.data.programDays[idx] || res.data.programDays[0];

                    if (day.name?.toLowerCase().includes('rest')) {
                        setWorkout({
                            name: 'Rest Day',
                            mesocycle: res.data.name || 'Program',
                            week: res.data.mesocycle?.currentWeek || 1,
                            phase: 'Recovery',
                            isRestDay: true,
                            exercises: [],
                        });
                    } else {
                        const logs = loadData().logs || [];
                        const findPreviousSession = (exerciseName) => {
                            const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
                            for (const log of sortedLogs) {
                                const foundEx = log.workout?.find(e => e.name?.toLowerCase() === exerciseName?.toLowerCase());
                                if (foundEx && foundEx.sets?.length > 0) {
                                    return foundEx.sets[0];
                                }
                            }
                            return null;
                        };

                        setWorkout({
                            name: day.name,
                            mesocycle: res.data.name,
                            week: res.data.mesocycle?.currentWeek || 1,
                            phase: res.data.mesocycle?.phase || 'Accumulation',
                            exercises:
                                day.exercises?.map((ex, i) => ({
                                    id: ex.id || `ex-${i}`,
                                    name: ex.exercise?.name || 'Exercise',
                                    target: {
                                        sets: ex.targetSets || 3,
                                        reps: normalizeReps(ex.targetReps),
                                        weight: normalizeWeight(ex.targetWeight),
                                    },
                                    previousSession: findPreviousSession(ex.exercise?.name),
                                    muscles: [ex.exercise?.muscle].filter(Boolean),
                                })) || [],
                        });
                    }
                } else {
                    setWorkout(sampleWorkout);
                }
            } catch (err) {
                console.error('[Tracker]', err);
                if (!cancelled) setWorkout(sampleWorkout);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ---------- Initialize sets ---------- */
    useEffect(() => {
        if (!workout?.exercises) return;
        const init = workout.exercises.map((ex) => ({
            ...ex,
            sets: Array(ex.target.sets)
                .fill(null)
                .map(() => ({
                    weight: ex.target.weight || 0,
                    reps: 0,
                    rpe: 0,
                    completed: false,
                })),
        }));
        setExercises(init);
        const open = {};
        // Default: first exercise expanded, rest collapsed for focus
        init.forEach((ex, i) => {
            open[ex.id] = i === 0;
        });
        setExpanded(open);
    }, [workout?.exercises]);

    /* ---------- Derived stats ---------- */
    const totalVolume = useMemo(() => {
        return exercises.reduce(
            (sum, ex) =>
                sum +
                ex.sets.reduce(
                    (s, set) =>
                        set.completed && set.reps > 0 ? s + set.weight * set.reps : s,
                    0,
                ),
            0,
        );
    }, [exercises]);

    const targetVolume = useMemo(
        () =>
            (workout?.exercises || []).reduce(
                (acc, ex) => acc + ex.target.sets * ex.target.reps * (ex.target.weight || 0),
                0,
            ) || 0,
        [workout],
    );

    const completedSets = exercises.reduce(
        (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
        0,
    );
    const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    const avgRpe = useMemo(() => {
        const all = exercises.flatMap((ex) =>
            ex.sets.filter((s) => s.completed && s.rpe > 0),
        );
        if (!all.length) return null;
        return (all.reduce((a, s) => a + s.rpe, 0) / all.length).toFixed(1);
    }, [exercises]);

    /* ---------- Mutations ---------- */
    const updateSet = useCallback((exerciseId, setIndex, field, value) => {
        setExercises((prev) =>
            prev.map((ex) => {
                if (ex.id !== exerciseId) return ex;
                const newSets = [...ex.sets];
                const next = { ...newSets[setIndex] };
                if (field === 'weight') {
                    // SetLogger already passes KG via toKg() — just store it.
                    next.weight = Number(value) || 0;
                } else if (field === 'reps' || field === 'rpe') {
                    next.reps = field === 'reps' ? Math.max(0, Number(value) || 0) : next.reps;
                    next.rpe = field === 'rpe' ? Number(value) || 0 : next.rpe;
                }
                newSets[setIndex] = next;
                return { ...ex, sets: newSets };
            }),
        );
    }, []);

    const completeSet = useCallback((exerciseId, setIndex) => {
        setExercises((prev) =>
            prev.map((ex) => {
                if (ex.id !== exerciseId) return ex;
                const newSets = [...ex.sets];
                newSets[setIndex] = { ...newSets[setIndex], completed: true };
                return { ...ex, sets: newSets };
            }),
        );
    }, []);

    const addSet = (exerciseId) => {
        setExercises((prev) =>
            prev.map((ex) => {
                if (ex.id !== exerciseId) return ex;
                const last = ex.sets[ex.sets.length - 1];
                return {
                    ...ex,
                    sets: [
                        ...ex.sets,
                        {
                            weight: last?.weight || ex.target.weight,
                            reps: 0,
                            rpe: 0,
                            completed: false,
                        },
                    ],
                };
            }),
        );
    };

    const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

    const handleFinish = async () => {
        hapticMedium();
        const data = loadData();
        const newLog = {
            id: `log-${Date.now()}`,
            date: new Date().toISOString(),
            name: workout?.name || 'Session',
            duration: timer,
            workout: exercises.map((ex) => ({
                name: ex.name,
                sets: ex.sets
                    .filter((s) => s.completed)
                    .map((s) => ({ weight: s.weight, reps: s.reps, rpe: s.rpe })),
            })),
        };
        setIsSaving(true);
        try {
            if (isAuthValue && isOnline) {
                try {
                    await createWorkout(newLog);
                } catch (err) {
                    console.warn('[Tracker] cloud save fallback:', err);
                    showToast('Saved locally — will sync when back online.', 'warning');
                }
            } else {
                saveData({ ...data, logs: [...(data.logs || []), newLog] });
            }
            hapticSuccess();
            showToast('Workout saved.', 'success');
        } finally {
            setIsSaving(false);
        }
    };

    const getRecommendation = (exercise) => {
        if (!exercise.previousSession) return null;
        const { rpe, weight } = exercise.previousSession;
        const currentDisplayWeight = convertWeight(weight);
        const step = unit === 'kg' ? 2.5 : 5;
        if (rpe < 7) {
            const suggested = Math.round((currentDisplayWeight + step) * 10) / 10;
            return {
                type: 'increase',
                suggestion: `Push to ${suggested}${unit}`,
                reasoning: `RPE ${rpe} was easy last session — add load.`,
            };
        }
        if (rpe > 9) {
            const suggested = Math.round(Math.max(0, currentDisplayWeight - step) * 10) / 10;
            return {
                type: 'decrease',
                suggestion: `Back off to ${suggested}${unit}`,
                reasoning: `RPE ${rpe} was near failure — manage fatigue.`,
            };
        }
        const suggested = Math.round(currentDisplayWeight * 10) / 10;
        return {
            type: 'maintain',
            suggestion: `Hold ${suggested}${unit} · aim for +1 rep`,
            reasoning: `RPE ${rpe} is in the hypertrophy sweet spot.`,
        };
    };

    /* ---------- Render guards ---------- */
    if (loading) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
                <LoadingRing size={36} />
                <p className="text-sm text-zinc-500">Loading today's session…</p>
            </div>
        );
    }

    if (!workout) {
        return (
            <EmptyState
                icon={Dumbbell}
                title="No workout scheduled"
                description="You don't have an active program yet. Generate one to start tracking."
                action={
                    <Link to="/program" className="btn-primary">
                        <Zap className="h-4 w-4" /> Generate Program
                    </Link>
                }
            />
        );
    }

    if (workout.isRestDay) {
        return (
            <div className="space-y-6">
                <PageHeader
                    eyebrow="Today"
                    title="Rest Day"
                    description={`${workout.mesocycle} · Week ${workout.week}`}
                    icon={Coffee}
                />
                <Card className="text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
                        <Coffee className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Recover and grow.</h2>
                    <p className="mt-2 text-zinc-400">
                        Training happens in the gym; adaptation happens in between. Walk,
                        eat well, sleep long.
                    </p>
                    <div className="mt-6 flex items-center justify-center gap-3">
                        <Link to="/program" className="btn-outline">
                            View full program
                        </Link>
                    </div>
                </Card>
            </div>
        );
    }

    const volumePct = targetVolume
        ? Math.min(100, Math.round((totalVolume / targetVolume) * 100))
        : 0;
    const setsPct = totalSets ? Math.round((completedSets / totalSets) * 100) : 0;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="surface-strong flex flex-wrap items-center justify-between gap-4 p-4 md:p-5">
                <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent shadow-glow-sm">
                        <Dumbbell className="h-6 w-6" strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                        <div className="eyebrow mb-0.5">
                            {workout.mesocycle} · W{workout.week} · {workout.phase}
                        </div>
                        <h1 className="truncate text-[22px] font-extrabold leading-tight tracking-tight text-white md:text-3xl">
                            {workout.name}
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <WorkoutTimer onTimeUpdate={setTimer} />
                    <button
                        type="button"
                        onClick={handleFinish}
                        disabled={isSaving || completedSets === 0}
                        className="btn-primary btn-lg hidden sm:inline-flex"
                    >
                        {isSaving ? (
                            <>
                                <LoadingRing size={14} /> Saving…
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4" /> Finish
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Progress overview */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card padded={false} className="flex items-center gap-4 p-5">
                    <CircularProgress
                        value={totalVolume}
                        maxValue={targetVolume || 1}
                        size={84}
                        strokeWidth={7}
                    >
                        <span className="text-lg font-bold tabular-nums text-white">
                            {volumePct}%
                        </span>
                    </CircularProgress>
                    <div className="min-w-0">
                        <div className="eyebrow mb-1">Daily Volume</div>
                        <p className="truncate text-lg font-bold tabular-nums text-white">
                            {Math.round(convertWeight(totalVolume)).toLocaleString()} {unit}
                        </p>
                        <p className="text-xs text-zinc-500">
                            of {Math.round(convertWeight(targetVolume)).toLocaleString()} {unit}
                        </p>
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center justify-between">
                        <div className="eyebrow">Sets</div>
                        <span className="text-lg font-bold tabular-nums text-white">
                            {completedSets}
                            <span className="text-zinc-500">/{totalSets}</span>
                        </span>
                    </div>
                    <ProgressBar value={setsPct} className="mt-3" />
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
                        <Target className="h-3 w-3" /> {totalSets - completedSets} remaining
                    </p>
                </Card>

                <Card>
                    <div className="space-y-2.5 text-sm">
                        <Row label="Duration" value={formatTimer(timer)} />
                        <Row label="Avg RPE" value={avgRpe ?? '—'} />
                        <Row
                            label="Exercises"
                            value={`${exercises.length}`}
                            accent
                        />
                    </div>
                </Card>
            </div>

            {/* Progression recommendations */}
            {exercises.some((ex) => ex.previousSession) && (
                <>
                    <button
                        type="button"
                        onClick={() => setShowProgression((v) => !v)}
                        className="flex w-full items-center justify-between rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-accent transition-all hover:bg-accent/10"
                        aria-expanded={showProgression}
                    >
                        <span className="flex items-center gap-2 font-semibold">
                            <Sparkles className="h-4 w-4" />
                            AI Progression Recommendations
                        </span>
                        <ChevronDown
                            className={clsx(
                                'h-4 w-4 transition-transform',
                                showProgression && 'rotate-180',
                            )}
                        />
                    </button>
                    {showProgression && (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {exercises
                                .filter((ex) => ex.previousSession)
                                .slice(0, 4)
                                .map((ex) => (
                                    <ProgressionCard
                                        key={ex.id}
                                        exercise={ex.name}
                                        recommendation={getRecommendation(ex)}
                                        previousSet={ex.previousSession}
                                        currentWeight={displayWeight(ex.target.weight)}
                                        unit={unit}
                                    />
                                ))}
                        </div>
                    )}
                </>
            )}

            {/* Exercise cards */}
            <div className="space-y-4">
                {exercises.map((exercise, idx) => {
                    const isOpen = !!expanded[exercise.id];
                    const done = exercise.sets.filter((s) => s.completed).length;
                    const pct = (done / exercise.sets.length) * 100;
                    const isDone = done === exercise.sets.length && done > 0;
                    return (
                        <Card
                            key={exercise.id}
                            padded={false}
                            className={clsx(
                                'overflow-hidden p-0 animate-fade-in',
                                isDone && 'border-emerald-500/20',
                            )}
                            style={{ animationDelay: `${idx * 40}ms` }}
                        >
                            <button
                                type="button"
                                onClick={() => toggle(exercise.id)}
                                className="flex w-full items-center justify-between gap-4 p-5 text-left"
                                aria-expanded={isOpen}
                            >
                                <div className="flex min-w-0 items-center gap-4">
                                    <div
                                        className={clsx(
                                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-base font-black',
                                            isDone
                                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                                : 'border-white/5 bg-white/[0.03] text-accent',
                                        )}
                                    >
                                        {isDone ? (
                                            <CheckCircle2 className="h-5 w-5" />
                                        ) : (
                                            idx + 1
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="truncate text-lg font-bold tracking-tight text-white">
                                            {exercise.name}
                                        </h3>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                            <Chip>{exercise.target.sets} sets</Chip>
                                            <Chip>{exercise.target.reps} reps</Chip>
                                            {exercise.muscles?.map((m) => (
                                                <Chip key={m}>{m}</Chip>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                    <Chip tone={isDone ? 'success' : done > 0 ? 'accent' : 'default'}>
                                        {done}/{exercise.sets.length}
                                    </Chip>
                                    <ChevronDown
                                        className={clsx(
                                            'h-5 w-5 text-zinc-500 transition-transform',
                                            isOpen && 'rotate-180 text-accent',
                                        )}
                                    />
                                </div>
                            </button>
                            {!isOpen && pct > 0 && <ProgressBar value={pct} className="rounded-none" />}

                            {isOpen && (
                                <div className="space-y-3 border-t border-white/5 p-4 md:p-5">
                                    {exercise.sets.map((set, setIdx) => (
                                        <SetLogger
                                            key={setIdx}
                                            set={set}
                                            setIndex={setIdx}
                                            exerciseId={exercise.id}
                                            onUpdate={updateSet}
                                            onComplete={completeSet}
                                            previousSet={
                                                setIdx === 0
                                                    ? exercise.previousSession
                                                    : exercise.sets[setIdx - 1]
                                            }
                                            targetReps={exercise.target.reps}
                                            targetWeight={exercise.target.weight}
                                        />
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => addSet(exercise.id)}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] py-3 text-sm font-semibold text-zinc-500 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                                    >
                                        <Plus className="h-4 w-4" /> Add set
                                    </button>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>

            {/* Mobile Finish FAB (only on small screens) */}
            <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-5 sm:hidden">
                <button
                    type="button"
                    onClick={handleFinish}
                    disabled={isSaving || completedSets === 0}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-ink-950 shadow-glow active:scale-95 disabled:opacity-50"
                    aria-label="Finish workout"
                >
                    {isSaving ? <LoadingRing size={20} /> : <Flame className="h-6 w-6" />}
                </button>
            </div>
        </div>
    );
}

function Row({ label, value, accent }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-zinc-500">{label}</span>
            <span
                className={clsx(
                    'font-mono text-base font-semibold tabular-nums',
                    accent ? 'text-accent' : 'text-white',
                )}
            >
                {value}
            </span>
        </div>
    );
}

function formatTimer(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
