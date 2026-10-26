import { randomUUID } from "node:crypto";
import { type Page, expect } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { interleave } from "@zoonk/utils/interleave";

const SKILL_NAMES = ["Discounts", "Ratios"];
const QUESTIONS_PER_SKILL = 3;

/** Seven of ten wins: with six questions, five right. */
export const CHECKPOINT_QUESTIONS = SKILL_NAMES.length * QUESTIONS_PER_SKILL;
export const CHECKPOINT_PASS_MARK = 5;

/** A mock keeps the exam's pace: three minutes a question. */
const MOCK_MINUTES = 18;

/** A learner who owns the returned goal, studying it. */
export async function createGoalLearner() {
  const user = await createE2EUser(getBaseURL());
  const goal = await goalFixture({ timezone: "UTC", title: "Learn percentages", userId: user.id });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

  return { goal, user };
}

type CheckpointKind = "boss" | "weekly";

/** The week's challenge: an exam's mock, or a learn goal's own mixed checkpoint. */
type WeeklyKind = "checkpoint" | "mock";

const TITLES = {
  boss: "Basics boss",
  checkpoint: "Weekly challenge",
  mock: "Mock exam 1",
} as const;

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

/**
 * A boss planned while the bank held fewer than five questions for it: ten, seven right to win,
 * once Start has the rest written.
 */
const THIN_CHECKPOINT = { minutes: 15, passMark: 7, questions: 10 } as const;

/** A checkpoint takes about a minute and a half a question. */
const CHECKPOINT_MINUTES = 9;

/** Questions the bank holds per skill when the checkpoint is thin, and what writing adds. */
const THIN_QUESTIONS_PER_SKILL = 1;
const WRITTEN_PER_SKILL = 4;

function toPayload({
  bossId,
  itemIds,
  itemKind,
  kind,
  passMark,
  skillIds,
}: {
  bossId: string;
  itemIds: string[];
  itemKind: keyof typeof TITLES;
  kind: CheckpointKind;
  passMark: number;
  skillIds: string[];
}) {
  return {
    checkpoint: {
      kind,
      mock: itemKind === "mock",
      passMark,
      phase: 0,
      rematch: false,
      timeLimitMinutes: itemKind === "mock" ? MOCK_MINUTES : null,
    },
    itemIds,
    planItemId: bossId,
    skillIds,
    title: TITLES[itemKind],
  };
}

/**
 * Today's session holding one checkpoint: the first phase's boss (or the week's mock), with six
 * questions on two skills. The plan has a second phase, which a lost boss never locks. A `thin`
 * boss was planned while the bank held one question per skill: `writeQuestions` stands in for
 * the run that writes the rest.
 */
export async function createCheckpointLearner({
  kind = "boss",
  planned = false,
  reinforcementLessons = 0,
  thin = false,
  weeklyKind = "mock",
}: {
  kind?: CheckpointKind;
  /** The planner owns the plan and today holds the week's challenge, so it can move. */
  planned?: boolean;
  /** Available lessons for a loss; two also interleave the missed skills. */
  reinforcementLessons?: number;
  thin?: boolean;
  /**
   * What the week's challenge is. A mock needs the time the plan saved for it, which this plan
   * has none of, so a move to Monday needs a learn goal's own checkpoint.
   */
  weeklyKind?: WeeklyKind;
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

  const perSkill = thin ? THIN_QUESTIONS_PER_SKILL : QUESTIONS_PER_SKILL;
  const itemKind = kind === "weekly" ? weeklyKind : "boss";

  const [items, boss, session] = await Promise.all([
    Promise.all(
      skills.flatMap((skill, skillIndex) =>
        Array.from({ length: perSkill }, (_, index) =>
          itemFixture({
            content: choiceItemContent(`${SKILL_NAMES[skillIndex]} question ${index + 1}?`),
            skillId: skill.id,
          }),
        ),
      ),
    ),
    planItemFixture({
      kind: itemKind,
      phase: 0,
      planId: plan.id,
      position: 0,
      scheduledFor: planned ? toUTCMidnight(new Date()) : null,
      titleSnapshot: "Basics boss",
    }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
  ]);

  await Promise.all(
    skills.slice(0, reinforcementLessons).map(async (skill) => {
      const lesson = await libraryLessonFixture();
      await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });
    }),
  );

  const orderedItems =
    reinforcementLessons === 2
      ? interleave(skills.map((skill) => items.filter((item) => item.skillId === skill.id)))
      : items;

  const block = await studySessionBlockFixture({
    estimatedMinutes: thin ? THIN_CHECKPOINT.minutes : CHECKPOINT_MINUTES,
    kind: "checkpoint",
    payload: toPayload({
      bossId: boss.id,
      itemIds: orderedItems.map((item) => item.id),
      itemKind,
      kind,
      passMark: thin ? THIN_CHECKPOINT.passMark : CHECKPOINT_PASS_MARK,
      skillIds: skills.map((skill) => skill.id),
    }),
    position: 0,
    sessionId: session.id,
  });

  // The run's calls write each skill's questions; `skillCount` of them succeed.
  const writeQuestions = (skillCount = skills.length) =>
    Promise.all(
      skills
        .slice(0, skillCount)
        .flatMap((skill, skillIndex) =>
          Array.from({ length: WRITTEN_PER_SKILL }, (_, index) =>
            itemFixture({
              content: choiceItemContent(
                `${SKILL_NAMES[skillIndex]} written question ${index + 1}?`,
              ),
              skillId: skill.id,
            }),
          ),
        ),
    );

  return { block, boss, items: orderedItems, plan, user, writeQuestions };
}

