import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it } from "vitest";
import { deleteRetiredSteps } from "./lesson-versions";

function readRetirement(id: string) {
  return prisma.item.findUniqueOrThrow({ select: { retiredAt: true }, where: { id } });
}

describe(deleteRetiredSteps, () => {
  it("deletes screens a fixed version replaced more than a day ago, keeping the answers given to them", async () => {
    const [lesson, user] = await Promise.all([libraryLessonFixture(), userFixture()]);
    const now = new Date();

    const [old, recent, current] = await Promise.all([
      libraryStepFixture({
        lessonId: lesson.id,
        position: 0,
        retiredAt: new Date(now.getTime() - 2 * MS_PER_DAY),
        version: 1,
      }),
      libraryStepFixture({
        lessonId: lesson.id,
        position: 0,
        retiredAt: new Date(now.getTime() - MS_PER_DAY / 2),
        version: 2,
      }),
      libraryStepFixture({ lessonId: lesson.id, position: 0, version: 3 }),
    ]);

    const answer = await attemptFixture({ stepId: old.id, userId: user.id });

    await expect(deleteRetiredSteps({ now })).resolves.toBeGreaterThanOrEqual(1);

    const [steps, attempt] = await Promise.all([
      prisma.step.findMany({ select: { id: true }, where: { lessonId: lesson.id } }),
      prisma.attempt.findUniqueOrThrow({ where: { id: answer.id } }),
    ]);

    expect(steps.map((step) => step.id).toSorted()).toStrictEqual(
      [recent.id, current.id].toSorted(),
    );

    expect(attempt.stepId).toBeNull();
  });

  it("retires the questions only the deleted screens still asked, such as a regeneration that never finished", async () => {
    const [lesson, skill] = await Promise.all([libraryLessonFixture(), skillFixture()]);
    const now = new Date();
    const retiredAt = new Date(now.getTime() - 2 * MS_PER_DAY);

    const [abandoned, kept] = await Promise.all([
      itemFixture({ skillId: skill.id }),
      itemFixture({ skillId: skill.id }),
    ]);

    await Promise.all([
      libraryStepFixture({ itemId: abandoned.id, lessonId: lesson.id, position: 0, retiredAt }),
      libraryStepFixture({ itemId: kept.id, lessonId: lesson.id, position: 1, retiredAt }),
      libraryStepFixture({ itemId: kept.id, lessonId: lesson.id, position: 0, version: 2 }),
    ]);

    await deleteRetiredSteps({ now });

    await expect(readRetirement(abandoned.id)).resolves.toStrictEqual({
      retiredAt: expect.any(Date),
    });

    await expect(readRetirement(kept.id)).resolves.toStrictEqual({ retiredAt: null });
  });
});
