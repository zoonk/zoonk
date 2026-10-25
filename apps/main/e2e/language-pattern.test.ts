import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { saveMissions } from "./study-day";

const PATTERN_TITLE = "“Since” e “for”";

/** Picks an option with its number key, checks it with Enter, sees it was right, and continues. */
async function answerRightWithKeys(page: Page, key: string) {
  await page.keyboard.press(key);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: /^Correct!/u })).toBeVisible();
  await page.keyboard.press("Enter");
}

/**
 * Answers the seeded "“Since” e “for”" drill, the first one wrong, and checks the feedback. As in a
 * lesson, a pick isn't graded until Check, so a mis-tap can still change.
 */
async function answerDrill(page: Page) {
  await expect(page.getByText("I've worked at the bank ___ 2019.")).toBeVisible();
  await page.keyboard.press("1");
  await page.keyboard.press("2");

  await expect(
    page.getByRole("status").filter({ has: page.getByText("Not quite", { exact: true }) }),
  ).toHaveCount(0);

  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("status").filter({ has: page.getByText("Not quite", { exact: true }) }),
  ).toContainText("2019 é quando começou, então é since.");

  await page.keyboard.press("Enter");

  await expect(page.getByText("We've lived here ___ three years.")).toBeVisible();
  await page.getByRole("radio", { name: /for$/u }).click();
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Correct!/u })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await answerRightWithKeys(page, "2");
  await answerRightWithKeys(page, "2");
  await answerRightWithKeys(page, "1");
}

/**
 * "We noticed a pattern" for Marcos: Today's one notice, under his plan's status, to the rule and its
 * contrast, then the five-question drill (pick with number keys or taps, then Check, as a lesson
 * asks), the result with Brain Power, and the row gone from Today once practiced.
 */
