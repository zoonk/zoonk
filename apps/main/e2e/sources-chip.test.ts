import { randomUUID } from "node:crypto";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

/**
 * Questions built from a public document (a law, an exam notice) show a dated "Sources" chip:
 * when the document was last checked, and a tap opens its title, publisher and link. The chip is
 * the same on lesson screens, which the player's tests cover.
 */

const LAW_URL = "https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm";
const CHIP = "Sources · Checked Sep 2026";

function lawFixture() {
  return sourceFixture({
    fetchedAt: new Date("2026-09-12T10:00:00.000Z"),
    publisher: "Planalto",
    title: `Law 8,112 ${randomUUID()}`,
    url: LAW_URL,
  });
}

async function createExamLearner() {
  const user = await createE2EUser(getBaseURL());
  const goal = await goalFixture({ kind: "exam", timezone: "UTC", userId: user.id });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

  return { goal, user };
}

/** Today's session holding one practice question that quotes an article of the law. */
async function createSourcedPractice() {
  const [{ goal, user }, skill, law, lesson] = await Promise.all([
    createExamLearner(),
    skillFixture({ name: `Probation ${randomUUID()}` }),
    lawFixture(),
    libraryLessonFixture({ title: "Probation" }),
  ]);

  const plan = await planFixture({ goalId: goal.id });

  const [drill, session] = await Promise.all([
    itemFixture({
      content: choiceItemContent("How long does a public servant's probation last?"),
      skillId: skill.id,
      sourceCitation: "Law 8,112, Art. 20",
      sourceId: law.id,
    }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: plan.id, position: 0 }),
  ]);

  await studySessionBlockFixture({
    estimatedMinutes: 2,
    kind: "practice",
    payload: { itemIds: [drill.id], skillIds: [skill.id] },
    position: 0,
    sessionId: session.id,
  });

  return { law, user };
}

test.describe("Sources chip", () => {
  test("a practice question's feedback shows the article and its dated source", async ({
    browser,
  }) => {
    const { law, user } = await createSourcedPractice();
    const page = await openAs(browser, user);
    const feedback = page.getByRole("region", { name: "Answer feedback" });

    await page.goto("/session");
    await page.getByRole("button", { name: /^Start/u }).click();

    await expect(
      page.getByRole("heading", { name: "How long does a public servant's probation last?" }),
    ).toBeVisible();

    await page.keyboard.press("1");
    await expect(feedback.getByText("Correct!")).toBeVisible();
    await expect(feedback.getByText("Law 8,112, Art. 20")).toBeVisible();
    await feedback.getByRole("button", { name: CHIP }).click();

    const source = page.getByRole("dialog");
    await expect(source.getByRole("heading", { name: law.title })).toBeVisible();

    await expect(source.getByRole("link", { name: "Open the source" })).toHaveAttribute(
      "href",
      LAW_URL,
    );

    await page.context().close();
  });
});
