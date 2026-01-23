import { expect, test } from "./fixtures";

test.describe("Org Home - Permissions", () => {
  test("returns not found for non-existent org", async ({ ownerPage }) => {
    await ownerPage.goto("/non-existent-org");

    await expect(ownerPage.getByRole("heading", { name: /404/i })).toBeVisible();
  });

  test("allows owner to view page", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");

    await expect(ownerPage.getByRole("heading", { name: /draft courses/i })).toBeVisible();
  });

  test("allows admin to view page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/ai");

    await expect(authenticatedPage.getByRole("heading", { name: /draft courses/i })).toBeVisible();
  });

  test("denies member access", async ({ memberPage }) => {
    await memberPage.goto("/ai");

    await expect(memberPage.getByRole("heading", { name: /401.*unauthorized/i })).toBeVisible();
  });

  test("denies non-org member access", async ({ userWithoutOrg }) => {
    await userWithoutOrg.goto("/ai");

    await expect(userWithoutOrg.getByRole("heading", { name: /401.*unauthorized/i })).toBeVisible();
  });

  test("denies unauthenticated access", async ({ page }) => {
    await page.goto("/ai");

    await expect(page.getByRole("heading", { name: /401.*unauthorized/i })).toBeVisible();
  });
});

test.describe("Org Home - Course Filtering", () => {
  test("shows only courses from this org", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");

    // Should see E2E Draft Course from ai org
    await expect(ownerPage.getByText("E2E Draft Course")).toBeVisible();

    // Should not see Test Org Course from test-org
    await expect(ownerPage.getByText("Test Org Course")).not.toBeVisible();
  });

  test("shows only draft courses, not published", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");

    // Should see E2E Draft Course (draft)
    await expect(ownerPage.getByText("E2E Draft Course")).toBeVisible();

    // Should not see Machine Learning (published)
    await expect(ownerPage.getByText("Machine Learning")).not.toBeVisible();
  });
});

test.describe("Org Home - Navigation", () => {
  test("clicking create course navigates to creation page", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");
    await ownerPage.getByRole("link", { name: /create course/i }).click();

    await expect(ownerPage).toHaveURL(/\/ai\/new-course/);
    await expect(ownerPage.getByText(/course title/i)).toBeVisible();
  });
});
