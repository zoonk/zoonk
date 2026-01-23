import { expect, test } from "./fixtures";

test.describe("Learn Form", () => {
  test("shows form with auto-focused input", async ({ page }) => {
    await page.goto("/learn");

    await expect(page.getByRole("heading", { name: /what do you want to learn/i })).toBeVisible();

    const input = page.getByRole("textbox");
    await expect(input).toBeFocused();
    await expect(page.getByRole("button", { name: /start/i })).toBeVisible();
  });

  test("submitting prompt navigates to suggestions page", async ({ page }) => {
    await page.goto("/learn");

    await page.getByRole("textbox").fill("test prompt");
    await page.getByRole("button", { name: /start/i }).click();

    await expect(page.getByRole("heading", { name: /course ideas for/i })).toBeVisible();
  });
});

test.describe("Course Suggestions", () => {
  test("shows suggestions with title, description, and generate link", async ({ page }) => {
    await page.goto("/learn/test%20prompt");

    await expect(
      page.getByRole("heading", { name: /course ideas for test prompt/i }),
    ).toBeVisible();

    await expect(page.getByText("Introduction to Testing")).toBeVisible();
    await expect(page.getByText(/fundamentals of software testing/i)).toBeVisible();

    const generateLinks = page.getByRole("link", { name: /generate/i });
    await expect(generateLinks.first()).toBeVisible();
  });

  test("Generate link navigates to generate page", async ({ page }) => {
    await page.goto("/learn/test%20prompt");

    await expect(page.getByRole("heading", { name: /course ideas for/i })).toBeVisible();

    const generateLink = page.getByRole("link", { name: /generate/i }).first();
    await generateLink.click();

    await expect(page).toHaveURL(/\/generate\/cs\/\d+/);
  });

  test("Change subject navigates back to learn form", async ({ page }) => {
    await page.goto("/learn/test%20prompt");

    await expect(page.getByRole("heading", { name: /course ideas for/i })).toBeVisible();

    await page.getByRole("link", { name: /change subject/i }).click();

    await expect(page.getByRole("heading", { name: /what do you want to learn/i })).toBeVisible();
  });

  test("submits form using Enter key", async ({ page }) => {
    await page.goto("/learn");

    const input = page.getByRole("textbox");
    await input.fill("test prompt");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: /course ideas for/i })).toBeVisible();
  });
});
