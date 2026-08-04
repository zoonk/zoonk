# Apple App Instructions

These instructions apply to the multiplatform SwiftUI app in this directory and supplement the repository-level instructions in `../../AGENTS.md`.

## Required Apple Guidance

- Before changing code for iOS, iPadOS, macOS, visionOS, tvOS, or watchOS, read `../../.agents/skills/apple-human-interface-guidelines/SKILL.md` and follow Apple's current Human Interface Guidelines and official platform documentation.
- Treat Apple platform conventions as product requirements. The `main` web app can define product intent, copy, business behavior, and API contracts, but it must never be copied as the UI, layout, navigation, interaction, or visual design template for this app.
- Design for each device's native interaction model: touch and adaptive layouts on iPhone and iPad, windows and commands on Mac, focus and the remote on Apple TV, spatial interaction on Vision Pro, and glanceable Digital Crown-friendly flows on Apple Watch.
- Prefer system colors, semantic colors, system materials, system typography, native controls, and SF Symbols. Add custom colors, symbols, or controls only when a system component cannot express the product need.
- Preserve Dynamic Type, VoiceOver semantics, sufficient contrast, system spacing, safe areas, keyboard behavior, focus behavior, and reduced-motion settings by relying on native components and avoiding fixed-size assumptions.

## Platform Architecture

- Keep `Zoonk` as the shared app target for iOS, iPadOS, macOS, tvOS, and visionOS. Keep `Zoonk Watch App` as a separate companion target because watchOS has a distinct application and navigation model.
- Use adaptive SwiftUI containers before platform checks. Platform-specific code is appropriate only when the capability or convention is genuinely different.
- Keep application lifecycle and dependency composition in each target's `App` folder. Organize product code vertically by feature rather than creating global `Views`, `Models`, or `ViewModels` buckets.
- Put code in `Shared` only when more than one target consumes it. Keep feature-specific platform differences beside the feature; reserve a future `Platform` folder for app-wide platform integrations such as scenes, commands, entitlements, and handoff.
- Do not duplicate features into one directory per operating system. Extract stable, independently owned domains or sufficiently large features into local Swift packages when real module boundaries emerge.
- Use Swift concurrency and value types by default. Keep observable state at the narrowest owning feature boundary and avoid introducing view models that only relay data without adding domain behavior.

## Navigation and Presentation

- Use `TabView` and `NavigationStack` for the shared primary navigation shell, allowing SwiftUI to adapt tab presentation across iPhone, iPad, Mac, Apple TV, and Vision Pro.
- A tab represents a persistent top-level destination, never an immediate action. Use toolbars, menus, sheets, or confirmation dialogs for actions according to the conventions of the current platform.
- Do not force a phone-style bottom tab bar onto platforms where Apple presents tabs differently. Apple Watch should use its own concise navigation hierarchy instead of mirroring the shared tab shell.

## Localization

- Keep user-facing text in native Xcode String Catalogs and use generated localized symbols from Swift. Let the operating system select the app language; do not add a custom locale switcher or parallel translation store.
- Reserve `Shared/Resources/Localization/Navigation.xcstrings` for cross-target navigation and app-shell terminology. When a durable feature receives its first feature-owned user-facing copy, add one named `<Feature>.xcstrings` catalog beside that feature instead of growing a global catalog. Keep every supported locale together in that feature catalog, keep catalog basenames unique and stable within each target, and use the generated `.Feature.*` symbols so the catalog name remains the explicit lookup table.
- Zoonk currently supports English, Spanish, Portuguese, French, and German. Use the generic `pt` locale to match the product-wide locale contract. Every catalog must support all five locales rather than splitting files by language.
- Reuse the main app's established wording when it fits native Apple UI, but prefer concise platform-standard terminology when the web wording is not appropriate for a native control.

## Verification

- Build every supported destination independently because successful compilation for one Apple platform does not prove another platform's APIs, assets, or layout are valid.
- Prefer UI tests for user flows and unit tests for non-trivial pure domain logic. Do not test SwiftUI implementation details or static catalog contents.
- Inspect the rendered result on the relevant simulator or device and verify accessibility, localization, focus, window sizing, and input behavior in proportion to the change.
