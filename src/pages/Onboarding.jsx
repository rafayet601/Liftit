import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Dumbbell, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { db } from '../data/db';
import { generateProgram, GOALS } from '../engine/generator';
import { GLUTE_GOAL, GLUTE_INTRO, LOWER_DAY_OPTIONS, trainingDaysForGoal, updateTrainingConfig } from '../engine/gluteFocused';
import { Segmented, Card } from '../components/ui/Primitives';
import { hapticSuccess } from '../lib/platform';
import Glass from '../components/ui/Glass';

/**
 * First-run flow: four quick questions → optional instant program.
 * Everything is stored on-device; signing in is offered later for sync.
 */
const STEPS = ['name', 'units', 'training', 'program'];

export default function Onboarding() {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [form, setForm] = useState({
        name: '',
        units: 'kg',
        experience: 'intermediate',
        goal: 'hypertrophy',
        daysPerWeek: 4,
        lowerBodyDays: 3,
    });

    const finish = (withProgram) => {
        db.settings.update({
            name: form.name.trim(),
            units: form.units,
            experience: form.experience,
            goal: form.goal,
            onboarded: true,
        });
        if (withProgram) {
            db.programs.save(
                generateProgram({
                    goal: form.goal,
                    experience: form.experience,
                    daysPerWeek: form.daysPerWeek,
                    lowerBodyDays: form.lowerBodyDays,
                    durationWeeks: form.goal === GLUTE_GOAL ? 8 : 6,
                }),
            );
        }
        hapticSuccess();
        navigate(withProgram ? '/program' : '/', { replace: true });
    };

    const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
    const back = () => setStep((s) => Math.max(s - 1, 0));

    return (
        <div className="onboarding-layout safe-top safe-bottom">
            <div className="onboarding-story">
                <div className="flex items-center gap-3 text-xl font-bold text-white"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-ink-950"><Dumbbell className="h-6 w-6" /></span>TRAIN WITH INTENT</div>
                <div className="eyebrow mt-16">Built for your next best</div>
                <h2>Small steps.<br /><span>Stronger you.</span></h2>
                <p>A clear plan. A simple training log. Progress you can see. Make every session count, at your own pace.</p>
                <div className="mt-10 flex items-center gap-3 text-sm text-ink-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />Works offline · Your data stays yours</div>
            </div>
            <div className="onboarding-step">
                <div className="mb-8 flex items-center gap-2.5"><Dumbbell className="h-6 w-6 text-accent" /><span className="font-display text-xl font-bold text-white">Liftit.</span></div>
                <div className="onboarding-progress">
                    <span>Step {step + 1} of {STEPS.length}</span>
                    <div className="flex gap-1.5" aria-hidden="true">{STEPS.map((s, i) => <span key={s} className={`h-1 w-8 rounded-full ${i <= step ? 'bg-accent' : 'bg-white/10'}`} />)}</div>
                </div>
                <div className="animate-fade-in" key={step}>
                    {step === 0 && (
                        <StepShell
                            title="What should we call you?"
                            subtitle="Everything stays on this device until you choose to sync."
                        >
                            <input
                                autoFocus
                                autoComplete="given-name"
                                maxLength={60}
                                type="text"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && next()}
                                placeholder="Your name"
                                className="input text-lg"
                                aria-label="Your name"
                            />
                        </StepShell>
                    )}

                    {step === 1 && (
                        <StepShell title="How do you load the bar?" subtitle="You can switch anytime in Settings.">
                            <Segmented
                                label="Weight unit"
                                value={form.units}
                                onChange={(units) => setForm((f) => ({ ...f, units }))}
                                options={[
                                    { value: 'kg', label: 'Kilograms' },
                                    { value: 'lbs', label: 'Pounds' },
                                ]}
                            />
                        </StepShell>
                    )}

                    {step === 2 && (
                        <StepShell
                            title="Your training, roughly."
                            subtitle="This seeds your first program — the engine adapts from your logs after that."
                        >
                            <div className="space-y-5">
                                <div>
                                    <div className="eyebrow mb-2">Experience</div>
                                    <Segmented
                                        label="Experience"
                                value={form.experience}
                                        onChange={(experience) => setForm((f) => ({ ...f, experience }))}
                                        options={[
                                            { value: 'beginner', label: 'Beginner' },
                                            { value: 'intermediate', label: 'Intermediate' },
                                            { value: 'advanced', label: 'Advanced' },
                                        ]}
                                    />
                                </div>
                                <div>
                                    <div className="eyebrow mb-2">Main goal</div>
                                    <Segmented
                                        label="Main goal"
                                value={form.goal}
                                        onChange={(goal) => setForm((f) => updateTrainingConfig(f, { goal }))}
                                        options={Object.entries(GOALS).map(([value, g]) => ({
                                            value,
                                            label: g.label,
                                        }))}
                                    />
                                    {form.goal === GLUTE_GOAL && <p className="mt-3 text-sm leading-relaxed text-ink-400">{GLUTE_INTRO}</p>}
                                </div>
                                {form.goal === GLUTE_GOAL && <div>
                                    <div className="eyebrow mb-2">Lower-body days</div>
                                    <Segmented label="Lower-body days" value={form.lowerBodyDays} onChange={lowerBodyDays => setForm(f => updateTrainingConfig(f, { lowerBodyDays }))} options={LOWER_DAY_OPTIONS} />
                                </div>}
                                <div>
                                    <div className="eyebrow mb-2">Days per week</div>
                                    <Segmented
                                        label="Days per week"
                                value={form.daysPerWeek}
                                        onChange={(daysPerWeek) => setForm((f) => ({ ...f, daysPerWeek }))}
                                        options={trainingDaysForGoal(form.goal, form.lowerBodyDays).map((n) => ({ value: n, label: String(n) }))}
                                    />
                                </div>
                            </div>
                        </StepShell>
                    )}

                    {step === 3 && (
                        <StepShell
                            title="Want a program built now?"
                            subtitle={`A ${form.daysPerWeek}-day ${GOALS[form.goal].label.toLowerCase()} block over ${form.goal === GLUTE_GOAL ? 8 : 6} weeks. ${form.goal === GLUTE_GOAL ? `${form.lowerBodyDays} lower-body days with upper-body training included. ` : ''}You can also start freestyle and add a program later.`}
                        >
                            <div className="space-y-2.5">
                                <button type="button" onClick={() => finish(true)} className="btn-primary btn-lg w-full">
                                    <Sparkles className="h-5 w-5" /> Build my program
                                </button>
                                <button type="button" onClick={() => finish(false)} className="btn-secondary w-full">
                                    Skip — I'll log freestyle
                                </button>
                            </div>
                        </StepShell>
                    )}
                </div>

                {/* Nav */}
                <div className="onboarding-footer">
                    {step > 0 ? (
                        <button type="button" onClick={back} className="btn-ghost">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </button>
                    ) : (
                        <Link to="/login" className="py-3 text-sm text-ink-400 hover:text-white">
                            Have an account? Sign in
                        </Link>
                    )}
                    {step < STEPS.length - 1 && (
                        <button type="button" onClick={next} className="btn-primary">
                            Continue <ArrowRight className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

        </div>
    );
}

function StepShell({ title, subtitle, children }) {
    return (
        <Glass
            tint="purple"
            className="w-full animate-scale-in"
        >
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white">
                {title}
            </h1>
            <p className="mb-7 mt-2 text-[15px] text-ink-400">{subtitle}</p>
            {children}
        </Glass>
    );
}
