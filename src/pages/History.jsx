import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    History as HistoryIcon,
    Trash2,
    Clock,
    Dumbbell,
    Trophy,
    ChevronRight,
    TrendingUp,
} from 'lucide-react';
import { db } from '../data/db';
import { useWorkouts } from '../data/DataProvider';
import { useUnit } from '../contexts/UnitContext';
import { workoutVolume, prTimeline, e1rmTrend } from '../engine/analytics';
import { Card, Chip, EmptyState, PageHeader, Sheet } from '../components/ui/Primitives';
import Glass from '../components/ui/Glass';
import { useToast } from '../components/ui/Toast';

/**
 * History — every logged session, newest first; tap into a session for the
 * full set breakdown, or drill into one exercise's long-term trend.
 */
export default function History() {
    const { id } = useParams();
    const workouts = useWorkouts();
    const navigate = useNavigate();
    const [exerciseDetail, setExerciseDetail] = useState(null);

    const prEvents = useMemo(() => prTimeline(workouts, 100), [workouts]);
    const prWorkoutIds = useMemo(() => new Set(prEvents.map((e) => e.workoutId)), [prEvents]);

    const selected = id ? workouts.find((w) => w.id === id) : null;

    if (!workouts.length) {
        return (
            <EmptyState
                icon={HistoryIcon}
                title="No workouts yet"
                description="Your training log lives here. Finish your first session and it shows up immediately."
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
            <Glass tint="neutral" glow wave wavePreset="purple" style={{ background: 'rgba(139,92,246,0.04)', borderColor: 'rgba(139,92,246,0.2)' }}>
                <PageHeader
                    eyebrow="Log"
                    title="History"
                    description={`${workouts.length} workout${workouts.length === 1 ? '' : 's'} on record.`}
                    icon={HistoryIcon}
                />
            </Glass>

            <ul className="space-y-3">
                {workouts.map((w) => (
                    <SessionRow
                        key={w.id}
                        workout={w}
                        hasPR={prWorkoutIds.has(w.id)}
                        onOpen={() => navigate(`/history/${w.id}`)}
                    />
                ))}
            </ul>

            {selected && (
                <SessionDetail
                    workout={selected}
                    onClose={() => navigate('/history')}
                    onExercise={(exerciseId) => setExerciseDetail(exerciseId)}
                />
            )}
            {exerciseDetail && (
                <ExerciseDetail
                    exerciseId={exerciseDetail}
                    workouts={workouts}
                    onClose={() => setExerciseDetail(null)}
                />
            )}
        </div>
    );
}

function SessionRow({ workout, hasPR, onOpen }) {
    const { unit, displayWeight } = useUnit();
    const volume = workoutVolume(workout);
    const date = new Date(workout.startedAt);
    const exerciseCount = new Set(workout.sets.map((s) => s.exerciseId)).size;

    return (
        <li>
            <button
                type="button"
                onClick={onOpen}
                className="glass-card glass-card-hover flex w-full items-center justify-between gap-4 p-4 text-left"
            >
                <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02]">
                        <span className="text-[10px] font-bold uppercase text-ink-500">
                            {date.toLocaleDateString(undefined, { month: 'short' })}
                        </span>
                        <span className="font-display text-lg font-bold leading-none text-white">
                            {date.getDate()}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="truncate font-display text-base font-bold text-white">
                                {workout.name}
                            </h3>
                            {hasPR && <Trophy className="h-4 w-4 shrink-0 text-amber-300" />}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-500">
                            {exerciseCount} exercises · {workout.sets.length} sets ·{' '}
                            {Math.round(displayWeight(volume)).toLocaleString()} {unit}
                            {workout.durationSec ? ` · ${Math.round(workout.durationSec / 60)}m` : ''}
                        </p>
                    </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-500" />
            </button>
        </li>
    );
}

