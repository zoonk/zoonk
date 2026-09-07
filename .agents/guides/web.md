# Web UI and localization

This guidance applies to React and Next.js UI across apps and shared packages, including `packages/ui`, `packages/player`, and React leaves in `packages/core`. Native Apple and Android UI follow their platform instructions.

## Components and routing

- Prefer Server Components and server data fetching. Add client state for browser interactions; use effects for synchronization with external systems. When deciding whether an effect is necessary, consult [React's effect guidance](https://react.dev/learn/you-might-not-need-an-effect) and the relevant [React best practices](../skills/vercel-react-best-practices/SKILL.md).
- Use `Suspense` with a loading skeleton built from `@zoonk/ui/components/skeleton`, colocated with the component it represents.
- Use [zoonk-compound-components](../skills/zoonk-compound-components/SKILL.md) when creating or refactoring reusable React UI, and [zoonk-design](../skills/zoonk-design/SKILL.md) for visual or interaction decisions. Keep domain compositions free to assemble these primitives.
- Define repeated accessibility IDs once as `*_ID` constants, shared across files when necessary.
- Preserve Next.js typed routes with literal hrefs or `as const`; never cast values to `Route`. Custom link wrappers should use a generic `Route<Href> | URL` prop.
- Use `ClientLink` when a Base UI `render` prop requires a client component.

## Localization

- Use `getExtracted` on the server and `useExtracted` on the client. Call the returned `t` with string literals; do not use translation keys or pass translation functions through props or helpers.
- Translate copy in the component that owns it. Do not hoist cheap translation lookups or pass labels solely to avoid repeated calls. Caller-provided copy may be an intentional reusable API.
- Use one ICU plural message, such as `{count, plural, one {# item} other {# items}}`, instead of singular/plural branches. Follow the [copy styleguide](../../packages/i18n/.eloqnt/styleguide.md) for user-facing text.
- When source copy changes, extract through the affected app's dev server or build, translate with `pnpm --filter <app> i18n`, and run its `i18n:lint`. Do not manually edit PO files. Unrelated tasks do not need extraction or translation runs.
