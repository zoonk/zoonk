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
- **Simplicity ≠ laziness.** Creating a reusable component for repeated patterns IS the simple solution—it maintains consistency and quality. Leaving duplication "because it's only N files" leads to inconsistency (bugs). DRY is about having a single source of truth, not just reducing typing. When you see the same pattern repeated, extract it
- Favor **clarity and minimalism** in both code and UI
- Follow design inspirations from Apple, Linear, Vercel
- Code must be modular, following SOLID and DRY principles
- Avoid nested conditionals and complex logic
- Prefer short and composable functions
- **Split files with multiple concerns.** If a file has distinct responsibilities (e.g., utils, validation, parsing, main logic), extract them into a `_utils/` folder (if internal) or separate files. A file should have one clear purpose, avoid doing too many things in a single file
- Prefer functional programming over OOP
- Avoid mutations: return new values instead of modifying existing data or state
- Use `[condition && value, ...].filter(Boolean)` instead of `let` + `.push()` for conditional arrays
- Extract helper functions that return objects to eliminate `let` variables (e.g., `const { a, b } = await getOrCreate(...)`)
- Use meaningful variable names and avoid abbreviations
- Never guess at imports, table names, or conventions—always search for existing patterns first
- Before writing code, check for existing patterns, agents, and skills that could help execute the task better
- Don't be afraid to refactor existing code to improve quality, clarity, or simplicity. Always leave the codebase better than you found it

**IMPORTANT**: Before completing a task, make sure to run the following commands:

- `pnpm turbo quality:fix`
- `pnpm db:generate` (always run this from the root of the monorepo)
- `pnpm typecheck`
- `pnpm knip`
- `pnpm test`
- `pnpm --filter {app} build` (eg `pnpm --filter main build`)
- `pnpm --filter {app} build:e2e` (always run this before running e2e tests)
- `pnpm --filter {app} e2e`

## Engineering Mindset

- **Build for growth, not current size.** "We only have N of X" is NEVER a valid reason to skip proper patterns. Early-stage projects grow. Build infrastructure that scales with the project from the start.
- **Single source of truth always wins.** If two things must stay in sync (schemas + docs, types + validation), generate one from the other. Manual duplication WILL drift.
- **Setup cost is amortized.** The effort to set up reusable code and automations always pays off. Don't optimize for today's sprint. Focus on long-term velocity.
- **Principles override plans.** If a plan marks something as "optional" but skipping it would violate core principles (like single source of truth), do it anyway. Plans are guidance; principles are non-negotiable. When in doubt, ask: "Does skipping this create duplicate sources of truth or technical debt?"
- **Plans must include tests.** Every implementation plan should identify which tests need to be added or updated — integration tests for data/workflow logic, e2e tests for UI flows, and unit tests for utilities. If a plan doesn't mention tests, it's incomplete. Tests must give us the confidence that everything is working as expected and help prevent regressions in the future.

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
- Workflow files (`"use workflow"`) can't call Node APIs directly; wrap them in `"use step"` functions
- When adding a new endpoint, add docs for it in `document.ts`
- When adding e2e tests, use `*Fixture()` functions to create unique test data per test - do not modify seed files

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

For detailed examples and patterns, see `.agents/skills/zoonk-compound-components/SKILL.md`

## Testing

**CRITICAL**: Before writing ANY test, you MUST:

1. **Read `.agents/skills/zoonk-testing/SKILL.md`** - Contains mandatory patterns and anti-patterns
2. **Use the `e2e-test-architect` agent** if available - It knows the testing patterns
3. **Invoke the `/testing` skill** - Use `Skill(testing)` to get guidance

**VERY IMPORTANT**: **Always follow TDD (Test-Driven Development)**: Write a failing test first, **run the test to confirm it fails**, then write the code to make it pass. If the test passes before your fix, the test is wrong—never use workarounds like `.first()` or loose assertions to make tests pass. Use unique test data (e.g., UUIDs in titles) to ensure tests catch regressions.

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

For detailed testing patterns, fixtures, and best practices, see `.agents/skills/zoonk-testing/SKILL.md`

## i18n

- Use `getExtracted` (server) or `useExtracted` (client) for translations
- **IMPORTANT**: The `t` function does NOT support dynamic keys. Use string literals: `t("Arts courses")`, not `t(someVariable)`
- **CRITICAL: NEVER pass `t` as a function argument**. This is a common mistake that breaks i18n extraction. Instead of passing `t` to a function, create an async function that calls `getExtracted()` internally (see `@apps/main/src/lib/categories.ts` and `@apps/main/src/lib/belt-colors.ts` for examples)
- **CRITICAL: NEVER call `getExtracted()` inside `Promise.all()`**
- When using `render` prop with base-ui components (e.g., `useRender`), use `ClientLink` instead of `Link` since the render prop requires a client component
- Always read the [translations skill](.agents/skills/zoonk-translations/SKILL.md) when using `next-intl`.

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

