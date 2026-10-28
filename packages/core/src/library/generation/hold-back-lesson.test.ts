import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as refresh from "../../plans/refresh-goal-plan";
import { holdBackLessonDraft } from "./hold-back-lesson";

describe(holdBackLessonDraft, () => {
  afterEach(() => vi.restoreAllMocks());

  it("refreshes only changed plans with at most four concurrent refreshes", async () => {
    const user = await userFixture();
    const workflowRunId = randomUUID();

    const lesson = await libraryLessonFixture({
      contentRunId: workflowRunId,
      contentStatus: "running",
      ownerId: user.id,
    });

    const goals = await Promise.all(
      Array.from({ length: 7 }, async (_, index) => {
        const goal = await goalFixture({ userId: user.id });
        const plan = await planFixture({ goalId: goal.id });

        await planItemFixture({
          kind: "lesson",
          lessonId: lesson.id,
          planId: plan.id,
          status: index === 6 ? "done" : "todo",
        });

        return goal;
      }),
    );

    let active = 0;
    let peak = 0;

    const renew = vi.spyOn(refresh, "refreshGoalPlan").mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      active -= 1;
      return { plan: null, status: "unchanged" };
    });

    await holdBackLessonDraft({
      lessonId: lesson.id,
      model: "test/fixture",
      problems: [],
      workflowRunId,
    });

    expect(renew.mock.calls.map(([input]) => input.goalId).toSorted()).toStrictEqual(
      goals
        .slice(0, 6)
        .map((goal) => goal.id)
        .toSorted(),
    );

    expect(peak).toBeLessThanOrEqual(4);
  });

  it("marks each plan holding the lesson changed content, and none for a run that lost its claim", async () => {
    const workflowRunId = randomUUID();

    const [user, lesson] = await Promise.all([
      userFixture(),
      libraryLessonFixture({ contentRunId: workflowRunId, contentStatus: "running" }),
    ]);

    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });
    await planItemFixture({ lessonId: lesson.id, planId: plan.id });
    const readPlan = () => prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    const draft = {
      lessonId: lesson.id,
      model: "test/fixture",
      problems: [{ problem: "The answer is incorrect.", screen: 0 }],
    };

    await expect(
      holdBackLessonDraft({ ...draft, workflowRunId: randomUUID() }),
    ).resolves.toBeNull();

    await expect(readPlan()).resolves.toMatchObject({ inputVersion: plan.inputVersion });

    await expect(holdBackLessonDraft({ ...draft, workflowRunId })).resolves.toMatchObject({
      setAside: false,
    });

    await expect(readPlan()).resolves.toMatchObject({ inputVersion: plan.inputVersion + 1 });
  });
});
