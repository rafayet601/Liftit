/**
 * Sync failures must be visible.
 *
 * The pull half used to swallow every error, so a 500 on /workouts looked
 * exactly like a successful sync into an empty account — which is how a
 * broken server stayed invisible on fresh devices. These tests pin the
 * reporting contract: runSync still never throws, but it says what failed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { db } from '../data/db';
import { DataProvider } from '../data/DataProvider';
import { runSync } from '../data/sync';
import { UnitProvider } from '../contexts/UnitContext';
import { AuthProvider } from '../contexts/AuthContext';
import { ModalProvider } from '../contexts/ModalContext';
import { ToastProvider } from '../components/ui/Toast';
import SettingsPage from '../pages/Settings';

// Same mocked-API shape as the e2e suite: handlers are swapped per test.
const mockApiState = {
    isAuthenticated: false,
    user: null,
    getHandler: () => Promise.resolve({ data: {} }),
    postHandler: () => Promise.resolve({ data: {} }),
    putHandler: () => Promise.resolve({ data: {} }),
    delHandler: () => Promise.resolve({ data: {} }),
};

vi.mock('../lib/api', () => {
    return {
        get: (...args) => mockApiState.getHandler(...args),
        post: (...args) => mockApiState.postHandler(...args),
        put: (...args) => mockApiState.putHandler(...args),
        del: (...args) => mockApiState.delHandler(...args),
        isAuthenticated: () => mockApiState.isAuthenticated,
        getStoredUser: () => mockApiState.user,
        // These tests exercise the signed-in/sync paths, so the mocked build
        // must report a configured backend — otherwise auth and sync short
        // out before the behaviour under test runs.
        API_BASE_URL: 'http://localhost:3001/api',
        backendAvailable: () => true,
    };
});

/** An axios-shaped rejection, which is what the sync code inspects. */
function httpError(status) {
    return Object.assign(new Error(`Request failed with status code ${status}`), {
        response: { status },
    });
}

function queueWorkout(id, name) {
    db.workouts.save({
        id,
        name,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        sets: [],
    });
}

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

describe('Liftit · sync failure reporting', () => {
    beforeEach(() => {
        localStorage.clear();
        db.wipe();
        db.__resetForTest();
        vi.clearAllMocks();

        mockApiState.isAuthenticated = true;
        mockApiState.user = { name: 'Sync User', email: 'sync@example.com' };
        mockApiState.getHandler = () => Promise.resolve({ data: { data: [] } });
        mockApiState.postHandler = () => Promise.resolve({ data: {} });
        mockApiState.putHandler = () => Promise.resolve({ data: {} });
        mockApiState.delHandler = () => Promise.resolve({ data: {} });
        localStorage.setItem('liftit_user', JSON.stringify(mockApiState.user));
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });

    it('reports a clean run with no error', async () => {
        mockApiState.getHandler = () =>
            Promise.resolve({
                data: {
                    data: [
                        {
                            id: 'w-remote',
                            name: 'Remote Session',
                            startedAt: new Date().toISOString(),
                            sets: [],
                        },
                    ],
                },
            });

        const result = await runSync();

        expect(result.error).toBeNull();
        expect(result.pulled).toBe(1);
        expect(result.remaining).toBe(0);
    });

    it('surfaces a failing pull instead of swallowing it', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockApiState.getHandler = (endpoint) =>
            endpoint === '/workouts'
                ? Promise.reject(httpError(500))
                : Promise.resolve({ data: {} });

        const result = await runSync();

        expect(result.error).toMatchObject({ stage: 'pull' });
        expect(result.error.message).toContain('500');
        expect(result.pulled).toBe(0);
    });

    it('keeps the push result when the pull fails', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        queueWorkout('w-push', 'Pushed Session');
        mockApiState.getHandler = () => Promise.reject(httpError(500));

        const result = await runSync();

        expect(result.pushed).toBe(1);
        expect(result.remaining).toBe(0);
        expect(result.error.stage).toBe('pull');
    });

    it('still stops the push loop on 401 and leaves ops queued', async () => {
        queueWorkout('w-a', 'Session A');
        queueWorkout('w-b', 'Session B');
        mockApiState.putHandler = () => Promise.reject(httpError(401));

        const result = await runSync();

        expect(result.pushed).toBe(0);
        expect(result.remaining).toBe(2);
        expect(result.error.stage).toBe('auth');
    });

    it('reports a failing push op that will be retried later', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        queueWorkout('w-flaky', 'Flaky Session');
        mockApiState.putHandler = () => Promise.reject(httpError(503));

        const result = await runSync();

        expect(result.pushed).toBe(0);
        expect(result.remaining).toBe(1);
        expect(result.error).toMatchObject({ stage: 'push' });
    });

    it('pushes program saves and deletes to the programs API', async () => {
        const calls = [];
        mockApiState.putHandler = (endpoint, body) => {
            calls.push(['put', endpoint, body?.name]);
            return Promise.resolve({ data: {} });
        };
        mockApiState.delHandler = (endpoint) => {
            calls.push(['del', endpoint]);
            return Promise.resolve({ data: {} });
        };

        db.programs.save({ id: 'p1', name: 'Synced Plan', isActive: true, days: [] });
        db.programs.remove('p1');

        const result = await runSync();

        expect(result.pushed).toBe(2);
        expect(result.remaining).toBe(0);
        expect(calls).toContainEqual(['put', '/programs/p1', 'Synced Plan']);
        expect(calls).toContainEqual(['del', '/programs/p1']);
    });

    it('tells the user in Settings when a sync fails', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        db.settings.update({ onboarded: true });
        mockApiState.getHandler = (endpoint) =>
            endpoint === '/workouts'
                ? Promise.reject(httpError(500))
                : Promise.resolve({ data: {} });

        render(
            <Providers>
                <SettingsPage />
            </Providers>,
        );

        fireEvent.click(screen.getByRole('button', { name: /Sync now/i }));

        await waitFor(() => {
            expect(screen.getByText(/Last sync didn't finish/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/safe on this device/i)).toBeInTheDocument();
    });
});