## Committing Changes

When committing changes, use the `/commit` skill. This ensures consistent commit message formatting across the project.

## Specialized Skills

Skills are reusable knowledge modules that agents can reference for domain-specific guidance. They're located in `.agents/skills/` and symlinked to each agent's skills directory.

### Core Skills

| Skill                       | Purpose                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `zoonk-business`            | Business decision-making framework - mission, values, trade-offs, and strategic alignment    |
| `zoonk-technical`           | Technical decision-making framework - architecture, implementation, and technical trade-offs |
| `zoonk-design`              | Design philosophy and UI/UX guidelines (Apple, Linear, Vercel-inspired)                      |
| `zoonk-compound-components` | Required pattern for building UI components                                                  |
| `zoonk-testing`             | TDD patterns, e2e testing, and test architecture                                             |
| `zoonk-translations`        | i18n patterns with next-intl                                                                 |
| `zoonk-commit`              | Commit message and PR description guidelines                                                 |
| `zoonk-code-simplification` | Code simplification and anti-overengineering patterns                                        |
| `zoonk-issue-planning`      | Break down implementation plans into small, manageable GitHub issues                         |
| `zoonk-issue-writer`        | Write detailed user stories from plans (product owner layer) before posting to GitHub        |
| `zoonk-github-issues`       | Create GitHub issues with types, dependencies, and sub-issues                                |

### When to Use Business Skill

Reference the `zoonk-business` skill when:

- Making strategic decisions about features or direction
- Evaluating trade-offs (speed vs quality, features vs simplicity)
- Ensuring decisions align with mission and values
- Understanding what requires human approval
- Determining priorities when facing conflicts

## Updating this document

Update this file whenever you learn something new about this project that future tasks might need to take into account. Keeping the guidelines current helps everyone work more effectively.

## IMPORTANT

- Before completing your plan, make sure you identified which tests need to be added or updated, looking for unit, integration, and e2e tests. A plan without tests is incomplete.

