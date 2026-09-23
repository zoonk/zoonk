---
name: zoonk-design
description: Design, implement, or assess Zoonk interfaces with clear hierarchy, low cognitive effort, and a coherent visual language.
license: MIT
metadata:
  author: zoonk
  version: "3.0.0"
---

# Zoonk design

Build clean, subtle, harmonious interfaces. **Don't make me think:** make the purpose, available actions, and their consequences easy to understand. Reduce the effort of using the interface while preserving the thought that learning requires. The user's explicit requirements take precedence over this skill.

## Understand the task

Start with the person's goal, knowledge, and context. Identify what they need to decide and what the product can handle for them. Choose the structure before the controls; a feature list is not an interface.

Inspect relevant screens and shared components in the current main app. Match established controls, proportions, and behavior in mockups as well as code. Question patterns that make the task harder. When the structure is uncertain, prototype with representative content before polishing.

## Shape the experience

- **Resolve unnecessary decisions.** Provide a useful default path. Use known context and reversible defaults; ask people to choose where their preferences or circumstances matter.
- **Give attention a clear order.** Decide what matters now, what supports it, and what can wait. Make the next action obvious; keep alternatives available without giving every option equal emphasis. Reconsider competing elements before fitting them into a tidier layout.
- **Make each element earn its place.** Remove labels that restate the obvious and repeated representations of the same information. Before adding a separate widget, consider whether an existing element can communicate it naturally. Look for simpler combinations of information and action while keeping their meaning clear.
- **Organize complexity around the task.** Sequence decisions when one answer determines what comes next. Keep related information together when people need to compare it. Reveal infrequent detail on demand through discoverable controls. Judge total effort: extra steps and hidden information can create more work.
- **Make behavior predictable.** Use familiar concepts, specific labels, and consistent interactions. Keep needed context visible. If routine use needs lengthy explanation, improve the interaction; place necessary guidance where uncertainty occurs.
- **Build confidence.** Show state and feedback promptly. Prevent likely mistakes, preserve work, and make correction easy. Keep meaningful choices accessible.
- **Design the whole journey.** Preserve context and consistent placement across transitions. Each addition should fit the surrounding experience. Reusing components alone does not make a coherent interface.
- **Express care.** Make people feel capable and comfortable through thoughtful language, balanced proportions, responsive feedback, and smooth continuity. Delight should remain pleasant through repeated use.

For the reasoning behind these principles, see [Design foundations](references/design-foundations.md).

## Zoonk's visual language

- Keep company logos out of app interfaces; use that space for the person's task.
- Use shared alignment anchors across adjacent sections and columns. Group through spacing and typography; add dividers or containers only when the grouping remains unclear without them.
- Use a neutral base with purposeful color, including icons that help distinguish content. Establish hierarchy through size, weight, and tone: contextual labels stay smaller and quieter than the content they introduce. Keep text readable and controls distinct.
- Reuse `@zoonk/ui` components and established variants. Check existing primitives and the shadcn registry before building a missing web primitive. Use Tailwind utilities and semantic tokens.
- Follow established button variants for the task: `default` for the primary action, `outline` for ordinary actions, and `secondary` for modest emphasis. Preserve compact proportions and familiar content placement. Keep text navigation lightweight.
- Write concise, concrete copy with enough context to remove uncertainty. Use imagery and subtle motion to communicate or support the experience; respect reduced-motion preferences.

## Check the experience

Walk through the task: can someone recognize what matters, predict what happens next, and recover from mistakes? Check what can be removed or combined without losing clarity. Fix unnecessary interpreting, remembering, and choosing.

Inspect implemented changes in the running app at relevant sizes. Check affected loading, empty, disabled, and error states, plus keyboard access, focus, touch targets, long translations, and dark mode where relevant. Recheck observed friction. For proposals, show representative screens and transitions. State what remains unverified.

## Related guidance

- [Zoonk compound components](../zoonk-compound-components/SKILL.md) for reusable React UI architecture.
- [Apple Human Interface Guidelines](../apple-human-interface-guidelines/SKILL.md) for Apple UI.
- [Android Material guidelines](../android-material-guidelines/SKILL.md) for Android UI.

Follow native platform conventions over web-specific styling.
