# Zoonk Guidelines for AI Agents

Zoonk is a web app where users can learn anything using AI. This app uses AI to generate courses, chapters, lessons, and exercises. Our goal is to help anyone to easily learn anything, providing tools that make learning easier, faster, more practical, and more fun.

## Table of Contents

- [Principles](#principles)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Tools](#tools)
- [Conventions](#conventions)
- [CSS](#css)
- [Icons](#icons)
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
- Use meaningful variable names and avoid abbreviations

## Tech stack

- Next.js (App Router)
- TypeScript
- Tailwind
- Prisma Postgres
- shadcn/ui
- Vercel AI SDK
- Better Auth

## Project structure

- `ai/`: AI-related code (e.g., prompts, content generation)
- `app/`: Next.js App Router routes
- `components/`: Reusable React components
- `db/`: Database queries
- `hooks/`: Custom React hooks
- `i18n/`: Localization configuration using `next-intl`
- `lib/`: Utility functions and libraries
- `messages/`: Translation files
- `prisma/`: Prisma schema and migrations
- `public/`: Static assets
- `services/`: Business logic calling `db`, `ai`, and other APIs
- `test/`: Testing helpers and utilities

## Tools

- Use `pnpm` for package management
- For AI features, use the [Vercel AI SDK](https://ai-sdk.dev) and the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). See docs for the AI SDK [here](https://ai-sdk.dev/llms.txt)

## Conventions

- Import `Link`, `redirect`, `usePathname`, `useRouter`, and `getPathname` from `@/i18n/navigation` since it handles localization
- Run `pnpm format` to format the code after making changes, then `pnpm lint` to check for linting errors, and `pnpm type-check` to check for TypeScript errors
- Don't run `pnpm build` or `pnpm dev`
- Never hard-code strings. Use `next-intl` instead
- Prefer to use server components than client components. Only use client components when absolutely necessary
- Avoid `useEffect` and `useState` unless absolutely required
- Fetch data on the server whenever possible and use `Suspense` with a fallback for loading states, [see docs](https://nextjs.org/docs/app/getting-started/fetching-data#streaming)
- Keep comments minimal—explain **why**, not **what**

## CSS

- Use Tailwind v4
- Use variables defined in `app/globals.css`
- Use `size-*` instead of `w-*` + `h-*`
- Only create custom utilities when we're often using the same styles
- Don't use `space-y-*` or `space-x-*` classes, instead use `gap-*`

## Icons

- We support both `lucide-react` and `@tabler/icons-react`
- Prefer `lucide-react`, only use `@tabler/icons-react` when the icon is not available in `lucide-react`

## Links

You can style links as buttons like this:

You can use the buttonVariants helper to create a link that looks like a button.

```tsx
import { buttonVariants } from "@/components/ui/button";

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
- MUST: Tabular numbers for comparisons (`font-variant-numeric: tabular-nums` or a mono like Geist Mono)
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