/** A task's main action is 44px tall wherever its bar puts it. */
const MAIN_ACTION_PX = 44;

const DUEL_VERDICTS = {
  "Right answer": "Correct!",
  "Wrong answer": /^Not quite\s*You'll see why at the end\.$/u,
} as const;

/**
 * The answer that decides a boss's duel ends it: the right one that breaks the Trickster's shield,
 * or the miss after which it can't break anymore (their lines: `checkpoints.test.ts`).
 */
const DECIDING_VERDICTS = { "Right answer": /^Correct!/u, "Wrong answer": /^Not quite/u } as const;

type DuelAnswer = keyof typeof DUEL_VERDICTS;

async function answerDuelQuestion(
  page: Page,
  {
    answer,
    isLast,
    keyboard,
    number,
    decides,
    total,
  }: {
    answer: DuelAnswer;
    decides: boolean;
    isLast: boolean;
    keyboard: boolean;
    number: number;
    total: number;
  },
) {
  const verdict = page.getByRole("status");
  const said = decides ? DECIDING_VERDICTS[answer] : DUEL_VERDICTS[answer];

  await expect(
    page.getByRole("progressbar", { name: `Question ${number} of ${total}` }),
  ).toBeAttached();

  if (keyboard) {
    // The options keep their order: the right answer is the first.
    await page.keyboard.press(answer === "Right answer" ? "1" : "2");
    await expect(page.getByRole("radio", { name: answer })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Enter");
    await expect(verdict).toHaveText(said);
    await page.keyboard.press("Enter");
    return;
  }

  await page.getByRole("radio", { name: answer }).click();

  // The main action keeps its 44px however the bar lays it out.
  const confirm = page.getByRole("button", { name: "Confirm" });
  const confirmBox = await confirm.boundingBox();
  expect(confirmBox?.height).toBe(MAIN_ACTION_PX);
  await confirm.click();
  await expect(verdict).toHaveText(said);
  await page.getByRole("button", { name: isLast ? "See how it went" : "Next" }).click();
}

/** The question that decides a boss's duel answered all the same way, or null without its pass mark. */
function getDecidingQuestion({
  answer,
  passMark,
  total,
}: {
  answer: DuelAnswer;
  passMark?: number;
  total: number;
}): number | null {
  if (passMark === undefined) {
    return null;
  }

  return answer === "Right answer" ? passMark : total - passMark + 1;
}

/**
 * Answers a running duel's questions with the same option, reading each verdict before moving on.
 * By keyboard, a number key picks the option and Enter confirms, then moves on. `from` skips the
 * questions a test answered itself, the same way; `total` is the duel's length (the fixtures'
 * six). A boss's duel ends once it's decided: with its `passMark`, right answers end it when they
 * reach it (his shield breaks), and misses once too few questions are left to reach it; without,
 * every question is asked. `until` stops after that question, for a test to answer the rest itself.
 */
export async function playDuel(
  page: Page,
  {
    answer = "Right answer",
    from = 1,
    keyboard = false,
    passMark,
    total = CHECKPOINT_QUESTIONS,
    until,
  }: {
    answer?: DuelAnswer;
    from?: number;
    keyboard?: boolean;
    passMark?: number;
    total?: number;
    until?: number;
  } = {},
) {
  const decidedAt = getDecidingQuestion({ answer, passMark, total });
  const end = decidedAt ?? total;

  for (let number = from; number <= (until ?? end); number += 1) {
    // oxlint-disable-next-line no-await-in-loop -- A duel is answered one question at a time.
    await answerDuelQuestion(page, {
      answer,
      decides: number === decidedAt,
      isLast: number === end,
      keyboard,
      number,
      total,
    });
  }
}
