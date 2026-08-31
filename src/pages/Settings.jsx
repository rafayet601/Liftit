import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Settings as SettingsIcon,
    User,
    Weight,
    Bot,
    Database,
    Download,
    Upload,
    FileUp,
    Trash2,
    LogOut,
    LogIn,
    RefreshCw,
    ShieldCheck,
} from 'lucide-react';
import { db } from '../data/db';
import { parseStrongCsv } from '../data/importers/strong';
import { parseHevyCsv } from '../data/importers/hevy';
import { parseFitNotesCsv } from '../data/importers/fitnotes';
import { backendAvailable } from '../lib/api';
import { isNative } from '../lib/platform';
import { startCheckout, openBillingPortal } from '../services/billing.service';
import { useSettings, useSyncStatus } from '../data/DataProvider';
import { useAuth } from '../contexts/AuthContext';
import { AI_PROVIDERS } from '../ai/providers';
import { Card, Chip, PageHeader, Segmented, Sheet } from '../components/ui/Primitives';
import Glass from '../components/ui/Glass';
import { useToast } from '../components/ui/Toast';

export default function SettingsPage() {
    const settings = useSettings();
    const { user, entitlement, logout, refreshSession } = useAuth();
    const { isOnline, isSyncing, pendingOps, syncError, requestSync } = useSyncStatus();
    const { showToast } = useToast();
    const fileRef = useRef(null);
    const [confirmWipe, setConfirmWipe] = useState(false);
    const [native, setNative] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        isNative().then(setNative).catch(() => {});
    }, []);

    // Returning from Stripe Checkout: clear the marker from the URL and
    // re-pull the session so the new plan lands. The webhook can lag the
    // redirect by a few seconds, hence the second pull.
    useEffect(() => {
        const billing = searchParams.get('billing');
        if (!billing) return undefined;
        const next = new URLSearchParams(searchParams);
        next.delete('billing');
        setSearchParams(next, { replace: true });
        if (billing !== 'success') return undefined;
        showToast('Payment received — activating Liftit Pro…', 'success');
        refreshSession().catch(() => {});
        const retry = setTimeout(() => refreshSession().catch(() => {}), 5000);
        return () => clearTimeout(retry);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const exportData = () => {
        const blob = new Blob([db.export()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `liftit-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup downloaded.', 'success');
    };

    const importData = async (file) => {
        try {
            db.import(await file.text());
            showToast('Backup restored.', 'success');
        } catch (err) {
            showToast(`Import failed: ${err.message}`, 'error');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader eyebrow="You" title="Settings" icon={SettingsIcon} />

            {/* Profile */}
            <Card className="space-y-5">
                <SectionHead icon={User} title="Profile" />
                <div>
                    <div className="eyebrow mb-2">Name</div>
                    <input
                        type="text"
                        defaultValue={settings.name}
                        onBlur={(e) => db.settings.update({ name: e.target.value.trim() })}
                        placeholder="Your name"
                        className="input max-w-sm"
                        aria-label="Name"
                    />
                </div>
                <div>
                    <div className="eyebrow mb-2">Experience</div>
                    <Segmented
                        className="max-w-md"
                        value={settings.experience}
                        onChange={(experience) => db.settings.update({ experience })}
                        options={[
                            { value: 'beginner', label: 'Beginner' },
                            { value: 'intermediate', label: 'Intermediate' },
                            { value: 'advanced', label: 'Advanced' },
                        ]}
                    />
                </div>
            </Card>

            {/* Units */}
            <Card className="space-y-4">
                <SectionHead icon={Weight} title="Units" />
                <Segmented
                    className="max-w-xs"
                    value={settings.units}
                    onChange={(units) => db.settings.update({ units })}
                    options={[
                        { value: 'kg', label: 'Kilograms' },
                        { value: 'lbs', label: 'Pounds' },
                    ]}
                />
                <p className="text-xs text-ink-500">
                    Weights are stored in kg internally — switching units never changes your data.
                </p>
            </Card>

            {/* AI provider — bring your own model */}
            <AiProviderCard settings={settings} />

            {/* Account + sync — only when this build has a backend behind it */}
            <Card className="space-y-4">
                <SectionHead icon={ShieldCheck} title="Account & sync" />
                {!backendAvailable() ? (
                    <p className="text-sm text-ink-400">
                        This build runs entirely on your device — there's no account to create and
                        nothing leaves the browser. Use Export JSON below to back up or move your
                        training history.
                    </p>
                ) : user ? (
                    <>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-white">{user.name}</p>
                                <p className="text-xs text-ink-500">{user.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {entitlement?.billingEnforced && entitlement.plan === 'pro' && (
                                    <Chip tone="success">
                                        {entitlement.source === 'beta-grandfather'
                                            ? 'Founding · Pro'
                                            : 'Pro'}
                                    </Chip>
                                )}
                                <Chip tone={isOnline ? 'success' : 'warning'}>
                                    {isOnline ? 'Online' : 'Offline'}
                                </Chip>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={requestSync}
                                disabled={isSyncing}
                                className="btn-secondary"
                            >
                                <RefreshCw className={isSyncing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                                {isSyncing ? 'Syncing…' : pendingOps ? `Sync ${pendingOps} changes` : 'Sync now'}
                            </button>
                            {entitlement?.billingEnforced
                                && entitlement.plan === 'pro'
                                && entitlement.manageable
                                && !native && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            await openBillingPortal();
                                        } catch (err) {
                                            showToast(err.message ?? 'Could not open the billing portal.', 'error');
                                        }
                                    }}
                                    className="btn-ghost"
                                >
                                    Manage subscription
                                </button>
                            )}
                            <button type="button" onClick={logout} className="btn-ghost text-red-400">
                                <LogOut className="h-4 w-4" /> Sign out
                            </button>
                        </div>
                        {entitlement?.billingEnforced && entitlement.plan !== 'pro' && (
                            <UpgradeOptions entitlement={entitlement} native={native} />
                        )}
                        {syncError && (
                            <p className="text-sm text-red-400">
                                {syncError.stage === 'auth'
                                    ? "Sync stopped because your session expired — sign in again to pick it up."
                                    : syncError.stage === 'entitlement'
                                        ? 'Cloud sync is a Liftit Pro feature.'
                                        : `Last sync didn't finish (${syncError.message}).`}{' '}
                                <span className="text-ink-400">
                                    Everything you've logged is safe on this device, and we'll try
                                    again.
                                </span>
                            </p>
                        )}
                    </>
                ) : (
                    <>
                        <p className="text-sm text-ink-400">
                            You're using Liftit on this device only. Sign in to back up workouts and sync
                            across devices — your local data comes with you.
                        </p>
                        <Link to="/login" className="btn-primary inline-flex">
                            <LogIn className="h-4 w-4" /> Sign in
                        </Link>
                    </>
                )}
            </Card>

            {/* Data */}
            <Card className="space-y-4 glass-card-glow-danger">
                <SectionHead icon={Database} title="Your data" />
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={exportData} className="btn-secondary">
                        <Download className="h-4 w-4" /> Export JSON
                    </button>
                    <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary">
                        <Upload className="h-4 w-4" /> Import backup
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) importData(f);
                            e.target.value = '';
                        }}
                    />
                    <button type="button" onClick={() => setConfirmWipe(true)} className="btn-danger">
                        <Trash2 className="h-4 w-4" /> Erase everything
                    </button>
                </div>
                {db.meta.isDemo() && (
                    <p className="text-xs text-amber-300/80">
                        You're on sample data — “Erase everything” clears it for a fresh start.
                    </p>
                )}
            </Card>

            {/* Migrate from Strong / Hevy / FitNotes — preview → commit */}
            <ImporterCard />

            {confirmWipe && (
                <Sheet open title="Erase all data?" onClose={() => setConfirmWipe(false)}>
                    <p className="text-sm text-ink-400">
                        Every workout, program, and setting on this device will be deleted. Export a
                        backup first if you might want it back.
                    </p>
                    <div className="mt-5 flex gap-2">
                        <button
                            type="button"
                            className="btn-danger flex-1"
                            onClick={() => {
                                db.wipe();
                                setConfirmWipe(false);
                                showToast('All data erased.', 'success');
                            }}
                        >
                            Erase everything
                        </button>
                        <button type="button" className="btn-secondary flex-1" onClick={() => setConfirmWipe(false)}>
                            Cancel
                        </button>
                    </div>
                </Sheet>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Migrate from Strong / Hevy / FitNotes — pick → preview → commit      */
/*                                                                     */
/* The three steps map onto the collision policy: (1) pick the source  */
/* + unit mode (Strong is unitless, so auto applies the ≥30%-of-       */
/* barbell-sets-≥90 heuristic; the header variants override it) and     */
/* the duplicate-date policy (skip default — never clobber logged      */
/* sets); (2) the preview shows honest counts incl. what will be       */
/* skipped/replaced and which unknown exercises become custom;         */
/* (3) commit runs exactly what the preview showed — no silent merges. */
/* ------------------------------------------------------------------ */
const IMPORT_SOURCES = [
    { value: 'strong', label: 'Strong' },
    { value: 'hevy', label: 'Hevy' },
    { value: 'fitnotes', label: 'FitNotes' },
];

const ACTION_LABELS = {
    import: { label: 'Import new', tone: 'success' },
    skip: { label: 'Skip (date exists)', tone: 'warning' },
    replace: { label: 'Replace existing', tone: 'danger' },
};

function ImporterCard() {
    const { showToast } = useToast();
    const fileRef = useRef(null);
    const [source, setSource] = useState('strong');
    const [unitMode, setUnitMode] = useState('auto'); // Strong only
    const [collision, setCollision] = useState('skip');
    const [rawText, setRawText] = useState('');
    const [parsedFile, setParsedFile] = useState(null); // { fileName, parsed }
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const runParse = (text, src, um) => {
        setResult(null);
        setError('');
        try {
            let parsed;
            if (src === 'strong') parsed = parseStrongCsv(text, { unitMode: um });
            else if (src === 'hevy') parsed = parseHevyCsv(text);
            else parsed = parseFitNotesCsv(text);
            if (!parsed.ok) {
                setParsedFile(null);
                setRawText('');
                setError(parsed.error);
                return;
            }
            setParsedFile({ fileName: null, parsed });
        } catch (err) {
            setParsedFile(null);
            setRawText('');
            setError(`Could not read the file: ${err.message}`);
        }
    };

    const onFile = async (file) => {
        if (!file) return;
        const text = await file.text();
        setRawText(text);
        runParse(text, source, unitMode);
    };

    const pickSource = (src) => {
        setSource(src);
        setParsedFile(null);
        setRawText('');
        setResult(null);
        setError('');
    };

    const pickUnitMode = (um) => {
        setUnitMode(um);
        if (rawText) runParse(rawText, source, um); // re-resolve units honestly
    };

    // Recomputed whenever the collision policy changes so the preview
    // always describes exactly what commit will do.
    const preview = useMemo(() => {
        if (!parsedFile?.parsed) return null;
        return db.importers.preview(parsedFile.parsed.workouts, { collision });
    }, [parsedFile, collision]);

    const commit = () => {
        if (!parsedFile?.parsed) return;
        const r = db.importers.commit(parsedFile.parsed.workouts, { collision });
        setResult(r);
        setParsedFile(null);
        setRawText('');
        showToast(`Imported ${r.imported} workout${r.imported === 1 ? '' : 's'}.`, 'success');
    };

    const reset = () => {
        setParsedFile(null);
        setRawText('');
        setResult(null);
        setError('');
    };

    return (
        <Card className="space-y-4">
            <SectionHead icon={FileUp} title="Import from Strong / Hevy / FitNotes" />
            <p className="text-sm text-ink-400">
                Bring your history from another tracker. Everything stays on this device; you see a
                full preview before anything is written.
            </p>

            <div>
                <div className="eyebrow mb-2">Exported from</div>
                <Segmented
                    className="max-w-md"
                    value={source}
                    onChange={pickSource}
                    options={IMPORT_SOURCES}
                />
            </div>

            {source === 'strong' && (
                <div>
                    <div className="eyebrow mb-2">Weight units in the file</div>
                    <Segmented
                        className="max-w-md"
                        value={unitMode}
                        onChange={pickUnitMode}
                        options={[
                            { value: 'auto', label: 'Detect' },
                            { value: 'kg', label: 'Kilos' },
                            { value: 'lbs', label: 'LB' },
                        ]}
                    />
                    <p className="mt-2 text-xs text-ink-500">
                        Strong CSVs don't say which unit they use. Detect reads a unit-suffixed
                        weight column if present, else assumes lbs when ≥30% of barbell sets are
                        90+.
                    </p>
                </div>
            )}

            <div>
                <div className="eyebrow mb-2">If a date already exists in Liftit</div>
                <Segmented
                    className="max-w-md"
                    value={collision}
                    onChange={setCollision}
                    options={[
                        { value: 'skip', label: 'Keep mine' },
                        { value: 'replace', label: 'Replace' },
                    ]}
                />
                <p className="mt-2 text-xs text-ink-500">
                    “Keep mine” never overwrites logged sets — those dates are skipped. “Replace”
                    deletes this device's workout for a colliding date and inserts the imported one.
                </p>
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => fileRef.current?.click()}
                    disabled={Boolean(parsedFile)}
                >
                    <Upload className="h-4 w-4" /> Choose CSV…
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        onFile(f);
                        e.target.value = '';
                    }}
                />
            </div>

            {error && (
                <p className="text-sm text-red-400">
                    {error}
                </p>
            )}

            {preview && parsedFile?.parsed && (
                <div className="space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Chip tone="accent">
                            {preview.workoutCount} workout{preview.workoutCount === 1 ? '' : 's'}
                        </Chip>
                        <Chip tone="steel">{preview.setCount} sets</Chip>
                        <Chip tone={preview.unmatchedNames.length ? 'warning' : 'success'}>
                            {preview.matchedNames.length} matched exercise
                            {preview.matchedNames.length === 1 ? '' : 's'}
                        </Chip>
                        {preview.unmatchedNames.length > 0 && (
                            <Chip tone="warning">
                                {preview.unmatchedNames.length} new custom exercise
                                {preview.unmatchedNames.length === 1 ? '' : 's'}
                            </Chip>
                        )}
                        <Chip>{parsedFile.parsed.unitReason}</Chip>
                    </div>

                    {preview.unmatchedNames.length > 0 && (
                        <div className="text-xs text-ink-400">
                            <span className="eyebrow">Will be added as custom exercises</span>
                            <p className="mt-1 break-words">
                                {preview.unmatchedNames.join(' · ')}
                            </p>
                        </div>
                    )}

                    {parsedFile.parsed.stats.warnings.length > 0 && (
                        <ul className="list-inside list-disc space-y-1 text-xs text-amber-300/90">
                            {parsedFile.parsed.stats.warnings.map((w) => (
                                <li key={w}>{w}</li>
                            ))}
                        </ul>
                    )}

                    <div className="max-h-56 space-y-1 overflow-y-auto text-xs">
                        {preview.items.map((item) => {
                            const meta = ACTION_LABELS[item.action] ?? ACTION_LABELS.import;
                            return (
                                <div
                                    key={`${item.date}-${item.contentHash}`}
                                    className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2"
                                >
                                    <span className="min-w-0 truncate text-white">
                                        <span className="tabular-nums text-ink-400">{item.date}</span>
                                        {' · '}
                                        {item.name}
                                        {' · '}
                                        {item.setCount} sets
                                    </span>
                                    <Chip tone={meta.tone}>{meta.label}</Chip>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex gap-2 pt-1">
                        <button type="button" className="btn-primary flex-1" onClick={commit}>
                            Import {preview.willImport + preview.willReplace} workout
                            {preview.willImport + preview.willReplace === 1 ? '' : 's'}
                        </button>
                        <button type="button" className="btn-ghost flex-1" onClick={reset}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {result && (
                <div className="space-y-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm">
                    <p className="font-semibold text-white">
                        Imported {result.imported} workout{result.imported === 1 ? '' : 's'}
                        {' '}({result.setCount} sets).
                    </p>
                    {result.skipped > 0 && (
                        <p className="text-xs text-ink-400">
                            {result.skipped} workout{result.skipped === 1 ? '' : 's'} skipped — a
                            workout already existed on that date.
                        </p>
                    )}
                    {result.removedWorkouts > 0 && (
                        <p className="text-xs text-ink-400">
                            {result.removedWorkouts} existing workout
                            {result.removedWorkouts === 1 ? '' : 's'} replaced.
                        </p>
                    )}
                    {result.createdCustomExercises.length > 0 && (
                        <p className="text-xs text-ink-400">
                            {result.createdCustomExercises.length} new custom exercise
                            {result.createdCustomExercises.length === 1 ? '' : 's'}:{' '}
                            {result.createdCustomExercises.join(' · ')}
                        </p>
                    )}
                    {result.imported === 0 && (
                        <p className="text-xs text-amber-300/90">
                            Nothing was written — every workout in the file collided with an
                            existing date under “Keep mine”.
                        </p>
                    )}
                </div>
            )}
        </Card>
    );
}

/* ------------------------------------------------------------------ */
/* AI provider — user-supplied key, stored on-device only               */
/* ------------------------------------------------------------------ */
function AiProviderCard({ settings }) {
    const { showToast } = useToast();
    const ai = settings.ai;
    const provider = AI_PROVIDERS[ai.provider] ?? AI_PROVIDERS.none;

    return (
        <Glass tint="neutral" glow style={{ background: 'rgba(139,92,246,0.04)', borderColor: 'rgba(139,92,246,0.2)' }}>
        <Card className="space-y-4 glass-card-glow-steel border-steel/30">
            <SectionHead icon={Bot} title="AI Coach" />
            <p className="text-sm text-ink-400">
                Bring your own model: pick a provider and paste your API key. The key is stored only
                on this device — it's never synced or included in exports.
            </p>
            <div>
                <div className="eyebrow mb-2">Provider</div>
                <Segmented
                    value={ai.provider}
                    onChange={(p) =>
                        db.settings.update({
                            ai: { provider: p, model: AI_PROVIDERS[p]?.defaultModel ?? '' },
                        })
                    }
                    options={Object.entries(AI_PROVIDERS).map(([value, p]) => ({
                        value,
                        label: p.label,
                    }))}
                />
            </div>
            {ai.provider !== 'none' && (
                <div className="grid gap-3 md:grid-cols-2">
                    <div>
                        <div className="eyebrow mb-2">Model</div>
                        <input
                            type="text"
                            defaultValue={ai.model || provider.defaultModel}
                            onBlur={(e) =>
                                db.settings.update({ ai: { model: e.target.value.trim() } })
                            }
                            placeholder={provider.defaultModel}
                            className="input"
                            aria-label="Model id"
                        />
                    </div>
                    <div>
                        <div className="eyebrow mb-2">API key</div>
                        <input
                            type="password"
                            defaultValue={ai.apiKey}
                            onBlur={(e) => {
                                db.settings.update({ ai: { apiKey: e.target.value.trim() } });
                                if (e.target.value.trim()) showToast('API key saved on this device.', 'success');
                            }}
                            placeholder="sk-…"
                            className="input"
                            aria-label="API key"
                            autoComplete="off"
                        />
                    </div>
                    {ai.provider === 'custom' && (
                        <div className="md:col-span-2">
                            <div className="eyebrow mb-2">Base URL (OpenAI-compatible)</div>
                            <input
                                type="url"
                                defaultValue={ai.baseUrl}
                                onBlur={(e) => db.settings.update({ ai: { baseUrl: e.target.value.trim() } })}
                                placeholder="https://my-endpoint.example.com/v1"
                                className="input"
                                aria-label="Base URL"
                            />
                        </div>
                    )}
                </div>
            )}
        </Card>
        </Glass>
    );
}

/* ------------------------------------------------------------------ */
/* Liftit Pro upgrade — web checkout only; native builds use IAP        */
/* ------------------------------------------------------------------ */
const PLAN_LABELS = { monthly: 'Monthly', yearly: 'Yearly', lifetime: 'Lifetime' };

function UpgradeOptions({ entitlement, native }) {
    const { showToast } = useToast();
    const [busy, setBusy] = useState(null);
    const plans = entitlement?.checkoutPlans ?? [];
    const buyable = !native && plans.length > 0;

    return (
        <div className="space-y-3">
            <p className="text-sm text-ink-400">
                Cloud backup & sync is part of{' '}
                <span className="font-semibold text-white">Liftit Pro</span>. Your training stays
                safe on this device either way, and your existing cloud backup can still be
                pulled down any time.
                {native && plans.length > 0
                    && ' Upgrade from the Liftit website — your account carries over.'}
            </p>
            {buyable && (
                <div className="flex flex-wrap gap-2">
                    {plans.map((plan) => (
                        <button
                            key={plan}
                            type="button"
                            disabled={Boolean(busy)}
                            className="btn-primary"
                            onClick={async () => {
                                setBusy(plan);
                                try {
                                    await startCheckout(plan);
                                } catch (err) {
                                    showToast(err.message ?? 'Checkout failed.', 'error');
                                    setBusy(null);
                                }
                            }}
                        >
                            {busy === plan ? 'Opening…' : `Go Pro · ${PLAN_LABELS[plan] ?? plan}`}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function SectionHead({ icon: Icon, title }) {
    return (
        <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Icon className="h-4.5 w-4.5 h-5 w-5" />
            </span>
            <h2 className="font-display text-lg font-bold text-white">{title}</h2>
        </div>
    );
}
