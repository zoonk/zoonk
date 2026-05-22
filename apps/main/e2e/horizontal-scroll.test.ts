import { expect, test } from "./fixtures";

test.describe("Horizontal Scroll - Category Pills", () => {
  test("shows scroll right button when content overflows", async ({ page }) => {
    await page.goto("/courses");

    const scrollRight = page.getByRole("button", { name: /scroll right/iu });
    await expect(scrollRight).toBeVisible();

    // Left button should not be visible at the start
    await expect(page.getByRole("button", { name: /scroll left/iu })).not.toBeVisible();
  });

  test("clicking scroll right reveals scroll left button", async ({ page }) => {
    await page.goto("/courses");

    const scrollRight = page.getByRole("button", { name: /scroll right/iu });
    await scrollRight.click();

    // After scrolling right, the left button should appear
    const scrollLeft = page.getByRole("button", { name: /scroll left/iu });
    await expect(scrollLeft).toBeVisible();
  });

  test("category pill row cannot scroll vertically", async ({ page }) => {
    await page.goto("/courses");

    const categories = page.getByRole("navigation", { name: /course categories/iu });
    await expect(categories).toBeVisible();

    const verticalScrollRange = await categories.evaluate((nav) => {
      const scrollTarget = nav.parentElement;

      return scrollTarget ? scrollTarget.scrollHeight - scrollTarget.clientHeight : null;
    });

    expect(verticalScrollRange).toBe(0);
  });
});
