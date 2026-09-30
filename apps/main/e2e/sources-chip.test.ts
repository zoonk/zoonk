import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { expect, test } from "./fixtures";
import { MODES, type Mode } from "./learn-personas";
import { openAs } from "./study-day";

/**
 * Screens and questions built from a public document (a law, an exam notice) show a dated
 * "Sources" chip: when the document was last checked, and a tap opens its title, publisher and
 * link. The chip is the same in Focus and Fun.
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

async function learnerIn(mode: Mode, goalId?: string) {
  const user = await createE2EUser(getBaseURL());

  const goal = goalId
    ? null
    : await goalFixture({ kind: "exam", timezone: "UTC", userId: user.id });

  await learningProfileFixture({
    activeGoalId: goalId ?? goal?.id,
    experienceMode: mode,
    userId: user.id,
    ...(mode === "fun" ? { buddyKind: "zu" } : {}),
  });

  return { goal, user };
}

/** Today's session holding one practice question that quotes an article of the law. */
async function createSourcedPractice(mode: Mode) {
  const [{ goal, user }, skill, law, lesson] = await Promise.all([
    learnerIn(mode),
    skillFixture({ name: `Probation ${randomUUID()}` }),
    lawFixture(),
    libraryLessonFixture({ title: "Probation" }),
  ]);

  const plan = await planFixture({ goalId: goal?.id ?? "" });

  const [drill, session] = await Promise.all([
    itemFixture({
      content: choiceItemContent("How long does a public servant's probation last?"),
      skillId: skill.id,
      sourceCitation: "Law 8,112, Art. 20",
      sourceId: law.id,
    }),
    studySessionFixture({ goalId: goal?.id, userId: user.id }),
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

for (const mode of MODES) {
  test.describe(`Sources chip in ${mode}`, () => {
    test("a lesson screen built from a law says when it was checked and opens it", async ({
      browser,
    }) => {
      const [{ user }, { lesson, steps }, law] = await Promise.all([
        learnerIn(mode),
        playableLessonFixture({ steps: ["explanation", "check"] }),
        lawFixture(),
      ]);

      await prisma.step.update({ data: { sourceId: law.id }, where: { id: steps[0]?.id } });

      const page = await openAs(browser, user);
      await page.goto(`/learn/${lesson.id}`);

      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
      await page.getByRole("button", { name: CHIP }).click();

      const source = page.getByRole("dialog");
      await expect(source.getByRole("heading", { name: law.title })).toBeVisible();
      await expect(source.getByText("Planalto · Checked Sep 12, 2026")).toBeVisible();

      await expect(source.getByRole("link", { name: "Open the source" })).toHaveAttribute(
        "href",
        LAW_URL,
      );

      // Closing it leaves the lesson where it was.
      await page.keyboard.press("Escape");
      await expect(source).toBeHidden();
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

      await page.context().close();
    });

    test("a practice question's feedback shows the article and its dated source", async ({
      browser,
    }) => {
      const { law, user } = await createSourcedPractice(mode);
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
}
