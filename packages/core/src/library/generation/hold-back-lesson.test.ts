import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { holdBackLessonDraft } from "./hold-back-lesson";

describe(holdBackLessonDraft, () => {
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
