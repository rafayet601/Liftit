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
    Search,
    X,
    RotateCcw,
} from 'lucide-react';
import { db } from '../data/db';
import { useWorkouts } from '../data/DataProvider';
import { useUnit } from '../contexts/UnitContext';
import { workoutVolume, prTimeline, e1rmTrend } from '../engine/analytics';
import { Card, Chip, EmptyState, PageHeader, Sheet, Segmented } from '../components/ui/Primitives';
import Glass from '../components/ui/Glass';
import ShareCard from '../components/ui/ShareCard';

/**
 * History — every logged session, newest first; tap into a session for the
 * full set breakdown, or drill into one exercise's long-term trend.
 */
export default function History() {
    const { id } = useParams();
    const workouts = useWorkouts();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [period, setPeriod] = useState('all');
    const [recordsOnly, setRecordsOnly] = useState(false);
    const [deleted, setDeleted] = useState(null);
    const { unit, displayWeight } = useUnit();
    const [exerciseDetail, setExerciseDetail] = useState(null);

    const prEvents = useMemo(() => prTimeline(workouts, Infinity), [workouts]);
    const prWorkoutIds = useMemo(() => new Set(prEvents.map((e) => e.workoutId)), [prEvents]);

    const filtered = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase();
        const cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
        cutoff.setDate(cutoff.getDate() - Number(period) + 1);
        return workouts.filter(workout => {
            if (period !== 'all' && new Date(workout.startedAt) < cutoff) return false;
            if (recordsOnly && !prWorkoutIds.has(workout.id)) return false;
            const searchText = [workout.name, workout.notes, ...workout.sets.map(set => db.exercises.byId(set.exerciseId)?.name)].join(' ').toLocaleLowerCase();
            return !needle || searchText.includes(needle);
        });
    }, [workouts, query, period, recordsOnly, prWorkoutIds]);
    const months = useMemo(() => {
        const groups = new Map();
        for (const workout of filtered) {
            const month = new Date(workout.startedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            if (!groups.has(month)) groups.set(month, []);
            groups.get(month).push(workout);
        }
        return [...groups];
    }, [filtered]);
    const resetFilters = () => { setQuery(''); setPeriod('all'); setRecordsOnly(false); };

    const selected = id ? workouts.find((w) => w.id === id) : null;

    if (!workouts.length && !deleted && !id) {
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

            {deleted && (
                <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
                    <p className="text-sm text-ink-300">Deleted “{deleted.name}”.</p>
                    <button type="button" className="btn-secondary" onClick={() => { db.workouts.save(deleted); setDeleted(null); }}><RotateCcw className="h-4 w-4" /> Undo delete</button>
                </div>
            )}

            <Card className="space-y-4">
                <div className="relative">
                    <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                    <input type="search" aria-label="Search workout history" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search workouts, exercises or notes" className="input pl-11 pr-12" />
                    {query && <button type="button" aria-label="Clear search" className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-ink-400" onClick={() => setQuery('')}><X className="h-4 w-4" /></button>}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Segmented label="History date range" value={period} onChange={setPeriod} options={[{ value: 'all', label: 'All time' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />
                    <button type="button" aria-pressed={recordsOnly} onClick={() => setRecordsOnly(value => !value)} className={recordsOnly ? 'btn-outline' : 'btn-secondary'}><Trophy className="h-4 w-4" /> Personal records</button>
                </div>
            </Card>

            <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                <p role="status" className="text-sm font-semibold text-ink-300">{filtered.length} of {workouts.length} workouts</p>
                <p className="text-xs text-ink-400">{filtered.reduce((total, workout) => total + workout.sets.length, 0)} logged sets · {Math.round(displayWeight(filtered.reduce((total, workout) => total + workoutVolume(workout), 0))).toLocaleString()} {unit} volume</p>
            </div>

            {months.map(([month, sessions]) => (
                <section key={month} aria-label={month} className="space-y-3">
                    <h2 className="eyebrow px-1">{month}</h2>
                    <ul className="space-y-3">
                        {sessions.map(workout => <SessionRow key={workout.id} workout={workout} hasPR={prWorkoutIds.has(workout.id)} />)}
                    </ul>
                </section>
            ))}
            {!filtered.length && <EmptyState icon={Search} title="No matching workouts" description="Try another exercise, a wider date range, or clear your filters." action={<button type="button" className="btn-secondary" onClick={resetFilters}>Reset filters</button>} />}
            {id && !selected && <Sheet open title="Workout unavailable" onClose={() => navigate('/history')}><p className="text-sm text-ink-300">This workout may have been deleted or isn’t saved on this device.</p><button type="button" className="btn-primary mt-5" onClick={() => navigate('/history')}>Back to history</button></Sheet>}

            {selected && (
                <SessionDetail
                    workout={selected}
                    onClose={() => navigate('/history')}
                    onDelete={workout => { setDeleted(workout); navigate('/history'); }}
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

const SessionRow = React.memo(function SessionRow({ workout, hasPR }) {
    const { unit, displayWeight } = useUnit();
    const volume = workoutVolume(workout);
    const date = new Date(workout.startedAt);
    const exerciseCount = new Set(workout.sets.map((s) => s.exerciseId)).size;

    return (
        <li>
            <Link
                to={`/history/${workout.id}`}
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
                            <h3 className="font-display text-base font-bold text-white">
                                {workout.name}
                            </h3>
                            {hasPR && <Trophy aria-label="Personal record" className="h-4 w-4 shrink-0 text-amber-300" />}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-500">
                            {exerciseCount} exercise{exerciseCount === 1 ? '' : 's'} · {workout.sets.length} set{workout.sets.length === 1 ? '' : 's'} ·{' '}
                            {Math.round(displayWeight(volume)).toLocaleString()} {unit}
                            {workout.durationSec ? ` · ${Math.round(workout.durationSec / 60)}m` : ''}
                        </p>
                    </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-500" />
            </Link>
        </li>
    );
})

function SessionDetail({ workout, onClose, onExercise, onDelete }) {
    const { unit, displayWeight } = useUnit();
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

                {workout.notes?.trim() && (
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink-500">
                            Notes
                        </p>
                        <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-ink-300">
                            {workout.notes}
                        </p>
                    </div>
                )}

                {groups.map(([exerciseId, sets]) => {
                    const exercise = db.exercises.byId(exerciseId);
                    return (
                        <Card key={exerciseId} padded={false} className="p-4">
                            <button
                                type="button"
                                onClick={() => onExercise(exerciseId)}
                                className="mb-2 flex min-h-11 w-full items-center justify-between text-left"
                            >
                                <span className="font-display text-sm font-bold text-white">
                                    {exercise?.name ?? 'Exercise'}
                                </span>
                                <span className="flex items-center gap-1 text-xs font-semibold text-accent">
                                    <TrendingUp className="h-3.5 w-3.5" /> Trend
                                </span>
                            </button>
                            <table className="w-full text-sm">
                                <caption className="sr-only">Logged sets for {exercise?.name ?? 'exercise'}</caption>
                                <thead className="text-left text-[10px] uppercase tracking-wider text-ink-400"><tr><th scope="col" className="py-2">Set</th><th scope="col">Weight × reps</th><th scope="col" className="text-right">Effort</th></tr></thead>
                                <tbody>
                                    {sets.map((s, i) => (
                                        <tr key={i} className="border-t border-white/[0.05]">
                                            <td className="py-1.5 pr-2 text-xs text-ink-500">#{s.setNumber}</td>
                                            <td className="py-1.5 font-semibold tabular-nums text-white">
                                                {s.isWarmup && (
                                                    <span className="mr-1.5 rounded border border-amber-400/30 bg-amber-400/10 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                                                        W
                                                    </span>
                                                )}
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
                                onDelete(workout);
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
    const prEvent = useMemo(
        () => prTimeline(workouts, 200).find((e) => e.exerciseId === exerciseId),
        [workouts, exerciseId],
    );

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

            {prEvent && <ShareCard event={prEvent} />}

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
