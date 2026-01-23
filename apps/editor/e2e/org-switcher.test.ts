import { expect, test } from "./fixtures";

test.describe("Org Switcher - Multi-org user", () => {
  test.beforeEach(async ({ multiOrgPage }) => {
    await multiOrgPage.goto("/ai");

    await expect(multiOrgPage.getByRole("button", { name: /zoonk ai/i })).toBeVisible();
  });

  test("shows other organizations in dropdown", async ({ multiOrgPage }) => {
    await multiOrgPage.getByRole("button", { name: /zoonk ai/i }).click();

    const menu = multiOrgPage.getByRole("menu");

    await expect(menu.getByRole("menuitem", { name: /test org/i })).toBeVisible();

    // current org should not be shown in the dropdown
    await expect(menu.getByRole("menuitem", { name: /zoonk ai/i })).not.toBeVisible();
  });
});

test.describe("Org Switcher - Active org update", () => {
  test("navigating to home redirects to newly selected org", async ({ multiOrgPage }) => {
    // Start at the "ai" org
    await multiOrgPage.goto("/ai");

    await expect(multiOrgPage.getByRole("button", { name: /zoonk ai/i })).toBeVisible();

    // Switch to "test-org"
    await multiOrgPage.getByRole("button", { name: /zoonk ai/i }).click();

    await multiOrgPage
      .getByRole("menu")
      .getByRole("menuitem", { name: /test org/i })
      .click();

    await expect(multiOrgPage).toHaveURL(/\/test-org/);

    // Wait for the page to fully load
    // The OrgSwitcher fires a setActive call when switching orgs
    await expect(multiOrgPage.getByRole("button", { name: /test org/i })).toBeVisible();

    // Navigate to the root page
    await multiOrgPage.goto("/");

    // Should redirect to "test-org" (the newly active org), not "ai"
    await expect(multiOrgPage).toHaveURL(/\/test-org/);
  });
});

test.describe("Org Switcher - Single org user", () => {
  test("shows 'No other organizations' message", async ({ ownerPage }) => {
    await ownerPage.goto("/ai");

    await expect(ownerPage.getByRole("button", { name: /zoonk ai/i })).toBeVisible();

    await ownerPage.getByRole("button", { name: /zoonk ai/i }).click();

    const menu = ownerPage.getByRole("menu");
    await expect(menu.getByText(/no other organizations/i)).toBeVisible();
  });
});
