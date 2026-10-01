import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { generateProgram, GOALS, scaleTargetsForWeek, phaseForWeek } from '../engine/generator';
import { GLUTE_GOAL, trainingDaysForGoal, updateTrainingConfig } from '../engine/gluteFocused';
import { getLibraryExercise } from '../data/exercises';
import { db } from '../data/db';
import { programFromFragment, programToFragment } from '../data/shareLinks';
import { DataProvider } from '../data/DataProvider';
import { UnitProvider } from '../contexts/UnitContext';
import { RecoveryProvider } from '../contexts/RecoveryContext';
import { ToastProvider } from '../components/ui/Toast';
import Program from '../pages/Program';
import Workout from '../pages/Workout';
import Onboarding from '../pages/Onboarding';
import { discardSession, getActiveSession, applySessionAction } from '../hooks/useActiveSession';
import { buildCoachSystemPrompt } from '../ai/coach';

const wrap = (node, path = '/program') => <MemoryRouter initialEntries={[path]}><DataProvider><UnitProvider><RecoveryProvider><ToastProvider>{node}</ToastProvider></RecoveryProvider></UnitProvider></DataProvider></MemoryRouter>;
beforeEach(() => { localStorage.clear(); db.wipe(); discardSession(); });

describe('Glute Focused prescriptions', () => {
    it('defaults to three lower sessions and two balanced upper sessions', () => {
        const program = generateProgram({ goal: GLUTE_GOAL });
        expect(GOALS[GLUTE_GOAL].label).toBe('Glute Focused');
        expect(program.days.map(day => day.name)).toEqual(['Quads', 'Upper A', 'Whole Legs', 'Upper B', 'Glutes']);
        expect(program.durationWeeks).toBe(8);
        const quads = program.days[0], whole = program.days[2], glutes = program.days[4];
        expect(quads.exercises[0].exerciseId).toBe('barbell-back-squat');
        expect(glutes.exercises[0].exerciseId).toBe('barbell-hip-thrust');
        expect(glutes.exercises.map(ex => ex.exerciseId)).toEqual(['barbell-hip-thrust', 'romanian-deadlift', 'seated-leg-curl', 'cable-kickback', 'hip-abduction-machine']);
        expect(whole.exercises.every(ex => ex.targetSets === 2)).toBe(true);
        expect(program.rationale).toContain('48 hours');
        expect(program.rationale.length).toBeLessThan(2000);
    });

    for (const lowerBodyDays of [2, 3]) for (const daysPerWeek of trainingDaysForGoal(GLUTE_GOAL, lowerBodyDays)) for (const equipment of ['full', 'home-dumbbell', 'minimal']) {
        it(`keeps ${lowerBodyDays} lower days, upper push/pull and usable alternatives at ${daysPerWeek} days with ${equipment}`, () => {
            const program = generateProgram({ goal: GLUTE_GOAL, lowerBodyDays, daysPerWeek, equipment });
            expect(program.days).toHaveLength(daysPerWeek);
            expect(program.days.filter(day => /Quads|Glutes|Whole Legs/.test(day.name))).toHaveLength(lowerBodyDays);
            expect(program.days.filter(day => day.name.startsWith('Whole Legs'))).toHaveLength(lowerBodyDays === 3 ? 1 : 0);
            const upperDays = program.days.filter(day => day.name.includes('Upper'));
            expect(upperDays.length).toBeGreaterThanOrEqual(2);
            for (const day of program.days) {
                expect(day.exercises.length).toBeGreaterThanOrEqual(4);
                const ids = day.exercises.map(ex => ex.exerciseId);
                expect(new Set(ids).size).toBe(ids.length);
                for (const [i, target] of day.exercises.entries()) {
                    const ex = getLibraryExercise(target.exerciseId);
                    expect(ex).toBeTruthy();
                    expect(target.order).toBe(i + 1);
                    if (equipment !== 'full') expect(equipment === 'minimal' ? ['bodyweight', 'kettlebell'] : ['bodyweight', 'kettlebell', 'dumbbell']).toContain(ex.equipment);
                }
            }
            for (const day of upperDays) {
                const muscles = day.exercises.map(ex => getLibraryExercise(ex.exerciseId).primaryMuscle);
                expect(muscles).toContain('back');
                expect(muscles.some(muscle => ['chest', 'shoulders'].includes(muscle))).toBe(true);
            }
        });
    }

    it('reduces beginner volume, keeps building sets steady, and deloads without a strength peak', () => {
        const novice = generateProgram({ goal: GLUTE_GOAL, experience: 'beginner' });
        const standard = generateProgram({ goal: GLUTE_GOAL });
        expect(novice.days[4].exercises[0].targetSets).toBe(2);
        expect(novice.days[4].exercises[0].targetRpe).toBe(7);
        const target = standard.days[4].exercises[0];
        expect(phaseForWeek(1, 8, GLUTE_GOAL).name).toBe('Foundation');
        expect(phaseForWeek(7, 8, GLUTE_GOAL).name).toBe('Build');
        expect(scaleTargetsForWeek(target, 7, 8, GLUTE_GOAL)).toMatchObject({ targetSets: 3, targetRpe: 8 });
        expect(scaleTargetsForWeek(target, 8, 8, GLUTE_GOAL)).toMatchObject({ targetSets: 2, targetRpe: 6 });
        expect(phaseForWeek(7, 8, 'strength').name).toBe('Realization');
    });

    it('normalizes unsupported schedules and retains the category, days and cues through sharing', () => {
        expect(updateTrainingConfig({ goal: 'strength', daysPerWeek: 6, lowerBodyDays: 2 }, { goal: GLUTE_GOAL })).toMatchObject({ daysPerWeek: 4, durationWeeks: 8 });
        expect(updateTrainingConfig({ goal: GLUTE_GOAL, daysPerWeek: 2, lowerBodyDays: 2 }, { lowerBodyDays: 3 }).daysPerWeek).toBe(3);
        const saved = db.programs.save(generateProgram({ goal: GLUTE_GOAL, daysPerWeek: 6, lowerBodyDays: 3 }));
        expect(saved.daysPerWeek).toBe(5);
        const imported = programFromFragment(programToFragment(saved));
        expect(imported.goal).toBe(GLUTE_GOAL);
        expect(imported.days).toEqual(saved.days);
        expect(imported.isActive).toBe(false);
    });
});

