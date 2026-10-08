---
name: apple-human-interface-guidelines
description: Use when designing, reviewing, or implementing any Apple-platform UI or feature for iOS, iPadOS, macOS, visionOS, tvOS, watchOS, SwiftUI, UIKit, AppKit, WatchKit, app icons, Dark Mode, SF Symbols, system colors, native controls, or when porting web features to Apple platforms. Ensures native controls and platform behavior follow current official Apple Human Interface Guidelines while the look matches Zoonk's main app.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# Apple Human Interface Guidelines

This skill is a workflow, not a frozen copy of Apple's HIG. Apple's official docs are the source of truth. Use this skill to make sure Apple-platform work uses native controls and behavior from current HIG guidance, with the look of Zoonk's `main` app.

## Required Workflow

1. Identify every target platform: iOS, iPadOS, macOS, visionOS, tvOS, and/or watchOS.
2. Read the current official HIG pages that match the feature, component, interaction, and platform. Start with [references/official-links.md](references/official-links.md).
3. If a page requires JavaScript, fetch the official JSON data instead:
   - Index: `https://developer.apple.com/tutorials/data/index/design--human-interface-guidelines.json`
   - Topic: `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<slug>.json`
4. Choose the native component first and style it to match `main`. Only build custom UI when no native component can carry the design, and give it the same accessibility and input behavior as the native one.
5. Before finishing, review the work against the relevant platform page, foundation pages, and component or pattern pages, and compare it with the matching `main` screen.

## Product Rule

Like Duolingo, Zoonk's Apple apps use native controls for performance and platform behavior, and look like the `main` web app. Take colors, typography, icons, proportions and screen structure from `main`. Take controls, navigation containers, gestures, input, and accessibility behavior from the platform. Do not port web implementation details such as HTML layout tricks, hover-only affordances, or custom replacements for native controls. When `main`'s look would break native behavior, keep the behavior and adapt the look.

Examples of native behavior:

- iOS and iPadOS should use native navigation, safe areas, sheets, tab bars/sidebar patterns, Dynamic Type, and touch-friendly controls where appropriate.
- macOS should respect menu bar, window, toolbar, sidebar, keyboard, pointer, and multiwindow conventions.
- visionOS should use spatial layout, depth, ornaments, focus, and immersive guidance instead of flattening the web layout into a window.
- tvOS should optimize for focus, remote input, large viewing distance, and clear selection states.
- watchOS should favor glanceable, compact, crown-aware interactions.

## Design Defaults

- Prefer native controls, materials, and navigation structures, styled with Zoonk's design tokens from `main`: colors, typography, spacing, and corner radii.
- Prefer SF Symbols for standard actions and objects, choosing the closest match to the icon `main` uses. Use custom symbols only when no platform symbol communicates the concept.
- Support Dark Mode with named colors that carry Zoonk's light and dark values instead of hardcoded ones. Light, dark, and reduced motion follow the device.
- Respect safe areas, Dynamic Type (custom fonts included), VoiceOver, reduced motion, contrast settings, platform gestures, pointer/focus behavior, and input-specific affordances.
- Use platform-provided components before custom components.
- Keep platform differences intentional. Behavior can differ between Apple platforms and the web; the look stays Zoonk's.

## Official Starting Points

- Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines
- Apple Design: https://developer.apple.com/design/
- Apple Design Resources: https://developer.apple.com/design/resources/
- SF Symbols: https://developer.apple.com/sf-symbols/
- Icon Composer: https://developer.apple.com/icon-composer/
- Adopting Liquid Glass: https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass
