import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '../data/db';
import { DataProvider } from '../data/DataProvider';
import { UnitProvider } from '../contexts/UnitContext';
import { RecoveryProvider } from '../contexts/RecoveryContext';
import { discardSession, startSession, makeSessionExercise, getActiveSession } from '../hooks/useActiveSession';
import Workout from '../pages/Workout';
import History from '../pages/History';
import Progress from '../pages/Progress';
import SetRow from '../components/workout/SetRow';
import RestTimer from '../components/workout/RestTimer';

const wrap = node => <MemoryRouter><DataProvider><UnitProvider><RecoveryProvider>{node}</RecoveryProvider></UnitProvider></DataProvider></MemoryRouter>;
const date = days => new Date(Date.now() - days * 86400000).toISOString();
const save = (id, days, name = 'Training', weight = 60) => db.workouts.save({ id, name, startedAt: date(days), durationSec: 600, notes: id === 'recent' ? 'Smooth tempo today' : '', sets: [{ exerciseId: 'barbell-bench-press', weight, reps: 8 }] });
beforeEach(() => { localStorage.clear(); db.wipe(); discardSession(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function LoggingRow({ initial = { weight: 0, reps: 0, completed: false }, ghost }) {
    const [set, setSet] = useState(initial);
    return <SetRow set={set} index={0} ghost={ghost} onChange={patch => setSet(value => ({ ...value, ...patch }))} onComplete={values => setSet(value => ({ ...value, ...values, completed: true }))} onUndo={() => setSet(value => ({ ...value, completed: false }))} />;
}

describe('Gym logging', () => {
    it('completes on the first tap without requiring blur, preserves decimals, and supports undo', () => {
        render(wrap(<LoggingRow />));
        fireEvent.change(screen.getByLabelText('weight in kg'), { target: { value: '60.' } });
        expect(screen.getByLabelText('weight in kg')).toHaveValue('60.');
        fireEvent.change(screen.getByLabelText('weight in kg'), { target: { value: '60.5' } });
        fireEvent.change(screen.getByLabelText('reps', { exact: true }), { target: { value: '8' } });
        fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }));
        expect(screen.getByRole('button', { name: 'Undo set 1' })).toBeEnabled();
        expect(screen.getByLabelText('weight in kg')).toHaveValue('60.5');
        fireEvent.click(screen.getByRole('button', { name: 'Undo set 1' }));
        expect(screen.getByRole('button', { name: 'Complete set 1' })).toBeEnabled();
    });
    it('copies the previous set and preserves an explicitly entered zero against ghost steppers', () => {
        render(wrap(<LoggingRow ghost={{ weight: 60, reps: 8, rpe: 8 }} />));
        fireEvent.click(screen.getByRole('button', { name: 'Use last set' }));
        expect(screen.getByLabelText('reps', { exact: true })).toHaveValue('8');
        fireEvent.change(screen.getByLabelText('weight in kg'), { target: { value: '0' } });
        fireEvent.click(screen.getByRole('button', { name: 'Increase weight in kg' }));
        expect(screen.getByLabelText('weight in kg')).toHaveValue('2.5');
    });
    it('persists typed values, confirms a partial finish, and saves only completed sets', () => {
        startSession({ name: 'Upper session', exercises: [makeSessionExercise({ exerciseId: 'barbell-bench-press', targetSets: 2 })] });
        render(wrap(<Workout />));
        fireEvent.change(screen.getAllByLabelText('weight in kg')[0], { target: { value: '60' } });
        fireEvent.change(screen.getAllByLabelText('reps', { exact: true })[0], { target: { value: '8' } });
        expect(getActiveSession().exercises[0].sets[0]).toMatchObject({ weight: 60, reps: 8, completed: false });
        fireEvent.click(screen.getByRole('button', { name: 'Complete set 1' }));
        expect(getActiveSession().rest.endAt).toBeGreaterThan(Date.now());
        fireEvent.click(screen.getByRole('button', { name: 'Finish Workout' }));
        expect(screen.getByRole('dialog', { name: 'Finish this workout?' })).toHaveTextContent('1 of 2 sets completed');
        expect(db.workouts.list()).toHaveLength(0);
        fireEvent.click(screen.getByRole('button', { name: 'Save 1 completed set' }));
        expect(db.workouts.list()[0].sets).toHaveLength(1);
        expect(screen.queryByRole('region', { name: 'Rest timer' })).not.toBeInTheDocument();
    });
    it('keeps logged work unless removal is explicitly confirmed', () => {
        const entry = makeSessionExercise({ exerciseId: 'barbell-bench-press', targetSets: 1 });
        entry.sets[0] = { weight: 60, reps: 8, completed: true };
        startSession({ name: 'Upper', exercises: [entry] });
        render(wrap(<Workout />));
        fireEvent.click(screen.getByRole('button', { name: 'Remove', exact: true }));
        expect(screen.getByRole('dialog', { name: /Remove Barbell Bench Press/ })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Keep exercise' }));
        expect(getActiveSession().exercises).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'Remove', exact: true }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove exercise', exact: true }));
        expect(getActiveSession().exercises).toHaveLength(0);
    });
});

