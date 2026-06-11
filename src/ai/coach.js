/**
 * Coach grounding: turn the user's real data (program, recent sessions,
 * engine suggestions) into a compact system prompt so any model gives
 * answers about *this* lifter, not generic advice.
 */

import { db } from '../data/db';
import { currentProgramWeek, phaseForWeek } from '../engine/generator';
import { suggestNextSession, sessionsForExercise } from '../engine/progression';
import { workoutVolume, trainingStreak } from '../engine/analytics';

export function buildCoachSystemPrompt() {
    const settings = db.settings.get();
    const workouts = db.workouts.list();
    const program = db.programs.getActive();
    const units = settings.units;

    const lines = [
        'You are Coach, the training assistant inside Liftit, a lift-tracking app.',
        'Be concise, concrete, and evidence-based. Use the lifter context below; never invent data.',
        'Progressive overload, RPE-based autoregulation, and recoverable volume are your defaults.',
        '',
        `Lifter: ${settings.name || 'unnamed'} · ${settings.experience} · goal: ${settings.goal} · units: ${units}.`,
    ];

    if (program) {
        const week = currentProgramWeek(program);
        const phase = phaseForWeek(week, program.durationWeeks);
        lines.push(
            `Program: ${program.name}, week ${week}/${program.durationWeeks} (${phase.name}). Days: ${program.days
                .map((d) => d.name)
                .join(', ')}.`,
        );
    } else {
        lines.push('Program: none active (training freestyle).');
    }

    if (workouts.length) {
        lines.push(`History: ${workouts.length} workouts logged; streak ${trainingStreak(workouts)} days.`);
        lines.push('Recent sessions:');
        for (const w of workouts.slice(0, 3)) {
            const date = new Date(w.startedAt).toISOString().slice(0, 10);
            const exercises = [...new Set(w.sets.map((s) => s.exerciseId))]
                .map((id) => db.exercises.byId(id)?.name)
                .filter(Boolean)
                .slice(0, 5)
                .join(', ');
            lines.push(`- ${date} ${w.name}: ${w.sets.length} sets (${exercises}); volume ${Math.round(workoutVolume(w))} kg.`);
        }

        // Engine view of the lifter's main lifts.
        const mainIds = [...new Set(workouts.flatMap((w) => w.sets.map((s) => s.exerciseId)))].slice(0, 4);
        const suggestions = mainIds
            .map((id) => {
                const exercise = db.exercises.byId(id);
                if (!exercise) return null;
                const s = suggestNextSession(sessionsForExercise(workouts, id, 4), {}, {
                    units,
                    isCompound: exercise.isCompound,
                });
                return s.weight ? `- ${exercise.name}: ${s.action} → ${s.reason}` : null;
            })
            .filter(Boolean);
        if (suggestions.length) {
            lines.push('Rule-based progression engine currently says:');
            lines.push(...suggestions);
        }
    } else {
        lines.push('History: no workouts logged yet.');
    }

    lines.push('', 'Weights in history are kg. When you mention weights, convert to the lifter\'s units.');
    return lines.join('\n');
}