describe('Glute Focused flows', () => {
    it('creates the chosen program, exposes research, and launches its scaled targets and exercise cues', () => {
        const view = render(wrap(<Program />));
        fireEvent.click(screen.getByRole('radio', { name: 'Glute Focused' }));
        fireEvent.click(screen.getByRole('radio', { name: '3 Quads + Glutes + Full Lower body' }));
        fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Days per week' })).getByRole('radio', { name: '5', exact: true }));
        fireEvent.click(screen.getByRole('radio', { name: '12 weeks' }));
        expect(screen.getByRole('region', { name: 'Glute Focused guide' })).toHaveTextContent('Whole Legs');
        fireEvent.click(screen.getByText('Research behind the plan'));
        expect(screen.getByRole('link', { name: /ACSM/ })).toHaveAttribute('href', 'https://acsm.org/resistance-training-guidelines-update-2026/');
        fireEvent.click(screen.getByRole('button', { name: 'Start this program' }));
        expect(db.programs.getActive()).toMatchObject({ goal: GLUTE_GOAL, daysPerWeek: 5, durationWeeks: 12 });
        expect(buildCoachSystemPrompt()).toContain('Glute Focused guidance');
        view.unmount();
        render(wrap(<Workout />, '/workout'));
        fireEvent.click(screen.getByRole('button', { name: 'Start Glutes', exact: true }));
        const session = getActiveSession();
        expect(session.exercises[0]).toMatchObject({ exerciseId: 'barbell-hip-thrust', targetSets: 3, targetRpe: 7.5 });
        expect(session.exercises[0].notes).toContain('ribs down');
        expect(screen.getByText(/Pad the load if needed/)).toBeInTheDocument();
        let result;
        act(() => { result = applySessionAction({ action: 'swap_exercise', exerciseKey: session.exercises[0].key, newExerciseId: 'glute-bridge' }); });
        expect(result.ok).toBe(true);
        expect(getActiveSession().exercises[0].notes).toBe('');
    });

    it('offers the main goal in onboarding and saves the selected two-lower-day option', () => {
        render(wrap(<Onboarding />, '/onboarding'));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Sam' } });
        fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
        fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
        fireEvent.click(screen.getByRole('radio', { name: 'Glute Focused' }));
        fireEvent.click(screen.getByRole('radio', { name: '2 · Quads + Glutes' }));
        fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
        expect(screen.getByText(/over 8 weeks/)).toHaveTextContent('2 lower-body days');
        fireEvent.click(screen.getByRole('button', { name: /Build my program/ }));
        expect(db.settings.get().goal).toBe(GLUTE_GOAL);
        expect(db.programs.getActive().days.map(day => day.name)).toEqual(['Quads', 'Upper A', 'Glutes', 'Upper B']);
    });
});
