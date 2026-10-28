# Measuring the Android app

How to look at screens and measure requests, memory, leaks, CPU and jank for the Android app. JVM renders need no emulator; everything else runs on an emulator from `apps/android/README.md`. Measure the screens a change touches, before and after, on the same emulator, and put the numbers in the report.

## Look at it without an emulator

Robolectric renders real screens on the JVM in seconds. Use it to check every window size, dark theme, more contrast and large text before opening an emulator. `app/src/testDebug/kotlin/com/zoonk/android/gallery/GalleryScreenshots.kt` is the pattern: `@GraphicsMode(NATIVE)`, Compose UI test v2's `createAndroidComposeRule`, one test per `@Config(qualifiers = "w411dp-h891dp-xxhdpi")` size (`-night` for dark, `RuntimeEnvironment.setFontScale(2f)` for 200%), and `onRoot().captureToImage()` written to a folder only when one is passed:

```sh
./gradlew :app:testDebugUnitTest --tests '*Screenshots*' --rerun -Pzoonk.shots=/path/to/folder
```

Read the PNGs. Images aren't committed and CI doesn't compare pixels. A render shows layout, color and type; it doesn't show system bars, timing or TalkBack, so the emulator check still follows for runtime behavior.

## Set up the emulator

- Start the checkout's backend (`pnpm dev` to iterate, `pnpm start` for timings). Debug builds call the URL it writes to `apps/android/local-development.properties`; on the emulator, `localhost` names resolve to the Mac at `10.0.2.2`.
- Boot your AVD once and keep it: `emulator -avd Medium_Phone -no-snapshot-save &`, then `adb wait-for-device`. Install and launch: `pnpm android:phone -- Medium_Phone`.
- Sign in as a persona copy (`pnpm dev:persona <name>`) with the token recipe in `apps/android/README.md`'s "Local API".
- Other agents may run Zoonk on another emulator: pass `-s <serial>` to every `adb` command (`adb devices`), and take your app's process: `PID=$(adb -s $SERIAL shell pidof com.zoonk.debug)`.

## Requests per screen and per tab switch

Debug builds log one `ZoonkHttp` line per finished request (method, path, status, time), API calls and private pictures alike:

```sh
adb logcat -c
# … use the app: open the screen, switch tabs, come back …
adb logcat -d -s ZoonkHttp:I
```

The line: returning to a tab or screen whose data is fresh makes no request; opening a screen reads each resource it shows once; a mutation refreshes only the resources it changed; rotating, folding or resizing makes no request; repeat picture loads come from Coil's memory cache.

## Memory and leaks

```sh
adb shell dumpsys meminfo com.zoonk.debug | grep -E 'TOTAL PSS|Java Heap|Native Heap|Graphics'
```

Repeat the same navigation loop ten times and compare `TOTAL PSS` and the Java heap after the first loop and the last: they must stay flat. Then open 30 different lessons, courses or tutor threads one after another and back out of each: memory may grow by the few recent ones the keyed stores keep, then stays flat, and reopening a recent one makes no request while an old one reloads. `adb shell am send-trim-memory com.zoonk.debug BACKGROUND` releases the rest.

LeakCanary runs in debug builds and reports a retained object after the screen holding it closes:

```sh
adb logcat -d | grep -E 'LeakCanary.*(Retained|leak)'
```

Each reported leak has a trace in the LeakCanary app on the device. For a heap to read on the Mac: `adb shell am dumpheap com.zoonk.debug /data/local/tmp/zoonk.hprof && adb pull /data/local/tmp/zoonk.hprof`, then open it in Android Studio's profiler.

## CPU and jank

- **Idle:** with nothing driving the app, read its CPU ticks before and after 30 seconds; an idle screen stays near zero, and a timer, animation or polling loop shows up here:

  ```sh
  adb shell cat /proc/$PID/stat | awk '{print $14 + $15}'   # user + system ticks, 100 per second
  ```

- **Frames:** reset, run the interaction (scroll a list, switch tabs), then read the summary:

  ```sh
  adb shell dumpsys gfxinfo com.zoonk.debug reset
  # … interact …
  adb shell dumpsys gfxinfo com.zoonk.debug | grep -E 'Total frames|Janky frames|50th|90th|95th|99th'
  ```

  Janky frames above a few percent, or a 90th percentile over the frame budget, need a trace.

- **Trace:**

  ```sh
  adb shell perfetto -o /data/misc/perfetto-traces/zoonk.pftrace -t 10s gfx view am wm sched freq
  adb pull /data/misc/perfetto-traces/zoonk.pftrace
  ```

  Open it in `https://ui.perfetto.dev` (it runs locally in the browser) and read the app's `Choreographer#doFrame` and `Recomposer` slices on the main thread.

- **Startup:** debug builds are much slower than release, so compare startup only between builds of the same type: `adb shell am start -W -n com.zoonk.debug/com.zoonk.android.MainActivity` prints `TotalTime` (force-stop the app first for a cold start).

## State across recreation and process death

- Rotation, fold and resize: rotate in the emulator, `adb shell wm size 1280x800` then `adb shell wm size reset`, or fold a foldable AVD from its extended controls. The screen keeps its scroll, its tab and the learner's input, and sends no request.
- Process death: open a screen with work in progress, press Home (`adb shell input keyevent KEYCODE_HOME`), kill the process (`adb shell am kill com.zoonk.debug`), reopen it from Recents. The tab, back stack, scroll and drafts come back; each screen reads its data once. "Don't keep activities" (`adb shell settings put global always_finish_activities 1`, then `0`) recreates on every leave.

## Settings to test against

```sh
adb shell cmd uimode night yes                                   # dark; "no" to restore
adb shell settings put system font_scale 2.0                     # 200% text; 1.0 to restore
adb shell settings put secure contrast_level 1.0                 # more contrast (API 34+); 0 to restore
adb shell settings put global animator_duration_scale 0          # remove animations; 1 to restore
adb shell cmd locale set-app-locales com.zoonk.debug --locales en-XA   # pseudolocale (API 33+); ar-XB for RTL
```

TalkBack: turn it on in the emulator's Settings (Play images) and use the emulator window for gestures; `adb input` can bypass it. Restore every setting you changed.

## Report

For each screen or flow the change touches: the JVM renders you checked (sizes, dark, contrast, font scale), requests on first open, on return and on each tab switch (before and after), `TOTAL PSS` after one and ten loops, LeakCanary's result, idle CPU ticks, janky frames for scrolls and tab switches, and what survived rotation and process death. Save the commands' output next to the screenshots.
