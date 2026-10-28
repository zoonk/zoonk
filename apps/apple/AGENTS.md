# Apple App Instructions

These instructions apply to the native iPhone and iPad app in this directory and supplement the repository-level instructions in `../../AGENTS.md`.

## Apple UI guidance

- For UI and interaction decisions, use [Zoonk design](../../.agents/skills/zoonk-design/SKILL.md) for the product's look and experience and [Apple Human Interface Guidelines](../../.agents/skills/apple-human-interface-guidelines/SKILL.md) for native controls and platform behavior, and consult the relevant official platform documentation. Framework-independent logic and documentation edits do not require a UI-guidance pass.
- Prefer native SwiftUI containers and semantic APIs before adding custom view hierarchies, state synchronization, platform branches, or animation workarounds. Consult official examples and validate a small equivalent implementation when platform behavior is uncertain.
- **System defaults first.** Use what Apple provides by default so the system handles Dynamic Type, Increase Contrast, Dark Mode, accessibility, window sizes and new devices: semantic system colors, the system font through text styles, SF Symbols, native default components and system spacing. Match the design system's meaning through the closest system API; [the design-system mapping](../../.agents/skills/apple-human-interface-guidelines/references/design-system.md) lists which one carries each role. Use custom colors, styles or assets only where no system equivalent carries the meaning (such as belt and character artwork), and make them adapt to dark, Increase Contrast and Dynamic Type too. Don't hard-code hex colors, point sizes or fixed frames.
- Main defines product intent, copy, business behavior, API contracts, information hierarchy, icons (as the closest SF Symbol) and screen structure. Apple defines controls, navigation, gestures, input, styling and accessibility.
- Design for every size one binary runs at: compact iPhone screens, iPhone Duo's outer and inner displays (folded too), regular-width iPad layouts, multitasking, resizable iPad windows, and the Designed for iPad Mac and Vision destinations. Adapt with size classes, safe areas and adaptive containers, never device checks.
- Preserve Dynamic Type, VoiceOver semantics, contrast, safe areas, keyboard behavior, focus behavior and reduced-motion settings by relying on native components and avoiding fixed-size assumptions.
- Keep grouped controls visually consistent in height, alignment, typography, shape, and prominence while still allowing localized labels and Dynamic Type to expand when needed.
- For dense visualizations, separate visible mark size from the interaction surface. Make data explorable with simple touch, pointer, keyboard, and VoiceOver interactions instead of turning tiny marks into tiny controls.
- When using an SF Symbol, first check what symbol is used for this feature in the `main` app. Then, choose the closest SF Symbol. Symbols/icons should be consistent across platforms.

## Platform Architecture

- The deployment target is iOS 26: use iOS 26 APIs (Liquid Glass, the current `TabView` and toolbar APIs) directly, and guard only newer APIs with `if #available(iOS 27, *)` or `27.1`. The app is unreleased, so don't add fallbacks for older systems.
- Keep one `Zoonk` application target for iPhone and iPad. Both devices should use the same feature code and adapt through SwiftUI size classes and native containers rather than separate implementations.
- Keep the Designed for iPhone/iPad compatibility destinations enabled for Apple silicon Mac and Apple Vision Pro. They run the iPad app and are not independently maintained native targets.
- Keep application lifecycle and dependency composition in the `App` folder. Organize product code vertically by feature rather than creating global `Views`, `Models`, or `ViewModels` buckets.
- Keep UI-test fixtures in `ZoonkUITests` and limit app-side launch decoding to the Debug-only `Zoonk/Testing` boundary. Inject ordinary initial state through the app composition root; never parse test arguments or embed fixture data in product views, stores, or clients.
- Extract stable, independently owned domains or sufficiently large features into local Swift packages when real module boundaries emerge.
- Use Swift concurrency and value types by default. Keep observable state at the narrowest owning feature boundary and avoid introducing view models that only relay data without adding domain behavior.
- Scope every asynchronous result and credential mutation to the full session identity that started it. Before publishing or deleting state, confirm that identity is still current and test meaningful request-order races.
- Treat initial loading and refresh as different experiences. Deduplicate only in-flight work, preserve valid content during revalidation, and make authentication loss lead to a recoverable screen rather than stranded loading UI.

