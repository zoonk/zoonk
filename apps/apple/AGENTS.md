# Apple App Instructions

These instructions apply to the native iPhone and iPad app in this directory and supplement the repository-level instructions in `../../AGENTS.md`.

## Required Apple Guidance

- Before changing code for iOS or iPadOS, read `../../.agents/skills/apple-human-interface-guidelines/SKILL.md` and follow Apple's current Human Interface Guidelines and official platform documentation.
- Treat Apple platform conventions as product requirements. The `main` web app can define product intent, copy, business behavior, and API contracts, but it must never be copied as the UI, layout, navigation, interaction, or visual design template for this app.
- Design for touch and adaptive layouts across compact iPhone screens, regular-width iPad layouts, multitasking, and resizable iPad windows.
- Prefer system colors, semantic colors, system materials, system typography, native controls, and SF Symbols. Add custom colors, symbols, or controls only when a system component cannot express the product need.
- Preserve Dynamic Type, VoiceOver semantics, sufficient contrast, system spacing, safe areas, keyboard behavior, focus behavior, and reduced-motion settings by relying on native components and avoiding fixed-size assumptions.

## Platform Architecture

- Keep one `Zoonk` application target for iPhone and iPad. Both devices should use the same feature code and adapt through SwiftUI size classes and native containers rather than separate implementations.
- Keep the Designed for iPhone/iPad compatibility destinations enabled for Apple silicon Mac and Apple Vision Pro. They run the iPad app and are not independently maintained native targets.
- Keep application lifecycle and dependency composition in the `App` folder. Organize product code vertically by feature rather than creating global `Views`, `Models`, or `ViewModels` buckets.
- Keep UI-test fixtures in `ZoonkUITests` and limit app-side launch decoding to the Debug-only `Zoonk/Testing` boundary. Inject ordinary initial state through the app composition root; never parse test arguments or embed fixture data in product views, stores, or clients.
- Extract stable, independently owned domains or sufficiently large features into local Swift packages when real module boundaries emerge.
- Use Swift concurrency and value types by default. Keep observable state at the narrowest owning feature boundary and avoid introducing view models that only relay data without adding domain behavior.

## Navigation and Presentation

- Use `TabView` and `NavigationStack` for the primary navigation shell, allowing SwiftUI to adapt between iPhone and iPad.
- A tab represents a persistent top-level destination, never an immediate action. Use toolbars, menus, sheets, or confirmation dialogs for actions according to the conventions of the current platform.
- Let iPad adopt its native sidebar-style tab presentation instead of forcing an iPhone-style bottom tab bar at regular widths.

## Localization

- Keep user-facing text in native Xcode String Catalogs. Let the operating system select the app language; do not add a custom locale switcher or parallel translation store.
- Prefer source-driven extraction. Pass English string literals directly to localizable SwiftUI or Foundation APIs, include a translator comment, and specify the owning feature catalog with `table: "<Feature>"`. Build the app to let Xcode add and update catalog entries automatically. Do not add `extractionState: "manual"` or catalog-first semantic keys unless a specific use case requires generated symbols whose values must change independently from their keys.
- Keep String Catalogs together in `Zoonk/Resources/Localization`, named by their owning feature or app surface, such as `Account.xcstrings` and `Navigation.xcstrings`. Keep catalog basenames unique and stable within the target; Eloqnt discovers every catalog in this directory automatically.
- After building to extract changed strings, run `pnpm --filter apple i18n` from the repository root to translate them and `pnpm --filter apple i18n:lint` to validate the catalogs. Never edit generated translations in `.xcstrings` files manually.
- Reuse the main app's established wording when it fits native Apple UI, but prefer concise platform-standard terminology when the web wording is not appropriate for a native control.

## Verification

- Build the iOS target and inspect both iPhone and iPad destinations because one binary can still render differently across size classes and multitasking widths.
- Prefer UI tests for user flows and unit tests for non-trivial pure domain logic. Do not test SwiftUI implementation details or static catalog contents.
- Inspect the rendered result on the relevant simulator or device and verify accessibility, localization, focus, window sizing, and input behavior in proportion to the change.
