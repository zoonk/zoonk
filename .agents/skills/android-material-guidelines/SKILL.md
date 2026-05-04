---
name: android-material-guidelines
description: Use when designing, reviewing, or implementing Android UI or features for phones, tablets, foldables, ChromeOS, desktop windowing, Wear OS, Android TV, Android for Cars, Android XR, widgets, Jetpack Compose, Material 3, Material Design, adaptive layouts, dynamic color, icons, dark theme, edge-to-edge UI, accessibility, or when porting web or iOS features to Android. Ensures current official Android Developers and Material Design guidance is checked and Android conventions are preferred over copying other platforms.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Android Material Guidelines

This skill is a workflow, not a frozen copy of Google's Android or Material Design docs. Google's official Android Developers and Material Design docs are the source of truth.

## Required Workflow

1. Identify every target surface: phone, tablet, foldable, ChromeOS, desktop windowing, Wear OS, Android TV, Android for Cars, Android XR, widgets, or other Android device categories.
2. Read the current official Android and Material pages that match the feature, component, interaction, and form factor. Start with [references/official-links.md](references/official-links.md).
3. If a Material page requires JavaScript, use the official Material sitemap to find the current page:
   - `https://m3.material.io/sitemap.xml`
4. Prefer Android and Material conventions first. Use custom UI only when Material components, Android system patterns, or form-factor guidance do not fit the product need.
5. Before finishing, review the work against the relevant Android form-factor page, Material foundation pages, and component pages.

## Product Rule

Preserve product intent, not web or iOS implementation details. Zoonk's `main` app is a web app, and Apple apps have their own conventions. When porting a feature to Android, do not map the same layout, navigation, density, controls, or visual treatment by default. Design the native version for the Android surface, screen size, and input method in front of you.

Examples:

- Mobile Android should use Material 3, Android navigation patterns, edge-to-edge layout, system bars, touch targets, and adaptive layouts.
- Tablets, foldables, ChromeOS, and desktop windowing should use window size classes, canonical layouts, panes, keyboard and pointer behavior, and resizable layouts.
- Wear OS should favor glanceable, low-friction, wrist-sized interactions.
- Android TV should optimize for focus, D-pad/remote input, distance from the screen, and clear selected states.
- Android for Cars should follow car templates and driver-distraction constraints.
- Android XR should use XR-specific spatial guidance instead of flattening a phone UI into a headset.

## Design Defaults

- Prefer Jetpack Compose with Material 3 components for new native Android UI unless the local app architecture requires Views.
- Prefer Material color schemes, dynamic color where appropriate, semantic roles, typography, shape, motion, and design tokens.
- Prefer Material Symbols or platform-standard icons for standard actions and objects. Use custom icons only when no official symbol communicates the concept.
- Support dark theme, accessibility, font scaling, contrast, reduced motion, system gestures, edge-to-edge behavior, and proper system bar handling.
- Use platform-provided components and AndroidX libraries before custom controls.
- Keep platform differences intentional. A feature can share the same domain model and product goal across Android, Apple, and web while using different native UI on each platform.

## Official Starting Points

- Android Design and Plan: https://developer.android.com/design
- Android UI Design: https://developer.android.com/design/ui
- Android mobile design: https://developer.android.com/design/ui/mobile
- Material Design 3: https://m3.material.io/
- Material components overview: https://developer.android.com/design/ui/mobile/guides/components/material-overview
- Material Design 3 in Compose: https://developer.android.com/develop/ui/compose/designsystems/material3
- Material Design for Android Views: https://developer.android.com/develop/ui/views/theming/look-and-feel
- Adaptive apps: https://developer.android.com/adaptive-apps
