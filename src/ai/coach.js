/**
 * Coach grounding: turn the user's real data (program, recent sessions,
 * engine suggestions) into a compact system prompt so any model gives
 * answers about *this* lifter, not generic advice.
 */

import { db } from '../data/db';
import { currentProgramWeek, phaseForWeek } from '../engine/generator';
import { suggestNextSession, sessionsForExercise } from '../engine/progression';
import { workoutVolume, trainingStreak } from '../engine/analytics';
import { getActiveSession } from '../hooks/useActiveSession';

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

    const session = getActiveSession();
    if (session?.exercises?.length) {
        lines.push(
            '',
            'ACTIVE SESSION (the user is working out right now):',
            ...session.exercises.map(
                (ex) =>
                    `- key ${ex.key}: ${db.exercises.byId(ex.exerciseId)?.name ?? ex.exerciseId}` +
                    ` — ${ex.targetSets} sets × ${ex.targetRepsMin}–${ex.targetRepsMax} reps @ RPE ${ex.targetRpe}` +
                    ` (${ex.sets.filter((s) => s.completed).length}/${ex.sets.length} sets done)`,
            ),
            '',
            ...actionProtocolLines(),
        );
    }

    return lines.join('\n');
}

/**
 * Constrained action protocol. The model may end its reply with ONE strict
 * JSON line (or one fenced ```json block) describing at most 3 actions.
 * Everything is parsed defensively and validated before anything is shown
 * to the user; nothing auto-applies. The model never sets weights — only
 * exercise swaps and target counts/reps.
 */
/** Full action-protocol block + exercise id reference, built when prompted
 * (lazy: the library reference reflects custom exercises added this run). */
function actionProtocolLines() {
    return [
        'ACTIONS — if the user asks you to change their active workout, you may append actions:',
        'End your reply with one line of strict JSON (no prose after it). Supported, exactly:',
        '{"action":"swap_exercise","exerciseKey":"<key from ACTIVE SESSION>","newExerciseId":"<exercise id from the library list below>"}',
        '{"action":"rescale_targets","exerciseKey":"<key>","targetSets":<integer 1-10>}',
        '{"action":"set_target_reps","exerciseKey":"<key>","repsMin":<integer>,"repsMax":<integer>}',
        'You may send an array of up to 3 actions: [{...},{...}].',
        'Never invent exercise ids or set weights; never log sets for the user. If unsure, just answer in prose.',
        'Exercise id → name reference: ' +
            db.exercises
                .all()
                .map((e) => `${e.id} = ${e.name}`)
                .join('; '),
    ];
}

function clampInt(v, lo, hi) {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
}

/** Validate one parsed action; returns a normalized copy or null. */
function validateAction(raw) {
    if (!raw || typeof raw !== 'object' || typeof raw.action !== 'string') return null;
    if (typeof raw.exerciseKey !== 'string' || !raw.exerciseKey) return null;
    const session = getActiveSession();
    if (!session?.exercises?.some((e) => e.key === raw.exerciseKey)) return null;

    if (raw.action === 'swap_exercise') {
        if (typeof raw.newExerciseId !== 'string' || !db.exercises.byId(raw.newExerciseId)) return null;
        return { action: 'swap_exercise', exerciseKey: raw.exerciseKey, newExerciseId: raw.newExerciseId };
    }
    if (raw.action === 'rescale_targets') {
        const targetSets = clampInt(raw.targetSets, 1, 10);
        if (targetSets === null) return null;
        return { action: 'rescale_targets', exerciseKey: raw.exerciseKey, targetSets };
    }
    if (raw.action === 'set_target_reps') {
        let repsMin = clampInt(raw.repsMin, 1, 49);
        let repsMax = clampInt(raw.repsMax, 2, 50);
        if (repsMin === null || repsMax === null) return null;
        if (repsMin >= repsMax) repsMax = Math.min(50, repsMin + 1);
        return { action: 'set_target_reps', exerciseKey: raw.exerciseKey, repsMin, repsMax };
    }
    return null;
}

/**
 * Split a model reply into displayable text and validated actions.
 * Accepts a fenced ```json block or a bare trailing JSON line/array.
 * Malformed or invalid blocks are ignored (the raw text still shows).
 */
export function parseCoachActions(reply) {
    if (typeof reply !== 'string' || !reply.includes('{')) return { text: reply, actions: [] };

    const candidates = [];
    const fenced = [...reply.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
    candidates.push(...fenced);
    const lines = reply.split('\n');
    const last = (lines[lines.length - 1] ?? '').trim();
    const trailingIsJson = !fenced.length && (last.startsWith('{') || last.startsWith('['));
    if (trailingIsJson) candidates.push(last);

    const actions = [];
    for (const candidate of candidates) {
        let parsed;
        try {
            parsed = JSON.parse(candidate);
        } catch {
            continue;
        }
        for (const raw of Array.isArray(parsed) ? parsed : [parsed]) {
            const valid = validateAction(raw);
            if (valid && !actions.some((a) => JSON.stringify(a) === JSON.stringify(valid))) {
                actions.push(valid);
            }
            if (actions.length >= 3) break;
        }
        if (actions.length >= 3) break;
    }

    let text = reply;
    if (actions.length) {
        if (fenced.length) {
            text = reply.replace(/```(?:json)?\s*[\s\S]*?```/gi, '');
        }
        if (trailingIsJson) {
            text = text.split('\n').slice(0, -1).join('\n');
        }
        text = text.trim();
    }
    return { text, actions };
}
