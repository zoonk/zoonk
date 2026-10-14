import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  choiceItemContent,
  itemFixture,
  itemSetFixture,
  skillFixture,
} from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { expect, test } from "./fixtures";
import { openAs, pickAndCheck } from "./study-day";

/** A passage long enough to fold on a phone once just read. */
const PASSAGE = {
  source: "Adapted from a town newsletter.",
  text: [
    "The town's library opened on Sundays last year, after a petition signed by more than two thousand residents.",
    "Visits rose by a third, mostly families who could not come on weekdays, and the children's section lent twice as many books as before.",
    "The council paid for the extra hours by closing the reading room on Monday mornings, when it was nearly empty.",
    "Staff say the Sunday crowd also asks for help with forms and job applications, which they hadn't planned for.",
  ].join(" "),
  title: "The Sunday library",
};

/** An exam learner whose day is one practice block asking a passage's two questions. */
async function createPassageDay() {
  const [user, skill, lesson, set] = await Promise.all([
    createE2EUser(getBaseURL()),
    skillFixture({ name: `Read for detail ${randomUUID()}` }),
    libraryLessonFixture({ title: "Reading for detail" }),
    itemSetFixture({ content: PASSAGE }),
  ]);

  const goal = await goalFixture({ kind: "exam", timezone: "UTC", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const [items, session] = await Promise.all([
    Promise.all(
      ["Opening: when did the library start opening?", "Visitors: who came most?"].map(
        (question, setPosition) =>
          itemFixture({
            content: choiceItemContent(question),
            setId: set.id,
            setPosition,
            skillId: skill.id,
          }),
      ),
    ),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: plan.id, position: 0 }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  await studySessionBlockFixture({
    estimatedMinutes: 3,
    kind: "practice",
    payload: { itemIds: items.map((item) => item.id), skillIds: [skill.id] },
    position: 0,
    sessionId: session.id,
  });

  return { itemIds: items.map((item) => item.id), user };
}

test.describe("Question sets in practice", () => {
  test("shows a passage above each of its questions, folded on a phone once just read", async ({
    browser,
  }) => {
    const { itemIds, user } = await createPassageDay();
    const page = await openAs(browser, user);
    const feedback = page.getByRole("region", { name: "Answer feedback" });
    const passage = page.getByRole("region", { name: PASSAGE.title });
    await page.goto("/session");
    await page.getByRole("button", { name: /^Start/u }).click();

    // The first question shows the whole passage, where it's from, and its place in the set.
    await expect(page.getByRole("heading", { name: /^Opening/u })).toBeVisible();
    await expect(passage.getByText("Question 1 of 2 on this text")).toBeVisible();
    await expect(passage.getByText(/mostly families who could not come/u)).toBeVisible();
    await expect(passage.getByText(PASSAGE.source)).toBeVisible();
    await expect(passage.getByRole("button", { name: "Read it all again" })).toBeHidden();

    // On a wide screen the passage sits beside its question, in the task's aside.
    const opening = page.getByRole("heading", { name: /^Opening/u });

    const [wideText, wideQuestion] = await Promise.all([
      passage.boundingBox(),
      opening.boundingBox(),
    ]);

    expect(wideText?.x ?? 0).toBeGreaterThan((wideQuestion?.x ?? 0) + (wideQuestion?.width ?? 0));

    await pickAndCheck(page, "Right answer");
    await expect(feedback.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();

    // The next one shows the passage whole on a wide screen; a phone folds the passage just read
    // and opens it again on request.
    await expect(page.getByRole("heading", { name: /^Visitors/u })).toBeVisible();
    await expect(passage.getByText("Question 2 of 2 on this text")).toBeVisible();
    const readAgain = passage.getByRole("button", { name: "Read it all again" });
    await expect(readAgain).toBeHidden();
    await expect(passage.getByText(/which they hadn't planned for/u)).toBeVisible();

    await page.setViewportSize({ height: 844, width: 390 });
    await expect(readAgain).toHaveAttribute("aria-expanded", "false");

    // On a phone it's above the question, in the column.
    const visitors = page.getByRole("heading", { name: /^Visitors/u });

    const [phoneText, phoneQuestion] = await Promise.all([
      passage.boundingBox(),
      visitors.boundingBox(),
    ]);

    expect(phoneText?.y ?? 0).toBeLessThan(phoneQuestion?.y ?? 0);
    await readAgain.click();

    await expect(passage.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await pickAndCheck(page, "Wrong answer");
    await expect(feedback.getByText("Not quite")).toBeVisible();

    const attempts = await prisma.attempt.findMany({ where: { itemId: { in: itemIds } } });

    expect(
      attempts.map((attempt) => attempt.isCorrect).toSorted((a, b) => Number(a) - Number(b)),
    ).toStrictEqual([false, true]);

    await page.context().close();
  });
});
