//
//  ContentView.swift
//  LiftitWatch
//
//  Single-screen logging UI: pick an exercise, pick a set, adjust weight
//  (2.5 kg steps) and reps, complete. Connection status up top.
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var model: WatchSessionModel

    var body: some View {
        ZStack {
            Color.liftitBackground.ignoresSafeArea()
            if model.hasSession {
                SessionLoggingView()
            } else {
                IdleView()
            }
        }
    }
}

// MARK: - No active session

private struct IdleView: View {
    @EnvironmentObject var model: WatchSessionModel

    var body: some View {
        VStack(spacing: 8) {
            ConnectionBadge(reachable: model.isReachable)
            Spacer()
            Image(systemName: "dumbbell.fill")
                .font(.system(size: 34))
                .foregroundColor(.liftitAccent)
            Text("No active session")
                .font(.liftit(16))
                .foregroundColor(.white)
            Text("Start a workout on your iPhone")
                .font(.liftit(12, weight: .regular))
                .foregroundColor(.gray)
            Spacer()
        }
        .padding(.horizontal, 4)
    }
}

// MARK: - Active session

private struct SessionLoggingView: View {
    @EnvironmentObject var model: WatchSessionModel
    @State private var exerciseIndex = 0
    @State private var setIndex = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ConnectionBadge(reachable: model.isReachable)

            if let error = model.lastError {
                Text(error)
                    .font(.liftit(11, weight: .semibold))
                    .foregroundColor(.orange)
                    .lineLimit(1)
            }

            Picker("Exercise", selection: $exerciseIndex) {
                ForEach(Array(model.exercises.enumerated()), id: \.offset) { idx, ex in
                    Text(ex.name).tag(idx)
                }
            }
            .pickerStyle(.navigationLink)
            .onChange(of: exerciseIndex) { _ in
                setIndex = model.exercises[min(exerciseIndex, model.exercises.count - 1)]
                    .nextIncompleteIndex ?? 0
            }

            if let exercise = currentExercise {
                SetListView(exercise: exercise, selection: $setIndex)
                SetEditor(exercise: exercise, setIndex: setIndex)
                    .frame(maxHeight: .infinity, alignment: .bottom)
            } else {
                Spacer()
            }
        }
        .padding(.horizontal, 4)
        .onAppear {
            setIndex = model.exercises[min(exerciseIndex, max(model.exercises.count - 1, 0))]
                .nextIncompleteIndex ?? 0
        }
    }

    private var currentExercise: WatchExercise? {
        guard model.exercises.indices.contains(exerciseIndex) else { return nil }
        return model.exercises[exerciseIndex]
    }
}

// MARK: - Set list

private struct SetListView: View {
    let exercise: WatchExercise
    @Binding var selection: Int

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 4) {
                ForEach(exercise.sets) { set in
                    SetRowView(
                        set: set,
                        targetReps: repsTargetLabel(exercise),
                        isSelected: set.index == selection
                    )
                    .onTapGesture { selection = set.index }
                }
            }
        }
        .frame(maxHeight: 110)
    }

    private func repsTargetLabel(_ exercise: WatchExercise) -> String {
        guard exercise.targetRepsMin > 0 else { return "" }
        if exercise.targetRepsMin == exercise.targetRepsMax {
            return "\(exercise.targetRepsMin)"
        }
        return "\(exercise.targetRepsMin)–\(exercise.targetRepsMax)"
    }
}

// MARK: - Steppers + complete button

private struct SetEditor: View {
    @EnvironmentObject var model: WatchSessionModel
    let exercise: WatchExercise
    let setIndex: Int

    var body: some View {
        VStack(spacing: 8) {
            if let set = exercise.sets.first(where: { $0.index == setIndex }) {
                Stepper(value: Binding(
                    get: { set.weight },
                    set: { model.adjustWeight(exercise: exercise, setIndex: setIndex, newValue: $0) }
                ), in: 0...500, step: 2.5) {
                    HStack {
                        Text("\(set.weight, specifier: set.weight.truncatingRemainder(dividingBy: 1) == 0 ? "%.0f" : "%.1f")")
                            .font(.liftit(20))
                        Text("kg")
                            .font(.liftit(12, weight: .regular))
                            .foregroundColor(.gray)
                    }
                }

                Stepper(value: Binding(
                    get: { Double(set.reps) },
                    set: { model.adjustReps(exercise: exercise, setIndex: setIndex, Int($0)) }
                ), in: 0...100, step: 1) {
                    HStack {
                        Text("\(set.reps)")
                            .font(.liftit(20))
                        Text("reps")
                            .font(.liftit(12, weight: .regular))
                            .foregroundColor(.gray)
                    }
                }

                Button {
                    model.completeSet(exercise: exercise, set: set)
                } label: {
                    Label(set.done ? "Re-log set" : "Complete set", systemImage: "checkmark.circle.fill")
                        .font(.liftit(15))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.liftitAccent)
                .disabled(!model.isReachable)
            }
        }
    }
}

// MARK: - Connection badge

struct ConnectionBadge: View {
    let reachable: Bool

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(reachable ? Color.green : Color.orange)
                .frame(width: 6, height: 6)
            Text(reachable ? "iPhone connected" : "iPhone offline")
                .font(.liftit(11, weight: .semibold))
                .foregroundColor(.gray)
        }
    }
}
