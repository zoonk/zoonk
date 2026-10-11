import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadPlacementPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut, markSkillsKnown } from "../learner/_utils/known-skills";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getTodayStudySession } from "./_test-utils/open-today";
import { readBlockPayload } from "./block-payload";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const TODAY = Date.UTC(2026, 9, 8);

function noonOf(day: number): Date {
  return new Date(TODAY + day * MS_PER_DAY + 12 * 60 * 60 * 1000);
}

/** More topics taken as known than one day's practice has room for at 15 minutes a day. */
const KNOWN_TOPICS = 10;

/**
 * A learner whose placement answered topics right yesterday (taken as known, their lessons tested
 * out) with lessons of two others still to study.
 */
async function knownTopicsLearner() {
  vi.setSystemTime(noonOf(-1));

  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({
      skills: [
        ...Array.from({ length: KNOWN_TOPICS }, () => ({ lessons: 1 })),
        { lessons: 6 },
        { lessons: 6 },
      ],
    }),
  ]);

  const known = library.skills.slice(0, KNOWN_TOPICS).map((skill) => skill.id);

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 15,
    details: { placementDeclined: true },
    timezone: "UTC",
    userId: user.id,
  });

  const items = await Promise.all(
    library.skills.flatMap((skill) =>
      [0, 1, 2].map(() => itemFixture({ content: choiceItemContent(), skillId: skill.id })),
    ),
  );

  await Promise.all([
    ...known.map((skillId) =>
      attemptFixture({
        answeredAt: noonOf(-1),
        isCorrect: true,
        isPlacement: true,
        itemId: items.find((item) => item.skillId === skillId)?.id ?? null,
        skillId,
        userId: user.id,
      }),
    ),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  mockSession(user.id);

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  await markSkillsKnown({ knownAt: noonOf(-1), skillIds: known, timeZone: "UTC", userId: user.id });

  const placed = await loadPlacementPlan(goal.id);

  await markPlanItemsTestedOut({
    goalId: goal.id,
    items: placed.items,
    knownSkillIds: new Set(known),
    placedSkills: placed.skills,
    testedOutAt: new Date(noonOf(-1).getTime() + 60_000),
    timeZone: "UTC",
  });

  return { goal, known, user };
}

/** The known topics the day's practice asks, opening the day without answering any of it. */
async function askedKnownTopics({ goalId, known }: { goalId: string; known: string[] }) {
  const today = await getTodayStudySession({ goalId, timeZone: "UTC" });

  if (today.status !== "ready") {
    throw new Error(`Expected a session, got ${today.status}`);
  }

  const blocks = await prisma.studySessionBlock.findMany({
    where: { kind: "practice", sessionId: today.session.id },
  });

  const items = await prisma.item.findMany({
    select: { skillId: true },
    where: { id: { in: blocks.flatMap((block) => readBlockPayload(block).itemIds) } },
  });

  return known.filter((skillId) => items.some((item) => item.skillId === skillId));
}

describe("known topics practice still has to confirm", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("take turns: the next day asks the ones the day before left for later", async () => {
    const { goal, known } = await knownTopicsLearner();

    vi.setSystemTime(noonOf(0));
    const first = await askedKnownTopics({ goalId: goal.id, known });

    // The learner skips practice, so nothing is confirmed.
    vi.setSystemTime(noonOf(1));
    const second = await askedKnownTopics({ goalId: goal.id, known });

    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThan(known.length);
    expect(second.filter((skillId) => first.includes(skillId))).toStrictEqual([]);
    expect(new Set([...first, ...second]).size).toBe(Math.min(known.length, first.length * 2));
  });
});
