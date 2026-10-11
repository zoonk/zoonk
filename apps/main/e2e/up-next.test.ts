import { expect, test } from "./fixtures";
import { asPersona, findPlanChapterId } from "./learn-personas";

/**
 * Pedro's plan (the stock market) gives "Where a share's price comes from", of its second phase,
 * today, while the first phase still has a topic being written and its challenge.
 */
const LESSON = "De onde vem o preço de uma ação";
const CHAPTER = "Como funcionam as negociações";

test.describe("Up next", () => {
  // Pedro's Today opened a lesson of his second phase while his Journey marked the first phase's
  // lessons still being written as up next.
  test("is the lesson Today opens, on the Journey and on its chapter's page, though its phase isn't the current one", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "stocks" }, async ({ page, user }) => {
      const chapterId = await findPlanChapterId(user.goalId, CHAPTER);

      await page.goto("/today");

      await expect(
        page.locator('[data-slot="today-next"]').getByRole("heading", { level: 3 }),
      ).toHaveText(LESSON);

      await page.goto("/journey");
      const path = page.getByRole("list", { name: "Your journey" });

      // He's still in the first phase: it has a topic being written and its challenge left.
      await expect(path.locator('li[aria-current="step"]')).toContainText("O que é uma ação");

      const upNext = path.getByRole("link", { name: /Up next/u });
      await expect(upNext).toHaveCount(1);
      await expect(upNext).toContainText(CHAPTER);
      await expect(upNext).toHaveAttribute("href", `/content/chapters/${chapterId}`);

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
