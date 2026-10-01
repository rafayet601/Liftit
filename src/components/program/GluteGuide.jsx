import React from 'react';
import { GLUTE_GOAL, GLUTE_STUDIES, gluteSchedule } from '../../engine/gluteFocused';
import { getLibraryExercise } from '../../data/exercises';

export default function GluteGuide({ program }) {
    if (program.goal !== GLUTE_GOAL) return null;
    const lowerDays = program.days.some(day => day.name.startsWith('Whole Legs')) ? 3 : 2;
    const exercises = program.days.flatMap(day => day.exercises);
    const gluteSets = exercises.reduce((total, target) => {
        const exercise = getLibraryExercise(target.exerciseId);
        const abduction = target.exerciseId.includes('abduction');
        return total + (!abduction && (exercise?.primaryMuscle === 'glutes' || exercise?.isCompound && exercise.secondaryMuscles.includes('glutes')) ? target.targetSets : 0);
    }, 0);
    const abductionSets = exercises.filter(target => target.exerciseId.includes('abduction')).reduce((total, target) => total + target.targetSets, 0);
    return (
        <section aria-label="Glute Focused guide" className="space-y-3 rounded-xl border border-accent/20 bg-accent/5 p-4">
            <h3 className="text-sm font-bold text-white">Your weekly rhythm</h3>
            <p className="text-sm leading-relaxed text-ink-300">{gluteSchedule(program.daysPerWeek, lowerDays)}</p>
            <p className="text-xs leading-relaxed text-ink-400">Keep at least 48 hours between lower-body sessions. {lowerDays === 3 ? 'Whole Legs is the lighter session: quads, glutes and hamstrings together.' : 'At two or three training days, upper-body lifts are mixed into the lower sessions.'} Adjust the schedule to your recovery.</p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-accent">
                <span className="rounded-lg border border-accent/15 px-2.5 py-1.5">Sets involving glutes: {gluteSets} / week</span>
                {abductionSets > 0 && <span className="rounded-lg border border-accent/15 px-2.5 py-1.5">{abductionSets} hip-abduction sets / week</span>}
            </div>
            <p className="text-xs leading-relaxed text-ink-400">Base targets before the deload. Squats, lunges and hinges share work with other muscles, so this is an exercise-set count, not a count of isolated glute sets.</p>
            <details className="text-xs text-ink-400">
                <summary className="cursor-pointer py-2 font-semibold text-accent">Progression and recovery</summary>
                <ul className="list-disc space-y-2 pl-4 leading-relaxed">
                    <li>Warm up with easy practice sets. Keep the same main lifts through the block so you can compare performance.</li>
                    <li>Start with {program.experience === 'beginner' ? 'about three' : 'about two'} reps in reserve. The first two weeks use slightly easier effort. Add reps, then the smallest load increase when all sets reach the top of the range at the planned effort.</li>
                    <li>The final week reduces sets and effort. If soreness, technique or performance worsens, reduce a set or load sooner and allow more recovery.</li>
                    <li>Women can build muscle with the same progressive-training principles. Adjust to your own sleep, energy and menstrual symptoms when relevant. A 2026 trial found no added growth or strength advantage from scheduling training volume by menstrual phase.</li>
                </ul>
            </details>
            <details className="text-xs text-ink-400">
                <summary className="cursor-pointer py-2 font-semibold text-accent">Research behind the plan</summary>
                <p className="mb-2 leading-relaxed">Exercise choices draw on training studies, including research in women. This exact split and its equipment substitutions have not been tested as a single protocol.</p>
                <ul className="space-y-2">
                    {GLUTE_STUDIES.map(study => <li key={study.url}><a href={study.url} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4">{study.label}<span className="sr-only"> (opens in a new tab)</span></a></li>)}
                </ul>
            </details>
        </section>
    );
}