test.describe("Language mistake pattern", () => {
  test("drills the pattern from Today and takes it off Today", async ({ browser }) => {
    await asPersona(browser, { persona: "language" }, async ({ page }) => {
      await page.goto("/today");

      // Today says only where the plan stands: the level lives in the Plan.
      await expect(page.getByText(/level A\d|preparation \d+%/u)).toHaveCount(0);

      // No word he mispronounced is due, so Today asks him to say none again.
      await expect(page.getByRole("region", { name: /words? again/u })).toHaveCount(0);
      await expectAccessibleScreen(page, "Today for a language goal");

      // The pattern is Today's one notice, with the way to practice it.
      const note = page.getByRole("region", { name: "We noticed a pattern" });
      await expect(note).toContainText(PATTERN_TITLE);
      await note.getByRole("link", { name: "Practice it" }).click();

      await expect(page).toHaveURL(/\/pattern\/[\da-f-]{36}$/u);

      // The pattern is the title, under what it is.
      await expect(page.getByRole("heading", { level: 1, name: "“Since” e “for”" })).toBeVisible();

      await expect(
        page.getByRole("main").getByText("We noticed a pattern", { exact: true }),
      ).toBeVisible();

      await expect(page.getByText("I've lived here since 2020.")).toBeVisible();
      await expect(page.getByText("for 6 years")).toBeVisible();
      await expectAccessibleScreen(page, "a mistake pattern");

      const practice = page.getByRole("button", { name: "Practice this · 3 min" });
      expect((await practice.boundingBox())!.height).toBeGreaterThanOrEqual(44);

      await page.keyboard.press("Enter");
      await answerDrill(page);

      await expect(page.getByRole("heading", { level: 1, name: "4 of 5 right" })).toBeVisible();

      await expect(
        page
          .getByRole("main")
          .getByRole("listitem")
          .filter({ hasText: /^\+\d+ Brain Power$/u }),
      ).toBeVisible();

      await page.getByRole("link", { name: "Done" }).click();

      await expect(page).toHaveURL(/\/today$/u);
      await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
      await expect(page.getByRole("region", { name: "We noticed a pattern" })).toHaveCount(0);
    });
  });

  test("a drill that completes the day's last mission says so at its end, with the +50", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      // Today builds the day; its missions are then the pattern alone.
      await page.goto("/today");

      const [session, pattern] = await Promise.all([
        prisma.studySession.findFirstOrThrow({
          orderBy: { createdAt: "desc" },
          where: { goalId: user.goalId, userId: user.id },
        }),
        prisma.mistakePattern.findFirstOrThrow({ where: { kind: "pattern", userId: user.id } }),
      ]);

      await saveMissions(session.id, [
        {
          anchor: { patternId: pattern.id },
          detail: { patternTitle: pattern.title },
          kind: "pattern",
          opens: { kind: "pattern", patternId: pattern.id },
          total: 1,
        },
      ]);

      await page.reload();
      await expect(page.getByRole("region", { name: "We noticed a pattern" })).toHaveCount(0);
      const missions = page.getByRole("region", { name: "Today's missions" });
      await expect(missions).toContainText("Practice a pattern");
      await missions.getByRole("link", { name: /Practice a pattern/u }).click();
      await page.getByRole("button", { name: "Practice this · 3 min" }).click();
      await answerDrill(page);

      const moment = page.getByRole("status").filter({ hasText: "Mission done:" });
      await expect(moment).toContainText("Mission done: Practice a pattern");
      await expect(moment.getByRole("button", { name: "+50 Brain Power" })).toBeVisible();

      await expect(page.getByRole("button", { exact: true, name: "+50 Brain Power" })).toHaveCount(
        1,
      );

      const event = await prisma.learningEvent.findFirstOrThrow({
        where: { lessonKind: "patternDrill", userId: user.id },
      });

      expect(event.brainPower).toBe(20);
      await expect(moment.getByRole("listitem")).toHaveText(`+${event.brainPower} Brain Power`);

      await expect(
        moment.getByText(`+${event.brainPower + 50} Brain Power`, { exact: true }),
      ).toHaveCount(0);

      await expect(moment).toContainText("from today's missions");
    });
  });

  test("keeps the pattern entry when another goal's earned bonus hides its mission row", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      await page.goto("/today");

      const [session, pattern, otherGoal] = await Promise.all([
        prisma.studySession.findFirstOrThrow({
          orderBy: { createdAt: "desc" },
          where: { goalId: user.goalId, userId: user.id },
        }),
        prisma.mistakePattern.findFirstOrThrow({ where: { kind: "pattern", userId: user.id } }),
        goalFixture({ userId: user.id }),
      ]);

      await saveMissions(session.id, [
        {
          anchor: { patternId: pattern.id },
          kind: "pattern",
          opens: { kind: "pattern", patternId: pattern.id },
          total: 1,
        },
      ]);

      await studySessionFixture({ fullMealAt: new Date(), goalId: otherGoal.id, userId: user.id });
      await page.reload();

      await expect(
        page.getByText("Today's +50 Brain Power is already earned.", { exact: true }),
      ).toBeVisible();

      const note = page.getByRole("region", { name: "We noticed a pattern" });
      await expect(note).toContainText(PATTERN_TITLE);
      await note.getByRole("link", { name: "Practice it" }).click();
      await expect(page).toHaveURL(new RegExp(`/pattern/${pattern.id}$`, "u"));
      await expect(page.getByRole("button", { name: "Practice this · 3 min" })).toBeVisible();
    });
  });

  test("a pattern that was only typos says so kindly, with nothing to practice", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      await prisma.mistakePattern.updateMany({
        data: { kind: "typos" },
        where: { userId: user.id },
      });

      await page.goto("/today");

      await page
        .getByRole("region", { name: "Just typos" })
        .getByRole("link", { name: "Open" })
        .click();

      await expect(page.getByRole("heading", { level: 1, name: "Just typos" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Practice this/u })).toHaveCount(0);

      // Reading the note is enough: it leaves Today.
      await page.getByRole("link", { name: "Done" }).click();
      await expect(page).toHaveURL(/\/today$/u);
      await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Just typos" })).toHaveCount(0);
    });
  });
});
