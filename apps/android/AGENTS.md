# Android app guidance

The [repository guidance](../../AGENTS.md) applies. This file adds Android-specific constraints; setup, commands, and implementation details live in the [README](README.md). Read the sections relevant to the task.

## Scope and architecture

- This Kotlin/Jetpack Compose app targets phones, tablets, foldables, ChromeOS, and resizable Android windows. Main and Apple define product intent and the design system defines meaning; build it with Android's default components, styles, and behavior. Additional platforms such as Wear OS or TV require their own product scope.
- Keep a single-activity app with feature-owned packages and one `:app` runtime module. `:lint-checks` is build-time tooling and stays out of the APK. Extract Gradle modules when ownership, reuse, or build boundaries justify them.
- As features need state and data, use immutable UI state and events, screen-level ViewModels, repositories, and lifecycle-scoped coroutines/Flow. Keep public API transport behind repositories and avoid feature-to-feature implementation dependencies. Add domain layers or dependency injection frameworks only for concrete complexity; constructor injection and app-level wiring are the default.

## Native UI

- For UI, navigation, or interaction work, use [Zoonk design](../../.agents/skills/zoonk-design/SKILL.md) for the experience and what things mean, the [Android Material guidelines skill](../../.agents/skills/android-material-guidelines/SKILL.md) for components, styles, and behavior, and current official documentation relevant to the change. Use what Material 3 and Android provide by default (`MaterialTheme` color, type, and shape roles, the `sp` type scale, Material Symbols, AndroidX components, adaptive scaffolds) and express the design system's meaning through them, with Zoonk's color scheme rather than dynamic color. No raw colors, fixed font sizes, or fixed frames in composables; add custom styles or assets only where no platform equivalent carries the meaning, and make them adapt to dark theme, contrast, and font scale.
- Navigation 3 with typed routes: `navigation/AppRoute.kt` declares every main path with its presentation (tab, page, section, task, web page) and requirement (none, account, goal), and `navigation/AppLink.kt` reads main's URLs into them. A feature registers its routes' screens, with their scene metadata, only in its own `feature/<name>/<Name>Navigation.kt`; a route without its screen shows `RoutePlaceholder`. Features navigate only through `AppNavigator`, which keeps one back stack per tab.
- The shell is Material's navigation suite: a bar on compact windows, a rail on medium ones, and a drawer that also lists the Study places on expanded ones. Tasks cover it. Build tab roots on `TabRootScaffold`, pages on `PageScaffold`, tasks on `TaskScaffold` and pages with an aside on `PageWithSupportingPane`.
- Adapt to the current window size and available space. Preserve state across resizing, folding, rotation, and recreation; keep orientation and resizing unrestricted. Use canonical multi-pane layouts when content benefits from them.
- Preserve edge-to-edge and accessible system bars, consume scaffold padding once, and account for cutouts and the keyboard. Retain Android back behavior, 48dp touch targets, font scaling, TalkBack semantics, RTL, and keyboard/pointer access as relevant controls change.
- When using a Material Symbol, first check what symbol is used for this feature in the `apple` and `main` apps. Then, choose the closest Material Symbol. Symbols/icons should be consistent across platforms.

## Localization contract

- Author app-owned UI copy in `app/src/main/res/values/`, the complete English fallback: one `strings_<feature>.xml` per feature, with every name prefixed by its feature (`today_blocks_left`) because Android merges all files into one namespace, and shared words in `strings.xml`. Use `stringResource` or `pluralStringResource`, positional placeholders, and locale-aware formatting; avoid inline UI text and concatenated sentences. Use `translatable="false"` for intentional fixed product names.
- `@zoonk/utils/locale` owns the supported locale list; `@zoonk/i18n` owns shared translation configuration and style guides. Preserve generated Android locale configuration and system language selection rather than adding a parallel locale store or picker.
- After adding, changing, or deleting English resources, run `pnpm --filter android i18n` from the repository root. It refreshes missing/stale translations, prunes removed entries, and finishes with strict validation. Eloqnt owns target XML and fingerprint comments; do not edit them manually or bypass freshness checks. See [localization details](README.md#localization) for the codec and targeted retranslation workflow.
- Keep translatable resources within the configured catalogs: each `res/values/strings*.xml` is one catalog with `values-<code>/` targets. Extend the catalog configuration and codec together before adding feature-module resources or qualified overrides. Retain completeness, freshness, extra-key, placeholder/plural, unused-resource, and hardcoded Compose text checks. Suppressions need a narrow non-user-facing or preview-only reason; they must not conceal missing translations.
- `HardcodedComposeText` cannot prove that arbitrary text flowing through API responses or application state is localized. Review those paths and translation quality when they change.

## Verification by impact

Follow the root completion and verification policy. The [README command reference](README.md#commands) covers setup and launch options; select checks for the affected behavior:

- For Kotlin, Gradle, or localization-tooling changes, run `pnpm android:check` from the repository root. It covers translation validation, tooling/JVM tests, formatting, Android Lint, and a Release build. For resource-only copy changes, run translation generation, `pnpm --filter android i18n:lint`, and the relevant native resource checks. Documentation-only edits need formatting and link checks, not a native build.
- Use JVM tests for non-trivial logic and semantics-based instrumented tests for user flows. Run `make -C apps/android ui-test` when a user flow changes.
- For adaptive UI changes, inspect affected compact, medium, and expanded windows at runtime. Choose theme, large-text, `en-XA`/`ar-XB` pseudolocale, accessibility, and input checks based on what changed. A build or static preview does not establish runtime behavior; report what was actually observed and any unverified coverage.
