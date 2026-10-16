import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { planSummarySchema } from "../../plans/_utils/plan-summary";
import { completeLessonPlanItems } from "./plan-items";

const NOW = new Date("2026-10-15T12:00:00Z");

async function postedPlan({
  lessonId,
  short,
  userId,
}: {
  lessonId: string;
  short: boolean;
  userId: string;
}) {
  const [goal, skill] = await Promise.all([goalFixture({ userId }), skillFixture()]);
  const plan = await planFixture({ goalId: goal.id, pendingAdaptation: ["content"] });

  const summary = planSummarySchema.parse({
    basis: {
      layoutInputVersion: 0,
      layoutStudyDay: "2026-10-01",
      planId: plan.id,
      planVersion: plan.version,
      timeZone: "UTC",
      userId,
    },
    schemaVersion: 2,
    selected: {
      bases: null,
      coverage: {
        basis: "selected",
        coreFits: true,
        coveredShare: short ? 0.5 : 1,
        deadline: "2026-10-14",
        fits: !short,
        measure: "goal",
        shortLessons: short
          ? [{ countedRaw: 5, lessonId, requiredRaw: 10, skillIds: [skill.id] }]
          : [],
        skills: [
          {
            coveredRaw: short ? 5 : 10,
            requiredRaw: 10,
            skillId: skill.id,
            state: "measured",
            worth: 10,
          },
        ],
        targetDate: "2026-10-14",
      },
      endDate: "2026-10-15",
      forecast: {
        basis: "estimated",
        dailyNeed: { basis: "estimated", minutes: 10 },
        finish: { date: "2026-10-15" },
      },
      phaseDates: { structureKey: null, trigger: false },
      requirement: { doneRaw: 0, remainingRaw: 10, totalRaw: 10 },
      sourceSkillIds: [skill.id],
      totalMinutes: 10,
    },
  });

  await prisma.plan.update({
    data: { coveredShare: short ? 0.5 : 1, summary },
    where: { id: plan.id },
  });

  await planItemFixture({
    lessonId,
    planId: plan.id,
    scheduledFor: new Date("2026-10-15"),
    skillId: skill.id,
  });

  return { plan, summary };
}

describe("completion reduces posted coverage without planning", () => {
  it("credits a shared short lesson once in each plan and preserves pending reasons", async () => {
    const [user, lesson] = await Promise.all([userFixture(), libraryLessonFixture()]);

    const plans = await Promise.all([
      postedPlan({ lessonId: lesson.id, short: true, userId: user.id }),
      postedPlan({ lessonId: lesson.id, short: true, userId: user.id }),
    ]);
    // Even duplicate held items for the same lesson may credit it only once per plan.
    await planItemFixture({ lessonId: lesson.id, planId: plans[0]!.plan.id, position: 1 });

    await prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId: user.id });
      await completeLessonPlanItems(tx, { lessonId: lesson.id, now: NOW, userId: user.id });
    });

    const saved = await prisma.plan.findMany({
      orderBy: { id: "asc" },
      where: { id: { in: plans.map(({ plan }) => plan.id) } },
    });

    expect(saved).toHaveLength(2);

    for (const row of saved) {
      expect(row).toMatchObject({
        coveredShare: 1,
        pendingAdaptation: ["content"],
        summary: { selected: { coverage: { coveredShare: 1, fits: true, shortLessons: [] } } },
      });
    }

    await prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId: user.id });
      await completeLessonPlanItems(tx, { lessonId: lesson.id, now: NOW, userId: user.id });
    });

    const repeated = await prisma.plan.findMany({
      orderBy: { id: "asc" },
      where: { id: { in: saved.map(({ id }) => id) } },
    });

    expect(repeated.map(({ summary }) => summary)).toStrictEqual(
      saved.map(({ summary }) => summary),
    );
  });

  it("leaves a normally counted lesson's summary bytes unchanged", async () => {
    const [user, lesson] = await Promise.all([userFixture(), libraryLessonFixture()]);

    const { plan, summary } = await postedPlan({
      lessonId: lesson.id,
      short: false,
      userId: user.id,
    });

    const posted = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId: user.id });
      await completeLessonPlanItems(tx, { lessonId: lesson.id, now: NOW, userId: user.id });
    });

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(saved.summary).toStrictEqual(summary);
    expect(JSON.stringify(saved.summary)).toBe(JSON.stringify(posted.summary));
    expect(saved.pendingAdaptation).toStrictEqual(["content"]);
  });
});
