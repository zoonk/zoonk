import { randomUUID } from "node:crypto";
import { type Page, expect } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";

const SKILL_NAMES = ["Discounts", "Ratios"];
const QUESTIONS_PER_SKILL = 3;

export const CHECKPOINT_QUESTIONS = SKILL_NAMES.length * QUESTIONS_PER_SKILL;
const CHECKPOINT_PASS_MARK = 5;

export async function createGoalLearner() {
  const user = await createE2EUser(getBaseURL());
  const goal = await goalFixture({ timezone: "UTC", title: "Learn percentages", userId: user.id });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

  return { goal, user };
}

const BOSS_TITLE = "Basics boss";

/** A checkpoint takes about a minute and a half a question. */
const CHECKPOINT_MINUTES = 9;

export async function createCheckpointLearner() {
  const [{ goal, user }, skills, lessons] = await Promise.all([
    createGoalLearner(),
    Promise.all(SKILL_NAMES.map((name) => skillFixture({ name: `${name} ${randomUUID()}` }))),
    Promise.all(SKILL_NAMES.map((name) => libraryLessonFixture({ title: name }))),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    items: [
      ...lessons.map((lesson, index) => ({
        completedAt: new Date(),
        lessonId: lesson.id,
        skillId: skills[index]?.id ?? null,
        status: "done" as const,
        titleSnapshot: lesson.title,
      })),
      { kind: "boss" as const, titleSnapshot: BOSS_TITLE },
    ],
    phases: [{ name: "Basics" }, { name: "Practice" }],
  });

  const boss = plan.items.at(-1);

  if (!boss) {
    throw new Error("Expected the phase's boss");
  }

  const [items, session] = await Promise.all([
    Promise.all(
      skills.flatMap((skill, skillIndex) =>
        Array.from({ length: QUESTIONS_PER_SKILL }, (_, index) =>
          itemFixture({
            content: choiceItemContent(`${SKILL_NAMES[skillIndex]} question ${index + 1}?`),
            skillId: skill.id,
          }),
        ),
      ),
    ),
    studySessionFixture({ goalId: goal.id, planVersion: plan.version, userId: user.id }),
    ...lessons.map((lesson, index) =>
      lessonSkillFixture({ lessonId: lesson.id, skillId: skills[index]?.id ?? "" }),
    ),
  ]);

  const block = await studySessionBlockFixture({
    estimatedMinutes: CHECKPOINT_MINUTES,
    kind: "checkpoint",
    payload: {
      checkpoint: {
        kind: "boss",
        mock: false,
        passMark: CHECKPOINT_PASS_MARK,
        phase: 0,
        rematch: false,
        timeLimitMinutes: null,
      },
      itemIds: items.map((item) => item.id),
      planItemId: boss.id,
      skillIds: skills.map((skill) => skill.id),
      title: BOSS_TITLE,
    },
    position: 0,
    sessionId: session.id,
  });

  return { block, boss, user };
}

/** The options keep their order, so the right answer is the first. */
async function answerDuelQuestion(page: Page, number: number) {
  const decides = number === CHECKPOINT_PASS_MARK;

  await expect(
    page.getByRole("progressbar", { name: `Question ${number} of ${CHECKPOINT_QUESTIONS}` }),
  ).toBeAttached();

  await page.keyboard.press("1");

  await expect(page.getByRole("radio", { name: "Right answer" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText(decides ? /^Correct!/u : "Correct!");
  await page.keyboard.press("Enter");
}

export async function playDuel(page: Page) {
  for (let number = 1; number <= CHECKPOINT_PASS_MARK; number += 1) {
    // oxlint-disable-next-line no-await-in-loop -- A duel is answered one question at a time.
    await answerDuelQuestion(page, number);
  }
}
