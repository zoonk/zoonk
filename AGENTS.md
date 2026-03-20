## Principles

- Always prefer the **simplest solution**. If something feels complex, refactor
- **Simplicity ≠ laziness.** Creating a reusable component for repeated patterns IS the simple solution—it maintains consistency and quality. Leaving duplication "because it's only N files" leads to inconsistency (bugs). DRY is about having a single source of truth, not just reducing typing. When you see the same pattern repeated, extract it
- Favor **clarity and minimalism** in both code and UI
- Follow design inspirations from Apple, Linear, Vercel
- Code must be modular, following SOLID and DRY principles
- Avoid nested conditionals and complex logic
- Prefer short and composable functions
- Avoid nested business logic inside `map`, `filter`, `flatMap`, and `reduce`. If an array callback needs branching, multiple steps, or non-trivial normalization, extract it into a named helper
- Prefer top-level functions that read like pipelines of named domain operations. The main function should describe the flow; helpers should describe the rules
- If a condition or transformation is important enough to think about, it is important enough to name
- Keep inline callbacks trivial. Simple property access or a one-line predicate is fine; anything more should become a helper
- When logic feels nested, split it by responsibility: matching, normalization, filtering, transformation, and merging should usually be separate functions
- **Split files with multiple concerns.** If a file has distinct responsibilities (e.g., utils, validation, parsing, main logic), extract them into a `_utils/` folder (if internal) or separate files. A file should have one clear purpose, avoid doing too many things in a single file
- Prefer functional programming over OOP
- Avoid mutations: return new values instead of modifying existing data or state
- Use `[condition && value, ...].filter(Boolean)` instead of `let` + `.push()` for conditional arrays
- **Never use `let` + reassignment to compute a value.** Extract a helper function with early returns instead (e.g., `function getLabel() { if (x) return a; return b; }`). For objects, use helper functions that return the result (e.g., `const { a, b } = await getOrCreate(...)`). See `getComparisonLabel` in `metric-comparison.tsx` for the pattern
- Use meaningful variable names and avoid abbreviations
- For workflow orchestration, prefer linear wave-based flows (core-workflow style) with `Promise.allSettled` over branching orchestration unless branching is strictly required
- Use linear, declarative code over nested conditionals and imperative code
- Don't be afraid to refactor existing code to improve quality, clarity, or simplicity. Always leave the codebase better than you found it
- Never cut corners or do hacks. Aim for maintainable, clean code
- Think about the big picture—how your changes fit into the overall architecture and future growth
- **Think from first principles.** Don't accept patterns just because they're common. For every piece of code, ask: "What is this actually doing? Is there a simpler, more declarative way?" For every test, ask: "Am I testing my business logic or just testing that React/the browser works?" Before finishing any change, review everything again: "Is this the best way to implement this? Is this the best way to test this? Am I missing anything?" Think like a top 0.1% engineer who deeply cares about quality and details, not just getting things working. Think like the best engineer in the world
- **Verify before fixing.** When evaluating review comments (AI or human), trace the actual code path to determine if the reported issue can happen in practice. Answer "can this actually happen?" before "should we fix it?" Distinguish real bugs from theoretical issues from code style — and say which one it is upfront. Don't default to agreement; apply the same rigor you'd apply to your own code

## Quality Control

**IMPORTANT**: Before completing a task, make sure to run the following commands:

- `pnpm turbo quality:fix`
- `pnpm db:generate` (always run this from the root of the monorepo)
- `pnpm typecheck`
- `pnpm knip --production`
- `pnpm test`
- `pnpm --filter {app} build` (eg `pnpm --filter main build`)
- `pnpm --filter {app} build:e2e` (always run this before running e2e tests)
- `pnpm --filter {app} e2e`

Always run `pnpm turbo quality:fix` and `pnpm typecheck` after making any changes

- Always run e2e tests for ALL apps (`main`, `editor`, `api`), not just the one you changed
- After e2e changes, run your tests multiple times to check for flakiness

## Engineering Mindset

