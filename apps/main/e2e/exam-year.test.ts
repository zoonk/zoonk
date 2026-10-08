import { type Browser } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { expect, test } from "./fixtures";

const ESTIMATE_NOTE =
  "Estimated from past editions. We'll tell you when the official notice is out.";

const citation = { passage: "", sourceId: "notice" };

/**
 * A learner preparing for ENEM in the year they named, while the stored notice is the 2098
 * edition's: the second and third Sundays of November. Returns their exam screen.
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

  const [context] = await Promise.all([
    browser.newContext({ storageState: user.storageState, timezoneId: "UTC" }),
    planFixture({ goalId: goal.id }),
  ]);

  const page = await context.newPage();
  await page.goto("/exam");

  return page;
}

test.describe("Exam year", () => {
  test("a year without its notice shows the days the exam usually falls on, as an estimate", async ({
    browser,
  }) => {
    const page = await openExamScreen({ browser, examYear: 2100 });

    // Its first day as a calendar page, the days in its line of facts, and the note that they're
    // estimated: the countdown says it too.
    await expect(page.getByRole("heading", { level: 1, name: "About the exam" })).toBeVisible();
    const facts = page.getByText(/November 14, 2100 and November 21, 2100/u);
    await expect(facts).toBeVisible();
    await expect(facts).toContainText(/About [\d,]+ days left/u);
    await expect(page.getByText(ESTIMATE_NOTE)).toBeVisible();

    await page.context().close();
  });
});
