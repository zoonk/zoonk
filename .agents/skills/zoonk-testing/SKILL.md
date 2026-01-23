---
name: zoonk-testing
description: Write tests following TDD principles. Use when implementing features, fixing bugs, or adding test coverage. Covers e2e, integration, and unit testing patterns.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Testing Guidelines

Follow TDD (Test-Driven Development) for all features and bug fixes. **Always write failing tests first.**

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

| When                    | Test Type   | Framework  | Location                              |
| ----------------------- | ----------- | ---------- | ------------------------------------- |
| Apps/UI features        | E2E         | Playwright | `apps/{app}/e2e/`                     |
| Data functions (Prisma) | Integration | Vitest     | `apps/{app}/src/data/` or `packages/` |
| Utils/helpers           | Unit        | Vitest     | `packages/{pkg}/*.test.ts`            |

## E2E Testing (Playwright)

### Core Principle: Test User Behavior

Test what users see and do, not implementation details. If your test breaks when you refactor CSS or rename a class, it's testing the wrong thing.

### Preventing Flaky Tests

**CRITICAL: Run new tests multiple times before considering them done.** Flaky tests often pass 90% of the time but fail intermittently. After writing a new E2E test:

```bash
# Run the test 5+ times to catch flakiness
for i in {1..5}; do pnpm e2e -- -g "test name" --reporter=line; done
```

**High-risk scenarios that commonly cause flakiness:**

| Scenario                         | Risk                          | Prevention                                         |
| -------------------------------- | ----------------------------- | -------------------------------------------------- |
| Clicking dropdown/menu items     | Animations cause instability  | Wait for item visibility, use `force: true`        |
| Actions that trigger navigation  | Page reload detaches elements | Use `waitForLoadState` or `waitForURL` after click |
| Form submissions                 | Async save operations         | Wait for success indicator before next action      |
| Clicking items in lists          | List may still be loading     | Wait for specific item with `toBeVisible()` first  |
| Keyboard navigation              | Focus state transitions       | Wait for focused element before next key press     |
| Inputs with debounced validation | State changes between actions | Use `waitForLoadState("networkidle")` after fill   |

**Defensive patterns for common interactions:**

```typescript
// RISKY: Dropdown item click without animation handling
await page.getByRole("menuitem", { name: /settings/i }).click();
await page.getByRole("menuitem", { name: "Dark mode" }).click();

// SAFE: Wait for submenu, then force click
await page.getByRole("menuitem", { name: /settings/i }).click();
await expect(page.getByRole("menuitem", { name: "Dark mode" })).toBeVisible();
await page.getByRole("menuitem", { name: "Dark mode" }).click({ force: true });

// RISKY: Click that triggers navigation without waiting
await page.getByRole("button", { name: /save/i }).click();
await page.getByRole("link", { name: /home/i }).click(); // May fail if save triggers reload

// SAFE: Wait for navigation to complete
await page.getByRole("button", { name: /save/i }).click();
await page.waitForLoadState("domcontentloaded");
await page.getByRole("link", { name: /home/i }).click();
```

**Before marking a test as complete, ask:**

1. Does this test interact with animated elements (dropdowns, modals, tooltips)?
2. Does any action trigger navigation or page reload?
3. Does the test depend on async operations completing?
4. Have I run this test multiple times to verify it's stable?

### Avoid Redundant Tests

**Don't write separate tests when a higher-level test already covers the behavior.** If a test proves the final outcome, intermediate steps are implicitly verified.

**Examples of redundancy to avoid:**

1. **Visibility + interaction**: If you click a button, don't also test that it's visible—the click would fail if it weren't.
2. **Intermediate + final states**: If "data persists after reload" passes, "auto-save works" is already proven—don't test both.
3. **Multiple steps in a flow**: If "user completes checkout" passes, you don't need separate tests for each form field.

```typescript
// BAD: Two redundant tests - persistence proves auto-save worked
test("auto-saves title changes", async ({ page }) => {
  await page.getByRole("textbox", { name: /title/i }).fill("New Title");
  await expect(page.getByText(/saved/i)).toBeVisible();
});

test("persists title after reload", async ({ page }) => {
  await page.getByRole("textbox", { name: /title/i }).fill("New Title");
  await expect(page.getByText(/saved/i)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: /title/i })).toHaveValue(
    "New Title",
  );
});

// GOOD: Single test that implicitly verifies auto-save through persistence
test("auto-saves and persists title", async ({ page }) => {
  const titleInput = page.getByRole("textbox", { name: /title/i });
  await titleInput.fill("New Title");
  await expect(page.getByText(/saved/i)).toBeVisible();

  await page.reload();
  await expect(titleInput).toHaveValue("New Title");
});
```

**When separate tests ARE useful:**

- Testing conditional rendering (element appears/disappears based on state)
- Testing error states that require different setup than success states
- Testing independent behaviors that don't share a logical flow

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
  const fallbackIcon = page.getByRole("img", { name: /post title/i }).first();
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

### Animated Elements (Dropdowns, Modals, Submenus)

Animated elements with CSS transitions (`slide-in-from-*`, `zoom-in-*`, `fade-in-*`) can cause flaky tests because Playwright considers moving elements "not stable" and won't click them.

**Pattern**: Wait for content to be visible, then use `force: true` to bypass stability checks:

```typescript
// BAD: Click immediately - element may still be animating
async function openLanguageSubmenu(page: Page) {
  await page.getByRole("button", { name: /menu/i }).click();
  await page.getByRole("menuitem", { name: /language/i }).click();
}

test("switches locale", async ({ page }) => {
  await openLanguageSubmenu(page);
  // This fails intermittently with "element is not stable"
  await page.getByRole("menuitem", { name: "Español" }).click();
});

// GOOD: Wait for animation to complete, then force click
async function openLanguageSubmenu(page: Page) {
  await page.getByRole("button", { name: /menu/i }).click();
  await page.getByRole("menuitem", { name: /language/i }).click();
  // Wait for submenu content to be visible (animation complete)
  await expect(page.getByRole("menuitem", { name: "English" })).toBeVisible();
}

test("switches locale", async ({ page }) => {
  await openLanguageSubmenu(page);
  // Force click bypasses stability check - safe because we confirmed visibility
  await page.getByRole("menuitem", { name: "Español" }).click({ force: true });
});
```

**When to use `force: true`**:

- After confirming the element is visible via `toBeVisible()`
- When CSS animations cause repeated "element is not stable" errors
- Never as a first resort—always investigate why the element is unstable first

### Verify Destination Content, Not Just URLs

**Never rely solely on `toHaveURL` for navigation tests.** If a route is moved or broken, URL-only tests will pass even when the destination is wrong. Always verify the destination page renders expected content.

```typescript
// BAD: Only checks URL - will pass even if page is broken or moved
test("creates item and redirects", async ({ page }) => {
  await page.getByRole("button", { name: /create/i }).click();
  await expect(page).toHaveURL(/\/items\/new-item/);
});

// GOOD: Verifies destination content exists
test("creates item and redirects to item page", async ({ page }) => {
  const itemTitle = "My New Item";
  const itemDescription = "Item description";

  // ... fill form with title and description ...

  await page.getByRole("button", { name: /create/i }).click();

  // Verify destination page shows the created content
  // For editable fields, use toHaveValue:
  await expect(page.getByRole("textbox", { name: /edit title/i })).toHaveValue(
    itemTitle,
  );

  // For static text, use toBeVisible:
  await expect(page.getByText(itemDescription)).toBeVisible();
});
```

### Testing Server Actions

**Server Actions run server-side, so `page.route()` cannot intercept them.** Don't try to mock server action failures with route interception—it only works for client-side HTTP requests.

**To test error states, trigger real validation errors through user input:**

```typescript
// BAD: Trying to intercept server action (won't work)
test("shows error on failure", async ({ page }) => {
  await page.route("**/api/endpoint", (route) =>
    route.fulfill({ status: 500 }),
  );
  // This won't affect server actions - they don't go through the browser
});

// GOOD: Trigger real validation error
test("shows error for whitespace-only name", async ({ authenticatedPage }) => {
  const nameInput = authenticatedPage.getByLabel(/name/i);
  const originalName = await nameInput.inputValue();

  // Whitespace passes HTML5 "required" but fails server-side when trimmed
  await nameInput.clear();
  await nameInput.fill("   ");

  await authenticatedPage.getByRole("button", { name: /submit/i }).click();

  await expect(authenticatedPage.getByRole("alert")).toBeVisible();

  // Verify data wasn't corrupted
  await authenticatedPage.reload();
  await expect(nameInput).toHaveValue(originalName);
});
```

**Common ways to trigger real server-side errors:**

| Error Type            | How to Trigger                                       |
| --------------------- | ---------------------------------------------------- |
| Empty/invalid input   | Whitespace-only `"   "` (passes HTML5, fails server) |
| Duplicate values      | Use existing slug/email from seeded data             |
| Invalid file          | Upload wrong type or oversized file                  |
| Missing required data | Remove required field via JavaScript before submit   |

**Always verify persistence after mutations:**

