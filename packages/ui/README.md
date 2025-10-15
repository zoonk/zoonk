# Zoonk UI

Reusable UI elements for our applications. We follow the standards set by [components.build](https://www.components.build/) when building these elements. They are organized into the following categories:

- [Components](./src/components/README.md)
- [Hooks](./src/hooks/README.md)
- [Library](./src/lib/README.md)
- [Patterns](./src/patterns/README.md)
- [Styles](./src/styles/README.md)

## Adding new elements

When adding new elements to this package, prefer using [shadcn/ui](https://ui.shadcn.com/) or [Kibo UI](https://www.kibo-ui.com/), if what we need is available there. If not, we can build our own custom elements.

## CSS

Always use [Tailwind CSS](https://tailwindcss.com/) for styling and make sure to use our [design tokens](https://www.components.build/design-tokens) from our [globals.css file](./src/styles/globals.css).
