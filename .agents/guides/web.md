# Web UI

This guidance applies to React and Next.js UI across apps and shared packages, including `packages/ui`, `packages/player`, and React leaves in `packages/core`. Native Apple and Android UI follow their platform instructions. Read the file for what you're changing:

| When you're changing                                                                                 | Read                                            |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| What renders on the server, Suspense, skeletons, the first paint, a part that needs the browser      | [Rendering](web-rendering.md)                   |
| A link, prefetching, what a tap shows while its page loads                                           | [Links](web-links.md)                           |
| The app's frame (sidebar, bars, tab bar), which layout a page lives in, a page that needs an account | [Frame](web-frame.md)                           |
| A button that sends a request, a form, a text field, a Server Action, state kept across a resize     | [Actions](web-actions.md)                       |
| Translated copy in web code: `getExtracted`, plurals, message ids, client catalogs                   | [Localization](web-localization.md)             |
| How a screen looks, reads or behaves                                                                 | [zoonk-design](../skills/zoonk-design/SKILL.md) |

## Components

- Before writing a component, [find the piece that exists](../skills/zoonk-design/SKILL.md#find-the-piece-before-you-build-one). A piece another surface could draw lives in a package from the start, exported: the learn kit (`packages/learn/src`, which the player imports) when it carries product words, `@zoonk/ui` when it doesn't. An app keeps only its routes' compositions.
- Create or refactor reusable React UI as [compound components](../skills/zoonk-compound-components/SKILL.md), and keep domain compositions free to assemble those primitives.
- Define repeated accessibility IDs once as `*_ID` constants, shared across files when necessary.
- Preserve Next.js typed routes with literal hrefs or `as const`; never cast values to `Route`. Custom link wrappers should use a generic `Route<Href> | URL` prop.
