import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getLessonWriterSpeed } from "./lesson-writer-speed";

describe(getLessonWriterSpeed, () => {
  it("serves only the new goal's first lesson fast, until a lesson is done", async () => {
    const user = await userFixture();

    const [goal, first, later] = await Promise.all([
      goalFixture({ userId: user.id }),
      libraryLessonFixture(),
      libraryLessonFixture(),
    ]);

    const plan = await planFixture({ goalId: goal.id });

    const [firstItem] = await Promise.all([
      planItemFixture({ lessonId: first.id, planId: plan.id, position: 0 }),
      planItemFixture({ lessonId: later.id, planId: plan.id, position: 1 }),
    ]);

    await expect(getLessonWriterSpeed({ goalId: goal.id, lessonId: first.id })).resolves.toBe(
      "fast",
    );

    await expect(
      getLessonWriterSpeed({ goalId: goal.id, lessonId: later.id }),
    ).resolves.toBeUndefined();

    await expect(getLessonWriterSpeed({ lessonId: first.id })).resolves.toBeUndefined();
    await prisma.planItem.update({ data: { status: "done" }, where: { id: firstItem.id } });

    await expect(
      getLessonWriterSpeed({ goalId: goal.id, lessonId: later.id }),
    ).resolves.toBeUndefined();
  });

  it("serves the saved opening fast before the plan has its lessons", async () => {
    const [user, lesson] = await Promise.all([userFixture(), libraryLessonFixture()]);
    const goal = await goalFixture({ openingLessonId: lesson.id, userId: user.id });
    await planFixture({ goalId: goal.id });

    await expect(getLessonWriterSpeed({ goalId: goal.id, lessonId: lesson.id })).resolves.toBe(
      "fast",
    );
  });
});
