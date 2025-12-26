# Zoonk Guidelines for AI Agents

Zoonk is a web app where users can learn anything using AI. This app uses AI to generate courses, chapters, lessons, and activities. Our goal is to help anyone to easily learn anything, providing tools that make learning easier, faster, more practical, and more fun.

## Table of Contents

- [Principles](#principles)
- [Design Style](#design-style)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Tools](#tools)
- [Conventions](#conventions)
- [CSS](#css)
- [Icons](#icons)
- [Cache Components](#cache-components)
- [Links](#links)
- [Params](#params)
- [Interactions](#interactions)
- [Animation](#animation)
- [Layout](#layout)
- [Content & Accessibility](#content--accessibility)
- [Performance](#performance)
- [Design](#design)

## Principles

- Always prefer the **simplest solution**. If something feels complex, refactor
- Favor **clarity and minimalism** in both code and UI
- Follow design inspirations from Apple, Linear, Vercel
- Code must be modular, following SOLID and DRY principles
- Avoid nested conditionals and complex logic. Prefer short and composable functions
- Prefer functional programming over OOP
- Use meaningful variable names and avoid abbreviations

## Design Style

Whenever you're designing something, follow this design style:

Subtle animations, great typography, clean, minimalist, and intuitive design with lots of black/white and empty space. Make it clean, intuitive and super simple to use. Take inspiration from brands with great design like Vercel, Linear, and Apple.

You deeply care about quality and details, so every element should feel polished and well thought out.

Some design preferences:

- Avoid cards/items with borders and heavy shadows. Prefer using empty space and subtle dividers instead
- For buttons, prefer `outline` variant for most buttons and links. Use the default one only for active/selected states or for submit buttons. Use the `secondary` variant for buttons you want to emphasize a bit more
- Prefer using existing components from `@zoonk/ui` instead of creating new ones. If a component doesn't exist, search the `shadcn` registry before creating a new one

## Tech stack

- Monorepo using [Turborepo](https://turborepo.com/docs)
- [Next.js (App Router)](https://nextjs.org/docs)
- TypeScript
- Tailwind CSS
- [Prisma Postgres](https://www.prisma.io/postgres)
- [Prisma ORM](https://www.prisma.io/docs/orm)
- [shadcn/ui](https://ui.shadcn.com/) and [Kibo UI](https://www.kibo-ui.com/)
- [Vercel AI SDK](https://ai-sdk.dev/llms.txt)
- [Better Auth](https://www.better-auth.com/llms.txt)

## Project structure

### Apps

- [main](./apps/main): Public web app (`zoonk.com`)
- [admin](./apps/admin): Dashboard for managing users and organizations (`admin.zoonk.com`)
- [editor](./apps/editor): Visual editor for building courses and activities (`editor.zoonk.com`)
- [evals](./apps/evals): Local-only tool for evaluating AI-generated content

### Packages

- [ai](./packages/ai): AI prompts, tasks, and helpers for content generation
- [core](./packages/core): Server utilities for database access and external integrations (the only package that should talk to `db`)
- [auth](./packages/auth): Shared Better Auth setup and plugins
- [db](./packages/db): Prisma schema and client (used only by `core`)
- [mailer](./packages/mailer): Email-sending utilities
- [tsconfig](./packages/tsconfig): Shared TypeScript config
- [ui](./packages/ui): Shared React components, patterns, hooks, and styles
- [utils](./packages/utils): Shared utilities and helpers

Read each folder's README file for more details

### Folder Structure

#### Apps

All apps should follow a consistent folder structure:

- `src/app/`: Next.js routes
- `src/i18n/`: Internationalization setup (if using `next-intl`)
- `src/lib/`: Shared utilities and constants
- `src/proxy.ts`: Next.js Proxy setup (if needed)

**Component Organization:**

1. **Route-specific components**: Colocate directly with the route's `page.tsx`
2. **Route group shared components**: Use `_components/` or `_hooks/` folders within the route group (e.g., `app/(private)/_components/`)
3. **Cross-route-group components**: Place in `src/components/{domain}/`
4. **Shared utilities**: Place in `src/lib/`

#### Packages

All packages should follow a consistent structure:

- `src/`: Source code with domain-organized subfolders, see existing packages for examples
- `README.md`: Package documentation
- `package.json`: Package manifest
- `tsconfig.json`: TypeScript configuration

## Tools

- Use `pnpm` for package management
- For AI features, use the [Vercel AI SDK](https://ai-sdk.dev) and the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). See docs for the AI SDK [here](https://ai-sdk.dev/llms.txt)

## Conventions

- When there are **formatting issues**, run `pnpm format` to auto-fix them
- When there are **linting issues**, run `pnpm lint --write --unsafe` to auto-fix them
- Run `pnpm typecheck` to check for TypeScript errors
- **Never manually fix formatting or linting issues** by reading files and editing them—always use the CLI commands above as it's more efficient
- Don't run `pnpm dev` since we already have a dev server running
- Run `pnpm build` to make sure all apps and packages are compiling correctly
- Prefer to use server components than client components. Only use client components when absolutely necessary
- Avoid `useEffect` and `useState` unless absolutely required
- Fetch data on the server whenever possible and use `Suspense` with a fallback for loading states, [see docs for streaming data](https://nextjs.org/docs/app/getting-started/fetching-data#streaming)
- Keep comments minimal—explain **why**, not **what**
- Use `safeAsync` when using `await` to better handle errors
- When creating a skeleton, use the `Skeleton` component from `@zoonk/ui/components/skeleton`
- Always build skeleton components when using `Suspense` for loading states
- For apps using `next-intl`, use `getExtracted` or `useExtracted`. This will extract the translations to PO files when we run `pnpm build`
- Don't add comments to a component's props
- Pass types directly to the component declaration instead of using `type` since those types won't be exported/reused

## CSS

- Use Tailwind v4
- Use variables defined in `packages/ui/src/styles/globals.css`
- Use `size-*` instead of `w-*` + `h-*`
- Only create custom utilities when we're often using the same styles
- Don't use `space-y-*` or `space-x-*` classes, instead use `gap-*`

## Icons

- We support both `lucide-react` and `@tabler/icons-react`
- Prefer `lucide-react`, only use `@tabler/icons-react` when the icon is not available in `lucide-react`

## Cache Components

When creating a `page.tsx` file, you should either use `use cache` or don't make any `await` calls directly in the component. Otherwise, Next.js will throw an error. Instead, move it to its own async component and wrap it with `<Suspense>`.

Don't wrap multiple elements in the same `Suspense` because this way the fallback using a skeleton would be too generic. Instead, wrap each component that fetches data in its own `Suspense` so you can provide a more specific fallback.

For example:

```tsx
<>
  <Suspense fallback={<OrganizationHeaderSkeleton />}>
    <OrganizationHeader />
  </Suspense>

  <Suspense fallback={<OrganizationListSkeleton />}>
    <OrganizationList />
  </Suspense>
</>
```

Avoid using `use cache` by default unless we know the page can be static. Plus, you can't use `use cache` with `searchParams`, `cookies()`, or `headers()`.

Use the `nextjs_docs` tool for searching the Next.js documentation when you have doubts about how to implement something.

## Links

You can style links as buttons like this:

You can use the buttonVariants helper to create a link that looks like a button.

```tsx
import { buttonVariants } from "@zoonk/ui/components/button";

<Link className={buttonVariants({ variant: "outline" })}>Click here</Link>;
```

## Params

In Next.js 15, `params` use Dynamic APIs. Dynamic APIs are: The `params` and `searchParams` props that get provided to pages, layouts, metadata APIs, and route handlers; `cookies()`, `draftMode()`, and `headers()` from `next/headers`. In Next 15, these APIs have been made asynchronous.

For example, the following code will issue a warning:

```ts
function Page({ params }) {
  // direct access of `params.id`.
  return <p>ID: {params.id}</p>;
}
```

This also includes enumerating (e.g. {...params}, or Object.keys(params)) or iterating over the return value of these APIs (e.g. [...headers()] or for (const cookie of cookies()), or explicitly with cookies()[Symbol.iterator]()).

In the version of Next.js that issued this warning, access to these properties is still possible directly but will warn. In future versions, these APIs will be async and direct access will not work as expected.

### How to fix

If you're using a server (e.g. a route handler, or a Server Component), you must await the dynamic API to access its properties:

```tsx
async function Page({ params }: { params: Promise<{ id: string }> }) {
  // asynchronous access of `params.id`.
  const { id } = await params;
  return <p>ID: {id}</p>;
}
```

If you're using a synchronous component (e.g. a Client component), you must use React.use() to unwrap the Promise first:

```tsx
"use client";
import { use } from "react";

function Page({ params }: { params: Promise<{ id: string }> }) {
  // asynchronous access of `params.id`.
  const { id } = use(params);
  return <p>ID: {id}</p>;
}
```

You can delay unwrapping the Promise (either with await or React.use) until you actually need to consume the value. This will allow Next.js to statically render more of your page.

## Interactions

- Keyboard
  - MUST: Full keyboard support per [WAI-ARIA APG](https://wwww3org/WAI/ARIA/apg/patterns/)
  - MUST: Visible focus rings (`:focus-visible`; group with `:focus-within`)
  - MUST: Manage focus (trap, move, and return) per APG patterns
- Targets & input
  - MUST: Hit target ≥24px (mobile ≥44px) If visual <24px, expand hit area
  - MUST: Mobile `<input>` font-size ≥16px or set:
    ```html
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
    />
    ```
  - NEVER: Disable browser zoom
  - MUST: `touch-action: manipulation` to prevent double-tap zoom; set `-webkit-tap-highlight-color` to match design
- Inputs & forms (behavior)
  - MUST: Hydration-safe inputs (no lost focus/value)
  - NEVER: Block paste in `<input>/<textarea>`
  - MUST: Loading buttons show spinner and keep original label
  - MUST: Enter submits focused text input In `<textarea>`, ⌘/Ctrl+Enter submits; Enter adds newline
  - MUST: Keep submit enabled until request starts; then disable, show spinner, use idempotency key
  - MUST: Don’t block typing; accept free text and validate after
  - MUST: Allow submitting incomplete forms to surface validation
  - MUST: Errors inline next to fields; on submit, focus first error
  - MUST: `autocomplete` + meaningful `name`; correct `type` and `inputmode`
  - SHOULD: Disable spellcheck for emails/codes/usernames
  - SHOULD: Placeholders end with ellipsis and show example pattern (eg, `+1 (123) 456-7890`, `sk-012345…`)
  - MUST: Warn on unsaved changes before navigation
  - MUST: Compatible with password managers & 2FA; allow pasting one-time codes
  - MUST: Trim values to handle text expansion trailing spaces
  - MUST: No dead zones on checkboxes/radios; label+control share one generous hit target
- State & navigation
  - MUST: URL reflects state (deep-link filters/tabs/pagination/expanded panels) Prefer libs like [nuqs](https://nuqs.dev)
  - MUST: Back/Forward restores scroll
  - MUST: Links are links—use `<a>/<Link>` for navigation (support Cmd/Ctrl/middle-click)
- Feedback
  - SHOULD: Optimistic UI; reconcile on response; on failure show error and rollback or offer Undo
  - MUST: Confirm destructive actions or provide Undo window
  - MUST: Use polite `aria-live` for toasts/inline validation
  - SHOULD: Ellipsis (`…`) for options that open follow-ups (eg, “Rename…”)
- Touch/drag/scroll
  - MUST: Design forgiving interactions (generous targets, clear affordances; avoid finickiness)
  - MUST: Delay first tooltip in a group; subsequent peers no delay
  - MUST: Intentional `overscroll-behavior: contain` in modals/drawers
  - MUST: During drag, disable text selection and set `inert` on dragged element/containers
  - MUST: No “dead-looking” interactive zones—if it looks clickable, it is
- Autofocus
  - SHOULD: Autofocus on desktop when there’s a single primary input; rarely on mobile (to avoid layout shift)

## Animation

- MUST: Honor `prefers-reduced-motion` (provide reduced variant)
- SHOULD: Prefer CSS > Web Animations API > JS libraries
- MUST: Animate compositor-friendly props (`transform`, `opacity`); avoid layout/repaint props (`top/left/width/height`)
- SHOULD: Animate only to clarify cause/effect or add deliberate delight
- SHOULD: Choose easing to match the change (size/distance/trigger)
- MUST: Animations are interruptible and input-driven (avoid autoplay)
- MUST: Correct `transform-origin` (motion starts where it “physically” should)

## Layout

- SHOULD: Optical alignment; adjust by ±1px when perception beats geometry
- MUST: Deliberate alignment to grid/baseline/edges/optical centers—no accidental placement
- SHOULD: Balance icon/text lockups (stroke/weight/size/spacing/color)
- MUST: Verify mobile, laptop, ultra-wide (simulate ultra-wide at 50% zoom)
- MUST: Respect safe areas (use env(safe-area-inset-\*))
- MUST: Avoid unwanted scrollbars; fix overflows

## Content & Accessibility

- SHOULD: Inline help first; tooltips last resort
- MUST: Skeletons mirror final content to avoid layout shift
- MUST: `<title>` matches current context
- MUST: No dead ends; always offer next step/recovery
- MUST: Design empty/sparse/dense/error states
- SHOULD: Curly quotes (“ ”); avoid widows/orphans
- MUST: Tabular numbers for comparisons (`font-variant-numeric: tabular-nums` or a monospace font)
- MUST: Redundant status cues (not color-only); icons have text labels
- MUST: Don’t ship the schema—visuals may omit labels but accessible names still exist
- MUST: Use the ellipsis character `…` (not ``)
- MUST: `scroll-margin-top` on headings for anchored links; include a “Skip to content” link; hierarchical `<h1–h6>`
- MUST: Resilient to user-generated content (short/avg/very long)
- MUST: Locale-aware dates/times/numbers/currency
- MUST: Accurate names (`aria-label`), decorative elements `aria-hidden`, verify in the Accessibility Tree
- MUST: Icon-only buttons have descriptive `aria-label`
- MUST: Prefer native semantics (`button`, `a`, `label`, `table`) before ARIA
- SHOULD: Right-clicking the nav logo surfaces brand assets
- MUST: Use non-breaking spaces to glue terms: `10&nbsp;MB`, `⌘&nbsp;+&nbsp;K`, `Vercel&nbsp;SDK`

## Performance

- SHOULD: Test iOS Low Power Mode and macOS Safari
- MUST: Measure reliably (disable extensions that skew runtime)
- MUST: Track and minimize re-renders (React DevTools/React Scan)
- MUST: Profile with CPU/network throttling
- MUST: Batch layout reads/writes; avoid unnecessary reflows/repaints
- MUST: Mutations (`POST/PATCH/DELETE`) target <500 ms
- SHOULD: Prefer uncontrolled inputs; make controlled loops cheap (keystroke cost)
- MUST: Virtualize large lists (eg, `virtua`)
- MUST: Preload only above-the-fold images; lazy-load the rest
- MUST: Prevent CLS from images (explicit dimensions or reserved space)

## Design

- SHOULD: Layered shadows (ambient + direct)
- SHOULD: Crisp edges via semi-transparent borders + shadows
- SHOULD: Nested radii: child ≤ parent; concentric
- SHOULD: Hue consistency: tint borders/shadows/text toward bg hue
- MUST: Accessible charts (color-blind-friendly palettes)
- MUST: Meet contrast—prefer [APCA](https://apcacontrastcom/) over WCAG 2
- MUST: Increase contrast on `:hover/:active/:focus`
- SHOULD: Match browser UI to bg
- SHOULD: Avoid gradient banding (use masks when needed)

## Updating this document

AI agents should update this file whenever they learn something new about this project that future tasks might need to take into account. Keeping the guidelines current helps everyone work more effectively.
