# Apple App Instructions

These instructions apply to the native iPhone and iPad app in this directory and supplement the repository-level instructions in `../../AGENTS.md`. The [README](README.md) has the commands, local setup, the API client, StoreKit, crash reports and usage analytics setup.

## Apple UI guidance

- For UI and interaction decisions, use [Zoonk design](../../.agents/skills/zoonk-design/SKILL.md) for the product's look and experience and [Apple Human Interface Guidelines](../../.agents/skills/apple-human-interface-guidelines/SKILL.md) for native controls and platform behavior, and consult the relevant official platform documentation. Framework-independent logic and documentation edits do not require a UI-guidance pass.
- **System defaults first.** Use Apple's defaults and carry the design system's meaning through the closest system API, as the Apple skill and [the design-system mapping](../../.agents/skills/apple-human-interface-guidelines/references/design-system.md) say. Prefer native SwiftUI containers and semantic APIs before custom view hierarchies, state synchronization, platform branches or animation workarounds, and validate a small equivalent when platform behavior is uncertain.
- Main defines the product: intent, copy, behavior, API contracts, information hierarchy, screen structure and icons (as the closest SF Symbol to the one `main` uses, so icons match across platforms). Apple defines controls, navigation, gestures, input, styling and accessibility.
- One binary runs on compact iPhones, iPhone Duo's outer and inner displays (folded too), iPad at every window size and in multitasking, and the Designed for iPad destinations on Mac and Vision Pro. Adapt with size classes, safe areas, measured width and adaptive containers, never device checks.
- **iPhone Duo:** open, it reads like an open wallet: two panes either side of the fold, never a stretched iPhone column or an iPad layout. Build with the fold-aware pieces in `DesignSystem` (`PaneSplit`, `PaneBeside`, `.lonePage()`, `.keepsOffFold()`) instead of reading the fold yourself; [the mapping's iPhone Duo section](../../.agents/skills/apple-human-interface-guidelines/references/design-system.md#iphone-duo) says which one a screen uses and what goes in each pane.
- Folding, unfolding, rotating and resizing re-lay out live and recreate pane content. Keep what the learner made (answers, drafts, selection, open panels) in the owning store, in state above the split, or in a view `PaneBeside` keeps; derive a field's text from its draft, and don't animate the switch. An activity canvas keeps the learner's work in `@ActivityState` and only momentary things in `@State`.
- Keep grouped controls visually consistent in height, alignment, typography, shape, and prominence while still allowing localized labels and Dynamic Type to expand when needed.
- For dense visualizations, separate visible mark size from the interaction surface. Make data explorable with simple touch, pointer, keyboard, and VoiceOver interactions instead of turning tiny marks into tiny controls.

## Platform Architecture

- The deployment target is iOS 26: use iOS 26 APIs (Liquid Glass, the current `TabView` and toolbar APIs) directly, and guard only newer APIs with `if #available(iOS 27, *)` or `27.1`. The app is unreleased, so don't add fallbacks for older systems.
- Keep one `Zoonk` application target with the same feature code for iPhone and iPad, and keep the Designed for iPad destinations on Mac and Vision Pro enabled; they run the iPad app and aren't separate targets.
- Keep application lifecycle and dependency composition in the `App` folder. Organize product code vertically by feature rather than creating global `Views`, `Models`, or `ViewModels` buckets.
- The local `ZoonkAPI` package owns the generated client and its hand-written lesson wire models, so app edits don't recompile it; app runtime glue stays in `Zoonk`. The [README](README.md#api-client) says how to add an operation and regenerate the contract.
- Keep UI-test fixtures in `ZoonkUITests` and limit app-side launch decoding to the Debug-only `Zoonk/Testing` boundary. Inject ordinary initial state through the app composition root; never parse test arguments or embed fixture data in product views, stores, or clients.
- Extract stable, independently owned domains or sufficiently large features into local Swift packages when real module boundaries emerge.
- Use Swift concurrency and value types by default. Keep observable state at the narrowest owning feature boundary and avoid introducing view models that only relay data without adding domain behavior.
- Scope every asynchronous result and credential mutation to the full session identity that started it. Before publishing or deleting state, confirm that identity is still current and test meaningful request-order races.
- Fire usage analytics with `UsageAnalytics.track(_:)` where main fires the same browser event, adding its case to `AnalyticsEvent` with main's name and properties. Never track an outcome a write makes, which core already sends, and don't gate an event yourself: `UsageAnalytics` decides what reaches PostHog.

## Data loading and caching

Every read a screen shows and every write goes through `Zoonk/Data`, so screens are instant on return, a refresh keeps valid content, and losing the session leads to a recoverable screen. Don't reimplement any of it in a store.

- Stores create their reads with `cache.resource(audience:domains:maxAge:isEmpty:fetch:)` on the `AppCache` from `App/AppDependencies.swift` and own the returned `Resource`. Stores live for the app's lifetime and are injected with `.environment`, so data survives tab switches and navigation. Pick the `audience` by whose data it is (`ResourceAudience`).
- A screen shows a resource with `.loads(store.thing)` (several: `.loads(a, b)`) and switches on `store.thing.state`; retry buttons call `refresh()`. Never start requests in `onAppear` or a bare `.task`, and never keep a second copy of a resource's value in view state.
- Keyed reads (a course by id) are a dictionary of resources created on first use, like `CourseCatalogStore.course(id:)`. Pagination appends with `resource.update` after checking `resource.revision` didn't change while the page loaded.
- Run every write through `cache.mutate(invalidating:_:)`, invalidating every `DataDomain` it changed: the same tags main revalidates in `packages/core/src/cache/tags.ts`. When the response carries the new value, show it with `resource.update` and invalidate the other domains it touched. Roll an optimistic change back only on `.failed`. Changes a learner can make faster than they save, such as settings, go through `QueuedSaves`. Own the task that runs a write and cancel it when its screen goes away.
- State that belongs to one learner but isn't a resource (a "Memory updated" notice, an undo, a save error) keeps the identity it was made for and is hidden once the session changes.
- Feature APIs throw `APIError` and run generated calls through `APIClientFactory.perform(token:operation:)`. Generation progress comes from `APIClientFactory.generationEvents(id:token:)`; screens stop at the event they need and never read a run's status themselves.
- Read frame state (goals, tier, today, level) from `LearnerSummaryStore` instead of fetching it per screen.
- Test a store only for logic it owns (races, session changes, request order, rollbacks), with unit tests against an API stub. A rule core decides belongs in core's tests, and `ResourceTests` already covers loading, staleness, dedupe, session races and invalidation.

## Navigation and Presentation

- Navigation is per window: each window owns its `AppRouter` and what its session is playing (`SessionPlayback`), while stores stay app-wide, so two Zoonk windows on iPad or the open iPhone Duo navigate and play independently.
- A settings page opened from elsewhere opens the account sheet at that page with `AppSheet.account(_:)`, so back leads to the settings list.
- Guard an iOS 27 toolbar API (`visibilityPriority`, `ToolbarOverflowMenu`) by choosing the whole `.toolbar` with `if #available` outside it, never inside its builder, as `DesignSystem/TaskToolbar.swift` does and explains.

## Localization

- Keep user-facing text in native Xcode String Catalogs in `Zoonk/Resources/Localization`, one per feature or app surface, with unique and stable basenames. Let the operating system select the app language; do not add a custom locale switcher or parallel translation store.
- Pass English string literals directly to localizable SwiftUI or Foundation APIs with a translator comment and `table: "<Feature>"`, and build the app so Xcode extracts them. Do not add `extractionState: "manual"` or catalog-first semantic keys unless a use case needs generated symbols whose values change independently from their keys.
- Extraction reads each literal with the `table:` written beside it. A helper that takes a plain string or `String.LocalizationValue` and passes it to `String(localized:table:)` sends the string to `Localizable`, where nothing translates it: write the literal and its `table:` at the call site, or take a `LocalizedStringResource` built there.
- After building, run `pnpm --filter apple i18n` and `pnpm --filter apple i18n:lint` from the repository root, following the [translation rules](../../.agents/guides/translations.md). `make strings-check` fails when a string the last build compiled is missing from its catalog, which would ship it in English.
- Reuse the main app's established wording when it fits native Apple UI, but prefer concise platform-standard terminology when the web wording is not appropriate for a native control.
- A string with a count uses String Catalog plural variations (`variations.plural` with `one` and `other` on the English entry), so no screen says "1 questions". Give each count its own string (join "3 right · 1 wrong" from two). Portuguese's `one` covers 0 and a catalog can't carry an exact 0 through translation, so a count that can be 0 gets its own literal string for it ("0 fixed"). A sentence that never shows the number ("this goal waits" / "these goals wait") gets one literal string for one and one for more, since the build rejects a plural without the number. Positions and fractions ("Question 2 of 5", "8/10") need none.
- Join facts on one line with `joinedFacts()`, or `\u{00A0}· ` between them in a format string.
- Treat dates, times, durations, and measurements as semantic values. Choose calendar and time-zone behavior intentionally, use native formatters, and test meaningful boundaries across locales.

## Performance

- Keep view bodies cheap and dependencies narrow (Fast SwiftUI in the [Apple skill](../../.agents/skills/apple-human-interface-guidelines/SKILL.md)). Whenever a change touches data loading, stores, navigation or long-lived state, measure requests per screen, memory, leaks, CPU and hangs on the simulator with the [verify skill's Apple reference](../../.agents/skills/verify/references/apple.md), and report the numbers before and after.

## Verification

- Use the latest Xcode and simulator runtime, and keep CI on the same Xcode: moving to a newer one includes `DEVELOPER_DIR` in `.github/workflows/apple.yml`. Install an older runtime only to investigate a bug that happens on that version.
- For Swift, project or localization changes, run `pnpm apple:check` from the repository root (translations, Swift formatting, and the unit tests on a simulator), plus `make -C apps/apple ui-test` when the change touches a flow the UI tests cover. Documentation-only edits need document validation, not a simulator run.
- Add a test only when it clears [the native bar](../../.agents/skills/zoonk-testing/SKILL.md#the-native-bar). A flow or screen is checked on the simulator, not with a new UI test.
- Never call Apple UI work complete based only on builds or automated tests. Inspect the rendered result on the affected iPhone, iPhone Duo and iPad destinations as the Apple skill's workflow says, compare it with the matching `main` screen and its neighboring controls, and verify accessibility, localization, focus, window sizing, and input behavior in proportion to the change.

## Simulators

Each simulator boot starts a full iOS system. When boots pile up while builds saturate the CPU, Apple's simulator services crash, each crash opens a "quit unexpectedly" alert, and a system service can keep crashing until the simulator is erased.

- Reuse a simulator from `xcrun simctl list devices available` instead of creating one per task. Run `pnpm dev:queue` before booting it, boot it once and keep it booted while you work; shut it down when your task ends, and delete any simulator you created.
- Keep at most three simulators booted on the machine (check `xcrun simctl list devices booted` before booting one, and wait for a slot) and at most two Xcode builds or test runs at a time. A lead running several Apple lanes gives each lane its simulator and runs no more lanes at once than those limits allow.
- When you run `xcodebuild test` yourself instead of `make test`, pass `-parallel-testing-enabled NO` so it doesn't boot extra clones of your simulator.
- When Zoonk crashes on a simulator (a new `~/Library/Logs/DiagnosticReports/Zoonk-*.ips`), stop and fix the cause before running more tests. When a system service crashes on the same simulator again after a reboot, shut it down and run `xcrun simctl erase <udid>` before using it again.
- After Zoonk crashes on a simulator, and before ending a task that used one, run `pnpm dev:close-device-crash-alerts`. It closes the crash alerts simulators and emulators opened and leaves alerts for Mac apps open.
