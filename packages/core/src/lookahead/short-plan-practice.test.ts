import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getShortPlanPracticeNeed } from "./short-plan-practice";

/** Wednesday morning, with the class test on Friday. */
const NOW = new Date("2026-10-07T12:00:00Z");

async function classTest({ daily, targetDate }: { daily: number; targetDate: string }) {
  const user = await userFixture();
  const skills = await Promise.all([skillFixture(), skillFixture(), skillFixture()]);

  const goal = await goalFixture({
    dailyMinutes: daily,
    kind: "exam",
    targetDate: new Date(`${targetDate}T00:00:00Z`),
    timezone: "UTC",
    userId: user.id,
  });

  await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Células" }],
      skills: skills.map((skill) => ({
        area: "Biologia",
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
      })),
    },
    settings: { startDate: "2026-10-07" },
  });

  return { goal, skills };
}

describe(getShortPlanPracticeNeed, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sizes a class test's questions to its days, shared among its skills", async () => {
    const { goal, skills } = await classTest({ daily: 30, targetDate: "2026-10-09" });

    // Two days of 30 minutes: 40 questions' worth, at most eight a skill.
    await expect(getShortPlanPracticeNeed(goal.id)).resolves.toStrictEqual({
      questionsPerSkill: 8,
      skillIds: skills.map((skill) => skill.id),
    });
  });

  it("asks a few questions a skill even for a short day", async () => {
    const { goal } = await classTest({ daily: 10, targetDate: "2026-10-08" });
    const need = await getShortPlanPracticeNeed(goal.id);

    expect(need?.questionsPerSkill).toBe(4);
  });

  it("needs nothing for a public exam's many skills days away", async () => {
    const { goal } = await classTest({ daily: 30, targetDate: "2026-10-09" });
    const skills = await Promise.all(Array.from({ length: 13 }, () => skillFixture()));

    await prisma.plan.update({
      data: {
        graph: {
          phases: [{ milestone: null, name: "ENEM" }],
          skills: skills.map((skill) => ({
            area: "Natureza",
            lessons: 4,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
          })),
        },
      },
      where: { goalId: goal.id },
    });

    await expect(getShortPlanPracticeNeed(goal.id)).resolves.toBeNull();
  });

  // A handout's every heading is a skill of its own now: a long one passes a public exam's count.
  it("sizes the questions of a test from the learner's own material, however many topics it has", async () => {
    const { goal } = await classTest({ daily: 30, targetDate: "2026-10-09" });
    const skills = await Promise.all(Array.from({ length: 16 }, () => skillFixture()));
    const blueprint = await examBlueprintFixture({ ownerId: goal.userId });

    await prisma.goal.update({ data: { examBlueprintId: blueprint.id }, where: { id: goal.id } });

    await prisma.plan.update({
      data: {
        graph: {
          phases: [{ milestone: null, name: "Células" }],
          skills: skills.map((skill) => ({
            area: "Biologia",
            lessons: 1,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
          })),
        },
      },
      where: { goalId: goal.id },
    });

    await expect(getShortPlanPracticeNeed(goal.id)).resolves.toStrictEqual({
      questionsPerSkill: 4,
      skillIds: skills.map((skill) => skill.id),
    });
  });

  it("needs nothing for a plan longer than a week", async () => {
    const { goal } = await classTest({ daily: 30, targetDate: "2026-11-20" });
    await expect(getShortPlanPracticeNeed(goal.id)).resolves.toBeNull();
  });
});
