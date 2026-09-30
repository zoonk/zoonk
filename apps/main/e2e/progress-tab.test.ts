import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

/** Ana's goal is named after the ENEM edition the seed picks for today: the year of her exam date. */
async function findPreparationTitle(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return `ENEM ${goal.targetDate?.getUTCFullYear()} preparation`;
}

/**
 * The Progress tab for Ana's ENEM goal: preparation with its evidence, the estimated score after
 * her mock, areas with what's still needed and practice on the weakest, the week and the stats pages.
 * Fun draws the same numbers as the preparation ring and area planets.
 */
test.describe("Progress tab", () => {
  test("Focus shows preparation with the evidence for each part", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page, user }) => {
      const title = await findPreparationTitle(user.goalId);
      await page.goto("/progress");

      await expect(page.getByText(title)).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: /^\d+%$/u })).toBeVisible();

      await Promise.all(
        ["Coverage", "Mastery", "Long-term memory", "Mock exams"].map((part) =>
          expect(page.getByText(part, { exact: true })).toBeVisible(),
        ),
      );

      await expect(page.getByText(/^Estimated score: \d+% to \d+%$/u)).toBeVisible();
      await expect(page.getByText(/^Based on your last/u)).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your areas" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Practice now" })).toBeVisible();
      await expect(page.getByText(/^\d+ skills? left/u).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
    });
  });

  test("Fun shows the preparation ring, the stages and the areas as planets", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "fun", persona: "exam" }, async ({ page, user }) => {
      const title = await findPreparationTitle(user.goalId);
      await page.goto("/progress");

      await expect(page.getByRole("heading", { name: title })).toBeVisible();

      await expect(page.getByRole("list", { name: "Stages" }).getByRole("listitem")).toHaveText([
        "Warming up",
        "Getting there",
        "Solid",
      ]);

      await expect(page.getByText(/^Estimated \d+% to \d+%$/u)).toBeVisible();

      await expect(page.getByRole("region", { name: "You vs. plan" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your areas" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Practice now" })).toBeVisible();
    });
  });

  test("says what's still needed to reach the goal, area by area", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page }) => {
      await page.goto("/progress");

      // Each area is listed once, with its preparation and what's still needed there.
      const stillNeeded = page.getByRole("region", { name: "Your areas" });
      await expect(stillNeeded).toBeVisible();

      // An exam asks for Solid only where the topic weighs a lot.
      await expect(
        stillNeeded.getByText("The topics that weigh most need to be Solid; the rest, started."),
      ).toBeVisible();

      await expect(stillNeeded.getByText(/^\d+ skills? to go/u)).toBeVisible();
      await expect(stillNeeded.getByText(/^\d+ skills? left · about/u).first()).toBeVisible();
      await expect(stillNeeded.getByText(/^Next: /u).first()).toBeVisible();
    });
  });

  test("a learn goal counts its weekly challenges, not mock exams", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "hugeGoal" }, async ({ page }) => {
      await page.goto("/progress");

      await expect(page.getByText("Weekly challenges", { exact: true })).toBeVisible();
      await expect(page.getByText("Mock exams", { exact: true })).toHaveCount(0);
      await expect(page.getByText(/^Estimated/u)).toHaveCount(0);
    });
  });

  test("a quick explanation has no preparation to show", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "explain" }, async ({ page }) => {
      await page.goto("/progress");

      await expect(
        page.getByText(
          "A quick explanation has nothing to prepare for. Its ideas come back in your reviews so they stay with you.",
        ),
      ).toBeVisible();

      await expect(page.getByText("Coverage", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Your stats" })).toBeVisible();
    });
  });

  test("the stats pages open inside the tabs", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "exam" }, async ({ page }) => {
      await page.goto("/progress");

      const stats = page.getByRole("navigation", { name: "Your stats" });
      await stats.getByRole("link", { name: "Energy" }).click();

      await expect(page).toHaveURL(/\/energy$/u);

      await expect(
        page
          .getByRole("navigation", { name: "Learning tabs" })
          .getByRole("link", { name: "Buddy" }),
      ).toHaveAttribute("aria-current", "page");

      await page
        .getByRole("navigation", { name: "Your stats" })
        .getByRole("link", { name: "Progress" })
        .click();

      await expect(page).toHaveURL(/\/progress$/u);
    });
  });

  test(`"Practice now" practices the weakest area in today's session`, async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page, user }) => {
      await page.goto("/progress");
      await page.getByRole("button", { name: "Practice now" }).click();

      // Practice plays on the session screen; with nothing left to practice, the area's lesson opens.
      await expect(page).toHaveURL(/\/(?:session|learn\/[0-9a-f-]+\?session=.+)$/u);

      await expect
        .poll(async () => {
          const blocks = await prisma.studySessionBlock.findMany({
            where: { session: { goalId: user.goalId } },
          });

          return blocks.map((block) => block.payload);
        })
        .toContainEqual(expect.objectContaining({ extra: true }));
    });
  });

  test("the mistakes notebook is one tap from Progress", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "exam" }, async ({ page }) => {
      await page.goto("/progress");
      await page.getByRole("link", { name: /^Mistakes notebook/u }).click();

      await expect(
        page.getByRole("heading", { level: 1, name: "Mistakes notebook" }),
      ).toBeVisible();
    });
  });
});
