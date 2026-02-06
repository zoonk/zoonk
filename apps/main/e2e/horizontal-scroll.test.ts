import { expect, test } from "./fixtures";

test.describe("Horizontal Scroll - Category Pills", () => {
  test("shows scroll right button when content overflows", async ({ page }) => {
    await page.goto("/courses");

    const scrollRight = page.getByRole("button", { name: /scroll right/i });
    await expect(scrollRight).toBeVisible();

    // Left button should not be visible at the start
    await expect(page.getByRole("button", { name: /scroll left/i })).not.toBeVisible();
  });

  test("clicking scroll right reveals scroll left button", async ({ page }) => {
    await page.goto("/courses");

    const scrollRight = page.getByRole("button", { name: /scroll right/i });
    await scrollRight.click();

    // After scrolling right, the left button should appear
    const scrollLeft = page.getByRole("button", { name: /scroll left/i });
    await expect(scrollLeft).toBeVisible();
  });
});
