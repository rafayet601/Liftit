//
//  SetRowView.swift
//  LiftitWatch
//
//  One set line: number, weight × reps, target hint, done checkmark.
//

import SwiftUI

struct SetRowView: View {
    let set: WatchSet
    let targetReps: String
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 6) {
            Text("\(set.index + 1)")
                .font(.liftit(13))
                .foregroundColor(isSelected ? .liftitBackground : .gray)
                .frame(width: 18, height: 18)
                .background(
                    Capsule().fill(isSelected ? Color.liftitAccent : Color.white.opacity(0.08))
                )

            Text("\(set.weight, specifier: weightSpecifier)kg × \(set.reps)")
                .font(.liftit(14))
                .foregroundColor(set.done ? .gray : .white)
                .strikethrough(set.done, color: .gray)

            if !targetReps.isEmpty && !set.done {
                Text("· \(targetReps)")
                    .font(.liftit(11, weight: .regular))
                    .foregroundColor(.liftitAccent)
            }

            Spacer(minLength: 0)

            if set.done {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
                    .font(.system(size: 13))
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(isSelected ? Color.white.opacity(0.06) : Color.clear)
        )
        .contentShape(Rectangle())
    }

    private var weightSpecifier: String {
        set.weight.truncatingRemainder(dividingBy: 1) == 0 ? "%.0f" : "%.1f"
    }
}
