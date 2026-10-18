import { prisma } from "@zoonk/db";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { backfillLessonMistakes } from "../../scripts/_utils/backfill-lesson-mistakes";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { mistakeListInputSchema } from "./contract";
import { listCurrentUserMistakes } from "./list-current-user-mistakes";

describe("backfilling hidden lesson mistakes", () => {
  it("recovers an old untagged miss into its goal's notebook without changing its snapshot or status", async () => {
    const [user, lesson, skill] = await Promise.all([
      userFixture(),
      libraryLessonFixture(),
      skillFixture(),
    ]);

    const { goal, planItems } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1],
      userId: user.id,
    });

    await Promise.all([
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
      prisma.planItem.update({ data: { lessonId: lesson.id }, where: { id: planItems[0]?.id } }),
    ]);

    const step = await libraryStepFixture({ kind: "check", lessonId: lesson.id });
    const attempt = await attemptFixture({ isCorrect: false, stepId: step.id, userId: user.id });

    const mistake = await mistakeFixture({
      attemptId: attempt.id,
      stepId: step.id,
      userId: user.id,
    });

    mockSession(user.id);

    const scope = { lessonIds: [lesson.id], userIds: [user.id] };
    const before = await listCurrentUserMistakes(mistakeListInputSchema.parse({ goalId: goal.id }));
    expect(before).toMatchObject({ counts: { open: 0 }, mistakes: [], status: "ready" });
    const preview = await backfillLessonMistakes({ ...scope, dryRun: true });

    expect(preview).toMatchObject({
      attempts: { recoverable: 1, repaired: 0 },
      mistakes: { recoverable: 1, repaired: 0 },
      steps: { recoverable: 1, repaired: 0 },
    });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ skillId: null });

    const recovered = await backfillLessonMistakes({ ...scope, dryRun: false });

    expect(recovered).toMatchObject({
      attempts: { repaired: 1 },
      mistakes: { repaired: 1 },
      steps: { repaired: 1 },
    });

    const notebook = await listCurrentUserMistakes(
      mistakeListInputSchema.parse({ goalId: goal.id }),
    );

    expect(notebook).toMatchObject({
      counts: { open: 1 },
      mistakes: [{ id: mistake.id, snapshot: mistake.snapshot, status: "open" }],
      status: "ready",
    });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ skillId: skill.id });

    await expect(
      prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id } }),
    ).resolves.toMatchObject({
      answer: attempt.answer,
      answeredAt: attempt.answeredAt,
      isCorrect: false,
      skillId: skill.id,
    });

    await expect(backfillLessonMistakes({ ...scope, dryRun: false })).resolves.toMatchObject({
      attempts: { recoverable: 0, repaired: 0 },
      mistakes: { recoverable: 0, repaired: 0 },
      steps: { recoverable: 0, repaired: 0 },
    });
  });

  it("recovers a retired screen, an attempt-only link and a fixed miss while keeping existing attribution", async () => {
    const [user, lesson, fallback, exact] = await Promise.all([
      userFixture(),
      libraryLessonFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    await lessonSkillFixture({ lessonId: lesson.id, skillId: fallback.id });

    const step = await libraryStepFixture({
      kind: "check",
      lessonId: lesson.id,
      retiredAt: new Date(),
    });

    const attempt = await attemptFixture({
      isCorrect: false,
      skillId: exact.id,
      stepId: step.id,
      userId: user.id,
    });

    const fixedAt = new Date();

    const [fixed, attributed] = await Promise.all([
      mistakeFixture({ attemptId: attempt.id, fixedAt, status: "fixed", userId: user.id }),
      mistakeFixture({ skillId: exact.id, stepId: step.id, userId: user.id }),
    ]);

    await backfillLessonMistakes({ dryRun: false, userIds: [user.id] });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: fixed.id } }),
    ).resolves.toMatchObject({
      fixedAt,
      skillId: exact.id,
      snapshot: fixed.snapshot,
      status: "fixed",
    });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: attributed.id } }),
    ).resolves.toStrictEqual(attributed);

    await expect(
      prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id } }),
    ).resolves.toStrictEqual(attempt);

    await expect(prisma.step.findUniqueOrThrow({ where: { id: step.id } })).resolves.toMatchObject({
      retiredAt: step.retiredAt,
      skillId: fallback.id,
    });
  });

  it("reports unrecoverable rows and leaves reading screens and learner history untouched", async () => {
    const [user, lesson] = await Promise.all([userFixture(), libraryLessonFixture()]);

    const [question, reading] = await Promise.all([
      libraryStepFixture({ kind: "check", lessonId: lesson.id, position: 0 }),
      libraryStepFixture({ kind: "explanation", lessonId: lesson.id, position: 1 }),
    ]);

    const [attempt] = await Promise.all([
      attemptFixture({ stepId: question.id, userId: user.id }),
      attemptFixture({ stepId: reading.id, userId: user.id }),
    ]);

    const miss = await mistakeFixture({
      attemptId: attempt.id,
      stepId: question.id,
      userId: user.id,
    });

    const orphan = await mistakeFixture({ userId: user.id });

    await expect(
      backfillLessonMistakes({ dryRun: false, userIds: [user.id] }),
    ).resolves.toMatchObject({
      attempts: { repaired: 0, unresolved: 2 },
      mistakes: { repaired: 0, unresolved: 2 },
      steps: { recoverable: 0, repaired: 0, unresolved: 1 },
    });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: miss.id } }),
    ).resolves.toStrictEqual(miss);

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: orphan.id } }),
    ).resolves.toStrictEqual(orphan);

    await expect(
      prisma.step.findUniqueOrThrow({ where: { id: reading.id } }),
    ).resolves.toStrictEqual(reading);

    await expect(prisma.learnerSkill.count({ where: { userId: user.id } })).resolves.toBe(0);
  });
});