- **Build for growth, not current size.** "We only have N of X" is NEVER a valid reason to skip proper patterns. Early-stage projects grow. Build infrastructure that scales with the project from the start.
- **Structure code for known growth.** When a plan or issue tracker shows a file will grow (e.g., new renderers, phases, or features), extract components and helpers proactively — don't wait for it to become a problem. "One-time use" is not a reason to inline if we already know more uses are coming.
- **Single source of truth always wins.** If two things must stay in sync (schemas + docs, types + validation), generate one from the other. Manual duplication WILL drift.
- **Setup cost is amortized.** The effort to set up reusable code and automations always pays off. Don't optimize for today's sprint. Focus on long-term velocity.
- **Principles override plans.** If a plan marks something as "optional" but skipping it would violate core principles (like single source of truth), do it anyway. Plans are guidance; principles are non-negotiable. When in doubt, ask: "Does skipping this create duplicate sources of truth or technical debt?"
- **Plans must include tests.** Every implementation plan should identify which tests need to be added or updated — integration tests for data/workflow logic, e2e tests for UI flows, and unit tests for utilities. If a plan doesn't mention tests, it's incomplete. Tests must give us the confidence that everything is working as expected and help prevent regressions in the future.
- **Zero tolerance for flakiness.** If a test fails once in any number of runs, it's broken — investigate and fix it. Never dismiss failures as "intermittent" or "pre-existing". A flaky test is worse than no test because it erodes trust in the entire suite. Run e2e tests multiple times before considering them done. Zero tolerance for flakiness means fixing ALL failures, not just the ones in your plan.
- **Own the whole build.** When making changes, run ALL quality checks across ALL apps — not just the ones you modified. A change to a shared package can break any consumer. "I didn't modify that file" is never an excuse for leaving something broken. Always leave the codebase better than you found it, even if it's outside your direct change area.
- **Never copy bad patterns.** When existing code has a bad pattern, fix it instead of replicating it. Always evaluate whether existing patterns are correct before following them. "Leave the codebase better than you found it" means actively fixing bad patterns you encounter, not propagating them.

## Design Style

Whenever you're designing something, follow this design style:

Subtle animations, great typography, clean, minimalist, and intuitive design with lots of black/white and empty space. Make it clean, intuitive and super simple to use. Take inspiration from brands with great design like Vercel, Linear, and Apple. Ask yourself "How would Apple, Linear, or Vercel design this?"

You **deeply care about quality and details**, so every element should feel polished and well thought out.

Some design preferences:

- Avoid cards/items with borders and heavy shadows. Prefer using empty space and subtle dividers instead
- For buttons, prefer `outline` variant for most buttons and links. Use the default one only for active/selected states or for submit buttons. Use the `secondary` variant for buttons you want to emphasize a bit more
- Prefer using existing components from `@zoonk/ui` instead of creating new ones. If a component doesn't exist, search the `shadcn` registry before creating a new one

For detailed UX guidelines (interactions, animation, layout, accessibility), see [.agents/skills/zoonk-design/SKILL.md](.agents/skills/zoonk-design/SKILL.md)

## Conventions

