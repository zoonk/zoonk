import { expect, test } from "./fixtures";

test.describe("Learn Form", () => {
  test("shows form with auto-focused input", async ({ page }) => {
    await page.goto("/learn");

    await expect(
      page.getByRole("heading", { name: /what do you want to learn/i }),
    ).toBeVisible();

    const input = page.getByRole("textbox");
    await expect(input).toBeFocused();
    await expect(page.getByRole("button", { name: /start/i })).toBeVisible();
  });

  test("submitting prompt navigates to suggestions page", async ({ page }) => {
    await page.goto("/learn");

    await page.getByRole("textbox").fill("test prompt");
    await page.getByRole("button", { name: /start/i }).click();

    await expect(
      page.getByRole("heading", { name: /course ideas for/i }),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Course Suggestions", () => {
  test("shows suggestions with title, description, and create button", async ({
    page,
  }) => {
    await page.goto("/learn/test%20prompt");

    await expect(
      page.getByRole("heading", { name: /course ideas for test prompt/i }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("Introduction to Testing")).toBeVisible();
    await expect(
      page.getByText(/fundamentals of software testing/i),
    ).toBeVisible();

    const createButtons = page.getByRole("button", { name: /create course/i });
    await expect(createButtons.first()).toBeVisible();
  });

  test("Change subject navigates back to learn form", async ({ page }) => {
    await page.goto("/learn/test%20prompt");

    await expect(
      page.getByRole("heading", { name: /course ideas for/i }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("link", { name: /change subject/i }).click();

    await expect(
      page.getByRole("heading", { name: /what do you want to learn/i }),
    ).toBeVisible();
  });
});
