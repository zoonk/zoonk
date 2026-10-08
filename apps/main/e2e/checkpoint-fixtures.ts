import { randomUUID } from "node:crypto";
import { type Page, expect } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";

const SKILL_NAMES = ["Discounts", "Ratios"];
const QUESTIONS_PER_SKILL = 3;

/** Seven of ten wins: with six questions, five right. */
export const CHECKPOINT_QUESTIONS = SKILL_NAMES.length * QUESTIONS_PER_SKILL;
export const CHECKPOINT_PASS_MARK = 5;

/** A mock keeps the exam's pace: three minutes a question. */
export const MOCK_MINUTES = 18;

/** A learner who owns the returned goal, studying it. */
export async function createGoalLearner() {
  const user = await createE2EUser(getBaseURL());
  const goal = await goalFixture({ timezone: "UTC", title: "Learn percentages", userId: user.id });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

  return { goal, user };
}

type CheckpointKind = "boss" | "weekly";

const DAYS_PER_WEEK = 7;
const STUDY_MINUTES = 30;

/** Enough lessons that the plan runs past next Monday. */
const PLANNED_LESSONS = 200;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A weekday's place in the week, from Monday (0) to Sunday (6), the week's last day. */
function weekPosition(weekday: number): number {
  return (weekday + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
}

/**
 * A plan the planner owns (a skill graph), whose weekly challenge falls on today: the plan started
 * a week ago and today is the week's last study day (the days after it rest), the day weekly
 * checkpoints go.
 */
function plannerPlan(skillId: string) {
  const today = toUTCMidnight(new Date());

  return {
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: [
        {
          area: null,
          lessons: PLANNED_LESSONS,
          name: "Percentages",
          phase: 0,
          skillId,
          weight: null,
        },
      ],
    },
    settings: {
      startDate: isoDay(new Date(today.getTime() - DAYS_PER_WEEK * MS_PER_DAY)),
      weekdayMinutes: Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
        weekPosition(weekday) <= weekPosition(today.getUTCDay()) ? STUDY_MINUTES : 0,
      ),
    },
  };
}

function toPayload({
  bossId,
  itemIds,
  kind,
  skillIds,
}: {
  bossId: string;
  itemIds: string[];
  kind: CheckpointKind;
  skillIds: string[];
}) {
  return {
    checkpoint: {
      kind,
      mock: kind === "weekly",
      passMark: CHECKPOINT_PASS_MARK,
      phase: 0,
      rematch: false,
      timeLimitMinutes: kind === "weekly" ? MOCK_MINUTES : null,
    },
    itemIds,
    planItemId: bossId,
    skillIds,
    title: kind === "weekly" ? "Mock exam 1" : "Basics boss",
  };
}

/**
 * Today's session holding one checkpoint: the first phase's boss (or the week's mock), with six
 * questions on two skills. The plan has a second phase, which a lost boss never locks.
 */
export async function createCheckpointLearner({
  kind = "boss",
  planned = false,
}: {
  kind?: CheckpointKind;
  /** The planner owns the plan and today holds the week's challenge, so it can move. */
  planned?: boolean;
} = {}) {
  const [{ goal, user }, skills] = await Promise.all([
    createGoalLearner(),
    Promise.all(SKILL_NAMES.map((name) => skillFixture({ name: `${name} ${randomUUID()}` }))),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    phases: [{ name: "Basics" }, { name: "Practice" }],
    ...(planned ? plannerPlan(skills[0]?.id ?? "") : {}),
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
      kind: kind === "weekly" ? "mock" : "boss",
      phase: 0,
      planId: plan.id,
      position: 0,
      scheduledFor: planned ? toUTCMidnight(new Date()) : null,
      titleSnapshot: "Basics boss",
    }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
  ]);

  const block = await studySessionBlockFixture({
    estimatedMinutes: 9,
    kind: "checkpoint",
    payload: toPayload({
      bossId: boss.id,
      itemIds: items.map((item) => item.id),
      kind,
      skillIds: skills.map((skill) => skill.id),
    }),
    position: 0,
    sessionId: session.id,
  });

  return { block, boss, plan, user };
}

const DAYS_TO_BOSS = 3;

/**
 * A phase checkpoint a few days away, with a lesson before it in its phase still to do and the next
 * phase after it: its intro says what it asks, and it opens on its day.
 */
export async function createUpcomingBoss() {
  const { goal, user } = await createGoalLearner();

  const plan = await planFixture({
    goalId: goal.id,
    phases: [{ name: "Basics" }, { name: "Practice" }],
  });

  const [boss] = await Promise.all([
    planItemFixture({
      kind: "boss",
      phase: 0,
      planId: plan.id,
      position: 1,
      scheduledFor: new Date(toUTCMidnight(new Date()).getTime() + DAYS_TO_BOSS * MS_PER_DAY),
      titleSnapshot: "",
    }),
    ...[0, 1].map((phase) =>
      planItemFixture({
        kind: "lesson",
        phase,
        planId: plan.id,
        position: phase * 2,
        titleSnapshot: phase === 0 ? "Discounts" : "Ratios",
      }),
    ),
  ]);

  return { boss, user };
}

const DUEL_VERDICTS = {
  "Right answer": "Right!",
  "Wrong answer": "Not this one. You'll see why at the end.",
} as const;

type DuelAnswer = keyof typeof DUEL_VERDICTS;

async function answerDuelQuestion(
  page: Page,
  { answer, keyboard, number }: { answer: DuelAnswer; keyboard: boolean; number: number },
) {
  const verdict = page.getByRole("status");
  await expect(page.getByText(`Question ${number} of ${CHECKPOINT_QUESTIONS}`)).toBeVisible();

  if (keyboard) {
    // The options keep their order: the right answer is the first.
    await page.keyboard.press(answer === "Right answer" ? "1" : "2");
    await expect(page.getByRole("radio", { name: answer })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Enter");
    await expect(verdict).toHaveText(DUEL_VERDICTS[answer]);
    await page.keyboard.press("Enter");
    return;
  }

  const isLast = number === CHECKPOINT_QUESTIONS;
  await page.getByRole("radio", { name: answer }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(verdict).toHaveText(DUEL_VERDICTS[answer]);
  await page.getByRole("button", { name: isLast ? "See how it went" : "Next" }).click();
}

/**
 * Answers every question of a running duel with the same option, reading each verdict before
 * moving on. By keyboard, a number key picks the option and Enter confirms, then moves on.
 */
export async function playDuel(
  page: Page,
  { answer = "Right answer", keyboard = false }: { answer?: DuelAnswer; keyboard?: boolean } = {},
) {
  for (let number = 1; number <= CHECKPOINT_QUESTIONS; number += 1) {
    // oxlint-disable-next-line no-await-in-loop -- A duel is answered one question at a time.
    await answerDuelQuestion(page, { answer, keyboard, number });
  }
}

/** When the first boss's star glasses had their ceremony; null until it showed. */
export async function starShownAt(userId: string) {
  const milestone = await prisma.milestone.findFirstOrThrow({
    where: { key: "star", kind: "glasses", userId },
  });

  return milestone.shownAt;
}
