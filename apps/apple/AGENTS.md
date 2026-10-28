# Apple App Instructions

These instructions apply to the native iPhone and iPad app in this directory and supplement the repository-level instructions in `../../AGENTS.md`.

## Apple UI guidance

- For UI and interaction decisions, use [Zoonk design](../../.agents/skills/zoonk-design/SKILL.md) for the product's look and experience and [Apple Human Interface Guidelines](../../.agents/skills/apple-human-interface-guidelines/SKILL.md) for native controls and platform behavior, and consult the relevant official platform documentation. Framework-independent logic and documentation edits do not require a UI-guidance pass.
- Prefer native SwiftUI containers and semantic APIs before adding custom view hierarchies, state synchronization, platform branches, or animation workarounds. Consult official examples and validate a small equivalent implementation when platform behavior is uncertain.
- **System defaults first.** Use what Apple provides by default so the system handles Dynamic Type, Increase Contrast, Dark Mode, accessibility, window sizes and new devices: semantic system colors, the system font through text styles, SF Symbols, native default components and system spacing. Match the design system's meaning through the closest system API; [the design-system mapping](../../.agents/skills/apple-human-interface-guidelines/references/design-system.md) lists which one carries each role. Use custom colors, styles or assets only where no system equivalent carries the meaning (such as belt and character artwork), and make them adapt to dark, Increase Contrast and Dynamic Type too. Don't hard-code hex colors, point sizes or fixed frames.
- Main defines product intent, copy, business behavior, API contracts, information hierarchy, icons (as the closest SF Symbol) and screen structure. Apple defines controls, navigation, gestures, input, styling and accessibility.
- Design for every size one binary runs at: compact iPhone screens, iPhone Duo's outer and inner displays (folded too), regular-width iPad layouts, multitasking, resizable iPad windows, and the Designed for iPad Mac and Vision destinations. Adapt with size classes, safe areas and adaptive containers, never device checks.
- **iPhone Duo:** open, it reads like an open wallet: two panes either side of the fold, with content and controls off the fold, never a stretched iPhone column or an iPad layout. Two related panes use `PaneSplit` (`DesignSystem/PaneSplit.swift`), which decides one or two panes by its measured width and meets at the fold. A custom bar or floating control outside a pane uses `.keepsOffFold()`. [The design-system mapping](../../.agents/skills/apple-human-interface-guidelines/references/design-system.md#iphone-duo) says what goes in each pane.
- Keep iPhone and iPad great from the same size-class-driven code. Folding, unfolding, rotating and resizing re-lay out live and recreate pane content: keep what the learner made (answers, drafts, selection, open panels) in the owning store or in state above the split, derive a field's text from its draft, and don't animate the switch.
- Preserve Dynamic Type, VoiceOver semantics, contrast, safe areas, keyboard behavior, focus behavior and reduced-motion settings by relying on native components and avoiding fixed-size assumptions.
- Keep grouped controls visually consistent in height, alignment, typography, shape, and prominence while still allowing localized labels and Dynamic Type to expand when needed.
- For dense visualizations, separate visible mark size from the interaction surface. Make data explorable with simple touch, pointer, keyboard, and VoiceOver interactions instead of turning tiny marks into tiny controls.
- When using an SF Symbol, first check what symbol is used for this feature in the `main` app. Then, choose the closest SF Symbol. Symbols/icons should be consistent across platforms.

## Generated API client

- The local `ZoonkAPI` package owns the generated client and its hand-written lesson wire models. Edit the operation filter and type overrides in `ZoonkAPI/Sources/ZoonkAPI/openapi-generator-config.yaml`; `pnpm openapi:generate` writes the single contract to `ZoonkAPI/Sources/ZoonkAPI/openapi.json`. Keep generation in the package so app edits do not recompile the client. App runtime glue stays in `Zoonk`; `App/APIExports.swift` re-exports the package.

## Platform Architecture

- The deployment target is iOS 26: use iOS 26 APIs (Liquid Glass, the current `TabView` and toolbar APIs) directly, and guard only newer APIs with `if #available(iOS 27, *)` or `27.1`. The app is unreleased, so don't add fallbacks for older systems.
- Keep one `Zoonk` application target for iPhone and iPad. Both devices should use the same feature code and adapt through SwiftUI size classes and native containers rather than separate implementations.
- Keep the Designed for iPhone/iPad compatibility destinations enabled for Apple silicon Mac and Apple Vision Pro. They run the iPad app and are not independently maintained native targets.
- Keep application lifecycle and dependency composition in the `App` folder. Organize product code vertically by feature rather than creating global `Views`, `Models`, or `ViewModels` buckets.
- Keep UI-test fixtures in `ZoonkUITests` and limit app-side launch decoding to the Debug-only `Zoonk/Testing` boundary. Inject ordinary initial state through the app composition root; never parse test arguments or embed fixture data in product views, stores, or clients.
- Extract stable, independently owned domains or sufficiently large features into local Swift packages when real module boundaries emerge.
- Use Swift concurrency and value types by default. Keep observable state at the narrowest owning feature boundary and avoid introducing view models that only relay data without adding domain behavior.
- Scope every asynchronous result and credential mutation to the full session identity that started it. Before publishing or deleting state, confirm that identity is still current and test meaningful request-order races.
- Treat initial loading and refresh as different experiences. Deduplicate only in-flight work, preserve valid content during revalidation, and make authentication loss lead to a recoverable screen rather than stranded loading UI. `Resource` (below) does all of this; don't reimplement it in a store.

## Data loading and caching

Every read the app shows goes through one pattern in `Zoonk/Data`, so screens are instant on return and the rules above hold everywhere:

- `AppCache` is created once in `App/AppDependencies.swift`. Feature stores create their reads with `cache.resource(audience:domains:maxAge:isEmpty:fetch:)` and own the returned `Resource<Value>`; stores live for the app's lifetime and are injected with `.environment`, so data survives tab switches and navigation.
- A `Resource` loads once, shows `.loading` only when nothing is cached, revalidates in the background when older than `maxAge` (5 minutes by default) or invalidated, shares one request among concurrent callers, keeps content when a refresh fails (except `.notFound`), signs out on `.unauthorized`, and drops a response whose session ended. Its `audience` decides what a session change does: `.everyone` (public, kept), `.viewer` (public but personalized, dropped) or `.signedIn` (the learner's own, idle while signed out, dropped).
- A screen shows a resource with `.loads(store.thing)` (several: `.loads(a, b)`) and switches on `store.thing.state` (`LoadState`: `.idle`, `.loading`, `.loaded`, `.empty`, `.failed(APIError)`). That modifier loads on appear, revalidates stale data on returning to the foreground, adds pull to refresh, and counts the screen as viewing the resource. Retry buttons call `refresh()`. Never start requests in `onAppear` or a bare `.task`, and never keep a second copy of a resource's value in view state.
- Keyed reads (a course by id) live in the store as a dictionary of resources created on first use, like `CourseCatalogStore.course(id:)`. Pagination appends with `resource.update` after checking `resource.revision` didn't change while the page loaded.
- After a successful mutation, invalidate every `DataDomain` the write changed, the same tags main revalidates in `packages/core/src/cache/tags.ts` (pass them to `mutate`). Resources reading those domains refetch now if a screen shows them and on their next appearance otherwise; the learner summary reads every domain, so it always follows. When the mutation's response already carries the new value, `resource.update` shows it without a request, then invalidate the other domains it touched.
- Run every write through `cache.mutate(invalidating:_:)` (`Data/Mutation.swift`). It captures the full session identity, sends that identity's token, signs that identity out on `unauthorized`, and returns `.done`, `.failed` or `.obsolete` (the session ended or changed meanwhile, or the write's task was cancelled, before or after the request). Roll an optimistic change back only on `.failed`; on `.obsolete` change nothing, since another learner's data may be on screen now. Own the task that runs a write and cancel it when its screen goes away; `mutate` then neither publishes nor invalidates.
- State that belongs to one learner but isn't a resource (a "Memory updated" notice, an undo, a save error) keeps the identity it was made for and is hidden once the session changes.
- Feature APIs throw `APIError` and run generated calls through `APIClientFactory.perform(token:operation:)`, which maps transport failures and keeps cancellation. Generation progress streams from `APIClientFactory.generationEvents(id:token:)`, which resumes a dropped connection from the last event.
- `LearnerSummaryStore` holds the frame's summary (`GET /me/summary`): read on launch and sign-in, on foreground after a minute, at its `nextChangeAt`, and after every mutation. Read frame state (goals, tier, today, level) from it instead of fetching it per screen.
- Cover a new store's own logic with unit tests against an API stub; `ResourceTests` already covers loading, staleness, dedupe, session races and invalidation.

## Navigation and Presentation

- Use `TabView` with `Tab` values, a `NavigationStack` per tab and `.tabViewStyle(.sidebarAdaptable)` for the primary navigation shell, allowing SwiftUI to adapt between iPhone, iPhone Duo and iPad. App-wide search is a `Tab(role: .search)`.
- A tab represents a persistent top-level destination, never an immediate action. Use toolbars, menus, sheets, or confirmation dialogs for actions according to the conventions of the current platform.
- Let iPad adopt its native sidebar-style tab presentation instead of forcing an iPhone-style bottom tab bar at regular widths. On iPhone Duo keep the tab bar (no `defaultTabBarPlacement(.sidebar)`): a sidebar takes the room the two panes need.
- Navigation is per window: each `WindowGroup` scene owns its `AppRouter`, while stores stay app-wide, so two Zoonk windows on iPad or the open Duo navigate independently.
- Put screen titles and navigation actions in `NavigationStack` navigation titles and toolbars. Do not recreate navigation bars or bottom bars with safe-area insets, fixed headers or overlays: the system moves bars to a vertical side bar on iPhone Duo, and a fake bar won't follow. Give toolbar items a `Label` with a title and an SF Symbol.
- When completing a modal flow is required, disable interactive dismissal and hide every dismissal affordance until completion; hiding only a close button is insufficient.

## Localization

- Keep user-facing text in native Xcode String Catalogs. Let the operating system select the app language; do not add a custom locale switcher or parallel translation store.
- Prefer source-driven extraction. Pass English string literals directly to localizable SwiftUI or Foundation APIs, include a translator comment, and specify the owning feature catalog with `table: "<Feature>"`. Build the app to let Xcode add and update catalog entries automatically. Do not add `extractionState: "manual"` or catalog-first semantic keys unless a specific use case requires generated symbols whose values must change independently from their keys.
- Extraction reads each literal with the `table:` written beside it. A helper that takes a plain string or `String.LocalizationValue` and passes it to `String(localized:table:)` sends the string to `Localizable`, where nothing translates it: write the literal and its `table:` at the call site, or take a `LocalizedStringResource` built there.
- Keep String Catalogs together in `Zoonk/Resources/Localization`, named by their owning feature or app surface, such as `Account.xcstrings` and `Navigation.xcstrings`. Keep catalog basenames unique and stable within the target; Eloqnt discovers every catalog in this directory automatically.
- After building to extract changed strings, run `pnpm --filter apple i18n` from the repository root to translate them and `pnpm --filter apple i18n:lint` to validate the catalogs. Never edit generated translations in `.xcstrings` files manually.
- Reuse the main app's established wording when it fits native Apple UI, but prefer concise platform-standard terminology when the web wording is not appropriate for a native control.
- A string with a count of something uses String Catalog plural variations: "Vary by Plural" on the English source entry (`variations.plural` with `one` and `other`), so no screen ever says "1 questions"; Eloqnt translates each plural case. Give each count its own string (join "3 right · 1 wrong" from two strings) instead of several plurals in one entry. Portuguese's `one` case covers 0 and a catalog can't carry an exact 0 through translation, so a count that can be 0 gets its own literal string for it ("0 fixed"). Positions and fractions ("Question 2 of 5", "8/10") need none.
- Treat dates, times, durations, and measurements as semantic values. Choose calendar and time-zone behavior intentionally, use native formatters, and test meaningful boundaries across locales.

## Performance

- Screens feel instant: show cached data at once and revalidate in the background; show a loading state only when nothing is cached. Keep data in app-scoped stores so it survives tab switches and navigation, load each fact once, and never refetch on every appear.
- Keep view bodies cheap and dependencies narrow (see Fast SwiftUI in the [Apple skill](../../.agents/skills/apple-human-interface-guidelines/SKILL.md)). Measure requests per screen, memory, leaks, CPU and hangs on the simulator with the [verify skill's Apple reference](../../.agents/skills/verify/references/apple.md) whenever a change touches data loading, stores, navigation or long-lived state, and report the numbers before and after.

## Verification

- CI and local builds use the same Xcode; when the local Xcode changes, update `DEVELOPER_DIR` in `.github/workflows/apple.yml` (the image's Xcode list is in its runner-images readme).
- For app code changes, build the iOS target. For UI or adaptive-layout changes, inspect the affected iPhone, iPhone Duo and iPad destinations because one binary can render differently across size classes, displays and multitasking widths. Documentation-only edits need document validation, not a simulator run.
- Prefer UI tests for user flows and unit tests for non-trivial pure domain logic. Do not test SwiftUI implementation details or static catalog contents.
- When changing asynchronous observable stores, cover the affected success, authentication-expiry, transient-failure, and request-order transitions directly; UI tests alone may miss state-machine races.
- Never call Apple UI work complete based only on builds or automated tests. Inspect the rendered result on relevant iPhone and iPad simulators in light, dark and Increase Contrast and at a large Dynamic Type size, compare it with the matching `main` screen, compare neighboring controls for alignment and visual consistency, and verify accessibility, localization, focus, window sizing, and input behavior in proportion to the change.

## Simulators

Agents share one Mac with the owner. Each simulator boot starts a full iOS system, and when boots pile up while builds saturate the CPU, Apple's simulator services miss their timeouts and crash. PosterBoard (the wallpaper service) can then lose its Clock poster descriptors and crash on every launch until the simulator is erased. Each of its crashes, and each crash of Zoonk, opens a "quit unexpectedly" alert on the owner's screen.

- Reuse a simulator from `xcrun simctl list devices available` instead of creating one per task. Boot it once and keep it booted while you work; shut it down when your task ends, and delete any simulator you created.
- Keep at most three simulators booted on the Mac (check `xcrun simctl list devices booted` before booting one, and wait for a slot) and at most two Xcode builds or test runs at a time. A lead running several Apple lanes gives each lane its simulator and runs no more lanes at once than those limits allow.
- Run `xcodebuild test` with `-parallel-testing-enabled NO` so it doesn't boot extra clones of your simulator.
- When Zoonk crashes on a simulator (a new `~/Library/Logs/DiagnosticReports/Zoonk-*.ips`), stop and fix the cause before running more tests. When a system service crashes on the same simulator again after a reboot, shut it down and run `xcrun simctl erase <udid>` before using it again.
- Before ending a task that used a simulator, run `pnpm simulator:close-crash-alerts`. It closes the crash alerts simulators opened and leaves alerts for Mac apps open.
