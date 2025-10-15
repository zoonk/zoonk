# Patterns

We're following the [components.build](https://www.components.build/definitions#13-pattern) definition for building our patterns:

> Patterns are a specific composition of primitives or components that are used to solve a specific UI/UX problem.
>
> Examples: Form validation with inline errors, confirming destructive actions, typeahead search, optimistic UI.

Patterns use reusable [components](../components/README.md) and [hooks](../hooks/README.md). For primitives, we usually use external libraries like [Radix UI](https://www.radix-ui.com/) and [Base UI](https://base-ui.com/).

## Usage

```tsx
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
```