```typescript
// Success test: verify new data persisted
await nameInput.fill("New Name");
await submitButton.click();
await expect(page.getByText(/success/i)).toBeVisible();
await page.reload();
await expect(nameInput).toHaveValue("New Name");

// Error test: verify original data wasn't corrupted
const originalName = await nameInput.inputValue();
await nameInput.fill("   "); // Invalid
await submitButton.click();
await expect(page.getByRole("alert")).toBeVisible();
await page.reload();
await expect(nameInput).toHaveValue(originalName);
```

### Authentication Fixtures

Use pre-configured fixtures from your test setup:

```typescript
import { expect, test } from "./fixtures";

test("authenticated user sees dashboard", async ({ authenticatedPage }) => {
  await authenticatedPage.goto("/");
  await expect(
    authenticatedPage.getByRole("heading", { name: "Dashboard" }),
  ).toBeVisible();
});

test("new user sees onboarding", async ({ userWithoutProgress }) => {
  await userWithoutProgress.goto("/");
  await expect(userWithoutProgress.getByText("Get started")).toBeVisible();
});
```

### E2E Test Data Setup

Choose the right approach based on what you're testing:

| Scenario                              | Approach            | Why                                        |
| ------------------------------------- | ------------------- | ------------------------------------------ |
| Testing a creation wizard/form        | Use UI              | You're testing the creation flow itself    |
| Testing edit/mutation behavior        | Use Prisma fixtures | Faster, isolated, focused on edit behavior |
| Testing read-only pages               | Use seeded data     | No isolation needed, seeded data is stable |
| Testing validation against duplicates | Use seeded data     | Need known duplicates to validate against  |

**Use Prisma fixtures when tests mutate data:**

```typescript
import { prisma } from "@/lib/db";
import { postFixture } from "@/tests/fixtures/posts";

async function createTestPost() {
  const user = await prisma.user.findFirstOrThrow();

  return postFixture({
    isPublished: true,
    userId: user.id,
    slug: `e2e-${randomUUID().slice(0, 8)}`,
  });
}

test("edits post title", async ({ authenticatedPage }) => {
  const post = await createTestPost();
  await authenticatedPage.goto(`/posts/${post.slug}`);
  // ... test editing behavior
});
```

**Benefits over UI-based setup:**

- ~100x faster (50ms vs 5s per record)
- Tests only what you intend to test
- Failures are isolated to the behavior under test
- Clear arrange/act/assert structure

**Use seeded data for read-only tests:**

```typescript
// GOOD: Read-only test uses seeded "welcome-post" post
test("shows post details", async ({ page }) => {
  await page.goto("/posts/welcome-post");

  await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
});

// GOOD: Validation test uses seeded post as duplicate target
test("shows error for duplicate slug", async ({ authenticatedPage }) => {
  const post = await createTestPost();
  await authenticatedPage.goto(`/posts/${post.slug}/edit`);
  await authenticatedPage.getByLabel(/url/i).fill("welcome-post"); // seeded post
  await expect(authenticatedPage.getByText(/already in use/i)).toBeVisible();
});
```

### Test Organization

```typescript
test.describe("Post Page", () => {
  test.describe("unauthenticated users", () => {
    test("shows sign-in prompt", async ({ page }) => {
      // ...
    });
  });

  test.describe("authenticated users", () => {
    test("can bookmark post", async ({ authenticatedPage }) => {
      // ...
    });
  });
});
```

However, avoid nesting too deeply. You shouldn't have more than 2 `test.describe` blocks.

## Integration Testing (Vitest + Prisma)

### Using Fixtures

```typescript
import { prisma } from "@/lib/db";
import { postFixture, memberFixture, signInAs } from "@/tests/fixtures";

describe("createComment", () => {
  describe("unauthenticated users", () => {
    test("returns unauthorized error", async () => {
      const result = await createComment({
        headers: new Headers(),
        postId: 1,
        content: "Test",
      });

      expect(result.error?.message).toBe(ErrorCode.unauthorized);
    });
  });

  describe("admin users", () => {
    let organization: Organization;
    let post: Post;
    let headers: Headers;

    beforeAll(async () => {
      const { organization, user } = await memberFixture({
        role: "admin",
      });

      post = await postFixture({ organizationId: organization.id });
      headers = await signInAs(user.email, user.password);
    });

    test("creates comment successfully", async () => {
      const result = await createComment({
        headers,
        postId: post.id,
        content: "New Comment",
      });

      expect(result.data?.content).toBe("New Comment");

      // Verify in database
      const comment = await prisma.comment.findFirst({
        where: { postId: post.id },
      });

      expect(comment?.content).toBe("New Comment");
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
const post = await postFixture({ organizationId: organization.id });
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
pnpm test -- --run src/data/posts/create-post.test.ts

# E2E tests using Playwright
pnpm e2e                     # Run all e2e tests
```