## Navigation and Presentation

- Use `TabView` with `Tab` values, a `NavigationStack` per tab and `.tabViewStyle(.sidebarAdaptable)` for the primary navigation shell, allowing SwiftUI to adapt between iPhone, iPhone Duo and iPad. App-wide search is a `Tab(role: .search)`.
- A tab represents a persistent top-level destination, never an immediate action. Use toolbars, menus, sheets, or confirmation dialogs for actions according to the conventions of the current platform.
- Let iPad adopt its native sidebar-style tab presentation instead of forcing an iPhone-style bottom tab bar at regular widths.
- Put screen titles and navigation actions in `NavigationStack` navigation titles and toolbars. Do not recreate navigation bars or bottom bars with safe-area insets, fixed headers or overlays: the system moves bars to a vertical side bar on iPhone Duo, and a fake bar won't follow. Give toolbar items a `Label` with a title and an SF Symbol.
- When completing a modal flow is required, disable interactive dismissal and hide every dismissal affordance until completion; hiding only a close button is insufficient.

## Localization

- Keep user-facing text in native Xcode String Catalogs. Let the operating system select the app language; do not add a custom locale switcher or parallel translation store.
- Prefer source-driven extraction. Pass English string literals directly to localizable SwiftUI or Foundation APIs, include a translator comment, and specify the owning feature catalog with `table: "<Feature>"`. Build the app to let Xcode add and update catalog entries automatically. Do not add `extractionState: "manual"` or catalog-first semantic keys unless a specific use case requires generated symbols whose values must change independently from their keys.
- Keep String Catalogs together in `Zoonk/Resources/Localization`, named by their owning feature or app surface, such as `Account.xcstrings` and `Navigation.xcstrings`. Keep catalog basenames unique and stable within the target; Eloqnt discovers every catalog in this directory automatically.
- After building to extract changed strings, run `pnpm --filter apple i18n` from the repository root to translate them and `pnpm --filter apple i18n:lint` to validate the catalogs. Never edit generated translations in `.xcstrings` files manually.
- Reuse the main app's established wording when it fits native Apple UI, but prefer concise platform-standard terminology when the web wording is not appropriate for a native control.
- Treat dates, times, durations, and measurements as semantic values. Choose calendar and time-zone behavior intentionally, use native formatters, and test meaningful boundaries across locales.

## Performance

- Screens feel instant: show cached data at once and revalidate in the background; show a loading state only when nothing is cached. Keep data in app-scoped stores so it survives tab switches and navigation, load each fact once, and never refetch on every appear.
- Keep view bodies cheap and dependencies narrow (see Fast SwiftUI in the [Apple skill](../../.agents/skills/apple-human-interface-guidelines/SKILL.md)). Measure requests per screen, memory, leaks, CPU and hangs on the simulator with the [verify skill's Apple reference](../../.agents/skills/verify/references/apple.md) whenever a change touches data loading, stores, navigation or long-lived state, and report the numbers before and after.

## Verification

- For app code changes, build the iOS target. For UI or adaptive-layout changes, inspect the affected iPhone, iPhone Duo and iPad destinations because one binary can render differently across size classes, displays and multitasking widths. Documentation-only edits need document validation, not a simulator run.
- Prefer UI tests for user flows and unit tests for non-trivial pure domain logic. Do not test SwiftUI implementation details or static catalog contents.
- When changing asynchronous observable stores, cover the affected success, authentication-expiry, transient-failure, and request-order transitions directly; UI tests alone may miss state-machine races.
- Never call Apple UI work complete based only on builds or automated tests. Inspect the rendered result on relevant iPhone and iPad simulators in light, dark and Increase Contrast and at a large Dynamic Type size, compare it with the matching `main` screen, compare neighboring controls for alignment and visual consistency, and verify accessibility, localization, focus, window sizing, and input behavior in proportion to the change.
