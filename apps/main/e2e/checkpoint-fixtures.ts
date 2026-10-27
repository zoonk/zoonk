import { randomUUID } from "node:crypto";
import { type Page, expect } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";

const SKILL_NAMES = ["Discounts", "Ratios"];
const QUESTIONS_PER_SKILL = 3;

/** Seven of ten wins: with six questions, five right. */
export const CHECKPOINT_QUESTIONS = SKILL_NAMES.length * QUESTIONS_PER_SKILL;
const CHECKPOINT_PASS_MARK = 5;

/** A learner who owns the returned goal, studying it. */
export async function createGoalLearner() {
  const user = await createE2EUser(getBaseURL());
  const goal = await goalFixture({ timezone: "UTC", title: "Learn percentages", userId: user.id });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

  return { goal, user };
}

const BOSS_TITLE = "Basics boss";

/** A checkpoint takes about a minute and a half a question. */
const CHECKPOINT_MINUTES = 9;

/**
 * Today's session holding one checkpoint: the first phase's boss, with six questions on two skills.
 * The plan has a second phase after it.
 */
export async function createCheckpointLearner() {
  const [{ goal, user }, skills] = await Promise.all([
    createGoalLearner(),
    Promise.all(SKILL_NAMES.map((name) => skillFixture({ name: `${name} ${randomUUID()}` }))),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    phases: [{ name: "Basics" }, { name: "Practice" }],
  });

  const [items, boss, session] = await Promise.all([
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
    planItemFixture({
      kind: "boss",
      phase: 0,
      planId: plan.id,
      position: 0,
      titleSnapshot: BOSS_TITLE,
    }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
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

/**
 * Answers a duel's question right by keyboard: its number key picks the right answer (the options
 * keep their order, so it's the first), Enter confirms and, once the verdict shows, moves on. The
 * answer that reaches the pass mark breaks the Trickster's shield, which his line adds to the
 * verdict (`checkpoints.test.ts`).
 */
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

/** Wins a running boss duel from `createCheckpointLearner` by keyboard, ending at its pass mark. */
export async function playDuel(page: Page) {
  for (let number = 1; number <= CHECKPOINT_PASS_MARK; number += 1) {
    // oxlint-disable-next-line no-await-in-loop -- A duel is answered one question at a time.
    await answerDuelQuestion(page, number);
  }
}
