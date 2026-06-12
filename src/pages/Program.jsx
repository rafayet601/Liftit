import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Calendar,
    Sparkles,
    Play,
    Plus,
    Repeat,
    Trash2,
    ChevronDown,
    Info,
    Minus,
} from 'lucide-react';
import clsx from 'clsx';
import { db } from '../data/db';
import { useActiveProgram } from '../data/DataProvider';
import { generateProgram, currentProgramWeek, phaseForWeek, scaleTargetsForWeek, GOALS } from '../engine/generator';
import ExercisePicker from '../components/workout/ExercisePicker';
import { Card, Chip, PageHeader, ProgressBar, Segmented, Sheet } from '../components/ui/Primitives';
import { useToast } from '../components/ui/Toast';
import { hapticMedium, hapticSuccess } from '../lib/platform';

/**
 * Program — view + edit the active block, or run the generation wizard.
 * Generation is the deterministic engine: instant and explainable.
 */
export default function Program() {
    const program = useActiveProgram();
    const [params, setParams] = useSearchParams();
    const wizardOpen = params.get('new') === '1' || !program;

    if (wizardOpen) {
        return (
            <Wizard
                hasExisting={Boolean(program)}
                onDone={() => setParams({})}
                onCancel={program ? () => setParams({}) : null}
            />
        );
    }
    return <ProgramView program={program} onNew={() => setParams({ new: '1' })} />;
}

/* ==================================================================
   Program view + editing
   ================================================================== */