- Prefer server components over client components. Only use client components when absolutely necessary
- Avoid `useEffect` and `useState` unless absolutely required
- **Required**: Every time you use `useEffect` you **MUST** read the [vercel-react-best-practices skill](.agents/skills/vercel-react-best-practices/SKILL.md) AND these docs: https://react.dev/learn/you-might-not-need-an-effect
- Fetch data on the server whenever possible and use `Suspense` with a fallback for loading states, [see docs for streaming data](https://nextjs.org/docs/app/getting-started/fetching-data#streaming)
- Use `safeAsync` when using `await` to better handle errors
- When creating a skeleton, use the `Skeleton` component from `@zoonk/ui/components/skeleton`
- Always build skeleton components when using `Suspense` for loading states
- Always place skeletons in the same file as the component they're loading for, not in a separate file
- Don't add comments to a component's props
- Don't create migration files manually. Run `pnpm --filter @zoonk/db db:migrate --name <migration-name>` to generate migration
- Workflow files (`"use workflow"`) can't call Node APIs directly; wrap them in `"use step"` functions
- When adding a new endpoint, add docs for it in `document.ts`
- When adding e2e tests, use `*Fixture()` functions to create unique test data per test - do not modify seed files
- Avoid inline imports like `await import()`, only do it when dynamic imports are absolutely necessary
- Always add comments to functions explaining why that function exists. Use clear language, assume the reader has no context, be verbose if needed and add examples to illustrate it. Use plain language, no jargon. Comments should be meaningful and explain the "why" behind the code (eg why did we need to create this function, why is this logic necessary, etc.). Avoid vague statements. For example, "remove anything we don't support" is vague. What we don't support?
- When writing comments, use `/** ... */` for functions, so we can get JSDoc tooltips

## Prisma Queries

- **Don't use `select` by default.** Return the full model — most models have only small columns and `select` adds maintenance cost (manual types, updating selects when adding fields) with negligible performance benefit
- **Use `omit`** only for models with large columns (`Step.content`, `Step.visualContent`, `StepAttempt.answer`, `StepAttempt.effects`) when you don't need those fields
- **Use `include`** to load relations. Use `select` on included relations when you only need specific fields from the related model
- **Don't define manual types** that mirror Prisma query shapes. Use Prisma's generated types (`Course`, `Chapter`, etc.) or derive types from queries using `NonNullable<Awaited<ReturnType<typeof myQueryFn>>>`

## Compound Components

When writing React components, use compound components. Always read this before creating components:

- `.agents/skills/zoonk-compound-components/SKILL.md`
- `.agents/skills/vercel-composition-patterns/SKILL.md`

## Testing

- Default to TDD: write a failing test first, run it to confirm it fails for the right reason, then write the code to make it pass
- Don't write unit tests for React components, prefer E2E tests. React unit tests require mocking and test implementation details, making tests fail if we change implementation
- Add unit tests for pure functions, helpers, and utils
- Add integration tests for data functions, business logic, and workflows with Prisma
- Don't add tests for CSS, style changes, prompt wording, zod schemas or other things where tests would only assert copy, external library internals, or implementation details
- Parallelize independent fixtures: When test setup creates multiple entities that don't depend on each other (e.g., `user` + `course`, sibling chapters, multiple `activityProgressFixture` calls), use `Promise.all` instead of sequential awaits

**E2E Query Rules (MANDATORY)**:

- **ALWAYS use semantic queries**: `getByRole`, `getByLabel`, `getByText`, `getByPlaceholder` (prefer `getByRole` when possible)
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

**E2E builds**: Apps use separate build directories for E2E testing (e.g., `.next-e2e` instead of `.next`). When running E2E tests, build with `pnpm --filter {app} build:e2e`

**IMPORTANT:** Before writing E2E tests, **always** read the [zoonk-testing skill](.agents/skills/zoonk-testing/SKILL.md).

## i18n

- Use `getExtracted` (server) or `useExtracted` (client) for translations, don't use `getTranslations` or `useTranslations`
- Pass string literals, never variables or keys (e.g., `getExtracted("Hello world")`, not `getExtracted(greeting)` nor `getExtracted("greeting")`)
- Translation strings are extracted to PO files automatically when running `pnpm --filter {app} build`
- Never edit `i18n.lock` manually
- Manual translation should be done only in PO entries with empty `msgstr`
- When using `render` prop with base-ui components (e.g., `useRender`), use `ClientLink` instead of `Link` since the render prop requires a client component
- i18n functions like `getExtracted` can't be called inside `Promise.all`

## Next.js links

We're using Next.js `typedRoutes` feature. Next.js can statically type links to prevent typos and other errors when using `next/link`. These types are generated when we run `pnpm typecheck` or `pnpm build`.

This works out of the box if you pass a string literal to `href`. However, for variables, you may need to use `as const` to preserve literal types. **NEVER** cast them as `Route` because this defeats the purpose of type safety:

```tsx
// BAD - casting as Route defeats type safety
const lessonHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}` as Route;

// ALSO BAD - Creating wrapper functions instead of using `as const`
function route<Href extends string>(href: Route<Href>): Route<Href> {
  return href;
}

// GOOD - string literal as const
const lessonHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}` as const;
```

To accept href in a custom component wrapping next/link, use a generic:

```tsx
import type { Route } from "next";
import Link from "next/link";

function Card<T extends string>({ href }: { href: Route<T> | URL }) {
  return (
    <Link href={href}>
      <div>My Card</div>
    </Link>
  );
}
```

You can also type a simple data structure and iterate to render links:

```tsx
import type { Route } from "next";

type NavItem<T extends string = string> = {
  href: T;
  label: string;
};

export const navItems: NavItem<Route>[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
];
```

## Plan Mode

- Before completing your plan, make sure you identified which tests need to be added or updated. A plan without tests is incomplete.

<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `apps/{app}/node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

```

```
