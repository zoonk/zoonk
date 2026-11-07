---
name: android-material-guidelines
description: Use when designing, reviewing, or implementing Android UI or features for phones, tablets, foldables, ChromeOS, desktop windowing, Wear OS, Android TV, Android for Cars, Android XR, widgets, Jetpack Compose, Material 3, Material Design, adaptive layouts, dynamic color, icons, dark theme, edge-to-edge UI, accessibility, or when porting web or iOS features to Android. Ensures the app uses Material 3 and Android components and behavior (theme roles, Material Symbols, components, adaptive layouts) styled with Zoonk's design system (its colors, Geist type and shapes), following current official Android Developers and Material Design guidance.
license: MIT
metadata:
  author: zoonk
  version: "3.1.0"
---

# Android Material Guidelines

This skill is a workflow, not a frozen copy of Google's Android or Material Design docs. Google's official Android Developers and Material Design docs are the source of truth for components, styles, and behavior; Zoonk's design system is the source of truth for what things mean.

## Required Workflow

1. Identify every target surface: phone, tablet, foldable (its outer display, and its inner display flat, as a book and as a tabletop), ChromeOS, desktop windowing, Wear OS, Android TV, Android for Cars, Android XR, widgets, or other Android device categories.
2. Read the current official Android and Material pages that match the feature, component, interaction, and form factor. Start with [references/official-links.md](references/official-links.md).
3. If a Material page requires JavaScript, use the official Material sitemap to find the current page:
   - `https://m3.material.io/sitemap.xml`
