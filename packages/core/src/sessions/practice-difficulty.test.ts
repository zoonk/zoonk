import { prisma } from "@zoonk/db";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { type DifficultyBias } from "../plans/planner/plan-state";
import {
  SESSION_NOW,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { readBlockPayload } from "./block-payload";
import { getTodayStudySession } from "./get-today-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** Item difficulty on the IRT-style scale real answers refine: easy, medium and hard. */
const DIFFICULTIES = { easy: -1, hard: 1, medium: 0 } as const;

/**
 * A goal whose only lesson is done, its skill studied and not due, with an easy, a medium and a
 * hard question on it, and the plan steered with `difficultyBias`: today is all mixed practice.
 */
async function practiceDay(difficultyBias: DifficultyBias) {
  const user = await userFixture();

  const { goal, plan, planItems, skills } = await sessionGoalFixture({
    itemsPerSkill: 0,
    lessons: 1,
    userId: user.id,
  });

  const skillId = skills[0]?.id ?? "";

  const [easy, medium, hard] = await Promise.all(
    [DIFFICULTIES.easy, DIFFICULTIES.medium, DIFFICULTIES.hard].map((difficulty) =>
      itemFixture({ difficulty, skillId }),
    ),
  );

  await Promise.all([
    prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]?.id } }),
    prisma.plan.update({ data: { settings: { difficultyBias } }, where: { id: plan.id } }),
    dueSkillFixture({ due: daysAgo(-10), skillId, userId: user.id }),
  ]);

  mockSession(user.id);

  return { goal, ids: { easy: easy?.id, hard: hard?.id, medium: medium?.id } };
}

async function getPracticeItemIds(goalId: string): Promise<string[]> {
  const today = await getTodayStudySession({ goalId });
  const sessionId = today.status === "ready" ? today.session.id : "";

  const block = await prisma.studySessionBlock.findFirstOrThrow({
    where: { kind: "practice", sessionId },
  });

  return readBlockPayload(block).itemIds;
}

describe("practice steered by Too easy and Too hard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the hardest questions first after Too easy", async () => {
    const { goal, ids } = await practiceDay("harder");

    await expect(getPracticeItemIds(goal.id)).resolves.toStrictEqual([
      ids.hard,
      ids.medium,
      ids.easy,
    ]);
  });

  it("asks the easiest questions first after Too hard", async () => {
    const { goal, ids } = await practiceDay("easier");

    await expect(getPracticeItemIds(goal.id)).resolves.toStrictEqual([
      ids.easy,
      ids.medium,
      ids.hard,
    ]);
  });
});
