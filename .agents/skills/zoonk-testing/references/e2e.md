# E2E and HTTP coverage

Use the owning app's existing Playwright fixtures and `apps/<app>/e2e/` tests. Exercise real product routes; do not add app endpoints or pages solely for tests. For endpoint coverage, use real HTTP with real authentication and persistence. Direct handler tests with mocked dependencies are adapter tests.

## Queries and waiting

- Prefer `getByRole`, then `getByLabel`, `getByText`, or `getByPlaceholder`. Do not use CSS, `data-testid`, `data-slot`, or `.locator()` selectors. If the UI lacks an accessible query, fix its semantics. Scope queries to a meaningful region rather than hiding ambiguous matches with `.first()`.
- Use Playwright's auto-waiting and assertions for the actual state: a saved indicator, validation message, enabled action, changed URL, or persisted record. Arbitrary sleeps and `networkidle` do not prove readiness.
- Visibility does not prove an element is stable or receives pointer events. Investigate overlays, animations, stale elements, and product behavior before considering forced interactions. Do not use `force: true` as the standard fix for a flaky click.
- `page.route()` intercepts browser requests, not downstream calls made on the server. Exercise real validation for server-action error cases or control the narrow external boundary through an existing test harness.
- E2E has no model. A model call inside a workflow run never answers, so the run stays in progress as while a model writes; a call a request makes fails at once, as an outage would. Write what a run would have written with a fixture instead of waiting for the run, and rely on the outage only for a request's own call.

```typescript
await page.getByRole("button", { name: "Save" }).click();
await expect(page.getByRole("status")).toHaveText("Saved");
```

Consult [Playwright actionability](https://playwright.dev/docs/actionability) or its [load-state guidance](https://playwright.dev/docs/api/class-page#page-wait-for-load-state) when diagnosing timing behavior.

## Coverage

- Add or extend an E2E test only for a risk that clears [the E2E bar](../SKILL.md#the-e2e-bar): a big deal for learners if it broke, likely enough to break, and nothing cheaper catches it.
- Before adding a test, look for the flow that already reaches the screen or state and extend it. A new test pays for its own sign-in, fixtures and navigation, so it needs behavior of its own that no existing flow can reach.
- Assert what guards the risk, not the screen's wording, layout or accessibility.

## Isolation and persistence

Use the app's authentication fixtures; for example, `apps/main/e2e/fixtures.ts` owns test-scoped users with progress and subscription states. Reuse helpers from `packages/e2e` and `packages/testing` instead of inventing an authentication route or relying on a shared mutable seed account.

For a mutation, assert the immediate UI outcome before reloading. When persistence is part of the behavior, inspect the affected database record with `expect.poll` or `toPass`, or reopen the product surface when that establishes the user's contract. Reloading is useful when refresh survival is the behavior under test; it must not mask a missing immediate UI update.

Fixture-scope changes need evidence that persisted state cannot leak between tests. Include an ordered mutating/read-only pair using the affected fixture, rather than assuming separate browser contexts are enough.

## Drag and drop

Use semantic drag handles and a deterministic target. If the pointer sensor requires intermediate movement, use `dragTo` with the supported `steps` option. Assert the intended resulting order and persistence. If landing is inconsistent, investigate layout movement and targeting; asserting only that something moved can hide an incorrect reorder.

## Commands

Run from the repository root with an existing test path; the [development guide](../../../guides/development.md) owns build, database, and sandbox setup.

```bash
mise x -- pnpm e2e:main e2e/path/to/test.test.ts
mise x -- pnpm e2e:api e2e/path/to/test.test.ts
```

For a demonstrated timing or isolation concern, use `--repeat-each=2` or another repetition count justified by the failure; a pass after an unexplained failure is insufficient.