function ProgramView({ program, onNew }) {
    const { showToast } = useToast();
    const week = currentProgramWeek(program);
    const [viewWeek, setViewWeek] = useState(week);
    const [editTarget, setEditTarget] = useState(null); // { dayNumber, index } | { dayNumber, add: true }
    const [showWhy, setShowWhy] = useState(false);
    const phase = phaseForWeek(viewWeek, program.durationWeeks);

    const saveDays = (mutator) => {
        const next = JSON.parse(JSON.stringify(program));
        mutator(next);
        db.programs.save(next);
    };

    const replaceExercise = (exercise) => {
        saveDays((p) => {
            const day = p.days.find((d) => d.dayNumber === editTarget.dayNumber);
            if (!day) return;
            if (editTarget.add) {
                day.exercises.push({
                    exerciseId: exercise.id,
                    order: day.exercises.length + 1,
                    targetSets: 3,
                    targetRepsMin: 8,
                    targetRepsMax: 12,
                    targetRpe: 8,
                    restSec: 120,
                });
            } else {
                day.exercises[editTarget.index].exerciseId = exercise.id;
            }
        });
        setEditTarget(null);
        showToast('Program updated.', 'success');
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                eyebrow="Plan"
                title={program.name}
                description={`${program.daysPerWeek} days/wk · ${program.durationWeeks} weeks · started ${new Date(program.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                icon={Calendar}
                actions={
                    <>
                        <button type="button" onClick={onNew} className="btn-outline">
                            <Sparkles className="h-4 w-4" /> New block
                        </button>
                        <Link to="/workout" className="btn-primary">
                            <Play className="h-4 w-4" /> Train
                        </Link>
                    </>
                }
            />

            {/* Phase timeline */}
            <Card>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="eyebrow mb-1">
                            Week {week} of {program.durationWeeks}
                        </div>
                        <h2 className="font-display text-xl font-bold text-white">
                            {phaseForWeek(week, program.durationWeeks).name} phase
                        </h2>
                        <p className="mt-1 text-sm text-ink-400">
                            {phaseForWeek(week, program.durationWeeks).blurb}
                        </p>
                    </div>
                    {program.rationale && (
                        <button type="button" onClick={() => setShowWhy(true)} className="btn-ghost text-xs">
                            <Info className="h-3.5 w-3.5" /> Why this program?
                        </button>
                    )}
                </div>
                <ProgressBar value={(week / program.durationWeeks) * 100} />
                <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
                    {Array.from({ length: program.durationWeeks }, (_, i) => i + 1).map((w) => {
                        const p = phaseForWeek(w, program.durationWeeks);
                        return (
                            <button
                                key={w}
                                type="button"
                                onClick={() => setViewWeek(w)}
                                className={clsx(
                                    'flex shrink-0 flex-col items-center rounded-xl border px-3 py-2 transition-colors',
                                    w === viewWeek
                                        ? 'border-accent/50 bg-accent/10 text-accent'
                                        : 'border-white/[0.07] bg-white/[0.02] text-ink-500 hover:text-white',
                                )}
                            >
                                <span className="text-xs font-bold">W{w}</span>
                                <span className="text-[9px] uppercase tracking-wider">{p.name.slice(0, 5)}</span>
                            </button>
                        );
                    })}
                </div>
            </Card>

            {/* Week-adjusted day cards */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold text-white">
                        Week {viewWeek} targets
                    </h2>
                    <Chip tone={phase.name === 'Deload' ? 'steel' : 'accent'}>{phase.name}</Chip>
                </div>
                {program.days.map((day) => (
                    <DayCard
                        key={day.dayNumber}
                        day={day}
                        viewWeek={viewWeek}
                        durationWeeks={program.durationWeeks}
                        onSwap={(index) => setEditTarget({ dayNumber: day.dayNumber, index })}
                        onAdd={() => setEditTarget({ dayNumber: day.dayNumber, add: true })}
                        onRemove={(index) =>
                            saveDays((p) => {
                                const d = p.days.find((x) => x.dayNumber === day.dayNumber);
                                d.exercises.splice(index, 1);
                                d.exercises.forEach((e, i) => {
                                    e.order = i + 1;
                                });
                            })
                        }
                        onAdjustSets={(index, delta) =>
                            saveDays((p) => {
                                const e = p.days.find((x) => x.dayNumber === day.dayNumber).exercises[index];
                                e.targetSets = Math.max(1, Math.min(8, e.targetSets + delta));
                            })
                        }
                    />
                ))}
            </div>

            {editTarget && (
                <ExercisePicker
                    title={editTarget.add ? 'Add exercise' : 'Swap exercise'}
                    onSelect={replaceExercise}
                    onClose={() => setEditTarget(null)}
                />
            )}
            {showWhy && (
                <Sheet open title="Why this program" onClose={() => setShowWhy(false)}>
                    <p className="text-sm leading-relaxed text-ink-300">{program.rationale}</p>
                </Sheet>
            )}
        </div>
    );
}

function DayCard({ day, viewWeek, durationWeeks, onSwap, onAdd, onRemove, onAdjustSets }) {
    const [open, setOpen] = useState(false);
    return (
        <Card padded={false} className="overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
                <div className="min-w-0">
                    <h3 className="truncate font-display text-base font-bold text-white">
                        Day {day.dayNumber} · {day.name}
                    </h3>
                    <p className="text-xs text-ink-500">
                        {day.exercises.length} exercises{day.focus ? ` · ${day.focus}` : ''}
                    </p>
                </div>
                <ChevronDown className={clsx('h-5 w-5 shrink-0 text-ink-500 transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="space-y-2 border-t border-white/[0.07] p-4">
                    {day.exercises.map((target, index) => {
                        const exercise = db.exercises.byId(target.exerciseId);
                        const scaled = scaleTargetsForWeek(target, viewWeek, durationWeeks);
                        return (
                            <div
                                key={`${target.exerciseId}-${index}`}
                                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-white">
                                        {exercise?.name ?? 'Exercise'}
                                    </p>
                                    <p className="text-xs tabular-nums text-ink-500">
                                        {scaled.targetSets} × {scaled.targetRepsMin}–{scaled.targetRepsMax} @ RPE{' '}
                                        {scaled.targetRpe} · rest {Math.round((target.restSec || 120) / 60)}m
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <button type="button" onClick={() => onAdjustSets(index, -1)} className="increment-btn h-8 w-8" aria-label="Fewer sets">
                                        <Minus className="h-3.5 w-3.5" />
                                    </button>
                                    <button type="button" onClick={() => onAdjustSets(index, 1)} className="increment-btn h-8 w-8" aria-label="More sets">
                                        <Plus className="h-3.5 w-3.5" />
                                    </button>
                                    <button type="button" onClick={() => onSwap(index)} className="increment-btn h-8 w-8" aria-label="Swap exercise">
                                        <Repeat className="h-3.5 w-3.5" />
                                    </button>
                                    <button type="button" onClick={() => onRemove(index)} className="increment-btn h-8 w-8 text-red-400" aria-label="Remove exercise">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    <button type="button" onClick={onAdd} className="btn-secondary w-full py-2 text-xs">
                        <Plus className="h-3.5 w-3.5" /> Add exercise
                    </button>
                </div>
            )}
        </Card>
    );
}

/* ==================================================================
   Wizard — instant deterministic generation
   ================================================================== */
function Wizard({ hasExisting, onDone, onCancel }) {
    const { showToast } = useToast();
    const settings = db.settings.get();
    const [config, setConfig] = useState({
        goal: settings.goal || 'hypertrophy',
        experience: settings.experience || 'intermediate',
        daysPerWeek: 4,
        durationWeeks: 6,
        equipment: 'full',
    });
    const preview = useMemo(() => generateProgram(config), [config]);

    const create = () => {
        hapticMedium();
        db.programs.save(preview);
        db.settings.update({ goal: config.goal, experience: config.experience });
        hapticSuccess();
        showToast('Program created — it adapts week by week.', 'success');
        onDone();
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                eyebrow="Plan"
                title={hasExisting ? 'New training block' : 'Create your program'}
                description="Answer four questions; the engine assembles a periodized block instantly."
                icon={Sparkles}
                actions={
                    onCancel && (
                        <button type="button" onClick={onCancel} className="btn-ghost">
                            Cancel
                        </button>
                    )
                }
            />

            <Card className="space-y-6">
                <Field label="Goal">
                    <Segmented
                        value={config.goal}
                        onChange={(goal) => setConfig((c) => ({ ...c, goal }))}
                        options={Object.entries(GOALS).map(([value, g]) => ({ value, label: g.label }))}
                    />
                </Field>
                <Field label="Experience">
                    <Segmented
                        value={config.experience}
                        onChange={(experience) => setConfig((c) => ({ ...c, experience }))}
                        options={[
                            { value: 'beginner', label: 'Beginner' },
                            { value: 'intermediate', label: 'Intermediate' },
                            { value: 'advanced', label: 'Advanced' },
                        ]}
                    />
                </Field>
                <Field label="Days per week">
                    <Segmented
                        value={config.daysPerWeek}
                        onChange={(daysPerWeek) => setConfig((c) => ({ ...c, daysPerWeek }))}
                        options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
                    />
                </Field>
                <Field label="Equipment">
                    <Segmented
                        value={config.equipment}
                        onChange={(equipment) => setConfig((c) => ({ ...c, equipment }))}
                        options={[
                            { value: 'full', label: 'Full gym' },
                            { value: 'home-dumbbell', label: 'Dumbbells' },
                            { value: 'minimal', label: 'Minimal' },
                        ]}
                    />
                </Field>
            </Card>

            {/* Live preview */}
            <Card className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="eyebrow mb-1">Preview</div>
                        <h2 className="font-display text-lg font-bold text-white">{preview.name}</h2>
                    </div>
                    <Chip tone="accent">{preview.durationWeeks} weeks</Chip>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                    {preview.days.map((day) => (
                        <div key={day.dayNumber} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                            <p className="mb-1.5 text-sm font-bold text-white">
                                Day {day.dayNumber} · {day.name}
                            </p>
                            <ul className="space-y-0.5 text-xs text-ink-400">
                                {day.exercises.map((e, i) => (
                                    <li key={i} className="truncate">
                                        {db.exercises.byId(e.exerciseId)?.name} — {e.targetSets}×
                                        {e.targetRepsMin}–{e.targetRepsMax}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                <p className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-xs leading-relaxed text-ink-400">
                    {preview.rationale}
                </p>
                <button type="button" onClick={create} className="btn-primary btn-lg w-full">
                    <Sparkles className="h-5 w-5" />
                    {hasExisting ? 'Replace active program' : 'Start this program'}
                </button>
                {hasExisting && (
                    <p className="text-center text-xs text-ink-500">
                        Your workout history is never affected by switching programs.
                    </p>
                )}
            </Card>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <div className="eyebrow mb-2">{label}</div>
            {children}
        </div>
    );
}
