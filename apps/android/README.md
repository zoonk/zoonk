# Zoonk for Android

Native Kotlin/Jetpack Compose app for phones, tablets, and foldables. Every page of the web app has a typed route; a route whose feature isn't built yet shows a placeholder.

## Setup

1. Run `pnpm install` from the repository root.
2. Open this directory in Android Studio. Choose a [compatible IDE](https://developer.android.com/studio/releases#android_gradle_plugin_and_android_studio_compatibility) for the AGP version in the [version catalog](gradle/libs.versions.toml).
3. Install the SDK packages listed in the [Android workflow](../../.github/workflows/android.yml), plus Android Emulator. Set `JAVA_HOME` to a JDK matching the [Gradle JVM configuration](gradle/gradle-daemon-jvm.properties).
4. Create phone and tablet AVDs in Device Manager. Use a Google Play image with TalkBack available for accessibility testing.

The launcher detects the standard SDK location; set `ANDROID_HOME` for a custom installation. Use the committed Gradle wrapper rather than a separately installed Gradle.

## Commands

Run from the repository root:

| Command                        | Purpose                                                               |
| ------------------------------ | --------------------------------------------------------------------- |
| `pnpm android:phone`           | Build, install, and launch on a phone emulator.                       |
| `pnpm android:tablet`          | Build, install, and launch on a tablet emulator.                      |
| `pnpm android:build`           | Build the Release APK.                                                |
| `pnpm android:check`           | Run translation checks, tests, formatting, lint, and a Release build. |
| `make -C apps/android lint`    | Check formatting, Android Lint, and the custom lint rules' tests.     |
| `make -C apps/android test`    | Run JVM unit tests.                                                   |
| `make -C apps/android format`  | Format Kotlin and Gradle files.                                       |
| `make -C apps/android ui-test` | Run instrumented tests on connected devices.                          |

The launcher prefers a running compatible emulator. Pass an exact Device Manager name to select another AVD:

```sh
pnpm android:phone -- Medium_Phone
pnpm android:tablet -- Pixel_Tablet
```

Use Android Studio for Compose previews. APKs and test reports are under `app/build/`.

The Makefile shortcuts require GNU Make and a POSIX shell. On native Windows, use `.\gradlew.bat` from this directory with the tasks listed in the [Makefile](Makefile), for example `.\gradlew.bat :app:assembleRelease`.

## Local API

`pnpm dev` writes the API URL it serves for this checkout to `local-development.properties` (ignored by Git), and the next Debug build calls it; without that file, Debug builds call `http://localhost:4000` (`pnpm dev:direct`). On the emulator, `localhost` names resolve to the Mac at `10.0.2.2` and keep their name, so the local proxy still routes them. Android 17 counts the Mac as the local network, so Debug builds ask for `ACCESS_LOCAL_NETWORK`: `pnpm android:phone` and `pnpm android:tablet` grant it on install; after installing another way, run `adb shell pm grant com.zoonk.debug android.permission.ACCESS_LOCAL_NETWORK`. Release builds call `https://api.zoonk.com`.

To sign a Debug build in as a persona, get a session token from the local API with the persona's email (`pnpm dev:persona <name>` prints it) and hand it to the app:

```sh
API=$(sed -n 's/^apiBaseUrl=//p' apps/android/local-development.properties)
curl -s "$API/v1/email-sign-in-codes" -H 'Content-Type: application/json' -d '{"email":"<email>"}'
# The code is in the htmlBody of the newest message to that address: curl -s <mailbox URL>/api/emails
curl -s "$API/v1/sessions/email-code" -H 'Content-Type: application/json' -d '{"email":"<email>","code":"<code>"}'
adb shell am broadcast -a com.zoonk.debug.SIGN_IN -n com.zoonk.debug/com.zoonk.android.app.DebugSignInReceiver --es token <token>
```

## Structure

The [app source](app/src/main/kotlin/com/zoonk/android) is organized into `app/` composition (application, container), `data/` (cache, session, drafts, API runtime), `navigation/`, `feature/<feature>/`, and shared `ui/` packages. [`api/`](api) generates the Kotlin client from `api/openapi.json` on build. `lint-checks/` is build-time tooling, not part of the APK.

Read [AGENTS.md](AGENTS.md) for architecture, platform, and contribution constraints.

## Design system

The theme (`ui/theme`), shared pieces (`ui/components`), formatters (`ui/format`), icons and the debug gallery follow the [design-system reference](../../.agents/skills/android-material-guidelines/references/design-system.md): what each Zoonk meaning maps to, how to regenerate the palette from `globals.css` (`pnpm --filter android palette`), add a Material Symbol (`pnpm --filter android symbol <name>`) and capture the gallery's review screenshots.

## Localization

Author English copy in your feature's `app/src/main/res/values/strings_<feature>.xml`, with names prefixed by the feature (`today_blocks_left`); shared words live in [strings.xml](app/src/main/res/values/strings.xml). Each file is its own Eloqnt catalog. Then use `stringResource` or `pluralStringResource`. Android resources are explicit, not automatically extracted from Kotlin.

```sh
pnpm --filter android i18n       # Translate missing/changed copy and prune removed entries
pnpm --filter android i18n:lint  # Check completeness and freshness without translating
```

Root `pnpm i18n` includes Android. For targeted retranslation, add `--id navigation_today`. Translation uses the shared Codex CLI configuration; CI validates committed translations without model credentials.

Eloqnt owns target XML and fingerprint comments; don't edit them manually. Supported locales live in [locale.ts](../../packages/utils/src/locale.ts). The [codec](scripts/i18n/tracked-android-xml.mts) and [Compose lint rule](lint-checks/src/main/kotlin/com/zoonk/lint/HardcodedComposeTextDetector.kt) define freshness and hardcoded-text checks. Custom composables should use the text parameter names recognized by that rule; dynamic/API text still needs human review.

## Verification

The [Android workflow](../../.github/workflows/android.yml) checks native code and builds; [shared code quality](../../.github/workflows/code-quality.yml) checks translations and TypeScript tooling.

For UI changes, inspect phone and tablet layouts, resizing, large text, and TalkBack. Instrumented tests don't replace manual accessibility testing; relaunch the app afterward if instrumentation removed the Debug APK.

During TalkBack testing, use the emulator window for gestures and verify actual focus and speech output. `adb input` gestures may bypass TalkBack, while UI Automator and instrumentation can suppress accessibility services. Record the device/version and observed results, then restore changed settings. See Android's [accessibility testing guide](https://developer.android.com/guide/topics/ui/accessibility/testing).
