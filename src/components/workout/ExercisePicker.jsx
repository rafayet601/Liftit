import React, { useMemo, useState } from 'react';
import { Search, Plus, Dumbbell } from 'lucide-react';
import clsx from 'clsx';
import { db } from '../../data/db';
import { MUSCLE_GROUPS } from '../../data/exercises';
import { useWorkouts } from '../../data/DataProvider';
import { recentExerciseIds } from '../../engine/analytics';
import { Sheet, Chip } from '../ui/Primitives';

/**
 * Searchable exercise picker — recents first, filter by muscle, and a
 * one-tap "create custom exercise" path when nothing matches.
 */
export default function ExercisePicker({ onSelect, onClose, title = 'Add exercise' }) {
    const [query, setQuery] = useState('');
    const [muscle, setMuscle] = useState(null);
    const workouts = useWorkouts();

    const recents = useMemo(() => {
        if (query || muscle) return [];
        return recentExerciseIds(workouts, 6)
            .map((id) => db.exercises.byId(id))
            .filter(Boolean);
    }, [workouts, query, muscle]);

    const results = useMemo(() => db.exercises.search(query, { muscle }), [query, muscle]);

    const handleCreate = () => {
        const exercise = db.exercises.addCustom({
            name: query.trim(),
            primaryMuscle: muscle ?? 'core',
        });
        onSelect(exercise);
    };

    return (
        <Sheet open title={title} onClose={onClose} wide>
            <div className="space-y-4">
                {/* Search */}
                <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                    <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search exercises…"
                        className="input pl-11"
                        aria-label="Search exercises"
                    />
                </div>

                {/* Muscle filter */}
                <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                    <FilterPill active={muscle === null} onClick={() => setMuscle(null)}>
                        All
                    </FilterPill>
                    {MUSCLE_GROUPS.map((m) => (
                        <FilterPill key={m} active={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
                            {m}
                        </FilterPill>
                    ))}
                </div>

                {/* Recents */}
                {recents.length > 0 && (
                    <div>
                        <div className="eyebrow mb-2">Recent</div>
                        <ul className="space-y-1.5">
                            {recents.map((e) => (
                                <ExerciseRow key={e.id} exercise={e} onSelect={onSelect} />
                            ))}
                        </ul>
                    </div>
                )}

                {/* Results */}
                <div>
                    {recents.length > 0 && <div className="eyebrow mb-2">All exercises</div>}
                    {results.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
                            <p className="text-sm text-ink-400">No match for “{query}”.</p>
                            {query.trim().length > 2 && (
                                <button type="button" onClick={handleCreate} className="btn-outline mt-4">
                                    <Plus className="h-4 w-4" /> Create “{query.trim()}”
                                </button>
                            )}
                        </div>
                    ) : (
                        <ul className="space-y-1.5">
                            {results.slice(0, 40).map((e) => (
                                <ExerciseRow key={e.id} exercise={e} onSelect={onSelect} />
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </Sheet>
    );
}

function FilterPill({ active, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={clsx(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                active
                    ? 'border-accent/50 bg-accent/15 text-accent'
                    : 'border-white/10 bg-white/[0.03] text-ink-400 hover:text-white',
            )}
        >
            {children}
        </button>
    );
}

function ExerciseRow({ exercise, onSelect }) {
    return (
        <li>
            <button
                type="button"
                onClick={() => onSelect(exercise)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-accent/30 hover:bg-white/[0.05]"
            >
                <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-ink-400">
                        <Dumbbell className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">
                            {exercise.name}
                        </span>
                        <span className="block text-xs capitalize text-ink-500">
                            {exercise.primaryMuscle} · {exercise.equipment}
                        </span>
                    </span>
                </span>
                {exercise.isCompound && <Chip tone="steel">Compound</Chip>}
            </button>
        </li>
    );
}
