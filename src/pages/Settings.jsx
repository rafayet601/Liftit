import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Settings as SettingsIcon,
    User,
    Weight,
    Bot,
    Database,
    Download,
    Upload,
    Trash2,
    LogOut,
    LogIn,
    RefreshCw,
    ShieldCheck,
} from 'lucide-react';
import { db } from '../data/db';
import { useSettings, useSyncStatus } from '../data/DataProvider';
import { useAuth } from '../contexts/AuthContext';
import { AI_PROVIDERS } from '../ai/providers';
import { Card, Chip, PageHeader, Segmented, Sheet } from '../components/ui/Primitives';
import Glass from '../components/ui/Glass';
import { useToast } from '../components/ui/Toast';

export default function SettingsPage() {
    const settings = useSettings();
    const { user, logout } = useAuth();
    const { isOnline, isSyncing, pendingOps, requestSync } = useSyncStatus();
    const { showToast } = useToast();
    const fileRef = useRef(null);
    const [confirmWipe, setConfirmWipe] = useState(false);

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

            {/* Account + sync */}
            <Card className="space-y-4">
                <SectionHead icon={ShieldCheck} title="Account & sync" />
                {user ? (
                    <>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-white">{user.name}</p>
                                <p className="text-xs text-ink-500">{user.email}</p>
                            </div>
                            <Chip tone={isOnline ? 'success' : 'warning'}>
                                {isOnline ? 'Online' : 'Offline'}
                            </Chip>
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
                            <button type="button" onClick={logout} className="btn-ghost text-red-400">
                                <LogOut className="h-4 w-4" /> Sign out
                            </button>
                        </div>
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
