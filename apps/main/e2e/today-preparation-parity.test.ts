import { type Locator, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { z } from "zod";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

const SHARE = /(?:<|>)?\d+%/u;

/** A share as a number to compare: "<1%" sits between 0% and 1%. */
function toPoints(text: string): number {
  const match = SHARE.exec(text)?.[0] ?? "";
  const points = Number(match.replaceAll(/[<>%]/gu, ""));
  return match.startsWith("<") ? points - 0.5 : points;
}

/** Today's block for where the goal stands, by its title, at a width that shows it. */
async function openTodayStanding(page: Page, name: string) {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/today");
  return page.getByRole("region", { exact: true, name });
}

/** The big number under the block's title: the first share it shows. */
function standingValue(block: Locator) {
  return block.getByText(SHARE).first();
}

/**
 * Clicks where an element is drawn, as a learner does, whatever lies over it: on Today's card the
 * link to the Plan covers the whole card, so a click on its cells lands on that link.
 */
async function clickWhereDrawn(locator: Locator) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("The element must be on screen to click it");
  }

  await locator.page().mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** The Plan's two numbers, in the aside at the tests' desktop width. */
function planNumbers(page: Page) {
  return page.locator('[data-slot="journey-standing"]').filter({ visible: true });
}

/** A Today read, as far as the budget below looks into it. */
const todayReadSchema = z.object({
  copy: z.object({
    view: z.object({
      syllabus: z.object({ subjects: z.array(z.record(z.string(), z.unknown())).min(1) }),
    }),
  }),
});

// Ana's Today carried her whole syllabus, every topic and chapter (94 KB of a 107 KB read), for the
// few rows its aside draws: each read now carries only those rows.
test("Today's read carries its subjects' rows, not the whole syllabus", async ({ browser }) => {
  await asPersona(browser, { persona: "exam" }, async ({ page }) => {
    const response = await page.request.get("/api/learner/views/today");
    await expect(response).toBeOK();

    const body = await response.text();
    const read = todayReadSchema.parse(JSON.parse(body));

    expect(body.length).toBeLessThan(40_000);
    expect(read.copy.view.syllabus.subjects.every((subject) => !("topics" in subject))).toBe(true);
  });
});

// Ana's Today read "Preparation 12%" over five subjects at "<1%": the bars counted lessons.
test("An exam's subjects read their preparation, which the overall number sums up", async ({
  browser,
}) => {
  await asPersona(browser, { persona: "exam" }, async ({ page }) => {
    const preparation = await openTodayStanding(page, "Preparation");

    const rows = preparation
      .getByRole("list", { exact: true, name: "Preparation" })
      .getByRole("listitem");

    await expect(rows).toHaveCount(5);

    // One measure: no lesson legend, no lesson caption.
    await expect(preparation.getByText("Studied", { exact: true })).toHaveCount(0);
    await expect(preparation.getByText("Lessons", { exact: true })).toHaveCount(0);

    const overallText = await standingValue(preparation).innerText();
    const overall = toPoints(overallText);

    const rowList = await rows.all();

    const shown = await Promise.all(
      rowList.map(async (row) => {
        const name = await row.getByTitle(/./u).getAttribute("title");
        const percentage = SHARE.exec(await row.innerText())?.[0];

        if (!name || !percentage) {
          throw new Error("A preparation row must expose its full subject name and percentage");
        }

        return { name, percentage };
      }),
    );

    // The whole reads as its subjects together: some at or above it, some at or below it.
    const points = shown.map((row) => toPoints(row.percentage));
    expect(Math.max(...points)).toBeGreaterThanOrEqual(overall);
    expect(Math.min(...points)).toBeLessThanOrEqual(overall);

    // The whole card is one link to the Plan, named by its words.
    const link = preparation.getByRole("link");
    await expect(link).toHaveAccessibleName(/^Preparation \d+%.* See your plan$/u);
    await link.click();
    const subjects = page.getByRole("region", { exact: true, name: "Subjects" });

    await expect(subjects.getByText("Preparation", { exact: true })).toBeVisible();
    await expect(subjects.getByText("Studied", { exact: true })).toHaveCount(0);
    await expect(planNumbers(page)).toContainText(`Preparation ${overallText}`);

    await Promise.all(
      shown.map(({ name, percentage }) =>
        expect(
          subjects.getByRole("link").filter({ has: page.getByTitle(name, { exact: true }) }),
        ).toContainText(percentage),
      ),
    );

    // The subject's page says the same share, once, as its preparation: never as lessons done.
    const [first] = shown;

    await subjects
      .getByRole("link")
      .filter({ has: page.getByTitle(first?.name ?? "", { exact: true }) })
      .click();

    await expect(page.getByRole("heading", { level: 1, name: first?.name })).toBeVisible();
    await expect(page.getByText(/% done/u)).toHaveCount(0);

    const aside = page.getByRole("complementary", { name: "About this subject" });
    await expect(aside.getByText("Preparation", { exact: true })).toBeVisible();
    await expect(aside.getByText(first?.percentage ?? "", { exact: true })).toBeVisible();

    // And the answers behind it: Ana's languages have enough new questions answered to count.
    await expect(aside.getByText("Mastery", { exact: true })).toBeVisible();
    await expect(aside.getByText(/^\d+ of \d+ right$/u)).toBeVisible();
  });
});

