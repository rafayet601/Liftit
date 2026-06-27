import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Plus,
    Play,
    Dumbbell,
    ChevronDown,
    CheckCircle2,
    Trash2,
    Repeat,
    Trophy,
    Flame,
    Clock,
    Coffee,
    Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import { db } from '../data/db';
import { useWorkouts, useActiveProgram } from '../data/DataProvider';
import { useUnit } from '../contexts/UnitContext';
import {
    useActiveSession,
    startSession,
    updateSession,
    discardSession,
    makeSessionExercise,
} from '../hooks/useActiveSession';
import { suggestNextSession, sessionsForExercise } from '../engine/progression';
import { currentProgramWeek, scaleTargetsForWeek, phaseForWeek } from '../engine/generator';
import { detectPRs } from '../engine/e1rm';
import { workoutVolume } from '../engine/analytics';
import ExercisePicker from '../components/workout/ExercisePicker';
import RestTimer from '../components/workout/RestTimer';
import SetRow from '../components/workout/SetRow';
import { Card, Chip, EmptyState, PageHeader, ProgressBar, Sheet } from '../components/ui/Primitives';
import Glass from '../components/ui/Glass';
import LinearGradient from '../components/ui/LinearGradient';
import WaveDistortion from '../components/ui/WaveDistortion';
import { useToast } from '../components/ui/Toast';
import { hapticMedium, hapticSuccess } from '../lib/platform';

export default function Workout() {
    const { session } = useActiveSession();
    return session ? <ActiveSession /> : <SessionLauncher />;
}

/* ==================================================================
   Launcher — pick today's program day or start blank
   ================================================================== */
