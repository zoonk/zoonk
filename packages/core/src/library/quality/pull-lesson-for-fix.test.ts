import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { pullLessonForFix } from "./pull-lesson-for-fix";

describe(pullLessonForFix, () => {
  it("takes a published lesson out of play once, and leaves a lesson being rewritten alone", async () => {
    const [published, rewriting] = await Promise.all([
      libraryLessonFixture({ contentStatus: "completed" }),
      libraryLessonFixture({ contentRunId: randomUUID(), contentStatus: "running" }),
    ]);

    await expect(pullLessonForFix(published.id)).resolves.toBe(true);
    await expect(pullLessonForFix(published.id)).resolves.toBe(false);
    await expect(pullLessonForFix(rewriting.id)).resolves.toBe(false);

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: published.id } }),
    ).resolves.toMatchObject({ contentStatus: "failed" });
  });

  it("marks each plan reading the lesson's skill changed, and no other", async () => {
    const [user, other, skill, published] = await Promise.all([
      userFixture(),
      userFixture(),
      skillFixture(),
      libraryLessonFixture({ contentStatus: "completed" }),
    ]);

    const [goal, otherGoal] = await Promise.all([
      goalFixture({ userId: user.id }),
      goalFixture({ userId: other.id }),
      lessonSkillFixture({ lessonId: published.id, skillId: skill.id }),
    ]);

    const [dependent, unrelated] = await Promise.all([
      planFixture({ goalId: goal.id, sourceSkillIds: [skill.id] }),
      planFixture({ goalId: otherGoal.id, sourceSkillIds: [] }),
    ]);

    await expect(pullLessonForFix(published.id)).resolves.toBe(true);
    await expect(pullLessonForFix(published.id)).resolves.toBe(false);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: dependent.id } }),
    ).resolves.toMatchObject({
      inputVersion: dependent.inputVersion,
      sourceVersion: dependent.sourceVersion + 1,
    });

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: unrelated.id } }),
    ).resolves.toMatchObject({
      inputVersion: unrelated.inputVersion,
      sourceVersion: unrelated.sourceVersion,
    });
  });
});
