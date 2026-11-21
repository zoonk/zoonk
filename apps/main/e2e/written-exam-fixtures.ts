import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";
import { CRITERIA, GRADING, STRUCTURE, task } from "./written-exam-blueprint";

export const SHORT_TITLE = "Internal and external control";
const SHORT_OTHER_TITLE = "Accountability of public agents";

/** The bank holds two 30-line prompts, and a start may admit either. */
export const SHORT_TITLES = new RegExp(`^(${SHORT_TITLE}|${SHORT_OTHER_TITLE})$`, "u");
const DAILY_EXTRA_WRITES = 6;
const DAYS_TO_EXAM = 23;

function promptContent({
  key,
  skillId,
  title,
}: {
  key: "long" | "short";
  skillId: string;
  title: string;
}) {
  const { lines, points } = task(key);

  return {
    context: "The Constitution gives Congress, with the Court of Accounts, the external control.",
    keyPoints: ["Name both controls"],
    question: "Write about the control of public administration.",
    rubric: CRITERIA.map(({ text }) => ({ criterion: text, description: text, points: null })),
    sampleOutline: "One paragraph per aspect.",
    writing: {
      aspects: CRITERIA.map(({ id, points: value, text }) => ({
        criterionId: id,
        description: text,
        points: value,
      })),
      assessedSkillIds: [skillId],
      charactersPerLine: 55,
      criteria: CRITERIA.map(({ id, points: value, text }) => ({ id, name: text, points: value })),
      grading: GRADING,
      keySource: "practiceKey",
      lines,
      minimumWords: 5,
      partMinimum: { max: 100, minimum: { unit: "points", value: 50 } },
      points,
      taskKey: key,
      title,
      unit: "answer",
    },
  };
}

/**
 * A CGU-like exam learner with a written-question block today, the question's prompt in the bank
 * and, with `prompts: false`, none, so its start has to write one.
 */
export async function createWrittenExamDay({
  plus = false,
  prompts = true,
  taskKey = "short",
}: { plus?: boolean; prompts?: boolean; taskKey?: string } = {}) {
  const [user, skill, blueprint] = await Promise.all([
    createE2EUser(getBaseURL()),
    skillFixture({ name: `Write answers about public control ${randomUUID()}` }),
    examBlueprintFixture({ identityKey: `cgu-${randomUUID()}`, name: "CGU", structure: STRUCTURE }),
  ]);

  const goal = await goalFixture({
    dailyMinutes: 240,
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: new Date(toUTCMidnight(new Date()).getTime() + DAYS_TO_EXAM * MS_PER_DAY),
    timezone: "UTC",
    title: "Pass the CGU exam",
    userId: user.id,
  });

  const graph = {
    phases: [{ milestone: null, name: "Basics" }],
    skills: [
      {
        area: "Written test",
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      },
    ],
  };

  const items = prompts
    ? await Promise.all(
        [
          { key: "short" as const, title: SHORT_TITLE },
          { key: "short" as const, title: SHORT_OTHER_TITLE },
          { key: "long" as const, title: "Risk-based audit planning" },
        ].map(({ key, title }) =>
          itemFixture({
            content: promptContent({ key, skillId: skill.id, title }),
            examBlueprintId: blueprint.id,
            format: "essay",
            skillId: skill.id,
          }),
        ),
      )
    : [];

  const [session, plan] = await Promise.all([
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    planFixture({ goalId: goal.id, graph }),
    learningProfileFixture({ activeGoalId: goal.id, buddyKind: "zu", userId: user.id }),
    plus &&
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
  ]);

  // A plan with a studied lesson is past its build, so Today shows the day.
  await planItemFixture({ kind: "lesson", planId: plan.id, skillId: skill.id, status: "done" });

  const block = await studySessionBlockFixture({
    estimatedMinutes: 70,
    kind: "produce",
    payload: {
      itemIds: [],
      skillIds: [],
      title: "The 30-line question",
      writing: { admissionId: null, draft: null, taskKey, unit: "answer" },
      writingPacing: "estimated",
    },
    position: 0,
    sessionId: session.id,
    status: "pending",
  });

  return {
    blockId: block.id,
    goalId: goal.id,
    items,
    sessionId: session.id,
    skillId: skill.id,
    user,
  };
}

