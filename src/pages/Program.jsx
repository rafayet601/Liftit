import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Check,
    ChevronRight,
    ChevronLeft,
    Sparkles,
    Calendar,
    Target,
    Dumbbell,
    TrendingUp,
    Play,
} from 'lucide-react';
import clsx from 'clsx';
import { loadData, saveData } from '../lib/store';
import { generateProgram } from '../services/program.service';
import { useToast } from '../components/ui/Toast';
import {
    Card,
    PageHeader,
    Chip,
    ProgressBar,
    LoadingRing,
    EmptyState,
} from '../components/ui/Primitives';
import { hapticMedium, hapticSuccess } from '../lib/platform';

const MESO_PHASES = [
    { name: 'Accumulation', weeks: 2, tone: 'bg-accent/80', desc: 'High volume, moderate intensity.' },
    { name: 'Intensification', weeks: 2, tone: 'bg-amber-400/80', desc: 'Moderate volume, rising intensity.' },
    { name: 'Realization', weeks: 1, tone: 'bg-orange-400/80', desc: 'Low volume, peak intensity.' },
    { name: 'Deload', weeks: 1, tone: 'bg-sky-400/80', desc: 'Back-off week for recovery.' },
];

import { SAMPLE_WEEK } from '../services/demoData';

export default function Program() {
    const [mode, setMode] = useState('view'); // 'view' | 'wizard'
    const [meso, setMeso] = useState(null);
    const [currentWeek, setCurrentWeek] = useState(1);
    const [wizardStep, setWizardStep] = useState(1);
    const [config, setConfig] = useState({
        experience: 'Intermediate',
        days: 4,
        focus: 'Hypertrophy',
    });
    const [generating, setGenerating] = useState(false);
    const navigate = useNavigate();
    const { showToast } = useToast();

    useEffect(() => {
        const data = loadData();
        if (data.currentMesocycle?.active) {
            setMeso(data.currentMesocycle);
            setCurrentWeek(data.currentMesocycle.currentWeek || 1);
            setMode('view');
        } else {
            setMode('wizard');
            setWizardStep(1);
        }
    }, []);

    const currentPhase = useMemo(() => {
        let count = 0;
        for (const p of MESO_PHASES) {
            count += p.weeks;
            if (currentWeek <= count) return p;
        }
        return MESO_PHASES[MESO_PHASES.length - 1];
    }, [currentWeek]);

    const planDays = useMemo(() => {
        if (!meso) return [];
        const days = meso.programDays || meso.aiProgram?.programDays;
        if (days && days.length > 0) {
            const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            return dayNames.map((dayName, idx) => {
                const dayData = days.find(d => d.dayOfWeek === idx + 1) || days[idx];
                if (dayData) {
                    return {
                        day: dayName,
                        focus: dayData.name || 'Training',
                        exercises: dayData.exercises?.map(ex => ex.exercise?.name || ex.name).filter(Boolean) || []
                    };
                }
                return {
                    day: dayName,
                    focus: 'Rest',
                    exercises: []
                };
            });
        }
        return SAMPLE_WEEK;
    }, [meso]);

    const handleGenerate = async () => {
        hapticMedium();
        setGenerating(true);
        const split = config.days === 3 ? 'Full Body' : config.days >= 5 ? 'PPL' : 'Upper / Lower';
        let isOffline = false;
        let programPayload = null;
        try {
            const res = await generateProgram({
                experience: config.experience,
                days: config.days,
                focus: config.focus,
            });
            programPayload = res.data;
            isOffline = !!res.fromCache;
        } catch (err) {
            console.warn('[Program] generate fell back to offline:', err);
            isOffline = true;
        }

        const newMeso = {
            active: true,
            name: `${config.focus} Block 1`,
            weeks: 6,
            currentWeek: 1,
            daysPerWeek: config.days,
            focus: config.focus,
            startDate: new Date().toISOString(),
            split,
            phases: MESO_PHASES,
            aiGenerated: true,
            aiProgram: programPayload,
        };
        const current = loadData();
        saveData({ ...current, currentMesocycle: newMeso });
        setMeso(newMeso);
        setCurrentWeek(1);
        setMode('view');
        setGenerating(false);
        hapticSuccess();
        showToast(
            isOffline ? 'Program created (offline template)' : 'Program generated',
            isOffline ? 'warning' : 'success',
        );
    };

    if (mode === 'wizard') {
        return (
            <Wizard
                step={wizardStep}
                setStep={setWizardStep}
                config={config}
                setConfig={setConfig}
                generating={generating}
                onGenerate={handleGenerate}
                onCancel={() => (meso ? setMode('view') : navigate('/'))}
            />
        );
    }

    if (!meso) {
        return (
            <EmptyState
                icon={Calendar}
                title="No active program"
                description="Generate a tailored mesocycle in about a minute."
                action={
                    <button type="button" onClick={() => setMode('wizard')} className="btn-primary">
                        <Sparkles className="h-4 w-4" /> Generate Program
                    </button>
                }
            />
        );
    }

    const totalWeeks = meso.weeks || 6;
    const weekPct = (currentWeek / totalWeeks) * 100;

    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                eyebrow="Program"
                title={meso.name}
                description={`${meso.split} · ${meso.daysPerWeek} days/wk · ${totalWeeks} weeks`}
                icon={Target}
                actions={
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                setWizardStep(1);
                                setMode('wizard');
                            }}
                            className="btn-outline"
                        >
                            <Sparkles className="h-4 w-4" /> New
                        </button>
                        <Link to="/tracker" className="btn-primary">
                            <Play className="h-4 w-4" /> Start today
                        </Link>
                    </>
                }
            />

            {/* Phase timeline */}
            <Card>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="eyebrow mb-1">Mesocycle phases</div>
                        <h2 className="text-xl font-bold tracking-tight text-white">
                            {currentPhase.name} phase
                        </h2>
                        <p className="mt-1 text-sm text-zinc-400">{currentPhase.desc}</p>
                    </div>
                    <Chip tone="accent">
                        Week {currentWeek} / {totalWeeks}
                    </Chip>
                </div>

                <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
                    {MESO_PHASES.map((p, i) => {
                        const isCurrent = currentPhase.name === p.name;
                        return (
                            <div
                                key={p.name}
                                className={clsx(
                                    'h-full transition-all duration-500',
                                    isCurrent ? p.tone : 'bg-white/5',
                                    i !== MESO_PHASES.length - 1 && 'border-r border-ink-950',
                                )}
                                style={{ flex: p.weeks }}
                                aria-label={p.name}
                            />
                        );
                    })}
                </div>
                <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {MESO_PHASES.map((p) => (
                        <span
                            key={p.name}
                            className={clsx(currentPhase.name === p.name && 'text-accent')}
                        >
                            {p.name}
                        </span>
                    ))}
                </div>

                <div className="mt-6">
                    <ProgressBar value={weekPct} />
                </div>
            </Card>

            {/* Week selector */}
            <Card>
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <div className="eyebrow mb-1">Week</div>
                        <h3 className="text-lg font-bold tracking-tight text-white">
                            Plan your block
                        </h3>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setCurrentWeek((w) => Math.max(1, w - 1))}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-white disabled:opacity-40"
                            disabled={currentWeek <= 1}
                            aria-label="Previous week"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentWeek((w) => Math.min(totalWeeks, w + 1))}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-white disabled:opacity-40"
                            disabled={currentWeek >= totalWeeks}
                            aria-label="Next week"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                    {Array.from({ length: totalWeeks }).map((_, i) => {
                        const n = i + 1;
                        const active = n === currentWeek;
                        return (
                            <button
                                type="button"
                                key={n}
                                onClick={() => setCurrentWeek(n)}
                                className={clsx(
                                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-sm font-bold transition-all',
                                    active
                                        ? 'border-accent/40 bg-accent/10 text-accent shadow-glow-sm'
                                        : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-white',
                                )}
                            >
                                W{n}
                            </button>
                        );
                    })}
                </div>
            </Card>

            {/* Week calendar */}
            <Card>
                <div className="mb-5 flex items-center justify-between">
                    <div>
                        <div className="eyebrow mb-1">This week · preview</div>
                        <h3 className="text-lg font-bold tracking-tight text-white">
                            Daily plan
                        </h3>
                    </div>
                    <Chip>{meso.daysPerWeek} sessions</Chip>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {planDays.map((d) => {
                        const today = new Date().getDay();
                        const dayIdx = [
                            'Sunday',
                            'Monday',
                            'Tuesday',
                            'Wednesday',
                            'Thursday',
                            'Friday',
                            'Saturday',
                        ].indexOf(d.day);
                        const isToday = dayIdx === today;
                        const isRest = d.focus === 'Rest';
                        return (
                            <div
                                key={d.day}
                                className={clsx(
                                    'relative rounded-2xl border p-4 transition-all',
                                    isToday
                                        ? 'border-accent/40 bg-accent/5'
                                        : 'border-white/5 bg-white/[0.02]',
                                    isRest && 'opacity-75',
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="eyebrow">{d.day}</span>
                                            {isToday && <Chip tone="accent">Today</Chip>}
                                        </div>
                                        <h4 className="mt-1 text-lg font-bold tracking-tight text-white">
                                            {d.focus}
                                        </h4>
                                    </div>
                                    {!isRest && isToday && (
                                        <Link to="/tracker" className="btn-primary">
                                            <Play className="h-3.5 w-3.5" /> Start
                                        </Link>
                                    )}
                                </div>
                                {d.exercises.length > 0 ? (
                                    <ul className="mt-3 space-y-1.5 text-sm text-zinc-300">
                                        {d.exercises.map((e, i) => (
                                            <li
                                                key={i}
                                                className="flex items-center gap-2 text-[13px]"
                                            >
                                                <Dumbbell className="h-3.5 w-3.5 text-zinc-500" />
                                                {e}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-3 text-sm text-zinc-500">
                                        Recovery · walk · mobility
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            <Card className="relative overflow-hidden">
                <div
                    aria-hidden
                    className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-accent/10 blur-3xl"
                />
                <div className="relative flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="eyebrow mb-1 flex items-center gap-2">
                            <TrendingUp className="h-3 w-3 text-accent" /> Guidance
                        </div>
                        <h3 className="text-xl font-bold tracking-tight text-white">
                            Focus for {currentPhase.name.toLowerCase()}
                        </h3>
                        <p className="mt-1 max-w-xl text-sm text-zinc-400">
                            {currentPhase.desc} Your AI coach will auto-adjust loads based on
                            your RPE logs at the end of each week.
                        </p>
                    </div>
                    <Link to="/tracker" className="btn-primary btn-lg shrink-0">
                        <Play className="h-4 w-4" /> Go train
                    </Link>
                </div>
            </Card>
        </div>
    );
}

/* -------- Wizard -------- */

function Wizard({ step, setStep, config, setConfig, generating, onGenerate, onCancel }) {
    const pct = ((step - 1) / 3) * 100;

    return (
        <div className="mx-auto max-w-2xl animate-fade-in">
            <PageHeader
                eyebrow={`Step ${step} of 3`}
                title="Generate a program"
                description="Three questions. We'll handle the periodization."
                icon={Sparkles}
                actions={
                    <button type="button" onClick={onCancel} className="btn-ghost">
                        Cancel
                    </button>
                }
            />

            <Card className="space-y-7">
                <ProgressBar value={pct} />

                {step === 1 && (
                    <Step
                        title="Experience"
                        description="Be honest — it calibrates load progression."
                    >
                        <div className="space-y-2.5">
                            {[
                                { v: 'Beginner', d: '< 1 year of consistent training' },
                                { v: 'Intermediate', d: '1–3 years of consistent training' },
                                { v: 'Advanced', d: '3+ years of consistent training' },
                            ].map((x) => (
                                <WizardOption
                                    key={x.v}
                                    active={config.experience === x.v}
                                    onClick={() => setConfig({ ...config, experience: x.v })}
                                    title={x.v}
                                    description={x.d}
                                />
                            ))}
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button type="button" onClick={() => setStep(2)} className="btn-primary">
                                Next <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </Step>
                )}

                {step === 2 && (
                    <Step
                        title="Frequency"
                        description="How many lifting sessions per week?"
                    >
                        <div className="grid grid-cols-4 gap-3">
                            {[3, 4, 5, 6].map((d) => {
                                const active = config.days === d;
                                return (
                                    <button
                                        type="button"
                                        key={d}
                                        onClick={() => setConfig({ ...config, days: d })}
                                        className={clsx(
                                            'relative flex h-20 flex-col items-center justify-center rounded-2xl border text-xl font-extrabold transition-all',
                                            active
                                                ? 'border-accent/40 bg-accent/10 text-accent shadow-glow-sm'
                                                : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-white',
                                        )}
                                    >
                                        {d}
                                        <span className="mt-1 text-[10px] font-bold uppercase tracking-widest">
                                            days
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="mt-3 text-center text-sm text-zinc-500">
                            {config.days === 3 && 'Full-body split suggested'}
                            {config.days === 4 && 'Upper / Lower split suggested'}
                            {config.days >= 5 && 'Push / Pull / Legs suggested'}
                        </p>
                        <div className="mt-6 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="btn-secondary flex-1"
                            >
                                <ChevronLeft className="h-4 w-4" /> Back
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep(3)}
                                className="btn-primary flex-1"
                            >
                                Next <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </Step>
                )}

                {step === 3 && (
                    <Step
                        title="Primary goal"
                        description="We'll pick reps, rest, and progression to match."
                    >
                        <div className="space-y-2.5">
                            {[
                                { v: 'Hypertrophy', d: 'Maximize muscle · moderate reps, short rests' },
                                { v: 'Strength', d: 'Heavier loads · lower reps, longer rests' },
                                { v: 'Endurance', d: 'High reps · conditioning bias' },
                            ].map((x) => (
                                <WizardOption
                                    key={x.v}
                                    active={config.focus === x.v}
                                    onClick={() => setConfig({ ...config, focus: x.v })}
                                    title={x.v}
                                    description={x.d}
                                />
                            ))}
                        </div>

                        <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                            <div className="eyebrow mb-2">Summary</div>
                            <dl className="grid grid-cols-2 gap-y-2 text-sm text-zinc-300 md:grid-cols-4">
                                <SummaryItem label="Level" value={config.experience} />
                                <SummaryItem label="Days/wk" value={String(config.days)} />
                                <SummaryItem label="Focus" value={config.focus} />
                                <SummaryItem label="Duration" value="6 weeks" />
                            </dl>
                        </div>

                        <div className="mt-6 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setStep(2)}
                                className="btn-secondary flex-1"
                                disabled={generating}
                            >
                                <ChevronLeft className="h-4 w-4" /> Back
                            </button>
                            <button
                                type="button"
                                onClick={onGenerate}
                                disabled={generating}
                                className="btn-primary flex-1"
                            >
                                {generating ? (
                                    <>
                                        <LoadingRing size={14} /> Generating…
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4" /> Generate program
                                    </>
                                )}
                            </button>
                        </div>
                    </Step>
                )}
            </Card>
        </div>
    );
}

function Step({ title, description, children }) {
    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
                <p className="mt-1 text-sm text-zinc-400">{description}</p>
            </div>
            {children}
        </div>
    );
}

function WizardOption({ active, onClick, title, description }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={clsx(
                'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all',
                active
                    ? 'border-accent/40 bg-accent/5'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20',
            )}
            aria-pressed={active}
        >
            <div
                className={clsx(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    active ? 'border-accent bg-accent' : 'border-white/20',
                )}
            >
                {active && <Check className="h-3 w-3 text-ink-950" strokeWidth={3} />}
            </div>
            <div>
                <p className={clsx('font-semibold', active ? 'text-white' : 'text-zinc-300')}>
                    {title}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
            </div>
        </button>
    );
}

function SummaryItem({ label, value }) {
    return (
        <div>
            <dt className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {label}
            </dt>
            <dd className="font-semibold text-white">{value}</dd>
        </div>
    );
}
