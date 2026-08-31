//
//  WatchSessionModel.swift
//  LiftitWatch
//
//  ObservableObject bridging CapgoWatchSDK's WatchConnector to the UI.
//  Ingests the phone's application context (session snapshot) and sends
//  `log_set` / `request_state` messages back. See src/lib/watchBridge.js
//  for the protocol definition.
//

import Foundation
import Combine
import WatchConnectivity
import CapgoWatchSDK

// MARK: - Snapshot types

struct WatchSet: Identifiable, Equatable {
    let index: Int
    var weight: Double   // kg
    var reps: Int
    var done: Bool

    var id: Int { index }
}

struct WatchExercise: Identifiable, Equatable {
    let key: String
    let name: String
    let targetRepsMin: Int
    let targetRepsMax: Int
    var sets: [WatchSet]

    var id: String { key }

    var nextIncompleteIndex: Int? {
        sets.firstIndex(where: { !$0.done })
    }
}

// MARK: - Model

final class WatchSessionModel: ObservableObject {

    static let shared = WatchSessionModel()

    @Published private(set) var hasSession = false
    @Published private(set) var sessionId: String = ""
    @Published private(set) var sessionName = ""
    @Published private(set) var exercises: [WatchExercise] = []

    @Published private(set) var isReachable = false
    @Published private(set) var lastError: String?

    private init() {
        // SDK pattern (watch-sdk README): attach delegate, activate, and
        // pick up any context that arrived before we were listening.
        WatchConnector.shared.delegate = self
        WatchConnector.shared.activate()
        isReachable = WatchConnector.shared.phoneIsReachable
        ingest(context: WatchConnector.shared.receivedApplicationContext)
    }

    // MARK: Context ingestion (phone → watch)

    func ingest(context: [String: Any]) {
        guard context["kind"] as? String == "session",
              let sid = context["sessionId"] as? String else {
            applySnapshot(nil)
            return
        }
        guard let rawExercises = context["exercises"] as? [[String: Any]] else {
            applySnapshot(nil)
            return
        }

        let parsed: [WatchExercise] = rawExercises.compactMap { raw in
            guard let key = raw["key"] as? String else { return nil }
            let sets = (raw["sets"] as? [[String: Any]] ?? []).map { s in
                WatchSet(
                    index: (s["i"] as? Int) ?? 0,
                    weight: (s["w"] as? Double) ?? ((s["w"] as? NSNumber)?.doubleValue ?? 0),
                    reps: (s["r"] as? Int) ?? 0,
                    done: (s["done"] as? Bool) ?? false
                )
            }
            return WatchExercise(
                key: key,
                name: (raw["name"] as? String) ?? key,
                targetRepsMin: (raw["targetRepsMin"] as? Int) ?? 0,
                targetRepsMax: (raw["targetRepsMax"] as? Int) ?? 0,
                sets: sets
            )
        }

        DispatchQueue.main.async {
            self.hasSession = true
            self.sessionId = sid
            self.sessionName = (context["name"] as? String) ?? "Workout"
            self.exercises = parsed
            self.lastError = nil
        }
    }

    private func applySnapshot(_ snapshot: [String: Any]?) {
        guard let snapshot else {
            DispatchQueue.main.async {
                self.hasSession = false
                self.sessionId = ""
                self.sessionName = ""
                self.exercises = []
            }
            return
        }
        ingest(context: snapshot)
    }

    // MARK: Logging (watch → phone)

    /// Send `log_set` for the given set. Optimistically marks the set done;
    /// the phone's fresh application context overwrites our local state and
    /// keeps both sides honest.
    func completeSet(exercise: WatchExercise, set: WatchSet) {
        guard set.index < exercise.sets.count else { return }
        let message: [String: Any] = [
            "action": "log_set",
            "exerciseKey": exercise.key,
            "setIndex": set.index,
            "weight": set.weight,
            "reps": set.reps,
        ]
        markDone(exerciseKey: exercise.key, setIndex: set.index, done: true)
        send(message) { [weak self] reply in
            if reply["ok"] as? Bool != true {
                DispatchQueue.main.async {
                    self?.lastError = "Phone didn't accept that set"
                }
                // Re-sync from the phone's authoritative snapshot.
                self?.requestState()
            }
        }
    }

    /// Ask the phone for the current session snapshot.
    func requestState() {
        send(["action": "request_state"]) { [weak self] reply in
            guard let snapshot = reply["session"] as? [String: Any] else { return }
            self?.applySnapshot(snapshot)
        }
    }

    func ping() {
        send(["action": "ping"], replyHandler: nil)
    }

    private func send(
        _ message: [String: Any],
        replyHandler: (([String: Any]) -> Void)?
    ) {
        WatchConnector.shared.sendMessage(
            message,
            replyHandler: replyHandler,
            errorHandler: { [weak self] _ in
                DispatchQueue.main.async {
                    self?.isReachable = false
                    self?.lastError = "iPhone not reachable"
                }
            }
        )
    }

    // MARK: Local edits (steppers) — synced to the phone on "Complete set"

    func adjustWeight(exercise: WatchExercise, setIndex: Int, newValue: Double) {
        DispatchQueue.main.async {
            guard let ei = self.exercises.firstIndex(where: { $0.key == exercise.key }),
                  setIndex < self.exercises[ei].sets.count else { return }
            self.exercises[ei].sets[setIndex].weight = max(0, newValue)
        }
    }

    func adjustReps(exercise: WatchExercise, setIndex: Int, _ newValue: Int) {
        DispatchQueue.main.async {
            guard let ei = self.exercises.firstIndex(where: { $0.key == exercise.key }),
                  setIndex < self.exercises[ei].sets.count else { return }
            self.exercises[ei].sets[setIndex].reps = max(0, newValue)
        }
    }

    private func markDone(exerciseKey: String, setIndex: Int, done: Bool) {
        DispatchQueue.main.async {
            guard let ei = self.exercises.firstIndex(where: { $0.key == exerciseKey }),
                  setIndex < self.exercises[ei].sets.count else { return }
            self.exercises[ei].sets[setIndex].done = done
        }
    }
}

// MARK: - WatchConnectorDelegate (CapgoWatchSDK)

extension WatchSessionModel: WatchConnectorDelegate {

    func didReceiveApplicationContext(_ context: [String: Any]) {
        ingest(context: context)
    }

    func didReceiveUserInfo(_ userInfo: [String: Any]) {
        // Not part of protocol v1 — application context is authoritative.
    }

    func didReceiveMessage(_ message: [String: Any]) {
        // Protocol v1 has no phone→watch interactive messages.
    }

    func didReceiveMessage(_ message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        replyHandler(["ok": false])
    }

    func reachabilityDidChange(_ isReachable: Bool) {
        DispatchQueue.main.async {
            self.isReachable = isReachable
            if isReachable { self.lastError = nil }
        }
    }

    func activationDidComplete(with state: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isReachable = WatchConnector.shared.phoneIsReachable
        }
        if error == nil {
            // The context may have landed between activation and delegate
            // attachment — pull it once more.
            ingest(context: WatchConnector.shared.receivedApplicationContext)
        }
    }
}
