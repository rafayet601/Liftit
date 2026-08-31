# Apple Watch Companion — Xcode Setup

The phone side (JS bridge, plugin wiring, AppDelegate) is already done in
code. What remains **cannot** be done from the CLI: registering the watchOS
app target in Xcode. Follow these steps once, then build to real devices.

> **Real devices required.** WatchConnectivity does not work between the iOS
> and watchOS simulators — `WCSession.isReachable` stays `false` and context
> never syncs. Test on a paired iPhone + Apple Watch.

Current state of the repo (nothing to redo):

- `@capgo/capacitor-watch@8.1.3` is in `package.json` and already referenced
  by `ios/App/CapApp-SPM/Package.swift` (added by `npx cap sync ios`).
- `ios/App/App/AppDelegate.swift` activates WCSession early but deliberately
  does **not** set `WCSession.default.delegate` — the plugin installs its own
  `WatchSessionDelegate` in `load()` and routes watch messages to JS. The
  plugin README mentions `CapWatchSessionDelegate.shared`, but that symbol
  does not exist in v8.1.3; do not add it.
- Watch UI sources live in `ios/Watch/LiftitWatch/` (plain Swift files —
  Xcode needs copies inside its target, see step 4).
- Message protocol: see the header of `src/lib/watchBridge.js`.

## Steps

### 1. Open the workspace

```bash
npm run ios:open   # opens ios/App/App.xcworkspace in Xcode
```

### 2. Add the watchOS App target

1. Select the **App** project (blue icon) in the navigator.
2. **File → New → Target…** → watchOS tab → **App** → Next.
3. Configure:
   - **Product Name**: `LiftitWatch`
   - **Bundle Identifier**: `com.liftit.app.watchkitapp`
     (Xcode pre-fills this pattern from the main app: `<main id>.watchkitapp`.
     `com.liftit.app.watchkitapp` is what this repo expects.)
   - **Language**: Swift · **User Interface**: SwiftUI
   - **Watch-only App**: off (it must be a companion app)
   - Uncheck "Include Notification Scene" / "Include Complication" — not
     needed for logging-only.
4. If Xcode offers to activate the watch scheme, accept.

### 3. Capabilities (both targets)

For **App** (iOS) and **LiftitWatch** (watchOS), in *Signing & Capabilities*:

1. **+ Capability → Background Modes** — check *Background fetch* and
   *Remote notifications* (lets the plugin wake for context transfers).
2. **+ Capability → Push Notifications** (per the plugin's requirements).

The WatchConnectivity framework itself needs no capability entry on either
side — it is linked automatically once the code imports it.

### 4. Add the Swift sources to the watch target

1. In Finder, locate `ios/Watch/LiftitWatch/` — it contains:
   `LiftitWatchApp.swift`, `WatchSessionModel.swift`, `ContentView.swift`,
   `SetRowView.swift`.
2. If Xcode created placeholder files with the same names in the new target
   group, delete the placeholders first.
3. Drag the four files into the `LiftitWatch` group in Xcode. In the dialog:
   - **Destination**: ✔ Copy items if needed (or leave unchecked — but then
     keep `ios/Watch/` as the source of truth)
   - **Added to targets**: ✔ **LiftitWatch** only. Not the App target.
4. Optional (fonts): drop `SpaceGrotesk-Bold.otf` / `SpaceGrotesk-Regular.otf`
   into the target and add them to *Build Phases → Copy Bundle Resources*.
   The UI falls back to the system rounded font without them.

### 5. Add the CapgoWatchSDK package to the watch target

The watch app talks to the phone through the plugin's watch-side SDK.

1. Select the project → **Package Dependencies** → **+**.
2. Enter: `https://github.com/Cap-go/capacitor-watch.git`
   - Dependency rule: *Up to Next Major* from `8.1.3`.
   - (Offline alternative: *Add Local…* and pick
     `node_modules/@capgo/capacitor-watch/watch-sdk` — works, but breaks the
     build wherever `node_modules` isn't restored, so prefer the GitHub URL.)
3. When asked to choose products, select **CapgoWatchSDK** and add it to the
   **LiftitWatch** target only. The main app already gets the plugin through
   `CapApp-SPM` — do not add the SDK product to it.
4. Confirm under **LiftitWatch → General → Frameworks, Libraries** that
   `CapgoWatchSDK` is listed.

### 6. Build & sign

1. Set the **LiftitWatch** scheme → destination: your paired Apple Watch.
2. Set the **App** scheme → destination: your iPhone.
3. Let Xcode fix signing for both targets (same team as the main app).
4. Run the **App** scheme on the iPhone first, then the **LiftitWatch**
   scheme on the watch.

### 7. Verify the loop

1. Start any workout on the phone (Workout → Start freestyle).
2. The watch should show the session name, exercises and sets within a few
   seconds (application-context sync).
3. Pick an exercise, bump weight/reps, tap **Complete set** — the set turns
   green on the watch and appears completed in the phone's session.
4. Finish/discard the workout on the phone → watch returns to
   "No active session".

## How the bridge degrades

| Situation | Behavior |
|---|---|
| Web / PWA build | `import('@capgo/capacitor-watch')` resolves to the plugin's web stub, `getInfo()` reports `isSupported: false` — the bridge never wires listeners; `pushWatchContext` is a no-op. |
| Native, no watch app installed | `getInfo()` reports `isWatchAppInstalled: false`; context pushes still succeed silently (WCSession queues them) and are picked up if the watch app is installed later. |
| Watch unreachable mid-workout | `updateApplicationContext` is latest-value-wins and does not require reachability; only the watch's `log_set` messages fail, and the watch shows "iPhone offline". |
| Watch target never registered | Everything above still runs; the watch companion simply doesn't exist. No phone-side errors. |

## Troubleshooting

- **"WCSession session is not activated" rejects in JS** — the first context
  push can race activation; the bridge logs a warning and the next snapshot
  (any set edit) re-pushes. This is expected and harmless.
- **Watch shows stale sets after logging on the phone** — context is
  latest-value-wins and may take a beat to re-sync; opening the workout on
  the phone triggers a fresh push.
- **Messages arrive but sets don't apply** — check that `log_set` is sent
  with the exact `exerciseKey` from the context snapshot (session keys are
  regenerated on every new session).