// Pedro finished every lesson and still read "Progress 4%".
test("A goal without an exam reads its plan's lessons, and finishing every one reads 100%", async ({
  browser,
}) => {
  await asPersona(browser, { persona: "stocks" }, async ({ page, user }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/plan");

    const numbers = planNumbers(page);
    await expect(numbers).toContainText(/^Progress\s*\d+%\s*\d+ of \d+ lessons/u);
    await expect(numbers).not.toContainText(/preparation/iu);

    const lessons = /(?<done>\d+) of (?<total>\d+) lessons/u.exec(await numbers.innerText());
    const total = Number(lessons?.groups?.total);

    expect(Math.round((Number(lessons?.groups?.done) / total) * 100)).toBe(
      toPoints(await numbers.innerText()),
    );

    // Today draws the same lessons as cells, one each, and the whole card leads back here, its
    // link named by the card's words.
    const today = await openTodayStanding(page, "Progress");
    const link = today.getByRole("link");

    await expect(today.locator('[data-slot="progress-cell"]')).toHaveCount(total);
    await expect(link).toHaveAccessibleName(/^Progress \d+% \d+ of \d+ lessons .*See your plan$/u);
    await clickWhereDrawn(today.locator('[data-slot="lesson-cells"]'));
    await expect(page).toHaveURL(/\/plan$/u);

    // The sheet's first ring is the same number: the lessons, not a mix of parts.
    await numbers.getByRole("button", { name: /^Progress/u }).click();
    const sheet = page.getByRole("dialog", { name: "Your progress" });

    await expect(sheet.locator('[data-part="lessons"]')).toContainText(
      `of ${String(total)} lessons`,
    );

    await expect(sheet.locator('[data-part="coverage"]')).toHaveCount(0);
    await page.keyboard.press("Escape");

    await prisma.planItem.updateMany({
      data: { completedAt: new Date(), status: "done" },
      where: { kind: { in: ["lesson", "chapter"] }, plan: { goalId: user.goalId } },
    });

    await page.reload();

    await expect(planNumbers(page)).toContainText(
      `Progress 100% ${String(total)} of ${String(total)} lessons`,
    );

    const progress = await openTodayStanding(page, "Progress");
    await expect(standingValue(progress)).toHaveText("100%");
    await expect(progress).toContainText(`${String(total)} of ${String(total)} lessons`);
  });
});

// Marcos's Today read "Progress 2%" while his Plan said his level.
test("A language goal says its level on Today, as the Plan does", async ({ browser }) => {
  await asPersona(browser, { persona: "language" }, async ({ page }) => {
    const level = await openTodayStanding(page, "Level");
    await expect(level).toContainText(/^Level\s*[ABC][12]\+?/u);
    await expect(page.getByRole("region", { exact: true, name: "Progress" })).toHaveCount(0);

    // The level on the CEFR scale, A1 to C2 in half steps, and the card leads to the Plan.
    await expect(level.locator('[data-slot="progress-cell"]')).toHaveCount(11);

    await expect(level.getByRole("link")).toHaveAccessibleName(
      /^Level [ABC][12]\+?(?: → goal [ABC][12]\+?)? See your plan$/u,
    );

    const label = /[ABC][12]\+?/u.exec(await level.innerText())?.[0] ?? "";

    await page.goto("/plan");
    await expect(planNumbers(page)).toContainText(`Level ${label}`);
  });
});
