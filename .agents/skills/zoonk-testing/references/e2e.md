# E2E and HTTP coverage

Use the owning app's existing Playwright fixtures and `apps/<app>/e2e/` tests. Exercise real product routes; do not add app endpoints or pages solely for tests. For endpoint coverage, use real HTTP with real authentication and persistence. Direct handler tests with mocked dependencies are adapter tests.

## Queries and waiting

- Prefer `getByRole`, then `getByLabel`, `getByText`, or `getByPlaceholder`. Do not use CSS, `data-testid`, `data-slot`, or `.locator()` selectors. If the UI lacks an accessible query, fix its semantics. Scope queries to a meaningful region rather than hiding ambiguous matches with `.first()`.
- Use Playwright's auto-waiting and assertions for the actual state: a saved indicator, validation message, enabled action, changed URL, or persisted record. Arbitrary sleeps and `networkidle` do not prove readiness.
- Visibility does not prove an element is stable or receives pointer events. Investigate overlays, animations, stale elements, and product behavior before considering forced interactions. Do not use `force: true` as the standard fix for a flaky click.
- `page.route()` intercepts browser requests, not downstream calls made on the server. Exercise real validation for server-action error cases or control the narrow external boundary through an existing test harness.

```typescript
await page.getByRole("button", { name: "Save" }).click();
await expect(page.getByRole("status")).toHaveText("Saved");
```

Consult [Playwright actionability](https://playwright.dev/docs/actionability) or its [load-state guidance](https://playwright.dev/docs/api/class-page#page-wait-for-load-state) when diagnosing timing behavior.

## Isolation and persistence

Use the app's authentication fixtures; for example, `apps/main/e2e/fixtures.ts` owns test-scoped users with progress and subscription states. Reuse helpers from `packages/e2e` and `packages/testing` instead of inventing an authentication route or relying on a shared mutable seed account.

For a mutation, assert the immediate UI outcome before reloading. When persistence is part of the behavior, inspect the affected database record with `expect.poll` or `toPass`, or reopen the product surface when that establishes the user's contract. Reloading is useful when refresh survival is the behavior under test; it must not mask a missing immediate UI update.

Fixture-scope changes need evidence that persisted state cannot leak between tests. Include an ordered mutating/read-only pair using the affected fixture, rather than assuming separate browser contexts are enough.

## Drag and drop

Use semantic drag handles and a deterministic target. If the pointer sensor requires intermediate movement, use `dragTo` with the supported `steps` option. Assert the intended resulting order and persistence. If landing is inconsistent, investigate layout movement and targeting; asserting only that something moved can hide an incorrect reorder.

## Commands

Build the owning app with its E2E configuration before running against a new revision. E2E uses a separate output directory, such as `.next-e2e`, and the package scripts load the test environment.

```bash
mise x -- pnpm --filter main build:e2e
mise x -- pnpm --filter main e2e e2e/path/to/test.test.ts
```

Choose an existing test path and use the app's script rather than copying the placeholder. On macOS, browser-launching commands require escalated sandbox permissions on the first attempt. For a demonstrated timing or isolation concern, run the focused coverage with `--repeat-each=2` or another repetition count justified by the failure; a pass after an unexplained failure is insufficient.
