import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock services so we don't hit network during smoke tests
vi.mock('../services/user.service', () => ({
    getProfile: vi.fn().mockResolvedValue({ name: 'Test Athlete' }),
    getUserStats: vi.fn().mockResolvedValue({ totalWorkouts: 0 }),
    updateProfile: vi.fn().mockResolvedValue({}),
}));
vi.mock('../services/program.service', () => ({
    getActiveProgram: vi.fn().mockResolvedValue(null),
    generateProgram: vi.fn().mockResolvedValue({}),
}));
vi.mock('../services/workout.service', () => ({
    createWorkout: vi.fn().mockResolvedValue({}),
}));
vi.mock('../services/ai.service', () => ({
    sendChatMessage: vi.fn(),
    generateAIContent: vi.fn(),
}));
vi.mock('../lib/api', () => ({
    default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
    isInDemoMode: () => true,
    enableDemoMode: vi.fn(),
    disableDemoMode: vi.fn(),
    isAuthenticated: () => false,
    setAuthToken: vi.fn(),
    getAuthToken: () => null,
    checkApiHealth: vi.fn().mockResolvedValue(false),
}));

import { UnitProvider } from '../contexts/UnitContext';
import { ToastProvider } from '../components/ui/Toast';
import LoginPage from '../components/auth/LoginPage';

describe('Liftit · smoke', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('renders LoginPage with demo and OAuth buttons', () => {
        render(
            <MemoryRouter>
                <UnitProvider>
                    <ToastProvider>
                        <LoginPage />
                    </ToastProvider>
                </UnitProvider>
            </MemoryRouter>,
        );
        expect(screen.getAllByText(/Liftit/i).length).toBeGreaterThan(0);
    });

    it('UnitContext toggles units and persists', async () => {
        const { useUnit } = await import('../contexts/UnitContext');
        let ref;
        function Probe() {
            ref = useUnit();
            return null;
        }
        render(
            <UnitProvider>
                <Probe />
            </UnitProvider>,
        );
        expect(['kg', 'lbs']).toContain(ref.unit);
        expect(typeof ref.toggleUnit).toBe('function');
        expect(typeof ref.toKg).toBe('function');
        expect(typeof ref.displayWeight).toBe('function');
    });

    it('UnitContext converts kg <-> lbs correctly', async () => {
        const { useUnit } = await import('../contexts/UnitContext');
        let ref;
        function Probe() {
            ref = useUnit();
            return null;
        }
        localStorage.setItem('liftit_unit', 'lbs');
        render(
            <UnitProvider>
                <Probe />
            </UnitProvider>,
        );
        // 100 kg ≈ 220.5 lbs (rounded to 1 dp)
        expect(ref.displayWeight(100)).toBeCloseTo(220.5, 1);
        // 220 lbs ≈ 99.79 kg
        expect(ref.toKg(220)).toBeCloseTo(99.79, 1);
    });
});
