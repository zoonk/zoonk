import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { holdPlanLock, waitForBlockedStatement } from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { updateGoal } from "./update-goal";

async function countryGoal(countryDependent?: boolean) {
  const user = await userFixture();

  const goal = await goalFixture({
    details: countryDependent === undefined ? {} : { countryDependent },
    language: "pt",
    userId: user.id,
  });

  const plan = await planFixture({ goalId: goal.id });
  mockSession(user.id);
  return { goal, plan, user };
}

describe("content-country changes", () => {
  it("owes one same-goal rebuild after parallel duplicate changes, retaining the old plan", async () => {
    const { user, goal, plan } = await countryGoal(true);
    const lock = holdPlanLock({ planId: plan.id });
    const pid = await lock.pid;

    const pending = Promise.allSettled(
      [1, 2].map(() => updateGoal({ goalId: goal.id, input: { contentCountry: "PT" } })),
    );

    try {
      await waitForBlockedStatement(pid, /FOR UPDATE OF plan/u, 2);
    } finally {
      lock.release();
      await lock.done;
    }

    await expect(pending).resolves.toMatchObject([
      { status: "fulfilled", value: { status: "updated" } },
      { status: "fulfilled", value: { status: "updated" } },
    ]);

    await expect(
      prisma.followUp.findMany({ where: { kind: "rebuildGoalCurriculum", userId: user.id } }),
    ).resolves.toMatchObject([{ key: goal.id, revision: 0 }]);

    await expect(
      prisma.followUp.count({ where: { kind: "rebuildGoalCurriculum", userId: user.id } }),
    ).resolves.toBe(1);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      contentCountry: "PT",
      status: "active",
    });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      graph: plan.graph,
    });
  });

  it("keeps the last country, rebuilds an older goal, and does not rebuild a general goal", async () => {
    const legacy = await countryGoal();
    await updateGoal({ goalId: legacy.goal.id, input: { contentCountry: "PT" } });
    await updateGoal({ goalId: legacy.goal.id, input: { contentCountry: "DE" } });

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: legacy.goal.id } }),
    ).resolves.toMatchObject({ contentCountry: "DE", details: { countryDependent: true } });

    await expect(
      prisma.followUp.count({ where: { kind: "rebuildGoalCurriculum", userId: legacy.user.id } }),
    ).resolves.toBe(1);

    const general = await countryGoal(false);
    await updateGoal({ goalId: general.goal.id, input: { contentCountry: "PT" } });

    await expect(
      prisma.followUp.count({ where: { kind: "rebuildGoalCurriculum", userId: general.user.id } }),
    ).resolves.toBe(0);
  });

  it.each(["BR", null])(
    "rebuilds an older goal once when its first explicit country is its own: %s",
    async (contentCountry) => {
      const { goal, user } = await countryGoal();

      await Promise.all(
        [1, 2].map(() => updateGoal({ goalId: goal.id, input: { contentCountry } })),
      );

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      ).resolves.toMatchObject({ details: { countryDependent: true } });

      const owed = await prisma.followUp.findMany({
        where: { key: goal.id, kind: "rebuildGoalCurriculum", userId: user.id },
      });

      expect(owed).toHaveLength(1);
      expect(owed[0]).toMatchObject({ revision: 0 });
    },
  );

  it("refuses another learner's goal, exams, language goals and unknown codes before writing", async () => {
    const { user, goal } = await countryGoal(true);
    const stranger = await userFixture();
    const other = await goalFixture({ userId: stranger.id });
    const exam = await goalFixture({ kind: "exam", userId: user.id });
    const language = await goalFixture({ kind: "language", userId: user.id });

    await expect(
      updateGoal({ goalId: other.id, input: { contentCountry: "PT" } }),
    ).resolves.toMatchObject({ status: "notFound" });

    await expect(
      updateGoal({ goalId: exam.id, input: { contentCountry: "PT" } }),
    ).resolves.toMatchObject({ status: "countryNotOffered" });

    await expect(
      updateGoal({ goalId: language.id, input: { contentCountry: "PT" } }),
    ).resolves.toMatchObject({ status: "countryNotOffered" });

    await expect(
      updateGoal({ goalId: goal.id, input: { contentCountry: "XX" } }),
    ).resolves.toMatchObject({ status: "countryNotOffered" });

    await expect(
      prisma.followUp.count({ where: { kind: "rebuildGoalCurriculum", userId: user.id } }),
    ).resolves.toBe(0);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      contentCountry: null,
    });
  });

  it("switches the primary course with the new graph and keeps finished lessons", async () => {
    const { goal, plan } = await countryGoal(true);

    const [oldCourse, nextCourse, oldLibrary, nextLibrary] = await Promise.all([
      courseFixture(),
      courseFixture({ country: "PT" }),
      planLibraryFixture({ skills: [{ lessons: 2 }] }),
      planLibraryFixture({ skills: [{ lessons: 2 }] }),
    ]);

    await prisma.goal.update({ data: { primaryCourseId: oldCourse.id }, where: { id: goal.id } });
    await createGoalPlan({ goalId: goal.id, graph: oldLibrary.graph });

    const first = await prisma.planItem.findFirstOrThrow({
      where: { kind: "lesson", planId: plan.id },
    });

    await prisma.planItem.update({ data: { status: "done" }, where: { id: first.id } });

    await createGoalPlan({
      goalId: goal.id,
      graph: nextLibrary.graph,
      primaryCourseId: nextCourse.id,
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      primaryCourseId: nextCourse.id,
      status: "active",
    });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: first.id } }),
    ).resolves.toMatchObject({ status: "done" });
  });

  it("discards a superseded rebuild atomically and keeps the saved plan and course", async () => {
    const { goal, plan, user } = await countryGoal(true);

    const [oldCourse, nextCourse, library] = await Promise.all([
      courseFixture(),
      courseFixture({ country: "PT" }),
      planLibraryFixture({ skills: [{ lessons: 1 }] }),
    ]);

    await prisma.goal.update({ data: { primaryCourseId: oldCourse.id }, where: { id: goal.id } });

    const owed = await prisma.followUp.create({
      data: {
        input: { goalId: goal.id },
        key: goal.id,
        kind: "rebuildGoalCurriculum",
        requestedAt: new Date(),
        revision: 1,
        userId: user.id,
      },
    });

    await expect(
      createGoalPlan({
        followUp: { id: owed.id, revision: 0 },
        goalId: goal.id,
        graph: library.graph,
        primaryCourseId: nextCourse.id,
      }),
    ).rejects.toThrow("newer content-country change");

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      graph: plan.graph,
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      primaryCourseId: oldCourse.id,
      status: "active",
    });
  });
});
