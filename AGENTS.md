# Zoonk Guidelines for AI Agents

Zoonk is a web app where users can learn anything using AI. This app uses AI to generate courses, chapters, lessons, and activities. Our goal is to help anyone to easily learn anything, providing tools that make learning easier, faster, more practical, and more fun.

## Table of Contents

- [Principles](#principles)
- [Design Style](#design-style)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Database Queries](#database-queries)
- [Tools](#tools)
- [Conventions](#conventions)
- [Compound Components](#compound-components)
- [Testing](#testing)
- [i18n](#i18n)
- [CSS](#css)
- [Icons](#icons)
- [Cache Components](#cache-components)
- [React Compiler](#react-compiler)
- [Links](#links)
- [Performance](#performance)

## Principles

- Always prefer the **simplest solution**. If something feels complex, refactor
- Favor **clarity and minimalism** in both code and UI
- Follow design inspirations from Apple, Linear, Vercel
- Code must be modular, following SOLID and DRY principles
- Avoid nested conditionals and complex logic
- Prefer short and composable functions
- Prefer functional programming over OOP
- Use meaningful variable names and avoid abbreviations

## Design Style

Whenever you're designing something, follow this design style:

Subtle animations, great typography, clean, minimalist, and intuitive design with lots of black/white and empty space. Make it clean, intuitive and super simple to use. Take inspiration from brands with great design like Vercel, Linear, and Apple. Ask yourself "How would Apple, Linear, or Vercel design this?"

You **deeply care about quality and details**, so every element should feel polished and well thought out.

Some design preferences:

- Avoid cards/items with borders and heavy shadows. Prefer using empty space and subtle dividers instead
- For buttons, prefer `outline` variant for most buttons and links. Use the default one only for active/selected states or for submit buttons. Use the `secondary` variant for buttons you want to emphasize a bit more
- Prefer using existing components from `@zoonk/ui` instead of creating new ones. If a component doesn't exist, search the `shadcn` registry before creating a new one

For detailed UX guidelines (interactions, animation, layout, accessibility), see `.claude/skills/design/SKILL.md`

## Tech stack

- Monorepo using [Turborepo](https://turborepo.com/docs)
- [Next.js (App Router)](https://nextjs.org/docs)
- TypeScript
- Tailwind CSS
- [Prisma Postgres](https://www.prisma.io/postgres)
- [Prisma ORM](https://www.prisma.io/docs/orm)
- [shadcn/ui](https://ui.shadcn.com/)
- [Vercel AI SDK](https://ai-sdk.dev/llms.txt)
- [Better Auth](https://www.better-auth.com/llms.txt)

## Project structure

### Apps

- [main](./apps/main): Public web app (`zoonk.com`)
- [admin](./apps/admin): Dashboard for managing users and organizations (`admin.zoonk.com`)
- [auth](./apps/auth): Centralized authentication for all apps
- [editor](./apps/editor): Visual editor for building courses and activities (`editor.zoonk.com`)
- [evals](./apps/evals): Local-only tool for evaluating AI-generated content

### Packages

- [ai](./packages/ai): AI prompts, tasks, and helpers for content generation
- [auth](./packages/auth): Shared Better Auth setup and plugins
- [core](./packages/core): Shared server utilities
- [db](./packages/db): Prisma schema and client
- [mailer](./packages/mailer): Email-sending utilities
- [next](./packages/next): Shared Next.js utilities
- [testing](./packages/testing): Shared testing utilities
- [tsconfig](./packages/tsconfig): Shared TypeScript config
- [ui](./packages/ui): Shared React components, patterns, hooks, and styles
- [utils](./packages/utils): Shared utilities and helpers

### Data Fetching Architecture

- **Shared utilities** → Use `@zoonk/core`
- **App-specific queries** → Use `@zoonk/db` directly in `apps/{app}/src/data/`

This separation allows each app to:

- Control its own caching strategy
- Handle permissions at the appropriate level
- Avoid complex conditional logic for different use cases

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
2. **Route group shared components**: Use `_components/` or `_hooks/` folders within the route group (e.g., `app/(private)/_components/`), except for the root route group (eg `/[locale]` for `main` app and `/[orgSlug]/c/[lang]/[courseSlug]` for `editor` app) where you should use `src/components/{domain}/` since all components are shared across the app.
3. **Cross-route-group components**: Place in `src/components/{domain}/`
4. **Shared utilities**: Place in `src/lib/`

## Tools

- Use `pnpm` for package management
- For AI features, use the [Vercel AI SDK](https://ai-sdk.dev) and the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). See docs for the AI SDK [here](https://ai-sdk.dev/llms.txt)

## Conventions

- **Never pass functions to Client Components** unless they are Server Actions (marked with `"use server"`). Regular functions like `getHref` or callbacks cannot be serialized. Instead, pass serializable data (strings, numbers, objects) and construct values in the client component. For example, pass `hrefPrefix: string` instead of `getHref: (item) => string`
- Run the following commands before completing your task: `pnpm format`, `pnpm lint --write --unsafe`, `pnpm typecheck`, `pnpm knip`
- When there are **formatting issues**, run `pnpm format` to auto-fix them
- When there are **linting issues**, run `pnpm lint --write --unsafe` from the **root of the monorepo** to auto-fix them (lint is a global setup, not per app/package)
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
- Always place skeletons in the same file as the component they're loading for, not in a separate file
- Don't add comments to a component's props
- Pass types directly to the component declaration instead of using `type` since those types won't be exported/reused
- When adding a new Prisma model, always add a seed for it in `packages/db/src/prisma/seed/`

## Compound Components

**IMPORTANT**: This is the REQUIRED pattern for ALL UI components. Always use compound components by default.

### Core Rules

1. **Each component = one element** - A component wraps exactly one HTML element
2. **Use `children` for content** - Never use props like `title`, `description`, `label`
3. **Use `className` for customization** - Allow consumers to override styles
4. **Use `data-slot` for CSS coordination** - Style child components based on parent context
5. **Make components generic** - Name for what they ARE, not what they're FOR (e.g., `MediaCard` not `CourseHeader`)

**Do NOT use React Context by default.** Most compound components don't need it.

For detailed examples and patterns, see `.claude/skills/compound-components/SKILL.md`

## Testing

**Always follow TDD (Test-Driven Development)**: Write a failing test first, then write the code to make it pass.

- **E2E tests**: For app/UI features, use Playwright (`apps/{app}/e2e/`)
- **Integration tests**: For data functions with Prisma (`apps/{app}/src/data/`)
- **Unit tests**: For utils, helpers, and UI component edge cases

**Exclude** `admin` and `evals` apps from testing requirements (internal tools).

**E2E builds**: Apps use separate build directories for E2E testing (e.g., `.next-e2e` instead of `.next`). When running E2E tests, build with `E2E_TESTING=true pnpm --filter {app} build` to ensure the correct build directory is used.

**E2E database reset**: When updating seed files, reset the E2E database with `dropdb zoonk_e2e && createdb zoonk_e2e`

For detailed testing patterns, fixtures, and best practices, see `.claude/skills/testing/SKILL.md`

## i18n

- Use `getExtracted` (server) or `useExtracted` (client) for translations
- **IMPORTANT**: The `t` function does NOT support dynamic keys. Use string literals: `t("Arts courses")`, not `t(someVariable)`

For detailed i18n workflow and gotchas, see `.claude/skills/translations/SKILL.md`

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

When creating a `page.tsx` file, either use `use cache` or don't make any `await` calls directly. Move async logic to separate components wrapped with `<Suspense>`.

- Wrap each data-fetching component in its own `Suspense` with a specific skeleton
- Avoid `use cache` by default (can't use with `searchParams`, `cookies()`, `headers()`)
- Call `revalidatePath()` before redirecting after mutations

For detailed caching patterns, streaming, and preloading, see the latest Next.js docs from the `next-devtools` MCP server.

## Links

You can style links as buttons like this:

You can use the buttonVariants helper to create a link that looks like a button.

```tsx
import { buttonVariants } from "@zoonk/ui/components/button";

<Link className={buttonVariants({ variant: "outline" })}>Click here</Link>;
```

## React Compiler

We're using the new [React Compiler](https://react.dev/learn/react-compiler/introduction). By default, React Compiler will memoize your code based on its analysis and heuristics. In most cases, this memoization will be as precise, or moreso, than what you may have written. This means you don't need to `useMemo` or `useCallback` as much. The useMemo and useCallback hooks can continue to be used with React Compiler as an escape hatch to provide control over which values are memoized. A common use-case for this is if a memoized value is used as an effect dependency, in order to ensure that an effect does not fire repeatedly even when its dependencies do not meaningfully change. However, this should be used sparingly and only when necessary. Don't default to using `useMemo` or `useCallback` with React Compiler, use them only when necessary.

## Performance

- MUST: Measure reliably (disable extensions that skew runtime)
- MUST: Track and minimize re-renders (React DevTools/React Scan)
- MUST: Profile with CPU/network throttling
- MUST: Batch layout reads/writes; avoid unnecessary reflows/repaints
- SHOULD: Prefer uncontrolled inputs; make controlled loops cheap (keystroke cost)
- MUST: Virtualize large lists (eg, `virtua`)

## Specialized Skills

For detailed guidance on complex workflows, see these skill files:

| Skill               | When to Use                  | File                                          |
| ------------------- | ---------------------------- | --------------------------------------------- |
| Compound Components | Building UI components       | `.claude/skills/compound-components/SKILL.md` |
| Design              | UI/UX, interactions, a11y    | `.claude/skills/design/SKILL.md`              |
| Testing             | Bug fixes, new features, TDD | `.claude/skills/testing/SKILL.md`             |
| Translations        | Working with i18n, PO files  | `.claude/skills/translations/SKILL.md`        |

**Note**: Claude Code auto-discovers these skills. Other AI agents should read the SKILL.md files directly when working on related tasks.

## Updating this document

AI agents should update this file whenever they learn something new about this project that future tasks might need to take into account. Keeping the guidelines current helps everyone work more effectively.
