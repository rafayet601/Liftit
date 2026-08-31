//
//  LiftitWatchApp.swift
//  LiftitWatch
//
//  Logging-only Apple Watch companion for Liftit. No history, no programs —
//  the watch mirrors the phone's active session and lets you log sets.
//
//  Communication rides on CapgoWatchSDK (WatchConnector), the watch-side
//  half of @capgo/capacitor-watch. The message protocol is documented in
//  src/lib/watchBridge.js — keep both sides in sync.
//

import SwiftUI
import CapgoWatchSDK

@main
struct LiftitWatchApp: App {
    @StateObject private var model = WatchSessionModel.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
        }
    }
}

// MARK: - Theme helpers (watch target)

extension Color {
    /// #0b0b0c — Liftit ink background.
    static let liftitBackground = Color(red: 0.043, green: 0.043, blue: 0.047)
    /// #8b5cf6 — Liftit accent.
    static let liftitAccent = Color(red: 0.545, green: 0.361, blue: 0.965)
}

extension Font {
    /// Space Grotesk display font when the resource is bundled with the
    /// target; falls back to the system rounded design otherwise.
    static func liftit(_ size: CGFloat, weight: Weight = .bold) -> Font {
        if UIFont(name: "SpaceGrotesk-Bold", size: size) != nil {
            return Font.custom("SpaceGrotesk-Bold", size: size)
        }
        if UIFont(name: "SpaceGrotesk", size: size) != nil {
            return Font.custom("SpaceGrotesk", size: size).weight(weight)
        }
        return Font.system(size: size, design: .rounded).weight(weight)
    }
}
