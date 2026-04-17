import React, { useEffect } from 'react';
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Link,
    useLocation,
    useNavigate,
} from 'react-router-dom';
import {
    LayoutDashboard,
    Dumbbell,
    BarChart3,
    Calendar,
    Sparkles,
    Cog,
} from 'lucide-react';
import clsx from 'clsx';
import { UnitProvider, useUnit } from './contexts/UnitContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ModalProvider, useModal } from './contexts/ModalContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import TrainerChat from './components/ai/TrainerChat';
import ProgramGenerator from './components/ai/ProgramGenerator';
import ConnectionStatus from './components/ui/ConnectionStatus';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';
import { useOfflineSync } from './hooks/useOfflineSync';
import { initNativeShell, isStandalone, hapticSelection } from './lib/platform';

import Dashboard from './pages/Dashboard';
import Program from './pages/Program';
import Tracker from './pages/Tracker';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import SettingsPage from './pages/Settings';
import AuthCallback from './components/auth/AuthCallback';

import MobileNav from './components/layout/MobileNav';

/* -----------------------------------------------------------------
   Sidebar (desktop only)
   ----------------------------------------------------------------- */
function Sidebar() {
    const location = useLocation();
    const { unit } = useUnit();
    const { user } = useAuth();
    const { openTrainer, openProgramGenerator } = useModal();

    const primary = [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
        { name: 'Tracker', icon: Dumbbell, path: '/tracker' },
        { name: 'Program', icon: Calendar, path: '/program' },
        { name: 'Analytics', icon: BarChart3, path: '/analytics' },
    ];

    return (
        <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-white/5 bg-ink-950/70 p-5 backdrop-blur-xl md:flex">
            {/* Brand */}
            <Link to="/" className="group mb-10 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-ink-950 shadow-glow-sm transition-transform group-hover:-rotate-6">
                    <Dumbbell className="h-5 w-5" strokeWidth={2.4} />
                </div>
                <div>
                    <h1 className="text-[22px] font-extrabold tracking-tight text-white">
                        Liftit<span className="text-accent">.</span>
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                        Version 3.0
                    </p>
                </div>
            </Link>

            {/* Primary nav */}
            <nav className="flex-1 space-y-1.5">
                {primary.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => hapticSelection()}
                            aria-current={isActive ? 'page' : undefined}
                            className={clsx(
                                'group relative flex items-center gap-3 rounded-xl px-4 py-3 transition-all',
                                isActive
                                    ? 'bg-accent/10 text-accent'
                                    : 'text-zinc-400 hover:bg-white/5 hover:text-white',
                            )}
                        >
                            {isActive && (
                                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent shadow-[0_0_12px_rgba(190,242,100,0.5)]" />
                            )}
                            <item.icon
                                className={clsx(
                                    'h-5 w-5 transition-transform group-hover:scale-110',
                                    isActive && 'text-accent',
                                )}
                                strokeWidth={isActive ? 2.3 : 2}
                            />
                            <span className="text-[14.5px] font-semibold tracking-tight">
                                {item.name}
                            </span>
                        </Link>
                    );
                })}

                <div className="mt-6 border-t border-white/5 pt-6 space-y-2">
                    <button
                        type="button"
                        onClick={openTrainer}
                        className="group flex w-full items-center gap-3 rounded-xl border border-accent/20 bg-gradient-to-r from-accent/10 to-transparent px-4 py-3 text-accent transition-all hover:border-accent/40 hover:from-accent/20"
                    >
                        <Sparkles className="h-5 w-5 transition-transform group-hover:rotate-12" />
                        <span className="text-[14.5px] font-bold tracking-tight">
                            AI Trainer
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={openProgramGenerator}
                        className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-zinc-400 transition-all hover:bg-white/5 hover:text-white"
                    >
                        <Calendar className="h-5 w-5 transition-transform group-hover:scale-110" />
                        <span className="text-[14.5px] font-semibold tracking-tight">
                            Generate Plan
                        </span>
                    </button>
                </div>
            </nav>

            {/* User card */}
            <Link
                to="/settings"
                className="group mt-6 flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3 transition-all hover:border-accent/30"
            >
                <div className="flex h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                    {user?.image ? (
                        <img
                            src={user.image}
                            alt={user.name}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-accent/10 font-bold text-accent">
                            {user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-white">
                        {user?.name || 'Athlete'}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                        {unit} · v3
                    </p>
                </div>
                <Cog className="h-4 w-4 text-zinc-500 transition-colors group-hover:text-accent" />
            </Link>
        </aside>
    );
}

/* -----------------------------------------------------------------
   Global modal container
   ----------------------------------------------------------------- */
function ModalContainer() {
    const { showTrainer, showProgramGenerator, closeTrainer, closeProgramGenerator } = useModal();
    const navigate = useNavigate();

    return (
        <>
            {showTrainer && <TrainerChat onClose={closeTrainer} />}
            {showProgramGenerator && (
                <ProgramGenerator
                    onComplete={() => {
                        closeProgramGenerator();
                        navigate('/program');
                    }}
                    onClose={closeProgramGenerator}
                />
            )}
        </>
    );
}

/* -----------------------------------------------------------------
   Main Layout
   ----------------------------------------------------------------- */
function Layout({ children }) {
    const { isOnline, isSyncing, lastSyncTime } = useOfflineSync();

    return (
        <div className="relative min-h-dvh bg-ink-950 text-zinc-200">
            {/* Subtle grid background */}
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0 -z-10 bg-grid-faint bg-grid opacity-[0.35]"
                style={{ maskImage: 'radial-gradient(ellipse at center, #000 30%, transparent 70%)' }}
            />
            <Sidebar />

            <main className="relative flex-1 overflow-x-hidden pb-28 pt-safe md:ml-64 md:pb-10">
                <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
                    {children}
                </div>
            </main>

            <MobileNav />
            <ModalContainer />
            <ConnectionStatus
                isOnline={isOnline}
                isSyncing={isSyncing}
                lastSyncTime={lastSyncTime}
            />
        </div>
    );
}

/* -----------------------------------------------------------------
   Global auth-expired listener (soft SPA redirect on 401)
   ----------------------------------------------------------------- */
function AuthEventBridge() {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const onExpired = () => {
            if (location.pathname !== '/login') {
                navigate('/login', {
                    replace: true,
                    state: { from: location.pathname + location.search },
                });
            }
        };
        window.addEventListener('liftit:auth-expired', onExpired);
        return () => window.removeEventListener('liftit:auth-expired', onExpired);
    }, [navigate, location]);

    return null;
}

/* -----------------------------------------------------------------
   Routes
   ----------------------------------------------------------------- */
function AppRoutes() {
    return (
        <>
            <AuthEventBridge />
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Dashboard />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/tracker"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Tracker />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/program"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Program />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/analytics"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <Analytics />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/settings"
                    element={
                        <ProtectedRoute>
                            <Layout>
                                <SettingsPage />
                            </Layout>
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </>
    );
}

/* -----------------------------------------------------------------
   Root
   ----------------------------------------------------------------- */
function NativeShell() {
    useEffect(() => {
        initNativeShell();
        // Hint scroll behaviour on iOS standalone
        if (isStandalone()) {
            document.documentElement.classList.add('is-standalone');
        }
    }, []);
    return null;
}

export default function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <DataProvider>
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
                </DataProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}
