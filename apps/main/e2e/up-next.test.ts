import { expect, test } from "./fixtures";
import { asPersona, findPlanChapterId } from "./learn-personas";

/**
 * Pedro's plan (the stock market) gives "Where a share's price comes from", of its second phase,
 * today, while the first phase still has a topic being written and its challenge.
 */
const LESSON = "De onde vem o preço de uma ação";
const CHAPTER = "Como funcionam as negociações";

test.describe("Up next", () => {
  // Pedro's Today opened a lesson of his second phase while his Plan marked the first phase's
  // lessons still being written as up next.
  test("is the lesson Today opens, on the Plan and on its chapter's page, though its phase isn't the current one", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "stocks" }, async ({ page, user }) => {
      const chapterId = await findPlanChapterId(user.goalId, CHAPTER);

      await page.goto("/today");

      await expect(page.locator('[data-slot="today-next"]')).toContainText(LESSON);

      await page.goto("/plan");
      const path = page.getByRole("list", { name: "Your path" });

      // He's still in the first phase, which has a topic being written and its challenge left: it
      // stays closed and says so, so the path opens at his next chapter, in the second phase, and
      // highlights only that.
      const first = path.locator(":scope > li").first();
      await expect(first).toContainText("O que é uma ação");
      await expect(first).toContainText("More lessons on the way");
      await expect(first).not.toHaveAttribute("aria-current", "step");

      const open = path.locator(':scope > li[aria-current="step"]');
      const upNext = open.getByRole("link", { name: new RegExp(CHAPTER, "u") }).first();
      await expect(upNext).toHaveAttribute("href", `/content/chapters/${chapterId}`);
      await expect(path.getByText("Up next", { exact: true })).toHaveCount(0);

      await upNext.click();
      await expect(page.getByRole("heading", { level: 1, name: CHAPTER })).toBeVisible();

      const lessons = page.getByRole("region", { name: "Lessons" });
      const next = lessons.getByRole("link", { name: /^Up next \d+\. /u });

      await expect(next).toHaveCount(1);
      await expect(next).toContainText(LESSON);

      await expect(page.getByRole("link", { name: /^(?:Continue|Start)/u })).toHaveAttribute(
        "href",
        (await next.getAttribute("href")) ?? "",
      );
    });
  });
});
