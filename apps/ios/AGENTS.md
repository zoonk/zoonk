# iOS App Guidance

## Use The Platform

Build the iOS app as a native Apple app, not as a port of the web app. Start from Apple HIG, SwiftUI conventions, and system components. When system behavior exists for navigation, search, tabs, lists, toolbars, sheets, or accessibility, prefer it over custom recreation.

For app shell screens, prefer native `NavigationStack`, `TabView`, search, sidebar, toolbar, and focus behavior. If system title/toolbar APIs cannot express the product chrome consistently across target device classes, put the title/account row in one shared layout component with standard content margins. Do not create one-off title positioning inside individual screens.

## Structure Before Styling

When layout is wrong, first question the view hierarchy and ownership boundaries. Avoid fixing structural problems with hard-coded padding, offsets, safe-area constants, or device-specific values.

A good fix usually makes ownership clearer:

- Shared chrome belongs outside feature-specific containers.
- Feature navigation belongs inside that feature.
- Modifiers should live on the smallest view that actually owns the behavior.
- System chrome should be allowed to reserve space only where it is meant to apply.
- Adaptive branches should be based on real platform traits, such as size class or OS, not on device names, pixel values, or compensating offsets.

## Code Organization

Use feature-first folders, with a small shared layer for primitives that are intentionally reused across screens. Avoid broad type buckets that become dumping grounds, such as a single `Views` or `Helpers` folder.

Default structure:

- `App/`: app-level shell, root content, tabs, scene wiring, and navigation entry points.
- `Screens/<Feature>/`: one folder per top-level screen or feature area.
- `Shared/Layout/`: reusable layout/chrome primitives.
- `Shared/Components/`: small reusable UI components.
- `Resources/`: asset catalogs, string catalogs, and other app resources.

Keep `ZoonkApp.swift` at the source root as the app entry point. Move a screen into its own feature folder before it grows real content. Add deeper subfolders only when the feature has multiple meaningful responsibilities, such as sections, models, services, or previews.

## Scope Modifiers Carefully

SwiftUI modifiers can affect ancestors, descendants, and sibling layout in non-obvious ways. Apply behavior modifiers as narrowly as possible, especially navigation, search, toolbar, presentation, environment, and safe-area modifiers.

If a modifier causes unrelated screens to change, it is probably attached too high in the tree.

## Verify On Device Classes

Compilation is not enough for SwiftUI layout work. Validate navigation and chrome changes in Preview or Simulator across relevant Apple device classes before calling the work done.

For interactive shell changes, verify:

- Default state.
- Selected tab state.
- Focused/input state.
- Keyboard-presented state.
- Compact and larger devices where relevant.

## Prefer Recomposition Over Compensation

Do not use magic numbers to line things up with Apple chrome. If the system adds unexpected spacing or movement, recompose the views so the affected system behavior is attached to the correct owner.

Offsets are acceptable only when they represent intentional design within a component, not when they compensate for unknown framework behavior.
