import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WAITING_START,
  outlineSkill,
  waitingGoal,
} from "../library/curriculum/_test-utils/waiting-goals";
import {
  mockDecision,
  mockSearchTerms,
  uniqueWord,
} from "../library/identity/_test-utils/identity-mocks";
import { markPlanInputsUntil } from "../plans/_test-utils/mark-plan-inputs";
import { createGoalPlan } from "../plans/create-goal-plan";
import { loadPlanLessons, pickPlanStartToWrite } from "./speculative-lessons";

async function landedBand() {
  const skill = await skillFixture();
  const { goal, plan } = await waitingGoal(skill);
  const lessonIds = await outlineSkill(skill);

  return { goal, lessonIds, plan, skill };
}

describe("lessons picked and started while a plan's band lands", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WAITING_START);
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("follows the rebuilt graph rather than restoring an initial run's old start", async () => {
    const { goal, lessonIds: oldLessons } = await landedBand();
    const skill = await skillFixture();
    const lessons = await outlineSkill(skill);

    await createGoalPlan({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Rebuilt foundations" }],
        skills: [
          {
            area: null,
            lessons: lessons.length,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          },
        ],
      },
    });

    await expect(pickPlanStartToWrite(goal.id)).resolves.toBe(lessons[0]);
    expect(oldLessons).not.toContain(lessons[0]);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({
      graph: { skills: [expect.objectContaining({ skillId: skill.id })] },
    });
  });

  it("loads the outlined opening without saving over onboarding's stand-ins", async () => {
    const { goal, lessonIds, plan } = await landedBand();
    await prisma.goal.update({ data: { details: {} }, where: { id: goal.id } });

    const read = () =>
      prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { position: "asc" } } },
        where: { id: plan.id },
      });

    const before = await read();

    expect(before.items.some((item) => item.kind === "lesson" && item.lessonId === null)).toBe(
      true,
    );

    const opening = await loadPlanLessons(goal.id);
    expect(opening.map((item) => item.lessonId)).toStrictEqual(lessonIds);
    await expect(read()).resolves.toStrictEqual(before);
  });

  it("picks the band's first lesson while the learner's onboarding keeps changing the plan", async () => {
    const { goal, lessonIds, plan } = await landedBand();
    const stop = new AbortController();
    const marking = markPlanInputsUntil({ planId: plan.id, signal: stop.signal });
    const picking = pickPlanStartToWrite(goal.id);

    await Promise.allSettled([picking.finally(() => stop.abort()), marking]);

    await expect(marking).resolves.toBeGreaterThan(0);
    await expect(picking).resolves.toBe(lessonIds[0]);
  });
});
