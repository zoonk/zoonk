import { randomUUID } from "node:crypto";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionBlockFixture } from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { createStudyDay, openAs } from "./study-day";

const MISSED_QUESTION = "Which price is 20% off 50?";

/** A saved day the plan led with the learner's mistakes and a lesson they keep missing. */
async function createMistakesDay() {
  const day = await createStudyDay({ reviewDone: true });
  const skill = await skillFixture({ name: `Percent off ${randomUUID()}` });

  const item = await itemFixture({
    content: choiceItemContent(MISSED_QUESTION),
    skillId: skill.id,
  });

  const mistake = await mistakeFixture({
    createdAt: new Date(Date.now() - MS_PER_DAY * 2),
    itemId: item.id,
    skillId: skill.id,
    snapshot: { answer: "Wrong answer", question: MISSED_QUESTION },
    userId: day.user.id,
  });

  await Promise.all([
    studySessionBlockFixture({
      estimatedMinutes: 1,
      kind: "practice",
      payload: { mistakeIds: [mistake.id], skillIds: [skill.id] },
      position: 3,
      sessionId: day.session.id,
    }),
    studySessionBlockFixture({
      estimatedMinutes: 3,
      kind: "learn",
      lessonId: day.lesson.id,
      payload: { returning: "again", skillIds: [skill.id], title: "Percent off, again" },
      position: 4,
      sessionId: day.session.id,
    }),
  ]);

  return day;
}

test.describe("Today's mistakes", () => {
  test("a day's mistakes row opens their practice and ends back on Today with the row done", async ({
    browser,
  }) => {
    const { user } = await createMistakesDay();
    const page = await openAs(browser, user);
    await page.goto("/today");

    const mistakesRow = page.getByRole("listitem").filter({ hasText: "Fix 1 mistake" });
    await expect(mistakesRow.getByText("Questions you missed before")).toBeVisible();

    const returningRow = page.getByRole("listitem").filter({ hasText: "Percent off, again" });
    await expect(returningRow.getByText("Again: you keep missing this")).toBeVisible();

    await mistakesRow.getByRole("button", { name: "Fix 1 mistake" }).click();
    await expect(page.getByRole("heading", { name: MISSED_QUESTION })).toBeVisible();
    await page.getByRole("radio", { name: "Right answer" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();

    await expect(
      page.getByRole("region", { name: "Answer feedback" }).getByText("Mistake fixed", {
        exact: false,
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect(page.getByRole("heading", { name: "Practice done" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Practice again" })).toHaveCount(0);

    await page.getByRole("link", { name: "Done" }).click();
    await expect(page).toHaveURL(/\/today$/u);
    await expect(page.getByRole("listitem").filter({ hasText: "Fix 1 mistake, done" })).toBeVisible();

    await page.context().close();
  });
});
