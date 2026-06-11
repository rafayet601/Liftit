import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { db } from '../data/db';
import { DataProvider } from '../data/DataProvider';
import { UnitProvider, useUnit } from '../contexts/UnitContext';
import { AuthProvider } from '../contexts/AuthContext';
import { ModalProvider } from '../contexts/ModalContext';
import { ToastProvider } from '../components/ui/Toast';
import LoginPage from '../components/auth/LoginPage';
import Home from '../pages/Home';
import Workout from '../pages/Workout';
import History from '../pages/History';
import { discardSession } from '../hooks/useActiveSession';

function Providers({ children }) {
    return (
        <MemoryRouter>
            <DataProvider>
                <AuthProvider>
                    <UnitProvider>
                        <ModalProvider>
                            <ToastProvider>{children}</ToastProvider>
                        </ModalProvider>
                    </UnitProvider>
                </AuthProvider>
            </DataProvider>
        </MemoryRouter>
    );
}

describe('Liftit · smoke', () => {
    beforeEach(() => {
        localStorage.clear();
        db.wipe();
        discardSession();
    });

    it('renders the login page with local-first options', () => {
        render(
            <Providers>
                <LoginPage />
            </Providers>,
        );
        expect(screen.getByText(/Use on this device only/i)).toBeInTheDocument();
        expect(screen.getByText(/sample data/i)).toBeInTheDocument();
    });

    it('renders Home with honest empty states (no fabricated numbers)', () => {
        db.settings.update({ onboarded: true, name: 'Test' });
        render(
            <Providers>
                <Home />
            </Providers>,
        );
        expect(screen.getByText(/Hey,/i)).toBeInTheDocument();
        expect(screen.getByText(/No sets logged yet this week/i)).toBeInTheDocument();
    });

    it('renders the Workout launcher without a program', () => {
        db.settings.update({ onboarded: true });
        render(
            <Providers>
                <Workout />
            </Providers>,
        );
        expect(screen.getByText(/No program yet/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Start freestyle/i)[0]).toBeInTheDocument();
    });

    it('shows logged workouts in History', () => {
        db.settings.update({ onboarded: true });
        db.workouts.save({
            id: 'w1',
            name: 'Push Day',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            durationSec: 3000,
            sets: [
                { exerciseId: 'barbell-bench-press', setNumber: 1, weight: 80, reps: 8, rpe: 8 },
            ],
        });
        render(
            <Providers>
                <History />
            </Providers>,
        );
        expect(screen.getByText('Push Day')).toBeInTheDocument();
    });

    it('UnitContext converts via db settings', () => {
        let ctx;
        function Probe() {
            // Test probe: capturing the hook value is intentional here.
            // eslint-disable-next-line react-hooks/globals
            ctx = useUnit();
            return null;
        }
        render(
            <Providers>
                <Probe />
            </Providers>,
        );
        expect(ctx.unit).toBe('kg');
        expect(ctx.displayWeight(100)).toBe(100);
        act(() => ctx.toggleUnit());
        expect(ctx.unit).toBe('lbs');
        expect(ctx.displayWeight(100)).toBeCloseTo(220.5, 1);
        expect(db.settings.get().units).toBe('lbs');
    });

    it('starts a freestyle session from the launcher', () => {
        db.settings.update({ onboarded: true });
        render(
            <Providers>
                <Workout />
            </Providers>,
        );
        fireEvent.click(screen.getByRole('button', { name: /Start freestyle/i }));
        expect(screen.getByText(/In session/i)).toBeInTheDocument();
        expect(screen.getByText(/Add exercise/i)).toBeInTheDocument();
    });
});
