---
name: android-material-guidelines
description: Use when designing, reviewing, or implementing Android UI or features for phones, tablets, foldables, ChromeOS, desktop windowing, Wear OS, Android TV, Android for Cars, Android XR, widgets, Jetpack Compose, Material 3, Material Design, adaptive layouts, dynamic color, icons, dark theme, edge-to-edge UI, accessibility, or when porting web or iOS features to Android. Ensures the app uses Material 3 and Android defaults (theme roles, type scale, Material Symbols, components, adaptive layouts) that express the meaning of Zoonk's design system, following current official Android Developers and Material Design guidance.
license: MIT
metadata:
  author: zoonk
  version: "3.0.0"
---

# Android Material Guidelines

This skill is a workflow, not a frozen copy of Google's Android or Material Design docs. Google's official Android Developers and Material Design docs are the source of truth for components, styles, and behavior; Zoonk's design system is the source of truth for what things mean.

## Required Workflow

1. Identify every target surface: phone, tablet, foldable, ChromeOS, desktop windowing, Wear OS, Android TV, Android for Cars, Android XR, widgets, or other Android device categories.
2. Read the current official Android and Material pages that match the feature, component, interaction, and form factor. Start with [references/official-links.md](references/official-links.md).
3. If a Material page requires JavaScript, use the official Material sitemap to find the current page:
   - `https://m3.material.io/sitemap.xml`
4. Choose the default Material or AndroidX component first, styled only through `MaterialTheme` roles. Only build custom UI when no platform component can carry the design, and give it the same accessibility, input, and adaptive behavior as the platform one.
5. Before finishing, review the work against the relevant Android form-factor page, Material foundation pages, and component pages, and compare its meaning (hierarchy, states, colors' jobs) with the matching `main` screen.

## Product Rule

Zoonk's Android app uses what Material 3 and Android provide by default instead of re-implementing the web design system, so the platform handles resizing, font scaling, contrast, accessibility, dark theme, and new devices. The design system defines meaning: roles, hierarchy, screen structure, and which color means what. Express that meaning through the closest Material role, type style, symbol, or component; take components, navigation containers, gestures, input, and accessibility behavior from Android. Add a custom style or asset only where no platform equivalent carries the meaning (such as belt and character artwork), and make it adapt to dark theme, contrast, and font scale too. Do not port web or iOS implementation details such as HTML layout tricks, hover-only affordances, pixel values from `main`, or iOS-specific controls.

Examples of native behavior:

- Mobile Android should use Material 3, Android navigation patterns, edge-to-edge layout, system bars, touch targets, and adaptive layouts.
- Tablets, foldables, ChromeOS, and desktop windowing should use window size classes, canonical layouts, panes, keyboard and pointer behavior, and resizable layouts.
- Wear OS should favor glanceable, low-friction, wrist-sized interactions.
- Android TV should optimize for focus, D-pad/remote input, distance from the screen, and clear selected states.
- Android for Cars should follow car templates and driver-distraction constraints.
- Android XR should use XR-specific spatial guidance instead of flattening a phone UI into a headset.

## Design Defaults

- Prefer Jetpack Compose with default Material 3 components for new Android UI unless the local app architecture requires Views. Use platform-provided components and AndroidX libraries before custom controls.
- Style through `MaterialTheme.colorScheme`, `MaterialTheme.typography`, and `MaterialTheme.shapes`. Never put raw colors, fixed font sizes, or fixed frames in composables; sizes come from the content, the component defaults, and the window.
- Use the default Material 3 type scale in `sp` so text follows the device's font scale; map each design-system type role to the closest Material style instead of copying `main`'s pixel sizes.
- Map each color's meaning from the design system (`apps/playground/src/design-system/`, rules in [the zoonk-design skill's color reference](../zoonk-design/references/color.md)) onto Material color roles: `primary` is the ink text color, picks are ink, progress and the learner's place a soft blue, wrong a soft pink-red (`error`), Brain Power violet, never a green for done. A meaning with no Material role (such as Brain Power) gets one extended color in the theme, with light, dark, and contrast values.
- Color scheme: use Zoonk's scheme, not wallpaper dynamic color. It's the same rule as Apple, whose system colors don't follow the wallpaper: wallpaper colors would drop the design system's meanings. Generate it as a full Material scheme (for example with Material Theme Builder) with light and dark plus medium- and high-contrast variants, and pick the variant from the device's contrast level (`UiModeManager.getContrast()`), so contrast is handled the standard Material way.
- Use Material Symbols for actions and objects, choosing the closest match to the meaning of the icon `main` and Apple use. Use custom icons only when no symbol communicates the concept.
- Use Material adaptive layouts for phones, foldables, tablets, ChromeOS, and desktop windowing: window size classes, `NavigationSuiteScaffold` for top-level navigation, and the list-detail and supporting-pane scaffolds where content benefits from panes.
- Support dark theme, accessibility, font scaling, contrast, reduced motion, system gestures, edge-to-edge behavior, and proper system bar handling; the defaults above provide most of it.
- Keep platform differences intentional. Look and behavior follow Android; the meaning stays Zoonk's.

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
