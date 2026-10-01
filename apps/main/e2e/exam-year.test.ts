import { type Browser } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { expect, test } from "./fixtures";
import { expectMode, showInMode } from "./learn-personas";

const ESTIMATE_NOTE = "Estimated from past editions until the official notice is out.";
const citation = { passage: "", sourceId: "notice" };

/**
 * A learner preparing for ENEM in the year they named, while the stored notice is the 2098
 * edition's: the second and third Sundays of November. Returns their exam screen in Focus.
 */
async function openExamScreen({ browser, examYear }: { browser: Browser; examYear: number }) {
  const [user, blueprint] = await Promise.all([
    createE2EUser(getBaseURL()),
    examBlueprintFixture({
      edition: {
        citations: [],
        dates: [
          { citation, date: "2098-11-09", kind: "exam", label: "Day 1", startTime: null },
          { citation, date: "2098-11-16", kind: "exam", label: "Day 2", startTime: null },
        ],
        noticeUrl: null,
        questionCount: 180,
        sourceHash: null,
        timeZone: "America/Sao_Paulo",
        year: 2098,
      },
      name: "ENEM",
    }),
  ]);

  const goal = await goalFixture({
    details: { examName: "ENEM", examYear },
    examBlueprintId: blueprint.id,
    kind: "exam",
    prompt: `quero me preparar para o enem de ${examYear}`,
    timezone: "UTC",
    title: `ENEM ${examYear}`,
    userId: user.id,
  });

  const context = await browser.newContext({ storageState: user.storageState, timezoneId: "UTC" });

  await Promise.all([
    planFixture({ goalId: goal.id }),
    showInMode(context, { mode: "focus", userId: user.id }),
  ]);

  const page = await context.newPage();
  await page.goto("/exam");
  await expectMode(page, "focus");

  return page;
}

test.describe("Exam year", () => {
  test("a year without its notice shows the days the exam usually falls on, as an estimate", async ({
    browser,
  }) => {
    const page = await openExamScreen({ browser, examYear: 2100 });

    await expect(page.getByText("Day 1: Sunday, November 14, 2100")).toBeVisible();
    await expect(page.getByText("Day 2: Sunday, November 21, 2100")).toBeVisible();
    await expect(page.getByText(ESTIMATE_NOTE)).toBeVisible();

    await page.context().close();
  });
});