4. Choose the default Material or AndroidX component first, styled only through `MaterialTheme` roles and [the design-system mapping](references/design-system.md). Only build custom UI when no platform component can carry the design, and give it the same accessibility, input, and adaptive behavior as the platform one.
5. Before finishing, review the work against the relevant Android form-factor page, Material foundation pages, and component pages, and compare its meaning (hierarchy, states, colors' jobs) with the matching `main` screen.

## Product Rule

Zoonk's design inside native components. Web, iOS and Android are one product, so the content layer looks the same on all three: Zoonk's colors, Geist type roles, radii, row and page anatomy, marks and characters, all from one source (`packages/ui/src/styles/globals.css`, generated or set once in the theme). Take components, navigation containers, gestures, input, and accessibility behavior from Material 3 and Android, styled through `MaterialTheme` with Zoonk's scheme, typography and shapes, so the platform still handles resizing, font scaling, contrast, accessibility, dark theme, and new devices. Chrome (bars, navigation, sheets, dialogs, menus, pickers) stays Material's, reading the theme. Do not port web or iOS implementation details such as HTML layout tricks, hover-only affordances, or iOS-specific controls.

Examples of native behavior:

- Mobile Android should use Material 3, Android navigation patterns, edge-to-edge layout, system bars, touch targets, and adaptive layouts.
- Tablets, foldables, ChromeOS, and desktop windowing should use window size classes, canonical layouts, panes, keyboard and pointer behavior, and resizable layouts.
- Wear OS should favor glanceable, low-friction, wrist-sized interactions.
- Android TV should optimize for focus, D-pad/remote input, distance from the screen, and clear selected states.
- Android for Cars should follow car templates and driver-distraction constraints.
- Android XR should use XR-specific spatial guidance instead of flattening a phone UI into a headset.

## Design Defaults

- Prefer Jetpack Compose with default Material 3 components for new Android UI unless the local app architecture requires Views. Use platform-provided components and AndroidX libraries before custom controls.
- Style through `MaterialTheme.colorScheme`, `MaterialTheme.typography`, and `MaterialTheme.shapes`, plus `MaterialTheme.zoonk` for the meanings Material has no role for. Never put raw colors, fixed font sizes, or fixed frames in composables; sizes come from the content, the component defaults, and the window.
- Use the theme's type roles, in `sp` so text follows the device's font scale: Geist in every Material slot and `MaterialTheme.zoonkType` for main's roles no slot carries ([mapping](references/design-system.md#type)). Screens use roles, never sizes.
- Map each color's meaning from the design system (`apps/playground/src/design-system/`, rules in [the zoonk-design skill's color reference](../zoonk-design/references/color.md)) onto Material color roles with [the mapping](references/design-system.md#color-roles): `primary` is the ink text color, picks are ink, progress and the learner's place a soft blue (`tertiary`), wrong a soft pink-red (`error`), Brain Power violet (`MaterialTheme.zoonk.brain`), never a green for done. Material components that default to `primary` for progress (progress indicators) take `tertiary` explicitly.
- Color scheme: use Zoonk's scheme, not wallpaper dynamic color. It's the same rule as Apple, whose system colors don't follow the wallpaper: wallpaper colors would drop the design system's meanings. The scheme has light and dark plus more-contrast variants; pick the variant from the device's contrast level (`UiModeManager.getContrast()`, API 34+: 0.5 and up takes the more-contrast scheme), so contrast is handled the standard Material way.
- Use Material Symbols for actions and objects, choosing the closest match to the meaning of the icon `main` and Apple use. Deliver them as vector drawables in one style (Outlined, weight 400, grade 0, optical size 24), filled only for a selected navigation item, `autoMirrored` when directional ([how to add one](references/design-system.md#icons)). The `material-icons-extended` library is frozen and no longer recommended. Use custom icons only when no symbol communicates the concept.
- Use Material adaptive layouts for phones, foldables, tablets, ChromeOS, and desktop windowing: window size classes, `NavigationSuiteScaffold` for top-level navigation (bar, rail, drawer by window size; `NavigationSuiteType.None` while a full-screen task covers the app), and the list-detail and supporting-pane scenes where content benefits from panes, split at a book foldable's fold ([Book foldables](#book-foldables)).
- Search is a Material `SearchBar` in the top app bar (full-screen when expanded on compact windows, docked on large ones), not a navigation destination.
- Prefer components in the stable Material 3 release the Compose BOM brings. Don't opt into `@ExperimentalMaterial3ExpressiveApi` or other experimental Material APIs; Expressive components come in when they're stable.
- Support dark theme, accessibility, font scaling, contrast, reduced motion (the animator duration scale), system gestures, predictive back, edge-to-edge behavior, and proper system bar handling; the defaults above provide most of it.
- Keep platform differences intentional. Look and behavior follow Android; the meaning stays Zoonk's.

## Book foldables

A book-style foldable (Galaxy Z Fold, Pixel Fold) has a phone-shaped outer display and a nearly square inner display with a fold down the middle: a medium window in portrait on a Galaxy Z Fold, an expanded one on a Pixel Fold. Read [Learn about foldables](https://developer.android.com/develop/ui/compose/layouts/adaptive/foldables/learn-about-foldables) and [Make your app fold aware](https://developer.android.com/develop/ui/compose/layouts/adaptive/foldables/make-your-app-fold-aware) before laying out a screen.

- Unfolded, it reads like an open book: a pane on each side of the fold, each about a phone wide, with content and controls off the fold, never one stretched phone column or a tablet layout. Zoonk's [product rule](../zoonk-design/references/foldables.md) says what goes on each side for each kind of screen; it's the same on the open iPhone Duo.
- Decide by window size class and measured space, through the window's folds: Material's `WindowAdaptiveInfo.windowPosture` lists each `FoldingFeature` as a hinge with its bounds in the window. Never check the device, `Build`, known screen sizes or the hinge's angle. In Zoonk, pages split through `PageWithSupportingPane` and `pageDirective`, which put the panes at a vertical fold that crosses the page, flat or folded, so folding moves nothing ([how](references/design-system.md#foldables)).
- Material's `calculatePaneScaffoldDirectiveWithTwoPanesOnMediumWidth` is its answer for two panes on a medium window such as a Galaxy Z Fold's; `calculatePaneScaffoldDirective` splits only from expanded widths. Both take a `HingePolicy` and return `excludedBounds`, which Material's pane scaffolds avoid: two panes meet at an excluded fold, and a lone pane goes in the first room nothing excluded covers, counted from the left even right to left. So pass the fold when two panes show, and for one pane, only where the page before the fold holds a phone's column, the fold and the window after it.
- Navigation follows Material's default suite: a bar when folded and in tabletop, a rail when unfolded. A permanent drawer only on large windows: on an unfolded foldable it would take most of the first page.
- Half opened with a vertical fold (book), the panes stay where they were. Half opened with a horizontal fold (tabletop, the device on its side), content sits on the upright half and controls on the flat one: the bottom bar does this already, and scrolling content may cross the fold. Every feature works in every posture; nothing hides behind one.
- The outer display is a phone: compact width, the bar, one column. Folding and unfolding recreates the activity, so what the learner made lives in view models, drafts and saveable state, and the scroll position and text input survive.
- Test on the `Pixel_Fold` AVD in every posture (outer display, inner display flat and half opened as a book, on its side flat and as a tabletop) and on a Galaxy Z Fold's shape, and look at fold layouts in on-demand Robolectric renders with `androidx.window:window-testing` ([commands](references/design-system.md#testing-on-a-foldable)).

## Official Starting Points

- Android Design and Plan: https://developer.android.com/design
- Android UI Design: https://developer.android.com/design/ui
- Android mobile design: https://developer.android.com/design/ui/mobile
- Material Design 3: https://m3.material.io/
- Material components overview: https://developer.android.com/design/ui/mobile/guides/components/material-overview
- Material Design 3 in Compose: https://developer.android.com/develop/ui/compose/designsystems/material3
- Material Design for Android Views: https://developer.android.com/develop/ui/views/theming/look-and-feel
- Adaptive apps: https://developer.android.com/adaptive-apps
- Adaptive layouts in Compose: https://developer.android.com/develop/ui/compose/layouts/adaptive
- Material Symbols in Compose: https://developer.android.com/develop/ui/compose/graphics/images/material
- Contrast levels: https://m3.material.io/foundations/designing/color-contrast
