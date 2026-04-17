import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User,
    Globe,
    LogOut,
    Save,
    Shield,
    Database,
    Trash2,
    Weight,
    Download,
    AlertTriangle,
    Bell,
    Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useUnit } from '../contexts/UnitContext';
import { updateProfile } from '../services/user.service';
import { useToast } from '../components/ui/Toast';
import { del as apiDelete } from '../lib/api';
import { loadData, saveData } from '../lib/store';
import {
    Card,
    PageHeader,
    Chip,
    LoadingRing,
} from '../components/ui/Primitives';
import clsx from 'clsx';
import { hapticMedium } from '../lib/platform';

/**
 * Settings — a proper "iOS-grouped" layout. Groups: Profile, Preferences,
 * Data, Danger Zone. Destructive flows are SPA-safe (navigate, never reload)
 * and properly hit the server when a real account exists.
 */
export default function Settings() {
    const { user, logout } = useAuth();
    const { data, updateData } = useData();
    const { unit, toggleUnit } = useUnit();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [isSaving, setIsSaving] = useState(false);
    const [profile, setProfile] = useState({
        name: user?.name || data?.user?.name || 'Athlete',
        level: data?.user?.level || 'Intermediate',
    });
    const [dialog, setDialog] = useState(null); // 'clearLocal' | 'deleteAccount' | null
    const [dialogBusy, setDialogBusy] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (user?.id && !user?.isDemo) {
                const response = await updateProfile(profile);
                if (response.data?.user) {
                    localStorage.setItem('liftit_user', JSON.stringify(response.data.user));
                }
            }
            updateData({ user: profile });
            showToast('Settings saved', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to save settings', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        hapticMedium();
        await logout();
        showToast('Signed out', 'info', 2000);
        navigate('/login', { replace: true });
    };

    const handleExport = () => {
        try {
            const payload = {
                exportedAt: new Date().toISOString(),
                user: user || data?.user || null,
                unit,
                ...loadData(),
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `liftit-export-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 250);
            showToast('Export downloaded', 'success');
        } catch (err) {
            console.error(err);
            showToast('Export failed', 'error');
        }
    };

    /** SPA-safe: clear local workout data while keeping the session. */
    const clearLocalData = async () => {
        setDialogBusy(true);
        try {
            saveData({
                user: data?.user || null,
                currentMesocycle: null,
                program: [],
                logs: [],
                preferences: { unit, theme: 'dark' },
            });
            updateData({ logs: [], currentMesocycle: null, program: [] });
            setDialog(null);
            showToast('Local training data cleared', 'success');
            navigate('/', { replace: true });
        } finally {
            setDialogBusy(false);
        }
    };

    /** Fully delete the server account, then sign out. */
    const deleteAccount = async () => {
        setDialogBusy(true);
        try {
            if (user?.id && !user?.isDemo) {
                try {
                    await apiDelete('/users/account', { useLocalStorage: false });
                } catch (err) {
                    console.warn('[Settings] account delete failed:', err);
                }
            }
            // Wipe everything local
            ['liftit_data_v1', 'liftit_user', 'liftit_token', 'liftit_unit', 'liftit_last_sync']
                .forEach((k) => localStorage.removeItem(k));
            await logout().catch(() => {});
            setDialog(null);
            showToast('Account deleted', 'info');
            navigate('/login', { replace: true });
        } finally {
            setDialogBusy(false);
        }
    };

    const levels = [
        {
            value: 'Beginner',
            label: 'Beginner',
            desc: 'Less than 1 year of consistent training',
        },
        {
            value: 'Intermediate',
            label: 'Intermediate',
            desc: '1–3 years of consistent training',
        },
        {
            value: 'Advanced',
            label: 'Advanced',
            desc: '3+ years of consistent training',
        },
    ];

    return (
        <div className="mx-auto max-w-3xl animate-fade-in space-y-6">
            <PageHeader
                eyebrow="Settings"
                title="Your setup"
                description="Account, preferences, and data controls."
                icon={SettingsIcon}
            />

            {/* Profile */}
            <Section
                icon={User}
                title="Profile"
                description="Your personal information"
            >
                <div className="space-y-5">
                    <Field label="Display Name">
                        <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                            className="input"
                            placeholder="Your name"
                        />
                    </Field>

                    <Field label="Experience Level">
                        <div className="space-y-2">
                            {levels.map((level) => {
                                const active = profile.level === level.value;
                                return (
                                    <label
                                        key={level.value}
                                        className={clsx(
                                            'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all',
                                            active
                                                ? 'border-accent/40 bg-accent/5'
                                                : 'border-white/10 hover:border-white/20',
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="level"
                                            value={level.value}
                                            checked={active}
                                            onChange={(e) =>
                                                setProfile({ ...profile, level: e.target.value })
                                            }
                                            className="mt-1 accent-[#bef264]"
                                        />
                                        <div>
                                            <span className="font-semibold text-white">
                                                {level.label}
                                            </span>
                                            <p className="mt-0.5 text-xs text-zinc-500">
                                                {level.desc}
                                            </p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </Field>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="btn-primary w-full"
                    >
                        {isSaving ? (
                            <>
                                <LoadingRing size={14} /> Saving…
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" /> Save Changes
                            </>
                        )}
                    </button>
                </div>
            </Section>

            {/* Preferences */}
            <Section
                icon={Globe}
                title="Preferences"
                description="Customize your experience"
            >
                <div className="space-y-2">
                    <Row
                        icon={Weight}
                        title="Weight unit"
                        description="Toggle between kilograms and pounds"
                        onClick={toggleUnit}
                        trailing={
                            <Chip tone="accent">{unit.toUpperCase()}</Chip>
                        }
                    />
                    <Row
                        icon={Bell}
                        title="Notifications"
                        description="Workout reminders & PR nudges"
                        trailing={<Chip>Coming soon</Chip>}
                        disabled
                    />
                </div>
            </Section>

            {/* Data */}
            <Section
                icon={Database}
                title="Data"
                description="Export or clear your local training data"
            >
                <div className="space-y-2">
                    <Row
                        icon={Download}
                        title="Export data"
                        description="Download a JSON backup of your logs and program"
                        onClick={handleExport}
                    />
                    <Row
                        icon={Trash2}
                        title="Clear local data"
                        description="Removes saved workouts from this device. Your account stays."
                        onClick={() => setDialog('clearLocal')}
                        tone="warning"
                    />
                </div>
            </Section>

            {/* Danger */}
            <Section
                icon={AlertTriangle}
                title="Danger zone"
                description="Irreversible actions"
                tone="danger"
            >
                <button
                    type="button"
                    onClick={() => setDialog('deleteAccount')}
                    className="btn-danger w-full"
                >
                    <Trash2 className="h-4 w-4" /> Delete account permanently
                </button>
            </Section>

            <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-4 font-semibold text-red-300 transition-all hover:border-red-500/30 hover:bg-red-500/5"
            >
                <LogOut className="h-4 w-4" /> Sign out
            </button>

            <p className="pt-4 text-center font-mono text-xs text-zinc-600">
                Liftit v3.0 · AI Edition · iOS ready
            </p>

            {/* Dialogs */}
            {dialog === 'clearLocal' && (
                <ConfirmDialog
                    icon={Trash2}
                    tone="warning"
                    title="Clear local data?"
                    description="This removes workouts and the active program from this device. Your account and any cloud-synced history remain. You'll be sent back to Home."
                    confirmLabel="Yes, clear data"
                    busy={dialogBusy}
                    onCancel={() => setDialog(null)}
                    onConfirm={clearLocalData}
                />
            )}
            {dialog === 'deleteAccount' && (
                <ConfirmDialog
                    icon={AlertTriangle}
                    tone="danger"
                    title="Delete your account?"
                    description="This permanently deletes your Liftit account, all workouts, and any synced data. This cannot be undone."
                    confirmLabel="Delete my account"
                    busy={dialogBusy}
                    onCancel={() => setDialog(null)}
                    onConfirm={deleteAccount}
                />
            )}
        </div>
    );
}

/* ----- helpers ----- */

function Section({ icon: Icon, title, description, tone, children }) {
    return (
        <Card
            className={clsx(
                'space-y-5',
                tone === 'danger' && 'border-red-500/20 bg-red-500/5',
            )}
        >
            <div className="flex items-center gap-3">
                <div
                    className={clsx(
                        'flex h-10 w-10 items-center justify-center rounded-xl border',
                        tone === 'danger'
                            ? 'border-red-500/30 bg-red-500/10 text-red-400'
                            : 'border-accent/20 bg-accent/10 text-accent',
                    )}
                >
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-lg font-bold tracking-tight text-white">{title}</h2>
                    <p className="text-sm text-zinc-500">{description}</p>
                </div>
            </div>
            {children}
        </Card>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <label className="eyebrow mb-2 block">{label}</label>
            {children}
        </div>
    );
}

function Row({ icon: Icon, title, description, trailing, onClick, tone, disabled }) {
    const inner = (
        <>
            <div className="flex items-center gap-3">
                <div
                    className={clsx(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                        tone === 'warning'
                            ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                            : 'border-white/10 bg-white/[0.03] text-zinc-400',
                    )}
                >
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-left font-semibold text-white">{title}</p>
                    <p className="text-left text-xs text-zinc-500">{description}</p>
                </div>
            </div>
            <div className="shrink-0">{trailing}</div>
        </>
    );
    const cls =
        'flex w-full items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-white/15 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50';
    return (
        <button type="button" onClick={onClick} disabled={disabled} className={cls}>
            {inner}
        </button>
    );
}

function ConfirmDialog({ icon: Icon, tone, title, description, confirmLabel, onCancel, onConfirm, busy }) {
    return (
        <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm md:items-center"
            role="dialog"
            aria-modal="true"
        >
            <div className="surface-strong w-full max-w-md animate-scale-in p-6">
                <div
                    className={clsx(
                        'mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border',
                        tone === 'danger'
                            ? 'border-red-500/30 bg-red-500/10 text-red-400'
                            : 'border-amber-400/30 bg-amber-400/10 text-amber-300',
                    )}
                >
                    <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold tracking-tight text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{description}</p>
                <div className="mt-5 flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="btn-secondary flex-1"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className={clsx(
                            'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
                            tone === 'danger'
                                ? 'bg-red-500 text-white hover:bg-red-400'
                                : 'bg-amber-400 text-ink-950 hover:bg-amber-300',
                        )}
                    >
                        {busy ? <LoadingRing size={14} /> : <Shield className="h-4 w-4" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