function SessionLauncher() {
    const program = useActiveProgram();
    const workouts = useWorkouts();
    const { unit, displayWeight } = useUnit();

    const week = program ? currentProgramWeek(program) : 1;
    const phase = program ? phaseForWeek(week, program.durationWeeks) : null;

    // Recommended next day: the one after the last logged day of this program.
    const nextDayNumber = useMemo(() => {
        if (!program) return 1;
        const last = workouts.find((w) => w.programId === program.id);
        if (!last?.programDayNumber) return 1;
        return (last.programDayNumber % program.daysPerWeek) + 1;
    }, [program, workouts]);

    const begin = (day) => {
        hapticMedium();
        const exercises = day.exercises.map((target) => {
            const scaled = scaleTargetsForWeek(target, week, program.durationWeeks);
            const exercise = db.exercises.byId(target.exerciseId);
            const suggestion = suggestNextSession(
                sessionsForExercise(workouts, target.exerciseId, 4),
                { repsMin: scaled.targetRepsMin, repsMax: scaled.targetRepsMax, rpe: scaled.targetRpe },
                { units: unit, isCompound: exercise?.isCompound ?? true },
            );
            return makeSessionExercise({
                exerciseId: target.exerciseId,
                targetSets: scaled.targetSets,
                targetRepsMin: scaled.targetRepsMin,
                targetRepsMax: scaled.targetRepsMax,
                targetRpe: scaled.targetRpe,
                restSec: target.restSec,
                suggestedWeight: suggestion.weight,
            });
        });
        startSession({
            name: day.name,
            programId: program.id,
            programDayNumber: day.dayNumber,
            exercises,
        });
    };

    const beginBlank = () => {
        hapticMedium();
        startSession({ name: 'Freestyle Workout', exercises: [] });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <Glass tint="neutral" glow wave wavePreset="purple" style={{ background: 'rgba(139,92,246,0.04)', borderColor: 'rgba(139,92,246,0.2)' }}>
                <PageHeader
                    eyebrow="Train"
                    title="Workout"
                    description={
                        program
                            ? `${program.name} · Week ${week} of ${program.durationWeeks} · ${phase.name}`
                            : 'No active program — start freestyle or generate one.'
                    }
                    icon={Dumbbell}
                    actions={
                        <button type="button" onClick={beginBlank} className="btn-outline">
                            <Plus className="h-4 w-4" /> Empty workout
                        </button>
                    }
                />
                <LinearGradient preset="purple" variant="strip" glow style={{ height: '2px', borderRadius: '999px', marginTop: '12px', opacity: 0.6 }} />
            </Glass>

            {!program ? (
                <EmptyState
                    icon={Dumbbell}
                    title="No program yet"
                    description="Generate a plan built around your goal, or just start logging freestyle."
                    action={
                        <div className="flex gap-2">
                            <Link to="/program" className="btn-primary">
                                <Sparkles className="h-4 w-4" /> Create program
                            </Link>
                            <button type="button" onClick={beginBlank} className="btn-secondary">
                                Start freestyle
                            </button>
                        </div>
                    }
                />
            ) : (
                <div className="space-y-3">
                    {phase.name === 'Deload' && (
                        <Card className="flex items-center gap-3 border-steel/20 bg-steel/5">
                            <Coffee className="h-5 w-5 shrink-0 text-steel" />
                            <p className="text-sm text-ink-300">
                                Deload week — {phase.blurb.toLowerCase()} Targets are already reduced.
                            </p>
                        </Card>
                    )}
                    {program.days.map((day) => {
                        const recommended = day.dayNumber === nextDayNumber;
                        return (
                            <Card
                                key={day.dayNumber}
                                padded={false}
                                className={clsx(
                                    'flex items-center justify-between gap-4 p-4 transition-all duration-200',
                                    recommended ? 'glass-card-glow' : 'surface-hover hover:scale-[1.01]',
                                )}
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="truncate font-display text-lg font-bold text-white">
                                            {day.name}
                                        </h3>
                                        {recommended && <Chip tone="accent">Up next</Chip>}
                                    </div>
                                    <p className="mt-0.5 truncate text-sm text-ink-500">
                                        {day.exercises.length} exercises
                                        {day.focus ? ` · ${day.focus}` : ''}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => begin(day)}
                                    className={recommended ? 'btn-primary' : 'btn-secondary'}
                                >
                                    <Play className="h-4 w-4" /> Start
                                </button>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Show first suggestion teaser when history exists */}
            <EngineTeaser workouts={workouts} program={program} unit={unit} displayWeight={displayWeight} />
        </div>
    );
}

function EngineTeaser({ workouts, program, unit, displayWeight }) {
    const teaser = useMemo(() => {
        if (!program || !workouts.length) return null;
        const day = program.days.find((d) => d.exercises.length);
        if (!day) return null;
        for (const t of day.exercises) {
            const sessions = sessionsForExercise(workouts, t.exerciseId, 4);
            if (!sessions.length) continue;
            const exercise = db.exercises.byId(t.exerciseId);
            const s = suggestNextSession(
                sessions,
                { repsMin: t.targetRepsMin, repsMax: t.targetRepsMax, rpe: t.targetRpe },
                { units: unit, isCompound: exercise?.isCompound ?? true },
            );
            if (s.weight) return { exercise, s };
        }
        return null;
    }, [workouts, program, unit]);

    if (!teaser) return null;
    return (
        <Card className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Flame className="h-4 w-4" />
            </span>
            <div>
                <p className="text-sm font-semibold text-white">
                    {teaser.exercise.name}: {displayWeight(teaser.s.weight)} {unit} next time
                </p>
                <p className="mt-0.5 text-xs text-ink-400">
                    {teaser.s.reason} <span className="text-ink-600">· Based on your last sessions</span>
                </p>
            </div>
        </Card>
    );
}

/* ==================================================================
   Active session
   ================================================================== */
function ActiveSession() {
    const { session } = useActiveSession();
    const workouts = useWorkouts();
    const { unit, displayWeight } = useUnit();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [expanded, setExpanded] = useState(() => ({ [session.exercises[0]?.key]: true }));
    const [picker, setPicker] = useState(null); // null | 'add' | { swapKey }
    const [rest, setRest] = useState(null); // { key, seconds }
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const [summary, setSummary] = useState(null);

    const completedSets = session.exercises.reduce(
        (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
        0,
    );
    const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

    /* ---------- mutations ---------- */
    const changeSet = (exKey, setIdx, patch) =>
        updateSession((d) => {
            const ex = d.exercises.find((e) => e.key === exKey);
            if (ex) ex.sets[setIdx] = { ...ex.sets[setIdx], ...patch };
        });

    const completeSet = (exercise, setIdx) => {
        updateSession((d) => {
            const ex = d.exercises.find((e) => e.key === exercise.key);
            if (ex) ex.sets[setIdx].completed = true;
        });
        setRest({ key: `${exercise.key}-${setIdx}`, seconds: exercise.restSec || 120 });
    };

    const addSet = (exKey) =>
        updateSession((d) => {
            const ex = d.exercises.find((e) => e.key === exKey);
            if (!ex) return;
            const last = ex.sets[ex.sets.length - 1];
            ex.sets.push({ weight: last?.weight ?? 0, reps: 0, rpe: 0, completed: false });
        });

    const removeExercise = (exKey) =>
        updateSession((d) => {
            d.exercises = d.exercises.filter((e) => e.key !== exKey);
        });

    const addExercise = (exercise) => {
        const suggestion = suggestNextSession(
            sessionsForExercise(workouts, exercise.id, 4),
            { repsMin: 8, repsMax: 12, rpe: 8 },
            { units: unit, isCompound: exercise.isCompound },
        );
        const entry = makeSessionExercise({
            exerciseId: exercise.id,
            suggestedWeight: suggestion.weight,
        });
        if (picker?.swapKey) {
            updateSession((d) => {
                const idx = d.exercises.findIndex((e) => e.key === picker.swapKey);
                if (idx >= 0) d.exercises[idx] = entry;
            });
        } else {
            updateSession((d) => {
                d.exercises.push(entry);
            });
        }
        setExpanded((p) => ({ ...p, [entry.key]: true }));
        setPicker(null);
    };

    /* ---------- finish ---------- */
    const finish = () => {
        hapticMedium();
        const durationSec = Math.max(
            0,
            Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000),
        );
        const sets = [];
        for (const ex of session.exercises) {
            let n = 0;
            for (const s of ex.sets) {
                if (!s.completed || !(s.reps > 0)) continue;
                n += 1;
                sets.push({
                    exerciseId: ex.exerciseId,
                    setNumber: n,
                    weight: s.weight,
                    reps: s.reps,
                    rpe: s.rpe,
                    completedAt: new Date().toISOString(),
                });
            }
        }
        if (!sets.length) {
            showToast('Complete at least one set first.', 'warning');
            return;
        }

        // PR detection against history *before* saving.
        const prs = [];
        const byExercise = new Map();
        for (const s of sets) {
            if (!byExercise.has(s.exerciseId)) byExercise.set(s.exerciseId, []);
            byExercise.get(s.exerciseId).push(s);
        }
        for (const [exerciseId, todaySets] of byExercise) {
            const prior = workouts.flatMap((w) =>
                (w.sets || []).filter((s) => s.exerciseId === exerciseId),
            );
            for (const pr of detectPRs(todaySets, prior)) {
                prs.push({ ...pr, exerciseId });
            }
        }

        const workout = db.workouts.save({
            id: session.id,
            name: session.name,
            programId: session.programId,
            programDayNumber: session.programDayNumber,
            startedAt: session.startedAt,
            completedAt: new Date().toISOString(),
            durationSec,
            sets,
        });

        hapticSuccess();
        // Keep the session mounted until the summary is dismissed —
        // discarding here would unmount this component and the sheet with it.
        setSummary({ workout, prs, volume: workoutVolume(workout), durationSec });
    };

    /* ---------- render ---------- */
    return (
        <div className="space-y-5 animate-fade-in">
            {/* Header */}
            <div className="sticky top-0 z-50 -mx-4 px-4 py-3 bg-ink-950/65 backdrop-blur-xl border-b border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.4)] flex flex-wrap items-center justify-between gap-3 md:mx-0 md:rounded-2xl md:border md:bg-ink-900/60">
                <div className="min-w-0">
                    <div className="eyebrow mb-0.5 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                        In session · <ElapsedClock startedAt={session.startedAt} />
                    </div>
                    <h1 className="truncate font-display text-2xl font-bold text-white">
                        {session.name}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setConfirmDiscard(true)} className="btn-ghost">
                        Discard
                    </button>
                    <button
                        type="button"
                        onClick={finish}
                        disabled={completedSets === 0}
                        className="btn-cta"
                        style={{ minWidth: '120px' }}
                    >
                        <CheckCircle2 className="h-5 w-5" /> Finish Workout
                    </button>
                </div>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-3">
                <ProgressBar value={totalSets ? (completedSets / totalSets) * 100 : 0} className="flex-1" />
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-400">
                    {completedSets}/{totalSets} sets
                </span>
            </div>

            {/* Exercises */}
            <div className="space-y-3">
                {session.exercises.map((ex, idx) => (
                    <ExerciseCard
                        key={ex.key}
                        entry={ex}
                        index={idx}
                        workouts={workouts}
                        open={!!expanded[ex.key]}
                        onToggle={() => setExpanded((p) => ({ ...p, [ex.key]: !p[ex.key] }))}
                        onChangeSet={changeSet}
                        onCompleteSet={completeSet}
                        onAddSet={addSet}
                        onSwap={() => setPicker({ swapKey: ex.key })}
                        onRemove={() => removeExercise(ex.key)}
                        unit={unit}
                        displayWeight={displayWeight}
                    />
                ))}

                <button
                    type="button"
                    onClick={() => setPicker('add')}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] py-4 text-sm font-semibold text-ink-500 transition-colors hover:border-white/20 hover:text-white"
                >
                    <Plus className="h-4 w-4" /> Add exercise
                </button>
            </div>

            {/* Overlays */}
            {picker && (
                <ExercisePicker
                    title={picker?.swapKey ? 'Swap exercise' : 'Add exercise'}
                    onSelect={addExercise}
                    onClose={() => setPicker(null)}
                />
            )}
            {rest && <RestTimer key={rest.key} seconds={rest.seconds} onDone={() => setRest(null)} />}
            {confirmDiscard && (
                <Sheet open title="Discard workout?" onClose={() => setConfirmDiscard(false)}>
                    <p className="text-sm text-ink-400">
                        Nothing from this session will be saved. This can't be undone.
                    </p>
                    <div className="mt-5 flex gap-2">
                        <button
                            type="button"
                            className="btn-danger flex-1"
                            onClick={() => {
                                discardSession();
                                setConfirmDiscard(false);
                            }}
                        >
                            Discard session
                        </button>
                        <button
                            type="button"
                            className="btn-secondary flex-1"
                            onClick={() => setConfirmDiscard(false)}
                        >
                            Keep training
                        </button>
                    </div>
                </Sheet>
            )}
            {summary && (
                <SummarySheet
                    summary={summary}
                    unit={unit}
                    displayWeight={displayWeight}
                    onClose={() => {
                        setSummary(null);
                        discardSession();
                        navigate(`/history/${summary.workout.id}`);
                    }}
                />
            )}
        </div>
    );
}

function ExerciseCard({
    entry,
    index,
    workouts,
    open,
    onToggle,
    onChangeSet,
    onCompleteSet,
    onAddSet,
    onSwap,
    onRemove,
    unit,
    displayWeight,
}) {
    const exercise = db.exercises.byId(entry.exerciseId);
    const previous = useMemo(
        () => sessionsForExercise(workouts, entry.exerciseId, 1)[0] ?? null,
        [workouts, entry.exerciseId],
    );
    const suggestion = useMemo(
        () =>
            suggestNextSession(
                sessionsForExercise(workouts, entry.exerciseId, 4),
                { repsMin: entry.targetRepsMin, repsMax: entry.targetRepsMax, rpe: entry.targetRpe },
                { units: unit, isCompound: exercise?.isCompound ?? true },
            ),
        [workouts, entry, unit, exercise],
    );

    const done = entry.sets.filter((s) => s.completed).length;
    const isDone = done === entry.sets.length && done > 0;

    return (
        <div
            className={clsx(
                'surface overflow-hidden transition-all duration-200 mesh-border',
                open && !isDone && 'glass-card-glow',
                isDone && 'glass-card-glow-success',
            )}
        >
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
                <div className="flex min-w-0 items-center gap-3">
                    <span
                        className={clsx(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border font-display text-base font-bold',
                            isDone
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : 'border-white/[0.07] bg-white/[0.02] text-accent',
                        )}
                    >
                        {isDone ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate font-display text-base font-bold text-white">
                            {exercise?.name ?? 'Exercise'}
                        </span>
                        <span className="block text-xs text-ink-500">
                            {entry.targetSets} × {entry.targetRepsMin}–{entry.targetRepsMax} @ RPE{' '}
                            {entry.targetRpe}
                        </span>
                    </span>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                    <Chip tone={isDone ? 'success' : done > 0 ? 'accent' : 'default'}>
                        {done}/{entry.sets.length}
                    </Chip>
                    <ChevronDown
                        className={clsx('h-5 w-5 text-ink-500 transition-transform', open && 'rotate-180')}
                    />
                </span>
            </button>

            {open && (
                <div className="space-y-2.5 border-t border-white/[0.07] p-3.5">
                    {/* Engine suggestion — rule-based, honestly labeled */}
                    {suggestion.action !== 'start' && (
                        <div className="flex items-start gap-2 rounded-xl border border-accent/15 bg-accent/[0.06] px-3 py-2.5">
                            <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                            <p className="text-xs leading-relaxed text-ink-300">
                                {suggestion.weight ? (
                                    <strong className="text-white">
                                        {displayWeight(suggestion.weight)} {unit} ·{' '}
                                    </strong>
                                ) : null}
                                {suggestion.reason}
                            </p>
                        </div>
                    )}

                    {entry.sets.map((set, setIdx) => (
                        <SetRow
                            key={setIdx}
                            set={set}
                            index={setIdx}
                            ghost={previous?.sets?.[setIdx] ?? null}
                            onChange={(patch) => onChangeSet(entry.key, setIdx, patch)}
                            onComplete={() => onCompleteSet(entry, setIdx)}
                        />
                    ))}

                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => onAddSet(entry.key)} className="btn-secondary flex-1 py-2 text-xs">
                            <Plus className="h-3.5 w-3.5" /> Set
                        </button>
                        <button type="button" onClick={onSwap} className="btn-ghost flex-1 py-2 text-xs">
                            <Repeat className="h-3.5 w-3.5" /> Swap
                        </button>
                        <button type="button" onClick={onRemove} className="btn-ghost flex-1 py-2 text-xs text-red-400">
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function SummarySheet({ summary, unit, displayWeight, onClose }) {
    const { workout, prs, volume, durationSec } = summary;
    const m = Math.round(durationSec / 60);
    return (
        <Sheet open title="Workout complete" onClose={onClose}>
            <div className="space-y-5">
                <div className="grid grid-cols-3 gap-2 text-center">
                    <SummaryStat icon={Clock} label="Duration" value={`${m}m`} />
                    <SummaryStat
                        icon={Dumbbell}
                        label="Volume"
                        value={`${Math.round(displayWeight(volume)).toLocaleString()}`}
                        sub={unit}
                    />
                    <SummaryStat icon={Trophy} label="PRs" value={String(prs.length)} />
                </div>

                {prs.length > 0 && (
                    <div>
                        <div className="eyebrow mb-2">Personal records</div>
                        <ul className="space-y-1.5">
                            {prs.map((pr, i) => {
                                const exercise = db.exercises.byId(pr.exerciseId);
                                return (
                                    <li
                                        key={i}
                                        className="glass-card-glow-gold flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm animate-fade-in"
                                        style={{ animationDelay: `${i * 80}ms` }}
                                    >
                                        <Trophy className="h-4 w-4 shrink-0 text-amber-300 text-glow-gold" />
                                        <span className="text-white">
                                            <strong>{exercise?.name}</strong>{' '}
                                            {pr.type === 'weight' &&
                                                `— heaviest ever: ${displayWeight(pr.value)} ${unit}`}
                                            {pr.type === 'e1rm' &&
                                                `— new est. 1RM: ${displayWeight(pr.value)} ${unit}`}
                                            {pr.type === 'reps' &&
                                                `— rep record: ${pr.value} @ ${displayWeight(pr.weight)} ${unit}`}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                <p className="text-sm text-ink-400">
                    {workout.sets.length} working sets logged. Saved on this device
                    {' — '}syncs automatically when you're signed in.
                </p>

                <button type="button" onClick={onClose} className="btn-cta">
                    View in history
                </button>
            </div>
        </Sheet>
    );
}

function SummaryStat({ icon: Icon, label, value, sub }) {
    return (
        <div className="stats-card">
            <div className="stats-card-inner text-center">
                <span className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
                    <Icon className="h-4 w-4 text-accent" />
                </span>
                <div className="font-display text-2xl font-bold tabular-nums text-white count-up">
                    {value}
                    {sub && <span className="ml-0.5 text-xs font-semibold text-ink-500">{sub}</span>}
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-ink-500">{label}</div>
            </div>
        </div>
    );
}

function ElapsedClock({ startedAt }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);
    const sec = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
    const h = Math.floor(sec / 3600);
    const mPart = Math.floor((sec % 3600) / 60);
    const sPart = String(sec % 60).padStart(2, '0');
    return (
        <span className="font-mono tabular-nums text-ink-300">
            {h > 0 ? `${h}:${String(mPart).padStart(2, '0')}:${sPart}` : `${mPart}:${sPart}`}
        </span>
    );
}
