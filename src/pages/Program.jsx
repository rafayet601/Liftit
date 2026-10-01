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
    Share2,
    Download,
} from 'lucide-react';
import clsx from 'clsx';
import { db } from '../data/db';
import { useActiveProgram } from '../data/DataProvider';
import { generateProgram, currentProgramWeek, phaseForWeek, scaleTargetsForWeek, GOALS } from '../engine/generator';
import { GLUTE_GOAL, GLUTE_INTRO, LOWER_DAY_OPTIONS, trainingDaysForGoal, updateTrainingConfig } from '../engine/gluteFocused';
import GluteGuide from '../components/program/GluteGuide';
import { buildShareUrl, programFromFragment } from '../data/shareLinks';
import ExercisePicker from '../components/workout/ExercisePicker';
import { Card, Chip, PageHeader, ProgressBar, Segmented, Sheet } from '../components/ui/Primitives';
import Glass from '../components/ui/Glass';
import LinearGradient from '../components/ui/LinearGradient';
import { useToast } from '../components/ui/Toast';
import { hapticMedium, hapticSuccess } from '../lib/platform';

/**
 * Program — view + edit the active block, or run the generation wizard.
 * Generation is the deterministic engine: instant and explainable.
 */
export default function Program() {
    const program = useActiveProgram();
    const [params, setParams] = useSearchParams();
    const shareFragment = params.get('program');
    const wizardOpen = (params.get('new') === '1' || !program) && !shareFragment;

    if (shareFragment) {
        return (
            <ImportShare
                fragment={shareFragment}
                onDone={() => setParams({})}
                onCancel={() => setParams({})}
            />
        );
    }
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
    const phase = phaseForWeek(viewWeek, program.durationWeeks, program.goal);

    const share = async () => {
        try {
            await navigator.clipboard.writeText(buildShareUrl(program));
            hapticSuccess();
            showToast('Share link copied — anyone can import this program.', 'success');
        } catch {
            showToast('Could not copy the share link.', 'error');
        }
    };

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
                day.exercises[editTarget.index].notes = '';
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
                        <button type="button" onClick={share} className="btn-outline">
                            <Share2 className="h-4 w-4" /> Share
                        </button>
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
            <Card className="border-accent/20">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="eyebrow mb-1 flex items-center gap-2">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" style={{ boxShadow: '0 0 6px rgba(139,92,246,0.8)' }} />
                            Week {week} of {program.durationWeeks}
                        </div>
                        <h2 className="font-display text-2xl font-bold text-white">
                            <span className="text-gradient-purple">{phaseForWeek(week, program.durationWeeks, program.goal).name}</span> phase
                        </h2>
                        <p className="mt-1 text-sm text-ink-400">
                            {phaseForWeek(week, program.durationWeeks, program.goal).blurb}
                        </p>
                    </div>
                    {program.rationale && (
                        <button type="button" onClick={() => setShowWhy(true)} className="btn-ghost text-xs">
                            <Info className="h-3.5 w-3.5" /> Why this program?
                        </button>
                    )}
                </div>
                <ProgressBar value={(week / program.durationWeeks) * 100} />
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {Array.from({ length: program.durationWeeks }, (_, i) => i + 1).map((w) => {
                        const p = phaseForWeek(w, program.durationWeeks, program.goal);
                        return (
                            <button
                                key={w}
                                type="button"
                                aria-pressed={w === viewWeek}
                                title={`Week ${w} · ${p.name}`}
                                onClick={() => setViewWeek(w)}
                                className={clsx(
                                    'flex min-w-0 flex-col items-center rounded-xl border px-2 py-2 transition-all duration-200',
                                    w === viewWeek
                                        ? 'border-accent/50 bg-accent/10 text-accent'
                                        : 'border-white/[0.07] bg-white/[0.02] text-ink-500 hover:text-white hover:border-white/20',
                                    w === week && w !== viewWeek && 'border-white/20',
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
                    <span className={(() => {
                        const n = phase.name.toLowerCase();
                        if (n.includes('deload')) return 'phase-badge phase-badge-deload';
                        if (n.includes('peak')) return 'phase-badge phase-badge-peaking';
                        if (n.includes('intensif')) return 'phase-badge phase-badge-intensification';
                        return 'phase-badge phase-badge-accumulation';
                    })()}>{phase.name}</span>
                </div>
                {program.days.map((day) => (
                    <DayCard
                        key={day.dayNumber}
                        day={day}
                        viewWeek={viewWeek}
                        durationWeeks={program.durationWeeks}
                        goal={program.goal}
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
                    <GluteGuide program={program} />
                    <p className="text-sm leading-relaxed text-ink-300">{program.rationale}</p>
                </Sheet>
            )}
        </div>
    );
}

function DayCard({ day, viewWeek, durationWeeks, goal, onSwap, onAdd, onRemove, onAdjustSets }) {
    const [open, setOpen] = useState(false);
    return (
        <Card padded={false} className="overflow-hidden holo-card">
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
                        const scaled = scaleTargetsForWeek(target, viewWeek, durationWeeks, goal);
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
                                        {scaled.targetRpe} · rest {target.restSec || 120}s
                                    </p>
                                    {target.notes && <p className="mt-1 text-xs leading-relaxed text-ink-400">{target.notes}</p>}
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
   Share-link import — preview before commit
   ================================================================== */
function ImportShare({ fragment, onDone, onCancel }) {
    const { showToast } = useToast();
    const result = useMemo(() => {
        try {
            return { program: programFromFragment(fragment), error: null };
        } catch (e) {
            return { program: null, error: e };
        }
    }, [fragment]);

    const { program, error } = result;

    const confirm = () => {
        hapticMedium();
        db.programs.save(program);
        hapticSuccess();
        showToast(`Imported "${program.name}" — it is not active yet.`, 'success');
        onDone();
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                eyebrow="Plan"
                title="Import shared program"
                description="Review the routine before it touches your data."
                icon={Download}
                actions={
                    <button type="button" onClick={onCancel} className="btn-ghost">
                        Cancel
                    </button>
                }
            />
            <Card className="space-y-5 glass-card-glow border-accent/20">
                {error ? (
                    <div className="space-y-4">
                        <Chip tone="danger">Invalid link</Chip>
                        <p className="text-sm text-ink-300">
                            {error?.message ?? 'This share link could not be read.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="eyebrow mb-1">Preview</div>
                                <h2 className="font-display text-xl font-bold text-white">
                                    {program.name}
                                </h2>
                            </div>
                            <div className="flex gap-2">
                                <Chip tone="accent">{program.daysPerWeek} days/wk</Chip>
                                <Chip>{program.durationWeeks} weeks</Chip>
                                <Chip>{GOALS[program.goal]?.label || program.goal}</Chip>
                            </div>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                            {program.days.map((day) => (
                                <div
                                    key={day.dayNumber}
                                    className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 holo-card"
                                >
                                    <p className="mb-1.5 text-sm font-bold text-white">
                                        Day {day.dayNumber} · {day.name}
                                    </p>
                                    <p className="text-xs text-ink-400">
                                        {day.exercises.length} exercises
                                        {day.isRestDay ? ' · rest day' : ''}
                                    </p>
                                    <ul className="mt-1 space-y-0.5 text-xs text-ink-500">
                                        {day.exercises.slice(0, 6).map((e, i) => (
                                            <li key={i} className="truncate">
                                                {db.exercises.byId(e.exerciseId)?.name ?? 'Exercise'}
                                                {' — '}
                                                {e.targetSets}×{e.targetRepsMin}–{e.targetRepsMax}
                                            </li>
                                        ))}
                                        {day.exercises.length > 6 && (
                                            <li>+{day.exercises.length - 6} more…</li>
                                        )}
                                    </ul>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-ink-500">
                            Importing never changes your workout history. The program is added
                            inactive — switch to it from your program list.
                        </p>
                        <div className="flex gap-3">
                            <button type="button" onClick={onCancel} className="btn-outline flex-1">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirm}
                                className="btn-primary btn-lg flex-1"
                            >
                                <Download className="h-5 w-5" /> Import program
                            </button>
                        </div>
                    </>
                )}
            </Card>
        </div>
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
        daysPerWeek: settings.goal === GLUTE_GOAL ? 5 : 4,
        durationWeeks: settings.goal === GLUTE_GOAL ? 8 : 6,
        equipment: 'full',
        lowerBodyDays: 3,
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
                description="Choose your goal, schedule and equipment. Preview every session before you start."
                icon={Sparkles}
                actions={
                    onCancel && (
                        <button type="button" onClick={onCancel} className="btn-ghost">
                            Cancel
                        </button>
                    )
                }
            />

            <Card className="space-y-6 glass-card-glow border-accent/30 shadow-glass-glow-purple">
                <Field label="Goal">
                    <Segmented
                        label="Main goal"
                        value={config.goal}
                        onChange={(goal) => setConfig((c) => updateTrainingConfig(c, { goal }))}
                        options={Object.entries(GOALS).map(([value, g]) => ({ value, label: g.label }))}
                    />
                    {config.goal === GLUTE_GOAL && <p className="mt-3 text-sm leading-relaxed text-ink-400">{GLUTE_INTRO}</p>}
                </Field>
                {config.goal === GLUTE_GOAL && <Field label="Lower-body days">
                    <Segmented label="Lower-body days" value={config.lowerBodyDays} onChange={lowerBodyDays => setConfig(c => updateTrainingConfig(c, { lowerBodyDays }))} options={LOWER_DAY_OPTIONS} />
                    <p className="mt-2 text-xs leading-relaxed text-ink-400">Days per week includes every session. Choose {config.lowerBodyDays + 2} days for two dedicated upper-body days; shorter schedules mix upper-body work into lower sessions.</p>
                </Field>}
                <Field label="Experience">
                    <Segmented
                        label="Experience"
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
                        label="Days per week"
                        value={config.daysPerWeek}
                        onChange={(daysPerWeek) => setConfig((c) => ({ ...c, daysPerWeek }))}
                        options={trainingDaysForGoal(config.goal, config.lowerBodyDays).map((n) => ({ value: n, label: String(n) }))}
                    />
                </Field>
                <Field label="Equipment">
                    <Segmented
                        label="Equipment"
                        value={config.equipment}
                        onChange={(equipment) => setConfig((c) => ({ ...c, equipment }))}
                        options={[
                            { value: 'full', label: 'Full gym' },
                            { value: 'home-dumbbell', label: 'Dumbbells' },
                            { value: 'minimal', label: 'Minimal' },
                        ]}
                    />
                </Field>
                {config.goal === GLUTE_GOAL && <Field label="Block length">
                    <Segmented label="Block length" value={config.durationWeeks} onChange={durationWeeks => setConfig(c => ({ ...c, durationWeeks }))} options={[6, 8, 12].map(value => ({ value, label: `${value} weeks` }))} />
                </Field>}
            </Card>

            {/* Live preview */}
            <Card className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="eyebrow mb-1">Preview</div>
                        <h2 className="font-display text-lg font-bold text-white">{preview.name}</h2>
                        {config.goal === GLUTE_GOAL && <p className="mt-1 text-xs text-ink-400">Base working sets · easier effort in weeks 1–2</p>}
                    </div>
                    <Chip tone="accent">{preview.durationWeeks} weeks</Chip>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                    {preview.days.map((day) => (
                        <div key={day.dayNumber} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 holo-card">
                            <p className="mb-1.5 text-sm font-bold text-white">
                                Day {day.dayNumber} · {day.name}
                            </p>
                            <p className="mb-2 text-xs text-ink-500">{day.focus}</p>
                            <ul className="space-y-0.5 text-xs text-ink-400">
                                {day.exercises.map((e, i) => (
                                    <li key={i} className="flex items-start justify-between gap-2 py-0.5">
                                        <span className="min-w-0">{db.exercises.byId(e.exerciseId)?.name}</span>
                                        <span className="shrink-0 tabular-nums">{e.targetSets}×{e.targetRepsMin}–{e.targetRepsMax}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                <GluteGuide program={preview} />
                {config.goal === GLUTE_GOAL ? <details className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-xs leading-relaxed text-ink-400"><summary className="cursor-pointer py-1 font-semibold text-ink-300">Why these exercises and targets?</summary><p className="mt-2">{preview.rationale}</p></details> : <p className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-xs leading-relaxed text-ink-400">{preview.rationale}</p>}
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
