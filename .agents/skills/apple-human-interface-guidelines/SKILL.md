---
name: apple-human-interface-guidelines
description: Use when designing, reviewing, or implementing any Apple-platform UI or feature for iOS, iPadOS, macOS, visionOS, tvOS, watchOS, SwiftUI, UIKit, AppKit, WatchKit, app icons, Dark Mode, SF Symbols, system colors, native controls, or when porting web features to Apple platforms. Ensures current official Apple Human Interface Guidelines are checked and platform conventions are preferred over copying web layouts.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Apple Human Interface Guidelines

This skill is a workflow, not a frozen copy of Apple's HIG. Apple's official docs are the source of truth. Use this skill to make sure Apple-platform work starts from current HIG guidance and native platform conventions.

## Required Workflow

1. Identify every target platform: iOS, iPadOS, macOS, visionOS, tvOS, and/or watchOS.
2. Read the current official HIG pages that match the feature, component, interaction, and platform. Start with [references/official-links.md](references/official-links.md).
3. If a page requires JavaScript, fetch the official JSON data instead:
   - Index: `https://developer.apple.com/tutorials/data/index/design--human-interface-guidelines.json`
   - Topic: `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<slug>.json`
4. Choose the platform convention first. Only use custom UI when the system component, color, symbol, material, navigation pattern, or interaction truly does not fit the product need.
5. Before finishing, review the work against the relevant platform page, foundation pages, and component or pattern pages.

## Product Rule

Preserve product intent, not web implementation details. Zoonk's `main` app is a web app; when porting a feature to an Apple app, do not map the same layout, navigation, density, controls, or visual treatment by default. Design the native version for the Apple platform and input method in front of you.

Examples:

- iOS and iPadOS should use native navigation, safe areas, sheets, tab bars/sidebar patterns, Dynamic Type, and touch-friendly controls where appropriate.
- macOS should respect menu bar, window, toolbar, sidebar, keyboard, pointer, and multiwindow conventions.
- visionOS should use spatial layout, depth, ornaments, focus, and immersive guidance instead of flattening the web layout into a window.
- tvOS should optimize for focus, remote input, large viewing distance, and clear selection states.
- watchOS should favor glanceable, compact, crown-aware interactions.

## Design Defaults

- Prefer system colors, semantic colors, materials, typography, spacing, controls, and navigation structures.
- Prefer SF Symbols for standard actions and objects. Use custom symbols only when no platform symbol communicates the concept.
- Support Dark Mode with semantic colors instead of hardcoded light or dark values.
- Respect safe areas, Dynamic Type, VoiceOver, reduced motion, contrast settings, platform gestures, pointer/focus behavior, and input-specific affordances.
- Use platform-provided components before custom components.
- Keep platform differences intentional. A feature can share the same domain model and product goal across Apple platforms while using different native UI on each platform.

## Official Starting Points

- Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines
- Apple Design: https://developer.apple.com/design/
- Apple Design Resources: https://developer.apple.com/design/resources/
- SF Symbols: https://developer.apple.com/sf-symbols/
- Icon Composer: https://developer.apple.com/icon-composer/
- Adopting Liquid Glass: https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass
