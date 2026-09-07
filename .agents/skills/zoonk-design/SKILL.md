---
name: zoonk-design
description: Design or assess Zoonk interface visuals, interactions, and user flows.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# Zoonk design

Make the user's next action clear with restrained interfaces inspired by Apple, Linear, and Vercel. Prefer a short, understandable flow and a clear visual hierarchy.

## Visual language

- Use generous space, readable typography, and a mostly black-and-white palette. Apply semantic design tokens and purposeful accent color.
- Prefer spacing and subtle dividers over bordered cards and heavy shadows.
- On the web, use `outline` for most buttons and links, the default variant for selected states or submit actions, and `secondary` for modest emphasis.
- Reuse `@zoonk/ui` components and established variants. Check the shadcn registry before building a missing web primitive. Use Tailwind utilities and semantic tokens instead of introducing CSS modules or arbitrary colors for ordinary component styling.
- Keep motion subtle, tied to feedback or continuity, and respectful of reduced-motion preferences.

## Interaction decisions

Design around the user's task: what they need to understand, what they can do next, and how they recover from errors. Remove steps, competing actions, and decoration that do not serve that task. Preserve clear loading, empty, disabled, and error states in the changed flow.

Keep layout, typography, and action priority consistent with neighboring screens. Account for small screens, long translations, dark mode, keyboard navigation, visible focus, semantic labels, contrast, and usable touch targets where the change affects them.

Inspect visible or interactive changes in the running application at relevant sizes. Judge whether the assembled flow is understandable and useful. State any runtime or accessibility behavior that remains unverified; a build alone does not establish visual quality.

## Related guidance

- For reusable React UI architecture, use [zoonk-compound-components](../zoonk-compound-components/SKILL.md).
- For Apple UI, follow [Apple Human Interface Guidelines](../apple-human-interface-guidelines/SKILL.md) and the app's instructions.
- For Android UI, follow [Android Material guidelines](../android-material-guidelines/SKILL.md).

Native controls, navigation, colors, and adaptive behavior take precedence over web-specific visual conventions. These references apply to their respective platforms; do not load all of them for an ordinary web edit.