function SessionDetail({ workout, onClose, onExercise }) {
    const { unit, displayWeight } = useUnit();
    const { showToast } = useToast();
    const [confirmDelete, setConfirmDelete] = useState(false);

    const groups = useMemo(() => {
        const map = new Map();
        for (const s of workout.sets) {
            if (!map.has(s.exerciseId)) map.set(s.exerciseId, []);
            map.get(s.exerciseId).push(s);
        }
        return [...map.entries()];
    }, [workout]);

    const date = new Date(workout.startedAt);

    return (
        <Sheet
            open
            wide
            onClose={onClose}
            title={`${workout.name} · ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
        >
            <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    <Chip icon={Clock}>
                        {workout.durationSec ? `${Math.round(workout.durationSec / 60)} min` : '—'}
                    </Chip>
                    <Chip icon={Dumbbell}>
                        {Math.round(displayWeight(workoutVolume(workout))).toLocaleString()} {unit}
                    </Chip>
                    <Chip>{workout.sets.length} sets</Chip>
                </div>

                {groups.map(([exerciseId, sets]) => {
                    const exercise = db.exercises.byId(exerciseId);
                    return (
                        <Card key={exerciseId} padded={false} className="p-4">
                            <button
                                type="button"
                                onClick={() => onExercise(exerciseId)}
                                className="mb-2 flex w-full items-center justify-between text-left"
                            >
                                <span className="font-display text-sm font-bold text-white">
                                    {exercise?.name ?? 'Exercise'}
                                </span>
                                <span className="flex items-center gap-1 text-xs font-semibold text-accent">
                                    <TrendingUp className="h-3.5 w-3.5" /> Trend
                                </span>
                            </button>
                            <table className="w-full text-sm">
                                <tbody>
                                    {sets.map((s, i) => (
                                        <tr key={i} className="border-t border-white/[0.05]">
                                            <td className="py-1.5 pr-2 text-xs text-ink-500">#{s.setNumber}</td>
                                            <td className="py-1.5 font-semibold tabular-nums text-white">
                                                {displayWeight(s.weight)} {unit} × {s.reps}
                                            </td>
                                            <td className="py-1.5 text-right text-xs tabular-nums text-ink-500">
                                                {s.rpe > 0 ? `RPE ${s.rpe}` : ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    );
                })}

                {confirmDelete ? (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="btn-danger flex-1"
                            onClick={() => {
                                db.workouts.remove(workout.id);
                                showToast('Workout deleted.', 'success');
                                onClose();
                            }}
                        >
                            Confirm delete
                        </button>
                        <button type="button" className="btn-secondary flex-1" onClick={() => setConfirmDelete(false)}>
                            Cancel
                        </button>
                    </div>
                ) : (
                    <button type="button" className="btn-ghost w-full text-red-400" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="h-4 w-4" /> Delete workout
                    </button>
                )}
            </div>
        </Sheet>
    );
}

function ExerciseDetail({ exerciseId, workouts, onClose }) {
    const { unit, displayWeight } = useUnit();
    const exercise = db.exercises.byId(exerciseId);
    const trend = useMemo(() => e1rmTrend(workouts, exerciseId, 20), [workouts, exerciseId]);
    const best = trend.reduce((max, p) => Math.max(max, p.e1rm), 0);

    return (
        <Sheet open onClose={onClose} title={exercise?.name ?? 'Exercise'}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 text-center">
                        <div className="font-display text-xl font-bold tabular-nums text-white">
                            {best ? `${displayWeight(best)}` : '—'}
                            <span className="ml-1 text-xs text-ink-500">{unit}</span>
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500">
                            Best est. 1RM
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 text-center">
                        <div className="font-display text-xl font-bold tabular-nums text-white">
                            {trend.length}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-ink-500">
                            Sessions
                        </div>
                    </div>
                </div>

                {/* Sparkline */}
                {trend.length >= 2 ? (
                    <Sparkline
                        points={trend.map((p) => displayWeight(p.e1rm))}
                        labels={trend.map((p) => p.date)}
                    />
                ) : (
                    <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-ink-500">
                        Log this lift in at least two sessions to see the trend.
                    </p>
                )}

                <ul className="space-y-1.5">
                    {[...trend].reverse().map((p) => (
                        <li
                            key={p.date}
                            className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-sm"
                        >
                            <span className="text-ink-400">
                                {new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="tabular-nums text-white">
                                {displayWeight(p.weight)} {unit} × {p.reps}
                                <span className="ml-2 text-xs text-ink-500">
                                    e1RM {displayWeight(p.e1rm)}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </Sheet>
    );
}

function Sparkline({ points }) {
    const w = 320;
    const h = 80;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const step = points.length > 1 ? w / (points.length - 1) : w;
    const path = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - ((p - min) / range) * (h - 8) - 4).toFixed(1)}`)
        .join(' ');
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" preserveAspectRatio="none" aria-hidden>
            <path d={path} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
    );
}
