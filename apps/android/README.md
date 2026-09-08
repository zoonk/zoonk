# Zoonk for Android

This directory contains the native Kotlin and Jetpack Compose app for Android phones, tablets, foldables, ChromeOS, and other resizable Android windows. The current app is intentionally a foundation only: Material 3 adaptive primary navigation and localized placeholder screens for Home, New, Courses, and Progress.

## Requirements

- Android Studio Panda 4 (2025.3.4) or newer
- JDK 21 for Gradle builds and compiler toolchains
- Android SDK Platform 37.0 and Android SDK Build Tools 36.0.0
- An Android Virtual Device for previewing the app

The project pins AGP 9.2.1 and Gradle 9.4.1 because AGP 9.2 is the newest line supported by the currently installed Android Studio. It compiles with API 37 because current Compose requires it, while targeting API 36 until Android 17 behavior changes are deliberately adopted and tested.

Open this directory in Android Studio to use Compose previews and normal Android tooling. The committed Gradle wrapper keeps command-line and CI builds on the same Gradle version.

`gradle/gradle-daemon-jvm.properties` selects JDK 21 for Gradle in Android Studio, the terminal, and CI. Keep this shared configuration in version control. Gradle can download a matching JDK from its configured URLs if none is installed; setting `JAVA_HOME` to a JDK 21 installation avoids that download. Android Studio's own runtime can use a different JDK. Both the app and lint checks compile with JDK 21 while retaining Java 17 bytecode targets; this does not change the minimum supported Android version.

## Commands

Build, install, and launch the Debug app from the repository root:

| Command               | Purpose                                                                           |
| --------------------- | --------------------------------------------------------------------------------- |
| `pnpm android:phone`  | Build and launch on a running or installed phone-sized Android device.            |
| `pnpm android:tablet` | Build and launch on a running or installed tablet-sized Android device.           |
| `pnpm android:build`  | Build the Release app.                                                            |
| `pnpm android:check`  | Run translation checks, tooling/JVM tests, formatting, lint, and a Release build. |

The launch commands prefer an already-running compatible emulator, then choose an installed AVD from conventional phone or tablet profile names. Pass an exact AVD name when automatic selection is not appropriate:

```sh
pnpm android:phone -- Medium_Phone
pnpm android:tablet -- Pixel_Tablet
```

Run commands from this directory:

| Command             | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `make build`        | Build the Release APK.                                              |
| `make test`         | Run local JVM tests for the Debug variant.                          |
| `make ui-test`      | Run instrumented tests on the connected Android device or emulator. |
| `make lint`         | Run Android Lint and fail on warnings.                              |
| `make format`       | Format Kotlin and Gradle Kotlin source files in place.              |
| `make format-check` | Check Kotlin and Gradle Kotlin formatting without changing files.   |
| `make check`        | Run formatting, lint, unit tests, and a Release build.              |

From the repository root, add `-C apps/android`, for example `make -C apps/android check`.

Build outputs live under `app/build/`. The Debug package is `com.zoonk.debug`; the Release application ID remains `com.zoonk`, preserving the ID used by the repository's earlier Android prototype.

## Project structure

```text
app/src/main/kotlin/com/zoonk/android/
  MainActivity.kt          Android lifecycle and edge-to-edge setup
  app/                     Application composition root and previews
  navigation/              Persistent top-level destinations
  feature/<feature>/       Feature-owned screens, state, and behavior
  ui/components/           Repeated app-wide Compose primitives
  ui/theme/                Material 3 theme and dynamic color
```

The app starts as one runtime Gradle module. The separate `lint-checks/` JVM module provides build-time localization checks and is not included in the APK. Feature-first packages keep ownership clear and can move into `:feature:*` modules without reorganizing the product when independent teams, compilation boundaries, or reusable features make that worthwhile. Add ViewModels, repositories, a data layer, Navigation 3, dependency injection, and shared design-system modules only as real features create those needs.

The app follows a single-activity, unidirectional-data-flow architecture. Future composables should render immutable UI state and emit events; screen-level ViewModels should coordinate state; repositories should own data access; and the public Zoonk API should remain behind feature or repository boundaries.

## Adaptive UI

`NavigationSuiteScaffold` supplies a bottom navigation bar for compact windows and a navigation rail for larger windows. Layout choices must follow the current app window, not a device name, physical display size, or orientation. The preview set covers a compact phone, expanded tablet, foldable-sized window, and large French text; runtime checks should still exercise relevant phone, tablet, resize, theme, accessibility, and input behavior.

## Tablet and TalkBack verification

