# Android app guidance

The [repository guidance](../../AGENTS.md) applies. This file adds Android-specific constraints; setup, commands, and implementation details live in the [README](README.md). Read the sections relevant to the task.

## Scope and architecture

- This Kotlin/Jetpack Compose app targets phones, tablets, foldables, ChromeOS, and resizable Android windows. Main and Apple define product intent; port requested behavior using Android conventions. Additional platforms such as Wear OS or TV require their own product scope.
- Keep a single-activity app with feature-owned packages and one `:app` runtime module. `:lint-checks` is build-time tooling and stays out of the APK. Extract Gradle modules when ownership, reuse, or build boundaries justify them.
- As features need state and data, use immutable UI state and events, screen-level ViewModels, repositories, and lifecycle-scoped coroutines/Flow. Keep public API transport behind repositories and avoid feature-to-feature implementation dependencies. Add domain layers or dependency injection frameworks only for concrete complexity; constructor injection and app-level wiring are the default.

## Native UI

- For UI, navigation, or interaction work, use the [Android Material guidelines skill](../../.agents/skills/android-material-guidelines/SKILL.md) and current official documentation relevant to the change. Prefer Material 3/AndroidX components, semantic theme colors, dynamic color, Material Symbols, and platform behavior.
- Keep `NavigationSuiteScaffold` for adaptive top-level navigation. The destination enum and saveable state serve the current shell; introduce Navigation 3 with typed routes and independent top-level back stacks when nested navigation or deep links require it.
- Adapt to the current window size and available space. Preserve state across resizing, folding, rotation, and recreation; keep orientation and resizing unrestricted. Use canonical multi-pane layouts when content benefits from them.
- Preserve edge-to-edge and accessible system bars, consume scaffold padding once, and account for cutouts and the keyboard. Retain Android back behavior, 48dp touch targets, font scaling, TalkBack semantics, RTL, and keyboard/pointer access as relevant controls change.
- When using a Material Symbol, first check what symbol is used for this feature in the `apple` and `main` apps. Then, choose the closest Material Symbol. Symbols/icons should be consistent across platforms.

## Localization contract

- Author app-owned UI copy in `app/src/main/res/values/strings.xml`, the complete English fallback. Use `stringResource` or `pluralStringResource`, positional placeholders, and locale-aware formatting; avoid inline UI text and concatenated sentences. Use `translatable="false"` for intentional fixed product names.
- `@zoonk/utils/locale` owns the supported locale list; `@zoonk/i18n` owns shared translation configuration and style guides. Preserve generated Android locale configuration and system language selection rather than adding a parallel locale store or picker.
- After adding, changing, or deleting English resources, run `pnpm --filter android i18n` from the repository root. It refreshes missing/stale translations, prunes removed entries, and finishes with strict validation. Eloqnt owns target XML and fingerprint comments; do not edit them manually or bypass freshness checks. See [localization details](README.md#localization) for the codec and targeted retranslation workflow.
- Keep translatable resources within the configured catalogs. Extend the catalog configuration and codec together before adding feature-module resources, additional catalogs, or qualified overrides. Retain completeness, freshness, extra-key, placeholder/plural, unused-resource, and hardcoded Compose text checks. Suppressions need a narrow non-user-facing or preview-only reason; they must not conceal missing translations.
- `HardcodedComposeText` cannot prove that arbitrary text flowing through API responses or application state is localized. Review those paths and translation quality when they change.

## Verification by impact

Follow the root completion and verification policy. The [README command reference](README.md#commands) covers setup and launch options; select checks for the affected behavior:

- For Kotlin, Gradle, or localization-tooling changes, run `pnpm android:check` from the repository root. It covers translation validation, tooling/JVM tests, formatting, Android Lint, and a Release build. For resource-only copy changes, run translation generation, `pnpm --filter android i18n:lint`, and the relevant native resource checks. Documentation-only edits need formatting and link checks, not a native build.
- Use JVM tests for non-trivial logic and semantics-based instrumented tests for user flows. Run `make -C apps/android ui-test` when a user flow changes.
- For adaptive UI changes, inspect affected compact, medium, and expanded windows at runtime. Choose theme, large-text, `en-XA`/`ar-XB` pseudolocale, accessibility, and input checks based on what changed. A build or static preview does not establish runtime behavior; report what was actually observed and any unverified coverage.
