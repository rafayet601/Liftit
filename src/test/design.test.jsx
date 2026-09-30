import React, { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import Home from '../pages/Home';
import { db } from '../data/db';
import { DataProvider } from '../data/DataProvider';
import { UnitProvider } from '../contexts/UnitContext';
import { ModalProvider } from '../contexts/ModalContext';
import { discardSession, startSession } from '../hooks/useActiveSession';
import { generateProgram } from '../engine/generator';
import { analyzeDoubleProgression, getProgressionRecommendation } from '../engine/progression';
import { Segmented, Sheet } from '../components/ui/Primitives';

const wrap = (node) => <MemoryRouter><DataProvider><UnitProvider><ModalProvider>{node}</ModalProvider></UnitProvider></DataProvider></MemoryRouter>;

beforeEach(() => {
    localStorage.clear();
    db.wipe();
    discardSession();
    window.history.replaceState({}, '', '/');
});

describe('Training dashboard', () => {
    it('advances the preview after a logged program day and links real sessions', () => {
        const program = db.programs.save(generateProgram({ goal: 'hypertrophy', daysPerWeek: 4, experience: 'intermediate' }));
        db.workouts.save({ id: 'recent', name: 'Yesterday upper', programId: program.id, programDayNumber: 1, startedAt: new Date().toISOString(), sets: [{ exerciseId: 'barbell-bench-press', weight: 60, reps: 8 }] });
        render(wrap(<Home />));
        expect(screen.getByRole('heading', { name: 'Lower A' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Yesterday upper/ })).toHaveAttribute('href', '/history/recent');
        expect(screen.getByText(/1 exercise/)).toBeInTheDocument();
    });

    it('offers resume without replacing the saved workout draft', () => {
        startSession({ name: 'Saved workout' });
        render(wrap(<Home />));
        expect(screen.getByRole('link', { name: /Resume Workout/ })).toHaveAttribute('href', '/workout');
        expect(screen.getByRole('heading', { name: 'Saved workout' })).toBeInTheDocument();
        act(() => discardSession());
        expect(screen.getByRole('link', { name: /Start Workout/ })).toBeInTheDocument();
    });

    it('uses preferred units in the digest as well as the volume metrics', () => {
        db.settings.update({ units: 'lbs' });
        db.workouts.save({ id: 'volume', startedAt: new Date().toISOString(), sets: [{ exerciseId: 'barbell-bench-press', weight: 100, reps: 10 }] });
        render(wrap(<Home />));
        expect(screen.getByTestId('digest-card')).toHaveTextContent('2,205 lbs this week');
        expect(screen.getByTestId('digest-card')).not.toHaveTextContent(/\bkg\b/);
    });

    it('treats a first session as a baseline rather than a decline', () => {
        const sessions = [{ startedAt: new Date().toISOString(), sets: [{ weight: 60, reps: 8 }] }];
        expect(getProgressionRecommendation(sessions, analyzeDoubleProgression(sessions))).toMatchObject({ title: 'Building your baseline', priority: 'info', action: null });
        expect(getProgressionRecommendation(sessions, { trend: 'insufficient_data' }).action).toBeNull();
    });

    it('mounts Progress through the real app with a working recovery provider', () => {
        db.settings.update({ onboarded: true });
        window.history.replaceState({}, '', '/progress');
        render(<App />);
        expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Settings', exact: true })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open Coach' })).toBeInTheDocument();
    });
});

describe('Keyboard access', () => {
    it('uses arrow keys and Home/End to select and focus choices with a single tab stop', () => {
        function Options() {
            const [value, setValue] = useState('kg');
            return <Segmented label="Weight unit" value={value} onChange={setValue} options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lbs', label: 'Pounds' }]} />;
        }
        render(<Options />);
        const kg = screen.getByRole('radio', { name: 'Kilograms' });
        const lbs = screen.getByRole('radio', { name: 'Pounds' });
        kg.focus();
        fireEvent.keyDown(kg, { key: 'ArrowRight' });
        expect(lbs).toHaveFocus();
        expect(lbs).toHaveAttribute('aria-checked', 'true');
        expect(kg).toHaveAttribute('tabindex', '-1');
        fireEvent.keyDown(lbs, { key: 'Home' });
        expect(kg).toHaveFocus();
        fireEvent.keyDown(kg, { key: 'End' });
        expect(lbs).toHaveFocus();
    });

    it('keeps keyboard focus inside a sheet and returns it to its trigger', () => {
        function Dialog() {
            const [open, setOpen] = useState(false);
            return <><button onClick={() => setOpen(true)}>Open details</button>{open && <Sheet onClose={() => setOpen(false)} title="Details"><input aria-label="Notes" /><button>Save</button></Sheet>}</>;
        }
        render(<Dialog />);
        const trigger = screen.getByRole('button', { name: 'Open details' });
        trigger.focus();
        fireEvent.click(trigger);
        expect(screen.getByRole('dialog', { name: 'Details' })).toHaveFocus();
        const save = screen.getByRole('button', { name: 'Save' });
        save.focus();
        fireEvent.keyDown(save, { key: 'Tab' });
        expect(screen.getByRole('button', { name: 'Close', exact: true })).toHaveFocus();
        fireEvent.keyDown(document.activeElement, { key: 'Tab', shiftKey: true });
        expect(save).toHaveFocus();
        fireEvent.keyDown(save, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });
});