Keep both a phone AVD and a tablet AVD available. In Android Studio's Device Manager, create a device using the **Pixel Tablet** hardware profile and name it `Pixel_Tablet`. Choose a Google Play system image compatible with the host architecture (`arm64-v8a` on Apple Silicon); check that Settings → Accessibility includes TalkBack. A plain AOSP image may not include it. Let a new AVD finish background system-app updates before accessibility testing; those updates can restart TalkBack or its speech engine. Install Android SDK Command-line Tools (latest) in SDK Manager if you need `avdmanager` or `sdkmanager` for terminal setup. See Android's [AVD setup guide](https://developer.android.com/studio/run/managing-avds).

From the repository root:

```sh
pnpm android:phone -- Medium_Phone
pnpm android:tablet -- Pixel_Tablet
make -C apps/android ui-test
```

Use the exact names from Device Manager if they differ. The instrumented test runs on connected devices; check its report under `app/build/reports/androidTests/connected/` to confirm both profiles ran. It checks navigation but does not replace manual TalkBack testing. Instrumentation can remove the Debug APK after testing, so rerun the launch commands before manual QA.

For TalkBack, open the emulator's Settings → Accessibility → TalkBack and enable it. In TalkBack settings, enable **Display speech output** when capturing evidence; its location varies by version. Use one-finger left/right swipes and double-taps in the emulator window, and confirm the accessibility focus actually moves. Keyboard verification is useful too, but the [TalkBack keymap](https://support.google.com/accessibility/android/answer/6110948) differs between versions and should be checked before choosing shortcuts.

For AI-assisted QA, ordinary `adb shell input swipe` may bypass TalkBack's gesture handling. Use the emulator's touch interface or its window for gestures; do not count an injected action as a pass unless the focus and resulting screen are observed. Avoid `uiautomator dump` and instrumented tests during the manual TalkBack pass: their UI automation session can suppress accessibility services. Read UI bounds beforehand, then capture screenshots and TalkBack's live speech output while the service remains active. Follow Android's [accessibility testing guide](https://developer.android.com/guide/topics/ui/accessibility/testing).

Record the AVD names, Android and TalkBack versions, checks performed, and screenshots with the review. Restore the original TalkBack, speech-overlay, font-size, theme, app-language, and rotation settings afterward. Emulator results establish coverage for those virtual profiles, not physical-device certification.

## Localization

English is the complete fallback locale. German, Spanish, French, and generic Portuguese are included in Android resource directories, while Debug builds also expose the `en-XA` and `ar-XB` pseudolocales. Android generates the per-app locale configuration from these resources, so supported users can choose Zoonk's language in system settings without a custom in-app picker.

Add or edit copy in `app/src/main/res/values/strings.xml` and reference it with `stringResource` or `pluralStringResource`. Unlike Xcode's String Catalog extraction, Android resources are authored explicitly; the compiler generates the typed `R.string`/`R.plurals` references. Android Studio's Extract String Resource action can move inline copy into XML.

From the repository root:

```sh
pnpm --filter android i18n       # Translate missing AND changed messages
pnpm --filter android i18n:lint  # Read-only completeness and freshness checks
pnpm android:check              # All localization and native quality checks
```

Root `pnpm i18n` and `pnpm i18n:lint` also include Android. `pnpm --filter android i18n --id navigation_home` intentionally regenerates a particular message even when it is current. Install workspace dependencies with `pnpm install` first; translation uses the same Codex CLI model and authentication as Apple and the web apps. CI only validates committed results and does not need model credentials.

Removing unused English entries and running `pnpm --filter android i18n` also prunes their generated translations without retranslating unchanged copy. The command ends with strict validation; interrupted or incomplete runs cannot report success just because some target text exists.

The `.eloqnt/android-xml.ts` codec wraps [Eloqnt's Android XML format](https://cli.eloqnt.dev/docs/formats/android-xml) using its [custom-codec API](https://cli.eloqnt.dev/docs/formats/custom). It stores generated per-message fingerprints in comments in each target XML file. A fingerprint covers the locale, source text and formatting metadata, and translated value. Changed or untracked values appear as missing to Eloqnt, so normal translation refreshes them and `eloqnt lint --strict` rejects them. Formatting-only XML edits do not invalidate translations; partial translation runs cannot certify unfinished messages. These comments are build-time metadata, not a second runtime translation store. Do not edit them manually.

Target XML is generated from the English resource structure, including printf types, plurals, arrays, and XLIFF metadata. Non-translatable values stay in the default locale. Edit source XML directly and let Eloqnt own target files. Use Android plurals and positional placeholders for dynamic copy, and mark names such as Zoonk with `translatable="false"`.

Supported locales come from `packages/utils/src/locale.ts`, not from whichever directories happen to exist. A missing locale file therefore fails CI; adding a supported locale lets Eloqnt create its target file. Debug pseudolocales are generated by Android and need no translated XML. Translatable strings outside the configured catalogs are rejected; extend the catalog configuration and codec together before adding feature modules, additional catalogs, or qualified string overrides.

Android Lint checks resource references and unused resources. The app's `HardcodedComposeText` rule additionally checks resolved Compose calls, constant text, string templates, annotated text, and accessibility labels. Static analysis cannot prove that arbitrary text arriving through application state or an API is localized; keep those paths and translation quality in human review.

## Continuous integration

`.github/workflows/android.yml` installs JDK 21 and Android SDK Platform 37.0, validates the Gradle wrapper, checks formatting, runs Android Lint (including `HardcodedComposeText`) and JVM/lint-detector tests, and builds the Release APK. The shared `.github/workflows/code-quality.yml` runs strict translation validation through `pnpm i18n:lint` and localization-tooling regression tests through `pnpm test`. Android's Turbo lint inputs include the shared locale/config files so their changes cannot reuse an outdated successful check. Instrumented emulator tests remain local so the pull-request gate stays fast; run `make ui-test` when a user flow changes.

## Troubleshooting

The launcher searches `ANDROID_SDK_ROOT`, `ANDROID_HOME`, and the standard Android SDK locations used by Android Studio. If it cannot find an emulator or `adb`, install Android SDK Platform Tools and the Android Emulator from Android Studio's SDK Manager.

If no compatible AVD is installed, create one in Android Studio's Device Manager and rerun the command with its exact name. Use a phone hardware profile for `android:phone` and a tablet or foldable profile for `android:tablet`; changing the operating-system window size manually is not a substitute for validating the intended hardware profile.