const GRADED_TEXT =
  "The Constitution of 1988 establish two kinds of control. Internal control is done by each branch.";

const ERROR_QUOTE = "The Constitution of 1988 establish two kinds of control.";

/** The day's first answer, graded with points, admitted and saved as the grader would. */
export async function addGradedAnswer({
  blockId,
  itemId,
  sessionId,
  userId,
}: {
  blockId: string;
  itemId: string;
  sessionId: string;
  userId: string;
}) {
  const admissionId = randomUUID();
  const today = toUTCMidnight(new Date());
  const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });

  const payload = {
    ...(isJsonObject(block.payload) ? block.payload : {}),
    itemIds: [itemId],
    writing: { admissionId, draft: null, taskKey: "short", unit: "answer" },
  };

  const grade = {
    content: { high: 19, low: 17 },
    criteria: CRITERIA.map(({ id, text }) => ({
      comment: `Comment on ${text}.`,
      id,
      level: "partial",
      name: text,
      quote: null,
    })),
    decimals: 0,
    deduction: { high: 0.4, low: 0.3 },
    errors: [
      {
        correction: "The Constitution of 1988 establishes two kinds of control.",
        kind: "grammar",
        quote: ERROR_QUOTE,
        start: 0,
      },
    ],
    ignoredFrom: null,
    kind: "points",
    max: 30,
    nextStep: {
      criterionId: "a2",
      example: null,
      quote: null,
      text: "Name two powers of the Court.",
    },
    progress: null,
    rows: CRITERIA.map(({ id, points }) => ({ earned: points / 2, id, max: points })),
    total: { high: 18.7, low: 16.6 },
    zeroReason: null,
  };

  await Promise.all([
    prisma.studySessionBlock.update({
      data: { payload, startedAt: new Date(), status: "active" },
      where: { id: blockId },
    }),
    prisma.writingAdmission.create({
      data: { extra: false, id: admissionId, itemIds: [itemId], localDate: today, userId },
    }),
  ]);

  const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });

  await prisma.attempt.create({
    data: {
      answer: {
        conditions: {
          admissionId,
          estimatedLines: 2,
          origin: "block",
          timed: false,
          version: "firstDraft",
        },
        grade,
        text: GRADED_TEXT,
      },
      durationMs: 600_000,
      hour: 12,
      isCorrect: true,
      itemId,
      localDate: today,
      skillId: item.skillId,
      studySessionId: sessionId,
      userId,
      weekday: today.getUTCDay(),
    },
  });

  return { text: GRADED_TEXT };
}

/** A drill on the same task after the answer, as a lesson of a written skill leaves one. */
export async function addWritingDrill({
  sessionId,
  skillId,
}: {
  sessionId: string;
  skillId: string;
}): Promise<string> {
  const block = await studySessionBlockFixture({
    estimatedMinutes: 8,
    kind: "produce",
    payload: {
      itemIds: [],
      skillIds: [skillId],
      title: "The 30-line question",
      writing: { admissionId: null, draft: null, taskKey: "short", unit: "drill" },
      writingPacing: "estimated",
    },
    position: 1,
    sessionId,
    status: "pending",
  });

  return block.id;
}

/** Every extra grade of the day used, as six rewrites or "Write now" starts would. */
export async function useTodayExtraGrades(userId: string) {
  const today = toUTCMidnight(new Date());

  await prisma.writingAdmission.createMany({
    data: Array.from({ length: DAILY_EXTRA_WRITES }, () => ({
      extra: true,
      id: randomUUID(),
      itemIds: [],
      localDate: today,
      userId,
    })),
  });
}
