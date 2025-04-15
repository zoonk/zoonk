## CSS

- Use Tailwind 4 for CSS.
- Never use tailwind colors directly. Instead, use the colors defined in `assets/css/app.css`. For example, don't use `bg-white`, use `bg-zk-surface` instead.
- Common used utilities should be added to the `assets/css/app.css` file and have a `zk` prefix. For example: `@utility zk-surface {@apply p-4}`.
- When adding tailwind utilities, ensure they're consistent with the existing ones in `assets/css/app.css`.
- When mentioned a screen should be adapted to mobile screens, it means Tailwind's `sm` or lower breakpoints. For tablet (portrait), you should use `md`, for tablet (landscape) `lg`, and for desktop/laptop `xl` or higher. If you want to target a specific breakpoint, for example, only tablet portrait, you can use the new `md:max-lg` utility from tailwind 4.
