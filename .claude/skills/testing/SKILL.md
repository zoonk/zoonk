---
name: testing
description: Write tests following TDD principles. Use when implementing features, fixing bugs, or adding test coverage. Covers e2e, integration, and unit testing patterns.
---

# Testing Guidelines

Follow TDD (Test-Driven Development) for all features and bug fixes. **Always write failing tests first.**

**Note**: Exclude `admin` and `evals` apps from testing requirements (internal tools).

## TDD Workflow

1. **Write a failing test** that describes the expected behavior
2. **Run the test** to confirm it fails (red)
3. **Write the minimum code** to make the test pass
4. **Run the test** to confirm it passes (green)
5. **Refactor** while keeping tests green

### When to Apply TDD

- **Bug fix**: Write a test that reproduces the bug first
- **New feature**: Write a test showing the feature doesn't exist yet
- **Refactoring**: Ensure tests exist before changing code

## Test Types

| When                    | Test Type   | Framework  | Location                                                |
| ----------------------- | ----------- | ---------- | ------------------------------------------------------- |
| Apps/UI features        | E2E         | Playwright | `apps/{app}/e2e/`                                       |
| Data functions (Prisma) | Integration | Vitest     | `apps/{app}/src/data/` or `packages/core/src/{domain}/` |
| Utils/helpers           | Unit        | Vitest     | `packages/{pkg}/*.test.ts`                              |

## E2E Testing (Playwright)

### Core Principle: Test User Behavior

Test what users see and do, not implementation details. If your test breaks when you refactor CSS or rename a class, it's testing the wrong thing.

### Avoid Redundant Visibility Tests

**Don't write tests that only check if elements are visible when another test already interacts with them.** If a test clicks a button or checks its attributes, visibility is implicitly verified—the interaction would fail if the element wasn't visible.

```typescript
// BAD: Redundant test - visibility is already covered by the interaction test below
test("shows feedback buttons", async ({ page }) => {
  await expect(page.getByRole("button", { name: /i liked it/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /i didn't like it/i })
  ).toBeVisible();
});

// GOOD: This test implicitly verifies visibility through interaction
test("clicking feedback button marks it as pressed", async ({ page }) => {
  const thumbsUp = page.getByRole("button", { name: /i liked it/i });
  const thumbsDown = page.getByRole("button", { name: /i didn't like it/i });

  await expect(thumbsUp).toHaveAttribute("aria-pressed", "false");
  await thumbsUp.click();
  await expect(thumbsUp).toHaveAttribute("aria-pressed", "true");
});
```

**When visibility-only tests ARE useful:**

- Testing conditional rendering (element appears/disappears based on state)
- Waiting for async content to load before proceeding
- Verifying error messages or notifications appear

### Query Priority

Use semantic queries that reflect how users interact with the page:

```typescript
// GOOD: Semantic queries (in order of preference)
page.getByRole("button", { name: "Submit" });
page.getByRole("heading", { name: "Welcome" });
page.getByLabel("Email address");
page.getByText("Sign up for free");
page.getByPlaceholder("Search...");

// BAD: Implementation details (including data-slot, data-testid, CSS classes)
page.locator(".btn-primary");
page.locator("#submit-button");
page.locator("[data-testid='submit']");
page.locator("[data-slot='media-card-icon']");
page.locator("button.bg-blue-500");
```

**If you can't use `getByRole`, the component likely has accessibility issues.** Refactor to make it more accessible instead of using implementation-detail selectors.

### Fix Accessibility First, Then Test

When a component lacks semantic markup, fix the component before writing tests:

```typescript
// BAD: Using implementation details because component lacks accessibility
test("shows fallback icon", async ({ page }) => {
  await expect(page.locator("[data-slot='media-card-icon']")).toBeVisible();
});

// GOOD: First fix the component to be accessible
// In the component: <MediaCardIcon role="img" aria-label={title}>
// Then test with semantic queries:
test("shows fallback icon", async ({ page }) => {
  const fallbackIcon = page.getByRole("img", { name: /course title/i }).first();
  await expect(fallbackIcon).toBeVisible();
  await expect(fallbackIcon).not.toHaveAttribute("src"); // Distinguishes from <img>
});
```

Common accessibility fixes:
- Decorative icons acting as image placeholders → add `role="img"` and `aria-label`
- Interactive elements without labels → add `aria-label` or visible text
- Custom controls → add appropriate ARIA roles

