# expo-audio Android foreground-service repro

Minimal repro for an Android `RemoteServiceException` crash in `expo-audio`'s
`AudioControlsService`. The service can return from `onStartCommand` without
calling `Service.startForeground()`, which is a foreground-service contract
violation. Android kills the process about five seconds later.

See `App.js` for four scenarios that exercise the suspect paths.

## Run it

```sh
npm install
npx expo prebuild --platform android --clean
npx expo run:android
```

Then tap a scenario button and press Home to background the app. Watch
`adb logcat` for `RemoteServiceException` lines.

## What's defective

`packages/expo-audio/android/src/main/java/expo/modules/audio/service/AudioControlsService.kt`,
lines 66 to 91 on `main`:

```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
  val currentPlayerRef = currentPlayer?.ref ?: return super.onStartCommand(intent, flags, startId)  // (A)
  val context = appContext ?: return super.onStartCommand(intent, flags, startId)                   // (B)
  ...
  postOrStartForegroundNotification(startInForeground = false)  // (C)
  return super.onStartCommand(intent, flags, startId)
}
```

Three problems:

- (A) and (B) return early when state isn't wired up, so `startForeground()`
  is never called even though the service was started via
  `Context.startForegroundService()`.
- (C) only calls `NotificationManager.notify()`, not `startForeground()`. The
  promotion to foreground only happens later in `setActivePlayerInternal`,
  which dispatches the call onto `appContext.mainQueue.launch { ... }` — an
  async hop that races the five-second deadline.

## Notes on reproducing

The bug is timing-sensitive. On a fresh API 36 emulator I couldn't trigger
it deterministically with the scenarios in `App.js`; the production crash we
hit came from an Android 11 Samsung device that was already backgrounded
when the service was restarted (`in_foreground: false` in Sentry tags). The
race shows up most easily on slower devices, older Android versions, or after
the OS has killed and restarted the audio service.
