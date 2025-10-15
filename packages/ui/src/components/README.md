# Components

We're following the [components.build](https://www.components.build/definitions#12-component) definition for building our components:

> A component is a styled, reusable UI unit that adds visual design to primitives or composes multiple elements to create complete, functional interface elements.
>
> Components are still relatively low-level but include styling, making them immediately usable in applications. They typically wrap unstyled primitives with default visual design while remaining customizable.

When using multiple components together to build a functionality, we refer to that as [blocks](../../../../apps/main/src/blocks/README.md) or [patterns](../patterns/README.md).

Blocks are usually placed on the app they belong to, while patterns are reusable across multiple apps.

## Usage

```tsx
import { Button } from "@zoonk/ui/components/button";
```
