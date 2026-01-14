# Zoonk Guidelines for AI Agents

Zoonk is a web app where users can learn anything using AI. This app uses AI to generate courses, chapters, lessons, and activities. Our goal is to help anyone to easily learn anything, providing tools that make learning easier, faster, more practical, and more fun.

## Table of Contents

- [Principles](#principles)
- [Design Style](#design-style)
- [Conventions](#conventions)
- [Component Organization](#component-organization)
- [Compound Components](#compound-components)
- [Testing](#testing)
- [i18n](#i18n)
- [CSS](#css)
- [Icons](#icons)
- [React Compiler](#react-compiler)
- [Next.js](#nextjs)
- [Specialized Skills](#specialized-skills)
- [Updating this document](#updating-this-document)

## Principles

- Always prefer the **simplest solution**. If something feels complex, refactor
- Favor **clarity and minimalism** in both code and UI
- Follow design inspirations from Apple, Linear, Vercel
- Code must be modular, following SOLID and DRY principles
- Avoid nested conditionals and complex logic
- Prefer short and composable functions
- Prefer functional programming over OOP
- Use meaningful variable names and avoid abbreviations
- Never guess at imports, table names, or conventions—always search for existing patterns first

**IMPORTANT**: Before completing a task, make sure to run the following commands:

- `pnpm format`
- `pnpm lint --write --unsafe`
- `pnpm db:generate` (always run this from the root of the monorepo)
- `pnpm typecheck`
- `pnpm knip`
- `pnpm test`
- `pnpm --filter {app} build` (eg `pnpm --filter main build`)
- `pnpm --filter {app} build:e2e` (always run this before running e2e tests)
- `pnpm --filter {app} e2e`

## Design Style

Whenever you're designing something, follow this design style:

Subtle animations, great typography, clean, minimalist, and intuitive design with lots of black/white and empty space. Make it clean, intuitive and super simple to use. Take inspiration from brands with great design like Vercel, Linear, and Apple. Ask yourself "How would Apple, Linear, or Vercel design this?"

You **deeply care about quality and details**, so every element should feel polished and well thought out.

Some design preferences:

- Avoid cards/items with borders and heavy shadows. Prefer using empty space and subtle dividers instead
- For buttons, prefer `outline` variant for most buttons and links. Use the default one only for active/selected states or for submit buttons. Use the `secondary` variant for buttons you want to emphasize a bit more
- Prefer using existing components from `@zoonk/ui` instead of creating new ones. If a component doesn't exist, search the `shadcn` registry before creating a new one

For detailed UX guidelines (interactions, animation, layout, accessibility), see [.claude/skills/design/SKILL.md](.claude/skills/design/SKILL.md)

## Conventions

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
- Never run `pnpm dev` as there's already a dev server running
- When writing a plan, don't include "manual verification" steps. We always do manual verification, you don't need to do it. Just ensure you add the necessary e2e tests for the task
- Don't create migration files manually. Run `pnpm --filter @zoonk/db db:migrate --name <migration-name>` to generate migration

## Component Organization

1. **Route-specific components**: Colocate directly with the route's `page.tsx`
2. **Route group shared components**: Use `_components/` or `_hooks/` folders within the route group (e.g., `app/(private)/_components/`), except for the root route group (eg `/[locale]` for `main` app and `/[orgSlug]/c/[lang]/[courseSlug]` for `editor` app) where you should use `src/components/{domain}/` since all components are shared across the app.
3. **Cross-route-group components**: Place in `src/components/{domain}/`
4. **Shared utilities**: Place in `src/lib/`

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

**CRITICAL**: Before writing ANY test, you MUST:

1. **Read `.claude/skills/testing/SKILL.md`** - Contains mandatory patterns and anti-patterns
2. **Use the `e2e-test-architect` agent** if available - It knows the testing patterns
3. **Invoke the `/testing` skill** - Use `Skill(testing)` to get guidance

**Always follow TDD (Test-Driven Development)**: Write a failing test first, then write the code to make it pass.

- **E2E tests**: For app/UI features, use Playwright (`apps/{app}/e2e/`)
- **Integration tests**: For data functions with Prisma (`apps/{app}/src/data/`)
- **Unit tests**: For utils, helpers, and UI component edge cases

**E2E Query Rules (MANDATORY)**:

- **ALWAYS use semantic queries**: `getByRole`, `getByLabel`, `getByText`, `getByPlaceholder`
- **NEVER use implementation details**: `data-slot`, `data-testid`, CSS classes, or `.locator()` with selectors
- **If semantic queries don't work**: Fix the component's accessibility first (add `aria-label`, proper roles, etc.)

```typescript
// BAD - Implementation details
page.locator("[data-slot='badge']");
page.locator("[data-testid='submit']");
page.locator(".btn-primary");

// GOOD - Semantic queries
page.getByRole("button", { name: /submit/i });
page.getByRole("heading", { name: /welcome/i });
page.getByLabel(/email/i);
```

**Exclude** `admin` and `evals` apps from testing requirements (internal tools).

**E2E builds**: Apps use separate build directories for E2E testing (e.g., `.next-e2e` instead of `.next`). When running E2E tests, build with `E2E_TESTING=true pnpm --filter {app} build` to ensure the correct build directory is used.

For detailed testing patterns, fixtures, and best practices, see `.claude/skills/testing/SKILL.md`

## i18n

- Use `getExtracted` (server) or `useExtracted` (client) for translations
- **IMPORTANT**: The `t` function does NOT support dynamic keys. Use string literals: `t("Arts courses")`, not `t(someVariable)`
- **CRITICAL: NEVER pass `t` as a function argument**. This is a common mistake that breaks i18n extraction. Instead of passing `t` to a function, create an async function that calls `getExtracted()` internally (see `@apps/main/src/lib/categories.ts` and `@apps/main/src/lib/belt-colors.ts` for examples)
- **CRITICAL: NEVER call `getExtracted()` inside `Promise.all()`**
- Always read the [translations skill](.claude/skills/translations/SKILL.md) when using `next-intl`.

## CSS

- Use Tailwind v4
- Use variables defined in `packages/ui/src/styles/globals.css`
- Use `size-*` instead of `w-*` + `h-*`
- Only create custom utilities when we're often using the same styles
- Don't use `space-y-*` or `space-x-*` classes, instead use `gap-*`

## Icons

- We support both `lucide-react` and `@tabler/icons-react`
- Prefer `lucide-react`, only use `@tabler/icons-react` when the icon is not available in `lucide-react`

## React Compiler

We're using the new [React Compiler](https://react.dev/learn/react-compiler/introduction). By default, React Compiler will memoize your code based on its analysis and heuristics. In most cases, this memoization will be as precise, or moreso, than what you may have written. This means you don't need to `useMemo` or `useCallback` as much. The useMemo and useCallback hooks can continue to be used with React Compiler as an escape hatch to provide control over which values are memoized. A common use-case for this is if a memoized value is used as an effect dependency, in order to ensure that an effect does not fire repeatedly even when its dependencies do not meaningfully change. However, this should be used sparingly and only when necessary. Don't default to using `useMemo` or `useCallback` with React Compiler, use them only when necessary.

## Next.js

- You can't use `export const dynamic = "force-dynamic";` with cache components. Instead, wrap async code in a `Suspense` boundary. grep `Suspense` for examples and search the latest Next.js docs for more information.

## Specialized Skills

For detailed guidance on complex workflows, see these skill files:

| Skill                | When to Use                         | File                                           |
| -------------------- | ----------------------------------- | ---------------------------------------------- |
| Cache Components     | next.js `cacheComponents` is `true` | `.claude/skills/cache-components/SKILL.md`     |
| Compound Components  | Building UI components              | `.claude/skills/compound-components/SKILL.md`  |
| Design               | UI/UX, interactions, a11y           | `.claude/skills/design/SKILL.md`               |
| React Best Practices | React best practices                | `.claude/skills/react-best-practices/SKILL.md` |
| Testing              | Bug fixes, new features, TDD        | `.claude/skills/testing/SKILL.md`              |
| Translations         | Working with i18n, PO files         | `.claude/skills/translations/SKILL.md`         |

## Updating this document

Update this file whenever you learn something new about this project that future tasks might need to take into account. Keeping the guidelines current helps everyone work more effectively.