describe('Rest deadlines', () => {
    it('catches up after a background interval, survives callback changes and can extend a completed rest', () => {
        vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-30T12:00:00Z'));
        const start = Date.now(), done = vi.fn(), extension = vi.fn();
        const view = render(<RestTimer seconds={120} endAt={start + 120000} onDone={done} onExtend={extension} />);
        act(() => vi.advanceTimersByTime(1000));
        expect(screen.getByRole('timer')).toHaveTextContent('1:59');
        view.rerender(<RestTimer seconds={120} endAt={start + 120000} onDone={() => done()} onExtend={extension} />);
        vi.setSystemTime(start + 125000);
        act(() => fireEvent(document, new Event('visibilitychange')));
        expect(screen.getByText('Rest complete')).toBeInTheDocument();
        expect(done).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Add 30 seconds to rest' }));
        expect(screen.getByRole('timer')).toHaveTextContent('0:30');
        expect(extension).toHaveBeenCalledWith(Date.now() + 30000, 30);
        fireEvent.click(screen.getByRole('button', { name: 'Skip rest' }));
        expect(done).toHaveBeenCalledTimes(1);
    });
});

describe('History discovery', () => {
    it('combines exercise/notes search with dates and offers a recoverable empty result', () => {
        save('recent', 1, 'Upper'); save('old', 100, 'Earlier upper');
        render(wrap(<History />));
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'smooth tempo' } });
        expect(screen.getByRole('link', { name: /Upper/ })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Earlier upper/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
        fireEvent.click(screen.getByRole('radio', { name: '30 days' }));
        expect(screen.queryByRole('link', { name: /Earlier upper/ })).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no match' } });
        expect(screen.getByText('No matching workouts')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
        expect(screen.getAllByRole('link')).toHaveLength(2);
    });
    it('restores a deleted workout including its notes and sets', () => {
        save('recent', 1, 'Upper');
        render(<MemoryRouter initialEntries={['/history/recent']}><DataProvider><UnitProvider><Routes><Route path="/history/:id?" element={<History />} /></Routes></UnitProvider></DataProvider></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Delete workout' }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
        expect(db.workouts.list()).toHaveLength(0);
        fireEvent.click(screen.getByRole('button', { name: 'Undo delete' }));
        expect(db.workouts.list()[0]).toMatchObject({ id: 'recent', notes: 'Smooth tempo today', sets: [{ weight: 60, reps: 8 }] });
    });
});

describe('Progress ranges', () => {
    it('uses calendar days rather than session counts, and keeps older history in All time', () => {
        save('recent', 1); save('old', 400);
        render(wrap(<Progress />));
        expect(screen.getByText('One session in this range. Log another session to see how this lift changes.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('radio', { name: 'All time' }));
        expect(screen.queryByText('One session in this range. Log another session to see how this lift changes.')).not.toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Exercise' })).toHaveValue('barbell-bench-press');
        fireEvent.click(screen.getByRole('radio', { name: 'Volume', exact: true }));
        expect(screen.queryByText('Estimated strength')).not.toBeInTheDocument();
    });
});
