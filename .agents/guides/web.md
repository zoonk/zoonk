# Web UI and localization

This guidance applies to React and Next.js UI across apps and shared packages, including `packages/ui`, `packages/player`, and React leaves in `packages/core`. Native Apple and Android UI follow their platform instructions.

## Components and routing

- Prefer Server Components and server data fetching. Add client state for browser interactions; use effects for synchronization with external systems. When deciding whether an effect is necessary, consult [React's effect guidance](https://react.dev/learn/you-might-not-need-an-effect) and the relevant [React best practices](../skills/vercel-react-best-practices/SKILL.md).
- Use `Suspense` with a loading skeleton built from `@zoonk/ui/components/skeleton`, colocated with the component it represents.
- Use [zoonk-compound-components](../skills/zoonk-compound-components/SKILL.md) when creating or refactoring reusable React UI, and [zoonk-design](../skills/zoonk-design/SKILL.md) for visual or interaction decisions. Keep domain compositions free to assemble these primitives.
- Define repeated accessibility IDs once as `*_ID` constants, shared across files when necessary.
- Preserve Next.js typed routes with literal hrefs or `as const`; never cast values to `Route`. Custom link wrappers should use a generic `Route<Href> | URL` prop.
- Use `ClientLink` when a Base UI `render` prop requires a client component.
- In `apps/main` pages whose only dynamic segment is `[lang]`, read the locale with `lang()` from `next/root-params` instead of awaiting `params`. Next.js warms prefetched session shells with `params` still pending but resolves them in the final render, so cached reads after `await params` log "Unexpected cache miss after cache warming".

## Localization

- Use `getExtracted` on the server and `useExtracted` on the client. Call the returned `t` with string literals; do not use translation keys or pass translation functions through props or helpers.
- Translate copy in the component that owns it. Do not hoist cheap translation lookups or pass labels solely to avoid repeated calls. Caller-provided copy may be an intentional reusable API.
- Use one ICU plural message, such as `{count, plural, one {# item} other {# items}}`, instead of singular/plural branches. Follow the [copy styleguide](../../packages/i18n/.eloqnt/styleguide.md) for user-facing text, including its voice, honest-progress, and feature-name rules.
- When source copy changes, extract through the affected app's dev server or build, translate with `pnpm --filter <app> i18n`, and run its `i18n:lint`. Do not manually edit PO files. Unrelated tasks do not need extraction or translation runs.
- In `apps/main`, client components receive only their route's messages (`ClientMessagesProvider` in `apps/main/src/i18n/client-messages-provider.tsx`): every page gets main's catalog and learn's `feedback` and `goalErrors` namespaces, learner routes add the learn catalog (`scope="learn"`), and the lesson player's routes add the player catalog (`scope="player"`). A route that renders learn or player client components needs a `layout.tsx` with that scope.
