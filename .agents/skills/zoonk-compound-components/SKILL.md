---
name: zoonk-compound-components
description: Create or refactor reusable Zoonk React UI primitives using flat compound components.
license: MIT
metadata:
  author: zoonk
  version: "2.0.0"
---

# Compound components

Use small composable primitives when callers need to arrange content or share styling. This convention applies to reusable UI building blocks; a page or domain composition can assemble several elements without turning every element into a new API.

## Repository conventions

- Prefer existing `@zoonk/ui` primitives. Put generic patterns in `packages/ui` and domain compositions in the owning app or feature.
- A presentational primitive normally wraps one semantic element, accepts `children` and `className`, and exposes the relevant native props. Keep domain data fetching and orchestration in the composition that uses it.
- Use flat names such as `MediaCard`, `MediaCardTitle`, and `MediaCardDescription`; do not introduce namespaced exports such as `MediaCard.Title`.
- Use children for caller-owned content and `className` for styling overrides. Avoid bundles of title/description/action props or boolean variants when composition expresses the structure directly.
- Name shared primitives by their UI purpose. Domain-specific names remain appropriate for domain compositions.
- Use `data-slot` and Tailwind group/has variants for CSS coordination when needed. These attributes are not E2E selectors; preserve semantic elements, labels, and accessible relationships.
- Translate fixed copy in the component that owns it. Caller-supplied content is appropriate when it is part of the intended reusable API.

```tsx
<MediaCard>
  <MediaCardContent>
    <MediaCardTitle>{title}</MediaCardTitle>
    <MediaCardDescription>{description}</MediaCardDescription>
  </MediaCardContent>
</MediaCard>
```

## Shared state

Pure visual composition does not need a provider. Use context when siblings must share state/actions or controls outside the main frame need access to them. For those cases, consult [Vercel composition patterns](../vercel-composition-patterns/SKILL.md), retaining Zoonk's flat naming. Do not add a provider solely to pass static content.

Use E2E coverage for user interactions according to the repository testing guidance; do not add isolated React component tests for these primitives.
