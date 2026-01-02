---
name: compound-components
description: Build UI components using the compound component pattern. Use when creating new React components, building UI elements, refactoring components, or when the user mentions compound components, composable components, component patterns, or UI building blocks.
---

# Compound Components Pattern

This is the **REQUIRED** pattern for ALL UI components. Always use compound components by default.

## What are Compound Components?

Compound components are small, single-purpose components that compose together. Each component wraps exactly ONE HTML element and has ONE responsibility. They are combined like building blocks.

For more information, see the [components.build docs](https://www.components.build/llms.txt).

## Core Rules

1. **Each component = one element** - A component wraps exactly one HTML element
2. **Use `children` for content** - Never use props like `title`, `description`, `label` - pass content as children
3. **Use `className` for customization** - Allow consumers to override styles
4. **Use `data-slot` for CSS coordination** - Style child components based on parent context using `data-slot` attributes and Tailwind's `has-*` or `group-*` selectors
5. **Make components generic** - Name components for what they ARE, not what they're FOR. A component used for courses, users, and brands should be in the UI package with a generic name like `MediaCard`, not `CourseHeader`

## Context/Provider - LAST RESORT

**Do NOT use React Context by default.** Most compound components don't need it. Context is only for:

- Shared state that MULTIPLE children need to read/write (like form state, open/close state)
- When props would need to pass through 3+ levels

If you find yourself reaching for Context, first ask: "Can I solve this with just composition and CSS?" Usually the answer is yes.

## Example: The Right Way

```tsx
// Each component wraps ONE element, uses children, no context needed
<MediaCard>
  <MediaCardTrigger>
    <MediaCardImage>
      <Image src={...} />
    </MediaCardImage>
    <MediaCardContent>
      <MediaCardTitle>{title}</MediaCardTitle>
      <MediaCardDescription>{description}</MediaCardDescription>
    </MediaCardContent>
    <MediaCardIndicator />
  </MediaCardTrigger>
  <MediaCardPopover>
    <MediaCardPopoverText>{fullDescription}</MediaCardPopoverText>
    <MediaCardPopoverMeta>
      <MediaCardPopoverSource>{source}</MediaCardPopoverSource>
    </MediaCardPopoverMeta>
  </MediaCardPopover>
</MediaCard>
```

## Example: The Wrong Way (Do NOT Do This)

```tsx
// BAD: Props instead of children
<CourseHeader
  title={t("Course title")}
  description={t("Course description")}
  organization={org.name}
  categories={categories}
  imageUrl={course.imageUrl}
/>

// BAD: Unnecessary Context/Provider
<CourseHeaderProvider value={{ description, organization }}>
  <CourseHeaderContent />
</CourseHeaderProvider>

// BAD: Domain-specific naming for generic patterns
<CourseHeaderImage /> // Should be <MediaCardImage /> in UI package
```

## Using data-slot for CSS Coordination

Use `data-slot` attributes to coordinate styles between parent and child:

```tsx
// Parent component
function MediaCard({ children }) {
  return <div data-slot="media-card">{children}</div>;
}

// Child component - styled based on parent context
function MediaCardTitle({ children, className }) {
  return (
    <h1
      className={cn(
        // Base styles
        "font-semibold",
        // Contextual styles using Tailwind's group/has selectors
        "group-data-[size=sm]/media-card:text-sm",
        className
      )}
      data-slot="media-card-title"
    >
      {children}
    </h1>
  );
}
```

## Why This Matters

1. **Flexibility** - Consumers can add, remove, or reorder any piece
2. **Reusability** - Generic components work across the entire codebase
3. **No magic** - The JSX structure shows exactly what renders
4. **Easy to extend** - Add new child components without changing existing ones
5. **Testable** - Each small component is easy to test in isolation

## Reference Examples

Look at these existing components for guidance:

- `packages/ui/src/components/item.tsx` - Item/list compound components
- `packages/ui/src/components/container.tsx` - Container compound components
- `packages/ui/src/components/sidebar.tsx` - Sidebar compound components
- `packages/ui/src/components/dialog.tsx` - Dialog compound components

## Component Placement

- **Generic UI patterns** (MediaCard, Item, Container): `packages/ui/src/components/`
- **Domain-specific compositions**: `apps/{app}/src/components/{domain}/`