<!-- NEXT-AGENTS-MD-START -->[Next.js Docs Index]|root: ./.next-docs|STOP. What you remember about Next.js is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: npx @next/codemod agents-md --output AGENTS.md|01-app:{glossary.mdx}|01-app/01-getting-started:{01-installation.mdx,02-project-structure.mdx,03-layouts-and-pages.mdx,04-linking-and-navigating.mdx,05-server-and-client-components.mdx,06-cache-components.mdx,07-fetching-data.mdx,08-updating-data.mdx,09-caching-and-revalidating.mdx,10-error-handling.mdx,11-css.mdx,12-images.mdx,13-fonts.mdx,14-metadata-and-og-images.mdx,15-route-handlers.mdx,16-proxy.mdx,17-deploying.mdx,18-upgrading.mdx}|01-app/02-guides:{analytics.mdx,authentication.mdx,backend-for-frontend.mdx,caching.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,data-security.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,json-ld.mdx,lazy-loading.mdx,local-development.mdx,mcp.mdx,mdx.mdx,memory-usage.mdx,multi-tenant.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,prefetching.mdx,production-checklist.mdx,progressive-web-apps.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,single-page-applications.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx,videos.mdx}|01-app/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|01-app/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|01-app/02-guides/upgrading:{codemods.mdx,version-14.mdx,version-15.mdx,version-16.mdx}|01-app/03-api-reference:{07-edge.mdx,08-turbopack.mdx}|01-app/03-api-reference/01-directives:{use-cache-private.mdx,use-cache-remote.mdx,use-cache.mdx,use-client.mdx,use-server.mdx}|01-app/03-api-reference/02-components:{font.mdx,form.mdx,image.mdx,link.mdx,script.mdx}|01-app/03-api-reference/03-file-conventions/01-metadata:{app-icons.mdx,manifest.mdx,opengraph-image.mdx,robots.mdx,sitemap.mdx}|01-app/03-api-reference/03-file-conventions:{default.mdx,dynamic-routes.mdx,error.mdx,forbidden.mdx,instrumentation-client.mdx,instrumentation.mdx,intercepting-routes.mdx,layout.mdx,loading.mdx,mdx-components.mdx,not-found.mdx,page.mdx,parallel-routes.mdx,proxy.mdx,public-folder.mdx,route-groups.mdx,route-segment-config.mdx,route.mdx,src-folder.mdx,template.mdx,unauthorized.mdx}|01-app/03-api-reference/04-functions:{after.mdx,cacheLife.mdx,cacheTag.mdx,connection.mdx,cookies.mdx,draft-mode.mdx,fetch.mdx,forbidden.mdx,generate-image-metadata.mdx,generate-metadata.mdx,generate-sitemaps.mdx,generate-static-params.mdx,generate-viewport.mdx,headers.mdx,image-response.mdx,next-request.mdx,next-response.mdx,not-found.mdx,permanentRedirect.mdx,redirect.mdx,refresh.mdx,revalidatePath.mdx,revalidateTag.mdx,unauthorized.mdx,unstable_cache.mdx,unstable_noStore.mdx,unstable_rethrow.mdx,updateTag.mdx,use-link-status.mdx,use-params.mdx,use-pathname.mdx,use-report-web-vitals.mdx,use-router.mdx,use-search-params.mdx,use-selected-layout-segment.mdx,use-selected-layout-segments.mdx,userAgent.mdx}|01-app/03-api-reference/05-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,appDir.mdx,assetPrefix.mdx,authInterrupts.mdx,basePath.mdx,browserDebugInfoInTerminal.mdx,cacheComponents.mdx,cacheHandlers.mdx,cacheLife.mdx,compress.mdx,crossOrigin.mdx,cssChunking.mdx,devIndicators.mdx,distDir.mdx,env.mdx,expireTime.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,htmlLimitedBots.mdx,httpAgentOptions.mdx,images.mdx,incrementalCacheHandlerPath.mdx,inlineCss.mdx,isolatedDevBuild.mdx,logging.mdx,mdxRs.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactCompiler.mdx,reactMaxHeadersLength.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,sassOptions.mdx,serverActions.mdx,serverComponentsHmrCache.mdx,serverExternalPackages.mdx,staleTimes.mdx,staticGeneration.mdx,taint.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,turbopackFileSystemCache.mdx,typedRoutes.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,viewTransition.mdx,webVitalsAttribution.mdx,webpack.mdx}|01-app/03-api-reference/05-config:{02-typescript.mdx,03-eslint.mdx}|01-app/03-api-reference/06-cli:{create-next-app.mdx,next.mdx}|02-pages/01-getting-started:{01-installation.mdx,02-project-structure.mdx,04-images.mdx,05-fonts.mdx,06-css.mdx,11-deploying.mdx}|02-pages/02-guides:{analytics.mdx,authentication.mdx,babel.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,lazy-loading.mdx,mdx.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,post-css.mdx,preview-mode.mdx,production-checklist.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx}|02-pages/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|02-pages/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|02-pages/02-guides/upgrading:{codemods.mdx,version-10.mdx,version-11.mdx,version-12.mdx,version-13.mdx,version-14.mdx,version-9.mdx}|02-pages/03-building-your-application/01-routing:{01-pages-and-layouts.mdx,02-dynamic-routes.mdx,03-linking-and-navigating.mdx,05-custom-app.mdx,06-custom-document.mdx,07-api-routes.mdx,08-custom-error.mdx}|02-pages/03-building-your-application/02-rendering:{01-server-side-rendering.mdx,02-static-site-generation.mdx,04-automatic-static-optimization.mdx,05-client-side-rendering.mdx}|02-pages/03-building-your-application/03-data-fetching:{01-get-static-props.mdx,02-get-static-paths.mdx,03-forms-and-mutations.mdx,03-get-server-side-props.mdx,05-client-side.mdx}|02-pages/03-building-your-application/06-configuring:{12-error-handling.mdx}|02-pages/04-api-reference:{06-edge.mdx,08-turbopack.mdx}|02-pages/04-api-reference/01-components:{font.mdx,form.mdx,head.mdx,image-legacy.mdx,image.mdx,link.mdx,script.mdx}|02-pages/04-api-reference/02-file-conventions:{instrumentation.mdx,proxy.mdx,public-folder.mdx,src-folder.mdx}|02-pages/04-api-reference/03-functions:{get-initial-props.mdx,get-server-side-props.mdx,get-static-paths.mdx,get-static-props.mdx,next-request.mdx,next-response.mdx,use-params.mdx,use-report-web-vitals.mdx,use-router.mdx,use-search-params.mdx,userAgent.mdx}|02-pages/04-api-reference/04-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,assetPrefix.mdx,basePath.mdx,bundlePagesRouterDependencies.mdx,compress.mdx,crossOrigin.mdx,devIndicators.mdx,distDir.mdx,env.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,httpAgentOptions.mdx,images.mdx,isolatedDevBuild.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,serverExternalPackages.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,webVitalsAttribution.mdx,webpack.mdx}|02-pages/04-api-reference/04-config:{01-typescript.mdx,02-eslint.mdx}|02-pages/04-api-reference/05-cli:{create-next-app.mdx,next.mdx}|03-architecture:{accessibility.mdx,fast-refresh.mdx,nextjs-compiler.mdx,supported-browsers.mdx}|04-community:{01-contribution-guide.mdx,02-rspack.mdx}<!-- NEXT-AGENTS-MD-END -->
