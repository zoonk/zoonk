import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { finishExplanations } from "./_utils/finish-explanations";
import { updateGoal } from "./update-goal";

async function setup() {
  const user = await userFixture();
  const goal = await goalFixture({ details: {}, timezone: "UTC", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);
  return { goal, plan, user };
}

async function versions(fixture: Awaited<ReturnType<typeof setup>>) {
  const [actor, plan] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } }),
    prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } }),
  ]);

  return { inputVersion: plan.inputVersion, revision: actor.learnerRevision };
}

async function activeGoal(userId: string) {
  const profile = await prisma.userLearningProfile.findUniqueOrThrow({ where: { userId } });
  return profile.activeGoalId;
}

describe("goal metadata revision boundaries", () => {
  it("marks visible metadata once without invalidating plan inputs, and rolls back a replay", async () => {
    const fixture = await setup();
    const before = await versions(fixture);
    const input = { studyTime: "07:30", title: "Understand gravity" };

    await expect(updateGoal({ goalId: fixture.goal.id, input })).resolves.toMatchObject({
      goal: input,
      status: "updated",
    });

    const expected = { inputVersion: before.inputVersion, revision: before.revision + 1n };
    await expect(versions(fixture)).resolves.toStrictEqual(expected);
    await updateGoal({ goalId: fixture.goal.id, input });
    await expect(versions(fixture)).resolves.toStrictEqual(expected);
  });

  it("invalidates plan inputs when the goal's learner details change", async () => {
    const fixture = await setup();
    const before = await versions(fixture);

    await expect(
      updateGoal({ goalId: fixture.goal.id, input: { details: { placementDeclined: true } } }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(versions(fixture)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
      revision: before.revision + 1n,
    });
  });

  it("commits the status and active-profile move once across concurrent completions", async () => {
    const fixture = await setup();
    const next = await goalFixture({ userId: fixture.user.id });
    const before = await versions(fixture);

    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        updateGoal({ goalId: fixture.goal.id, input: { status: "completed" } }),
      ),
    );

    expect(results).toMatchObject(
      Array.from({ length: 3 }, () => ({ goal: { status: "completed" }, status: "updated" })),
    );

    await expect(activeGoal(fixture.user.id)).resolves.toBe(next.id);

    await expect(versions(fixture)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
      revision: before.revision + 1n,
    });
  });

  it("does not mark an unauthorized goal update", async () => {
    const fixture = await setup();
    const stranger = await userFixture();
    const before = await versions(fixture);
    mockSession(stranger.id);

    await expect(
      updateGoal({ goalId: fixture.goal.id, input: { title: "Someone else's change" } }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(versions(fixture)).resolves.toStrictEqual(before);
  });
});

describe("explanation completion revision boundary", () => {
  it("marks once with the completed explanations and active-profile move, retaining another learner's goal", async () => {
    const fixture = await setup();

    const [lesson, foreignUser, explanation] = await Promise.all([
      libraryLessonFixture(),
      userFixture(),
      goalFixture({ kind: "explain", userId: fixture.user.id }),
    ]);

    const foreign = await goalFixture({ kind: "explain", userId: foreignUser.id });

    const [ownPlan, foreignPlan] = await Promise.all([
      planFixture({ goalId: explanation.id }),
      planFixture({ goalId: foreign.id }),
    ]);

    await Promise.all([
      planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: ownPlan.id }),
      planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: foreignPlan.id }),
      prisma.userLearningProfile.update({
        data: { activeGoalId: explanation.id },
        where: { userId: fixture.user.id },
      }),
    ]);

    const before = await versions(fixture);
    const foreignBefore = await prisma.user.findUniqueOrThrow({ where: { id: foreignUser.id } });

    await Promise.all(
      Array.from({ length: 3 }, () =>
        finishExplanations({ lessonId: lesson.id, userId: fixture.user.id }),
      ),
    );

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: explanation.id } }),
    ).resolves.toMatchObject({ status: "completed" });

    await expect(activeGoal(fixture.user.id)).resolves.toBe(fixture.goal.id);

    await expect(versions(fixture)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
      revision: before.revision + 1n,
    });

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: foreign.id } }),
    ).resolves.toMatchObject({ status: "active" });

    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: foreignUser.id } }),
    ).resolves.toStrictEqual(foreignBefore);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: foreignPlan.id } }),
    ).resolves.toMatchObject({ inputVersion: foreignPlan.inputVersion });
  });

  it("does not mark a lesson that completes no active explanation", async () => {
    const fixture = await setup();
    const lesson = await libraryLessonFixture();
    const before = await versions(fixture);
    await finishExplanations({ lessonId: lesson.id, userId: fixture.user.id });
    await expect(versions(fixture)).resolves.toStrictEqual(before);
  });
});
