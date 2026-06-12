import React, { useEffect } from 'react';
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Link,
    Navigate,
    useLocation,
} from 'react-router-dom';
import {
    LayoutDashboard,
    Dumbbell,
    BarChart3,
    Calendar,
    History as HistoryIcon,
    MessageCircle,
    Cog,
    CloudOff,
    RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import { UnitProvider } from './contexts/UnitContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ModalProvider, useModal } from './contexts/ModalContext';
import { DataProvider, useSettings, useSyncStatus } from './data/DataProvider';
import TrainerChat from './components/ai/TrainerChat';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';
import { initNativeShell, isStandalone, hapticSelection } from './lib/platform';

import Home from './pages/Home';
import Workout from './pages/Workout';
import History from './pages/History';
import Program from './pages/Program';
import Progress from './pages/Progress';
import Onboarding from './pages/Onboarding';
import SettingsPage from './pages/Settings';
import Login from './pages/Login';
import AuthCallback from './components/auth/AuthCallback';
import MobileNav from './components/layout/MobileNav';

export const NAV_ITEMS = [
    { name: 'Home', icon: LayoutDashboard, path: '/' },
    { name: 'Workout', icon: Dumbbell, path: '/workout' },
    { name: 'History', icon: HistoryIcon, path: '/history' },
    { name: 'Program', icon: Calendar, path: '/program' },
    { name: 'Progress', icon: BarChart3, path: '/progress' },
];

/* -----------------------------------------------------------------
   Sidebar (desktop)
   ----------------------------------------------------------------- */
function Sidebar() {
    const location = useLocation();
    const { user } = useAuth();
    const settings = useSettings();
    const { openTrainer } = useModal();
    const { isOnline, isSyncing, pendingOps } = useSyncStatus();

    const displayName = user?.name || settings.name || 'Athlete';

    return (
        <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-white/[0.07] bg-ink-950 p-5 md:flex">
            {/* Brand */}
            <Link to="/" className="group mb-10 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-ember text-ink-950 transition-transform group-hover:-rotate-6">
                    <Dumbbell className="h-5 w-5" strokeWidth={2.4} />
                </div>
                <div>
                    <h1 className="font-display text-[22px] font-bold tracking-tight text-white">
                        Liftit<span className="text-accent">.</span>
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-500">
                        Forge · v4
                    </p>
                </div>
            </Link>

            {/* Primary nav */}
            <nav className="flex-1 space-y-1">
                {NAV_ITEMS.map((item) => {
                    const isActive =
                        item.path === '/'
                            ? location.pathname === '/'
                            : location.pathname.startsWith(item.path);
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => hapticSelection()}
                            aria-current={isActive ? 'page' : undefined}
                            className={clsx(
                                'group relative flex items-center gap-3 rounded-xl px-4 py-2.5 transition-colors',
                                isActive
                                    ? 'bg-accent/10 text-accent'
                                    : 'text-ink-400 hover:bg-white/5 hover:text-white',
                            )}
                        >
                            {isActive && (
                                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent" />
                            )}
                            <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.3 : 2} />
                            <span className="text-[14.5px] font-semibold tracking-tight">
                                {item.name}
                            </span>
                        </Link>
                    );
                })}

                <div className="mt-6 space-y-1 border-t border-white/[0.07] pt-6">
                    <button
                        type="button"
                        onClick={openTrainer}
                        className="group flex w-full items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-2.5 text-accent transition-colors hover:bg-accent/10"
                    >
                        <MessageCircle className="h-5 w-5" />
                        <span className="text-[14.5px] font-bold tracking-tight">Coach</span>
                    </button>
                </div>
            </nav>

            {/* Sync status */}
            {(!isOnline || pendingOps > 0) && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-xs text-ink-400">
                    {isSyncing ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-steel" />
                    ) : (
                        <CloudOff className="h-3.5 w-3.5 text-steel" />
                    )}
                    {isSyncing
                        ? 'Syncing…'
                        : isOnline
                          ? `${pendingOps} change${pendingOps === 1 ? '' : 's'} pending`
                          : 'Offline — saved on device'}
                </div>
            )}

            {/* User card → Settings */}
            <Link
                to="/settings"
                className="group flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 transition-colors hover:border-accent/30"
            >
                <div className="flex h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                    {user?.image ? (
                        <img src={user.image} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-accent/10 font-bold text-accent">
                            {displayName[0]?.toUpperCase() || 'A'}
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-white">{displayName}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-500">
                        {user ? 'Synced account' : 'On this device'}
                    </p>
                </div>
                <Cog className="h-4 w-4 text-ink-500 transition-colors group-hover:text-accent" />
            </Link>
        </aside>
    );
}

/* -----------------------------------------------------------------
   Layout + onboarding gate
   ----------------------------------------------------------------- */
function Layout({ children }) {
    const settings = useSettings();
    const location = useLocation();

    if (!settings.onboarded) {
        return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
    }

    return (
        <div className="relative min-h-dvh bg-ink-950 text-ink-200">
            <Sidebar />
            <main className="relative flex-1 overflow-x-hidden pb-28 pt-safe md:ml-64 md:pb-10">
                <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
                    {children}
                </div>
            </main>
            <MobileNav />
            <TrainerModal />
        </div>
    );
}

function TrainerModal() {
    const { showTrainer, closeTrainer } = useModal();
    return showTrainer ? <TrainerChat onClose={closeTrainer} /> : null;
}

/* -----------------------------------------------------------------
   Routes — local-first: nothing requires login. /login exists for sync.
   ----------------------------------------------------------------- */
function AppRoutes() {
    const page = (Component) => (
        <Layout>
            <Component />
        </Layout>
    );
    return (
        <Routes>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/" element={page(Home)} />
            <Route path="/workout" element={page(Workout)} />
            <Route path="/history" element={page(History)} />
            <Route path="/history/:id" element={page(History)} />
            <Route path="/program" element={page(Program)} />
            <Route path="/progress" element={page(Progress)} />
            <Route path="/settings" element={page(SettingsPage)} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

/* -----------------------------------------------------------------
   Root
   ----------------------------------------------------------------- */
function NativeShell() {
    useEffect(() => {
        initNativeShell();
        if (isStandalone()) {
            document.documentElement.classList.add('is-standalone');
        }
    }, []);
    return null;
}

export default function App() {
    return (
        <ErrorBoundary>
            <DataProvider>
                <AuthProvider>
                    <UnitProvider>
                        <ModalProvider>
                            <ToastProvider>
                                <Router>
                                    <NativeShell />
                                    <AppRoutes />
                                </Router>
                            </ToastProvider>
                        </ModalProvider>
                    </UnitProvider>
                </AuthProvider>
            </DataProvider>
        </ErrorBoundary>
    );
}