### Wait Patterns

```typescript
// GOOD: Wait for visible state with timeout
await expect(page.getByRole("heading")).toBeVisible();
await expect(page.getByText("Success")).toBeVisible();

// GOOD: Wait for URL change
await page.waitForURL(/\/dashboard/);

// BAD: Arbitrary delays
await page.waitForTimeout(2000);
```

### Authentication Fixtures

Use pre-configured fixtures from `apps/{app}/e2e/fixtures.ts`:

```typescript
import { expect, test } from "./fixtures";

test("authenticated user sees dashboard", async ({ authenticatedPage }) => {
  await authenticatedPage.goto("/");
  await expect(
    authenticatedPage.getByRole("heading", { name: "Dashboard" })
  ).toBeVisible();
});

test("new user sees onboarding", async ({ userWithoutProgress }) => {
  await userWithoutProgress.goto("/");
  await expect(userWithoutProgress.getByText("Get started")).toBeVisible();
});
```

### Test Organization

```typescript
test.describe("Course Page", () => {
  test.describe("unauthenticated users", () => {
    test("shows sign-in prompt", async ({ page }) => {
      // ...
    });
  });

  test.describe("authenticated users", () => {
    test("can enroll in course", async ({ authenticatedPage }) => {
      // ...
    });
  });
});
```

However, avoid nesting too deeply. You shouldn't have more than 2 `test.describe` blocks.

## Integration Testing (Vitest + Prisma)

### Using Fixtures

```typescript
import { prisma } from "@zoonk/db";
import {
  courseFixture,
  memberFixture,
  signInAs,
} from "@zoonk/testing/fixtures";

describe("createChapter", () => {
  describe("unauthenticated users", () => {
    test("returns unauthorized error", async () => {
      const result = await createChapter({
        headers: new Headers(),
        courseId: 1,
        title: "Test",
      });

      expect(result.error?.message).toBe(ErrorCode.unauthorized);
    });
  });

  describe("admin users", () => {
    let organization: Organization;
    let course: Course;
    let headers: Headers;

    beforeAll(async () => {
      const { organization, user } = await memberFixture({
        role: "admin",
      });

      course = await courseFixture({ organizationId: organization.id });
      headers = await signInAs(user.email, user.password);
    });

    test("creates chapter successfully", async () => {
      const result = await createChapter({
        headers,
        courseId: course.id,
        title: "New Chapter",
      });

      expect(result.data?.title).toBe("New Chapter");

      // Verify in database
      const chapter = await prisma.chapter.findFirst({
        where: { courseId: course.id },
      });

      expect(chapter?.title).toBe("New Chapter");
    });
  });
});
```

### Fixture Patterns

```typescript
// Parallel fixture creation (faster)
const [org, user] = await Promise.all([organizationFixture(), userFixture()]);

// Dependent fixtures (when order matters)
const { organization, user } = await memberFixture({ role: "admin" });
const course = await courseFixture({ organizationId: organization.id });
```

### Test All Permission Levels

```typescript
describe("unauthenticated users", () => {
  /* ... */
});

describe("members", () => {
  /* ... */
});

describe("admins", () => {
  /* ... */
});

// if owners have the same permissions as admins, you can skip this test
describe("owners", () => {
  /* ... */
});
```

## Unit Testing (Vitest)

### Pure Functions

```typescript
import { removeAccents } from "./string";

describe("removeAccents", () => {
  test("removes diacritics from string", () => {
    expect(removeAccents("café")).toBe("cafe");
    expect(removeAccents("São Paulo")).toBe("Sao Paulo");
  });
});
```

### When to Add Unit Tests

- Edge cases not covered by e2e tests
- Complex utility functions
- Error boundary conditions

## Commands

```bash
# Unit/Integration tests using Vitest
pnpm test                    # Run all tests once

# Run specific test file
pnpm --filter @zoonk/editor test -- --run src/data/chapters/create-chapter.test.ts

# E2E tests using Playwright
pnpm e2e                     # Run all e2e tests
```

## Reference Files

- E2E fixtures: `apps/{app}/e2e/fixtures.ts`
- E2E config: `apps/{app}/playwright.config.ts`
- Test fixtures: `packages/testing/src/fixtures/`
- Vitest config: `apps/{app}/vitest.config.mts`
- Example e2e tests: `apps/main/e2e/`
- Example integration tests: `apps/editor/src/data/chapters/`
