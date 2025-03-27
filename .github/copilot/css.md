## CSS

- Use `tailwind` for CSS.
- Never use tailwind colors directly. Instead, use the colors defined in `assets/css/main.css`. For example, don't use `bg-white`, use `bg-zk-surface` instead.
- Common used utilities should be added to the `assets/css/main.css` file and have a `zk` prefix. For example: `@utility zk-surface {@apply p-4}`.
- When adding tailwind utilities, ensure they're consistent with the existing ones in `assets/css/main.css`.
