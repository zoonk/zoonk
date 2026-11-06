import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it } from "vitest";
import { completeLessonContent, isLessonSavedByRun } from "./lesson-generation-state";

describe(completeLessonContent, () => {
  it("reports the run's lesson ready, again when its step runs twice, and never another run's", async () => {
    const workflowRunId = randomUUID();
    const saved = new Date("2026-01-01T00:00:00Z");

    const lesson = await libraryLessonFixture({
      contentRunId: workflowRunId,
      contentStatus: "running",
      updatedAt: saved,
    });

    await expect(
      completeLessonContent({ lessonId: lesson.id, workflowRunId: randomUUID() }),
    ).resolves.toBe(false);

    await expect(completeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toBe(true);
    await expect(completeLessonContent({ lessonId: lesson.id, workflowRunId })).resolves.toBe(true);

    const stored = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });

    expect(stored.contentStatus).toBe("completed");
    expect(stored.updatedAt.getTime()).toBeGreaterThan(saved.getTime());
  });
});

describe(isLessonSavedByRun, () => {
  it("finds the screens a run saved while its lesson waits for its pictures, and none for another run", async () => {
    const workflowRunId = randomUUID();
    const claim = { contentRunId: workflowRunId, contentStatus: "running" } as const;

    const [{ lesson }, unwritten] = await Promise.all([
      playableLessonFixture({ lesson: claim, steps: ["explanation"] }),
      libraryLessonFixture(claim),
    ]);

    await expect(
      Promise.all([
        isLessonSavedByRun({ lessonId: lesson.id, workflowRunId }),
        isLessonSavedByRun({ lessonId: lesson.id, workflowRunId: randomUUID() }),
        isLessonSavedByRun({ lessonId: unwritten.id, workflowRunId }),
      ]),
    ).resolves.toStrictEqual([true, false, false]);
  });
});
