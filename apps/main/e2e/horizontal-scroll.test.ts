import { expect, test } from "./fixtures";

test.describe("Horizontal Scroll - Category Pills", () => {
  test("scrolls the overflowing pill row sideways only, with a scroll button for each way", async ({
    page,
  }) => {
    // The categories are a row of chips under `lg` (a list beside the courses from `lg`). The E2E
    // catalog files its courses under more categories than fit this width (`e2e-data.ts`).
    await page.setViewportSize({ height: 1180, width: 820 });
    await page.goto("/courses");

    const scrollRight = page.getByRole("button", { name: /scroll right/iu });
    const scrollLeft = page.getByRole("button", { name: /scroll left/iu });

    await expect(scrollRight).toBeVisible();

    // Left button should not be visible at the start
    await expect(scrollLeft).not.toBeVisible();

    await scrollRight.click();
    await expect(scrollLeft).toBeVisible();

    const categories = page.getByRole("navigation", { name: /course categories/iu });
    await expect(categories).toBeVisible();

    const verticalScrollRange = await categories.evaluate((nav) => {
      const scrollTarget = nav.parentElement;

      return scrollTarget ? scrollTarget.scrollHeight - scrollTarget.clientHeight : null;
    });

    expect(verticalScrollRange).toBe(0);
  });
});
