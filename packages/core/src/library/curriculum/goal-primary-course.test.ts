import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { describe, expect, it } from "vitest";
import { getGoalsCacheTag } from "../../cache/tags";
import { getGoalCourseFormat, setGoalPrimaryCourse } from "./goal-primary-course";

describe(setGoalPrimaryCourse, () => {
  it("points a goal without a main course at the course its first phase is taught in, marking the learner's plans changed", async () => {
    const [user, course] = await Promise.all([userFixture(), courseFixture()]);

    const [goal, otherGoal] = await Promise.all([
      goalFixture({ userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    const [plan, otherPlan] = await Promise.all([
      planFixture({ goalId: goal.id }),
      planFixture({ goalId: otherGoal.id }),
    ]);

    await setGoalPrimaryCourse({ courseId: course.id, goalId: goal.id });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      primaryCourseId: course.id,
    });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 1,
    });

    // Marking is per learner, so their other plan is marked too.
    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: otherPlan.id } }),
    ).resolves.toMatchObject({ inputVersion: otherPlan.inputVersion + 1 });

    expect(revalidateTag).toHaveBeenCalledWith(getGoalsCacheTag(user.id), { expire: 0 });
  });

  it("keeps the course the learner or onboarding already chose", async () => {
    const [user, chosen, generated] = await Promise.all([
      userFixture(),
      courseFixture(),
      courseFixture(),
    ]);

    const goal = await goalFixture({ primaryCourseId: chosen.id, userId: user.id });
    const plan = await planFixture({ goalId: goal.id });

    await setGoalPrimaryCourse({ courseId: generated.id, goalId: goal.id });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      primaryCourseId: chosen.id,
    });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
    });

    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("does nothing for a goal that no longer exists", async () => {
    const course = await courseFixture();

    await expect(
      setGoalPrimaryCourse({ courseId: course.id, goalId: randomUUID() }),
    ).resolves.toBeUndefined();

    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe(getGoalCourseFormat, () => {
  it("makes a learner's own course personalized, a language goal's a language course, others core", () => {
    expect(getGoalCourseFormat({ kind: "language", ownerId: randomUUID() })).toBe("personalized");
    expect(getGoalCourseFormat({ kind: "language", ownerId: null })).toBe("language");
    expect(getGoalCourseFormat({ kind: "exam", ownerId: null })).toBe("core");
    expect(getGoalCourseFormat({ kind: "learn", ownerId: null })).toBe("core");
  });
});
