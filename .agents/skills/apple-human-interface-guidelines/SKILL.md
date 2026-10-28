---
name: apple-human-interface-guidelines
description: Use when designing, reviewing, or implementing any Apple-platform UI or feature for iOS, iPadOS, macOS, visionOS, tvOS, watchOS, SwiftUI, UIKit, AppKit, WatchKit, app icons, Dark Mode, SF Symbols, system colors, native controls, Liquid Glass, iPhone Duo, or when porting web features to Apple platforms. Ensures the app uses Apple's system defaults (semantic colors, text styles, SF Symbols, native components, system spacing and adaptive containers) and current official Human Interface Guidelines, expressing the meaning of Zoonk's design system through the closest system API.
license: MIT
metadata:
  author: zoonk
  version: "3.0.0"
---

# Apple Human Interface Guidelines

This skill is a workflow, not a frozen copy of Apple's HIG. Apple's official docs are the source of truth. Use it so Apple-platform work uses what the system provides by default, follows current HIG guidance, and carries the meaning of Zoonk's design system.

## Required Workflow

1. Identify every target platform and size: iPhone (including iPhone Duo's outer and inner displays), iPad (every size, multitasking, resizable windows), and the Designed for iPad destinations on Mac and Apple Vision Pro.
2. Read the current official HIG pages that match the feature, component, interaction, and platform. Start with [references/official-links.md](references/official-links.md).
3. Pages need JavaScript, so fetch Apple's JSON instead (it also carries each API's availability under `metadata.platforms`):
   - HIG index: `https://developer.apple.com/tutorials/data/index/design--human-interface-guidelines.json`
   - HIG topic: `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<slug>.json`
   - Developer docs: `https://developer.apple.com/tutorials/data/documentation/<path>.json`, such as `swiftui/view/tabbarminimizebehavior(_:)` or `updates/swiftui` (what's new in each release).
4. Pick the system API that carries each element's meaning, using [references/design-system.md](references/design-system.md) for Zoonk's role → system mapping. Build custom UI only when no system API can carry the meaning, and give it the native accessibility, input, Dynamic Type, Dark Mode and Increase Contrast behavior.
5. Before finishing, review the work against the relevant platform, foundation, component and pattern pages, compare it with the matching `main` screen, and check it on a small iPhone, iPhone Duo, and an iPad in a resized window, in light, dark and Increase Contrast, at a large Dynamic Type size.

## Product Rule: system defaults first

Use what Apple provides by default, so the system handles Dynamic Type, Increase Contrast, Dark Mode, accessibility, window sizes and new devices for us. Match Zoonk's design system by choosing the closest system API for each meaning, not by reimplementing it:

- **Color:** semantic system colors (`.primary`, `.secondary`, `.tertiary`, `Color(.label)`, `.background`, `Color(.secondarySystemBackground)`, `.separator`, `.tint`) and system colors used softly (`.blue`, `.pink`, `.purple`, `.orange`). The meaning comes from the design system: the label color is primary, progress and the learner's place are soft blue, wrong is soft pink-red, Brain Power is purple, and done is never green.
- **Type:** the system font through text styles (`.largeTitle` … `.caption2`, `.headline`, weights and `.monospacedDigit()` where needed). No fixed point sizes.
- **Icons:** SF Symbols, choosing the closest match to the icon `main` uses, with rendering modes and variable values instead of custom artwork.
- **Components:** native defaults (`List`, `Form`, `Section`, `Button` with `.glass`, `.glassProminent`, `.bordered`, `.borderedProminent`, `Toggle`, `Picker`, `Menu`, `ProgressView`, `Gauge`, `Label`, `ContentUnavailableView`, sheets, `confirmationDialog`, `searchable`, `TabView`, `NavigationStack`, `NavigationSplitView`).
- **Spacing and adaptivity:** default padding, `.scenePadding()`, `.contentMargins`, safe areas, size classes, `ViewThatFits` and adaptive grids. No fixed frames or device checks.
- **Custom** colors, styles or assets only where no system equivalent carries the meaning (belts and character artwork, for example), and they still adapt to dark, Increase Contrast and Dynamic Type.

From `main` take the product structure: copy, flows, information hierarchy, icons (as SF Symbols) and screen structure. Take controls, navigation, gestures, input, styling and accessibility from the platform. Don't port web implementation details (HTML layout tricks, hover-only affordances, custom replacements for native controls, hex colors, pixel sizes).

## Liquid Glass (iOS 26 and later)

- Standard bars, tab bars, sidebars, toolbars, sheets, popovers, menus and controls adopt Liquid Glass automatically. Remove custom backgrounds, tints and shadows from them; they fight the material and the scroll edge effect.
- Liquid Glass is the functional layer that floats over content. Never use it in the content layer (cards, rows, backgrounds); use standard materials or semantic backgrounds there.
- Use glass on custom controls sparingly: `.buttonStyle(.glass)` / `.glassProminent` for buttons, `glassEffect(_:in:)` for the rare custom control, grouped in a `GlassEffectContainer`. Use `.regular` glass; `.clear` only over rich media.
- Toolbars: group related items (`ToolbarItemGroup`), separate groups with `ToolbarSpacer`, one `.prominent` primary action on the trailing side, and `sharedBackgroundVisibility(.hidden)` for an item that shouldn't sit in the shared glass (such as an avatar). Give every item a `Label` with a title and a symbol so the system can choose.
- Prefer concentric shapes (`ConcentricRectangle`, `containerShape`) for rounded elements inside rounded containers.
- Let the system's scroll edge effect separate bars from content; use `scrollEdgeEffectStyle(_:for:)` only for custom bars.
- Don't set `UIDesignRequiresCompatibility`; the app is built for the current design.

## Navigation (iOS 26 and 27)

- Use `TabView` with `Tab` values for top-level destinations and a `NavigationStack` per tab, with `.tabViewStyle(.sidebarAdaptable)` so iPad gets a tab bar that turns into a sidebar. Use `TabSection` to group destinations in the sidebar. A tab is a place, never an action.
- Search that spans the app is a `Tab(role: .search)` at the trailing end of the tab bar, with `.searchable` on its content. Search scoped to one screen is `.searchable` on that screen.
- `.tabBarMinimizeBehavior(.onScrollDown)` lets the tab bar recede on long reading screens; `tabViewBottomAccessory` holds a persistent mini control (a resumable session, for example). On iOS 27, `Tab(role: .prominent)` places one key destination apart at the trailing edge; guard it with `if #available(iOS 27, *)`.
- On iOS 27, `toolbarMinimizationBehavior(_:for:)`, `ToolbarOverflowMenu`, `visibilityPriority(_:)` and the `topBarPinnedTrailing` placement manage crowded toolbars. Use the system overflow menu; don't build your own "More" menu.
- Titles and actions live in `navigationTitle` and `toolbar`. Never recreate a bar with a top `safeAreaInset`, a fixed header or a bottom overlay: on iPhone Duo the system moves bars to the side, and a fake bar won't follow.
- Modal flows use sheets or `fullScreenCover`; required completion disables interactive dismissal and hides every dismissal affordance.

## iPhone Duo (iOS 27.1)

iPhone Duo has an outer display (wide and short, compact width) and an inner display (regular width) with a hinge, and it can be held folded like a book. Apps built from standard components and size classes adapt with little work. Read [Designing for iPhone Duo](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo) before laying out a screen.

- Open, iPhone Duo reads like an open wallet: use two panes either side of the fold, with content and controls off the hinge, rather than an iPad layout or a stretched iPhone. The same size-class-driven code keeps iPhone and iPad great.
- Lay out with size classes, safe areas and layout margins. The outer display and landscape place the status bar, toolbars and the tab bar on a vertical side bar, so content space is asymmetric: respect the safe area on every edge and never assume bars are at the top or bottom.
- Keep the same functions and state across displays and poses; show an extra level of hierarchy on the inner display when it helps (a `NavigationSplitView` does this for you).
- Folded, the hinge is a reserved region (`.division`). System sheets, alerts, menus and split views avoid it. For a custom two-part layout use `ArrangementView` (split or overlay), keep navigation containers outside it, and prefer an even number of grid columns so content divides at the fold. Use `ReservedRegion` only when a custom view must keep content off the fold or cameras. Guard these 27.1 APIs with `if #available(iOS 27.1, *)`.
- Don't override the vertical bar placement (`toolbarVerticalBehavior(.disabled)`) except for a full-screen immersive or non-scrolling view.
- Test on an iPhone Duo simulator with the iOS 27.1 runtime: `xcrun simctl create "iPhone Duo" com.apple.CoreSimulator.SimDeviceType.iPhone-Duo com.apple.CoreSimulator.SimRuntime.iOS-27-1`.

## Fast SwiftUI

Screens must feel instant. The rules that matter most:

- Keep app data in app-scoped, session-scoped stores created in the `App` composition root and injected with `.environment`; they survive tab switches and navigation. Show cached data immediately and revalidate in the background; a spinner or placeholder only when nothing is cached yet. Never refetch on every appear. `apps/apple/AGENTS.md` describes the app's store pattern.
- Observation tracks each property a body reads. Read the narrowest property you need, keep per-item state in per-item observable objects instead of one big dictionary, and split a view when part of it depends on fast-changing state.
- Keep `body`, `init`, `onAppear` and `onChange` cheap: no formatting of large collections, sorting, decoding or network there. Precompute in the store when data arrives.
- `.task` and `.task(id:)` cancel when the view disappears. Start loads that should finish anyway (a request the next visit will reuse) in the store, not only in the view's task.
- Use lazy containers (`List`, `LazyVStack`, `LazyVGrid`) with stable `id`s for long content; avoid `AnyView`, `GeometryReader` in rows, and closures stored in views.
- With Xcode 27, `@State` initializes a class value once; still create long-lived stores in the composition root, not in a view.
- Public images: `AsyncImage` goes through `URLCache.shared`, which serves repeat visits without the network when the server sends cache headers. On iOS 27, `asyncImageURLSession(_:)` can point it at a session with a larger cache.
- Measure instead of guessing: the [verify skill's Apple reference](../verify/references/apple.md) has the commands for requests per screen, memory, leaks, CPU and hangs on the simulator.

## Lessons learned

- Xcode 27's simulator can't record Instruments' Network Connections, Hitches or SwiftUI templates; Time Profiler, Leaks, Allocations and the `leaks`/`footprint` command-line tools work. See the verify reference.
- UI automation that snapshots the accessibility tree makes the app compute it, which shows up as CPU in a profile. Measure idle CPU and profiles with no automation running.
- When `xcodebuild test` fails before any test runs with "Invalid device state" while installing on a simulator clone, rerun with `-parallel-testing-enabled NO` so it uses the simulator itself.
- Developer documentation JSON states each API's availability; check it before using an API newer than the deployment target (iOS 26).

## Official Starting Points

- Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines
- Adopting Liquid Glass: https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass
- Designing for iPhone Duo: https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo
- What's new in SwiftUI (every release): https://developer.apple.com/documentation/updates/swiftui
- Understanding and improving SwiftUI performance: https://developer.apple.com/documentation/xcode/understanding-and-improving-swiftui-performance
- SF Symbols: https://developer.apple.com/sf-symbols/
