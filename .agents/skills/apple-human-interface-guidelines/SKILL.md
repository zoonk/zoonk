---
name: apple-human-interface-guidelines
description: Use when designing, reviewing, or implementing any Apple-platform UI or feature for iOS, iPadOS, macOS, visionOS, tvOS, watchOS, SwiftUI, UIKit, AppKit, WatchKit, app icons, Dark Mode, SF Symbols, native controls, Liquid Glass, iPhone Duo, or when porting web features to Apple platforms. Ensures the app uses Apple's native components, navigation and behavior (bars, sheets, Liquid Glass, SF Symbols, Dynamic Type, adaptive containers) styled with Zoonk's design system (its generated colors, Geist type roles, radii and shared pieces), following current official Human Interface Guidelines.
license: MIT
metadata:
  author: zoonk
  version: "3.0.0"
---

# Apple Human Interface Guidelines

This skill is a workflow, not a frozen copy of Apple's HIG. Apple's official docs are the source of truth for components and behavior; Zoonk's design system is the source of truth for what things mean and how the content looks.

## Required Workflow

1. Identify every target platform and size: iPhone (including iPhone Duo's outer and inner displays), iPad (every size, multitasking, resizable windows), and the Designed for iPad destinations on Mac and Apple Vision Pro.
2. Read the current official HIG pages that match the feature, component, interaction, and platform. Start with [references/official-links.md](references/official-links.md).
3. Pages need JavaScript, so fetch Apple's JSON instead (it also carries each API's availability under `metadata.platforms`):
   - HIG index: `https://developer.apple.com/tutorials/data/index/design--human-interface-guidelines.json`
   - HIG topic: `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<slug>.json`
   - Developer docs: `https://developer.apple.com/tutorials/data/documentation/<path>.json`, such as `swiftui/view/tabbarminimizebehavior(_:)` or `updates/swiftui` (what's new in each release).
4. Build from native components and the app's shared pieces in `DesignSystem/`, using [references/design-system.md](references/design-system.md) for the role or piece each element of the design system takes. Draw a new piece only when neither carries the design, add it to `DesignSystem/` and the Debug gallery, and give it the native accessibility, input, Dynamic Type, Bold Text, Dark Mode and Increase Contrast behavior.
5. Before finishing, review the work against the relevant platform, foundation, component and pattern pages, compare it with the matching `main` screen, and check it on a small iPhone, iPhone Duo, and an iPad in a resized window, in light, dark and Increase Contrast, at a large Dynamic Type size.

## Product Rule: Zoonk's design inside native components

Web, iOS and Android are one product, so the content layer looks the same on all three: Zoonk's colors, Geist type roles, radii, row and page anatomy, marks, meters and characters, from one source (`packages/ui/src/styles/globals.css`, generated or set once in `apps/apple/Zoonk/DesignSystem/`). The chrome layer stays Apple's: `TabView`, `NavigationStack` bars and their titles, toolbars, sheets, alerts, `confirmationDialog`, menus, pickers, `Toggle`, text editing and the keyboard, gestures, haptics, Liquid Glass, the iPad sidebar and iPhone Duo's vertical bars. Zoonk reaches the chrome only through the ink tint, never a custom background, so the system still handles Dynamic Type, Bold Text, Increase Contrast, Dark Mode, Reduce Transparency, VoiceOver, window sizes and new devices.

- **Color:** the generated roles in `DesignSystem/ColorRoles.swift`, which `pnpm palette` writes from `globals.css` in light, dark and both Increase Contrast appearances. A mark, fill or icon takes the base role and words its `-text` role. Content never uses `.secondary`, `.tertiary`, `.separator`, system grays, fills or hues; they stay in system chrome. Done is never green.
- **Type:** main's type roles through `.typeStyle(_:)` (Geist and Geist Mono, `DesignSystem/Typography.swift`), which grow with Dynamic Type and Bold Text. System-drawn UI keeps the system font, navigation bar titles included; a page shows its title in Geist through `PageHeader`. No fixed point sizes.
- **Icons:** SF Symbols, choosing the closest match to the icon `main` uses, with rendering modes and variable values instead of custom artwork.
- **Components:** native controls wearing the shared pieces in `DesignSystem/`: `ZoonkList` for a page's list, `SectionTitle`, `ListRow`, `PageHeader`, the `.mainAction`, `.outline` and `.ghost` button styles (`.icon` for an icon alone), `.panel()`, `Meter`, `BigQuantity`, `GoalRing`, `TaskSegments`, `.chip()`, `.answerSurface(_:)`, `FeedbackVerdict`, `FormField` and `.fieldBorder(isFocused:isInvalid:)` ([what each is for](references/design-system.md#components)). Keep the native `Toggle`, `Picker`, `Menu`, `ContentUnavailableView`, sheets, `confirmationDialog`, `searchable`, `TabView`, `NavigationStack` and `NavigationSplitView`, and `.glass` on floating controls.
- **Shape and spacing:** the generated `Radius` constants with `.continuous` corners; nothing is a capsule except avatars, dots and rings. Page margins come from `ZoonkList`, the rest from safe areas, size classes, `ViewThatFits` and adaptive grids. No fixed frames or device checks.
- **Custom** artwork only where no piece carries the meaning (belts and characters, for example), and it still adapts to dark, Increase Contrast and Dynamic Type.

From `main` take the product and its look: copy, flows, information hierarchy, screen structure, icons (as SF Symbols) and the content layer's design through the shared pieces. Take controls, navigation, gestures, input and accessibility from the platform. Don't port web implementation details (HTML layout tricks, hover-only affordances, custom replacements for native controls, hex colors, pixel sizes at the call site).

## Liquid Glass (iOS 26 and later)

- Standard bars, tab bars, sidebars, toolbars, sheets, popovers, menus and controls adopt Liquid Glass automatically. Remove custom backgrounds, tints and shadows from them; they fight the material and the scroll edge effect.
- Liquid Glass is the functional layer that floats over content. Never use it in the content layer (cards, rows, backgrounds); content stays opaque on the design system's surfaces there (the page, `.panel()`).
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
- A page's name lives in `navigationTitle` (Back, VoiceOver and the iPad and iPhone Duo bars read it) and its actions in `toolbar`. A page that leads with `PageHeader` takes `barTitleAfterHero(_:)`, so the bar names it only once the header scrolls under it. Never recreate a bar with a top `safeAreaInset`, a fixed header or a bottom overlay: on iPhone Duo the system moves bars to the side, and a fake bar won't follow.
- Modal flows use sheets or `fullScreenCover`; required completion disables interactive dismissal and hides every dismissal affordance.

## iPhone Duo (iOS 27.1)

iPhone Duo has an outer display (wide and short, compact width) and an inner display (regular width) with a hinge, and it can be held folded like a book. Apps built from standard components and size classes adapt with little work. Read [Designing for iPhone Duo](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo) before laying out a screen.

- It is still an iPhone app: compact width on the outer display, regular width on the inner one. Open, it reads like an open wallet: two panes either side of the fold, each about an iPhone wide, with content and controls off the fold, never a stretched iPhone column or an iPad layout. Show the extra level of hierarchy where it helps, as Mail and Notes do (a `NavigationSplitView` does this for you).
- Lay out with size classes, safe areas and layout margins. The outer display and landscape place the status bar, toolbars and the tab bar on a vertical side bar, so content space is asymmetric: respect the safe area on every edge and never assume bars are at the top or bottom.
- Decide one or two panes by the container's measured width, never by device, idiom, orientation or screen, so the same rule serves iPad and multitasking.
- Keep the same functions and state in every display and pose. Never put a feature behind a pose or the hinge angle (`onHingeChange`); tabletop works through bottom bars, which land on the flat half.
- Partially folded, the fold is an active reserved region (`.division`; flat, it's inactive). Keep text and controls out of it; scrolling lists may cross it. Sheets, alerts, menus, toolbars and split views follow it by themselves; an inspector does too, but one presented while folded leaves the main column running under it, so Zoonk's side panels are panes. In Zoonk, two related panes use `PaneSplit` and a custom bar or floating control outside a pane uses `.keepsOffFold()`; both read `reservedRegions`. Don't use `ArrangementView` where the one-column layout needs both views: it shows only the primary when it can't split. Prefer an even number of grid columns so content divides at the hinge, flat or folded (`PaneSpace.columnsAroundHinge`).
- Vertical bars show only each toolbar item's symbol, and text-only items or custom views stay horizontal, so every item needs its `Label`. Put Back or Close first and order the rest with `visibilityPriority`. Don't disable the vertical bar (`toolbarVerticalBehavior(.disabled)`) except for a full-screen, non-scrolling view.
- Guard the 27.1 APIs (`reservedRegions`, `ArrangementView`, `onHingeChange`, `toolbarVerticalEdge`, `toolbarVerticalBehavior`, `axisBehavior`, `toolbarVerticalCompressionBehavior`) with `if #available(iOS 27.1, *)` and the 27.0 ones (`visibilityPriority`, `ToolbarOverflowMenu`, `presentationPlacement`, `defaultTabBarPlacement`) with `if #available(iOS 27, *)`. Before 27.1 there's no fold, so the fallback is the iPhone or iPad layout.
- Test on an iPhone Duo simulator with the iOS 27.1 runtime (create one only if none exists: `xcrun simctl create "iPhone Duo" com.apple.CoreSimulator.SimDeviceType.iPhone-Duo com.apple.CoreSimulator.SimRuntime.iOS-27-1`) in every pose: the outer display in portrait and landscape, the inner display flat in landscape and portrait, partially folded as a book and as a tabletop, and Split View on each side. Then check an iPhone and an iPad.

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
