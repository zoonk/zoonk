import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { bringBackMissedLessons } from "../plans/bring-back-missed-lessons";
import {
  SESSION_NOW,
  SESSION_TODAY,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { loadSessionBuildInput } from "./_utils/load-build-inputs";

/**
 * An IELTS learner whose placement tested out a speaking skill (its stand-in), who then took
 * Speaking out of their plan. Every skill is studied and due.
 */
async function speakingTakenOut() {
  const user = await userFixture();

  const { goal, plan, planItems, skills } = await sessionGoalFixture({
    goal: { kind: "exam", targetDate: new Date("2026-11-30T00:00:00Z") },
    lessons: 2,
    userId: user.id,
  });

  const [reading, speaking] = skills;

  await Promise.all([
    prisma.plan.update({
      data: {
        graph: {
          phases: [{ milestone: null, name: "Base" }],
          skills: [
            {
              area: "Reading",
              lessons: 3,
              name: "Read",
              phase: 0,
              skillId: reading?.id,
              weight: 1,
            },
            {
              area: "Speaking",
              lessons: 3,
              name: "Speak",
              phase: 0,
              skillId: speaking?.id,
              weight: 1,
            },
          ],
        },
        settings: { skippedAreas: ["Speaking"] },
      },
      where: { id: plan.id },
    }),
    prisma.planItem.update({
      data: { scheduledFor: SESSION_TODAY, skillId: reading?.id ?? null },
      where: { id: planItems[0]?.id },
    }),
    prisma.planItem.update({
      data: {
        completedAt: SESSION_NOW,
        lessonId: null,
        lessons: 3,
        scheduledFor: SESSION_TODAY,
        skillId: speaking?.id ?? null,
        status: "testedOut",
      },
      where: { id: planItems[1]?.id },
    }),
    ...skills.map((skill) => dueSkillFixture({ skillId: skill.id, userId: user.id })),
  ]);

  mockSession(user.id);

  return { goal, plan, speaking, speakingItem: planItems[1], user };
}

describe("a subject the learner took out of their plan", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Out by choice: practice never asks it, and a miss on it never brings its lessons back.
  it("asks none of its skills, even one placement tested out", async () => {
    const { goal, speaking, user } = await speakingTakenOut();

    const input = await loadSessionBuildInput({
      goal: await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      localDate: SESSION_TODAY,
      now: SESSION_NOW,
      timeZone: "UTC",
      userId: user.id,
    });

    const asked = [
      ...input.practice.map((item) => item.skillId),
      ...input.capsules.flatMap((capsule) => capsule.skillIds),
    ];

    expect(asked).not.toContain(speaking?.id);
  });

  it("keeps its lessons out after a miss on it", async () => {
    const { goal, plan, speaking, speakingItem } = await speakingTakenOut();

    await bringBackMissedLessons({
      goalId: goal.id,
      now: SESSION_NOW,
      skillIds: [speaking?.id ?? ""],
      timeZone: "UTC",
    });

    const [item, changes] = await Promise.all([
      prisma.planItem.findUniqueOrThrow({ where: { id: speakingItem?.id } }),
      prisma.planChange.findMany({ where: { kind: "relearn", planId: plan.id } }),
    ]);

    expect(item.status).toBe("testedOut");
    expect(changes).toStrictEqual([]);
  });
});
