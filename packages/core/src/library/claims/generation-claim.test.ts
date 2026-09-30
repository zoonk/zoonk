import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { revalidateTag } from "next/cache";
import { describe, expect, it } from "vitest";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { claimLibraryGeneration, finishLibraryGeneration } from "./generation-claim";

describe(claimLibraryGeneration, () => {
  it("lets exactly one of two racing workflows claim a lesson's content", async () => {
    const lesson = await libraryLessonFixture();
    const [firstRun, secondRun] = [randomUUID(), randomUUID()];

    const results = await Promise.all([
      claimLibraryGeneration({ id: lesson.id, target: "lessonContent", workflowRunId: firstRun }),
      claimLibraryGeneration({ id: lesson.id, target: "lessonContent", workflowRunId: secondRun }),
    ]);

    expect(results.toSorted()).toStrictEqual(["claimed", "running"]);

    const stored = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    const winner = results[0] === "claimed" ? firstRun : secondRun;

    expect(stored).toMatchObject({ contentRunId: winner, contentStatus: "running" });
    expect(revalidateTag).toHaveBeenCalledWith(getLibraryLessonCacheTag(lesson.id), { expire: 0 });
  });

  it("keeps a claim for the run that holds it when its step retries", async () => {
    const chapter = await libraryChapterFixture();
    const workflowRunId = randomUUID();
    const claim = { id: chapter.id, target: "chapterOutline" as const, workflowRunId };

    await expect(claimLibraryGeneration(claim)).resolves.toBe("claimed");
    await expect(claimLibraryGeneration(claim)).resolves.toBe("claimed");
  });

  it("reports completed work instead of claiming it again", async () => {
    const lesson = await libraryLessonFixture({ specStatus: "completed" });

    await expect(
      claimLibraryGeneration({ id: lesson.id, target: "lessonSpec", workflowRunId: randomUUID() }),
    ).resolves.toBe("completed");
  });

  it("clears a failed run's partial steps when a new run claims the content", async () => {
    const lesson = await libraryLessonFixture({ contentStatus: "failed" });
    await libraryStepFixture({ lessonId: lesson.id, position: 0 });

    await expect(
      claimLibraryGeneration({
        id: lesson.id,
        target: "lessonContent",
        workflowRunId: randomUUID(),
      }),
    ).resolves.toBe("claimed");

    await expect(prisma.step.count({ where: { lessonId: lesson.id } })).resolves.toBe(0);
  });

  it("claims the outline of a course made before outlines existed", async () => {
    const course = await courseFixture({ outlineStatus: null });

    await expect(
      claimLibraryGeneration({
        id: course.id,
        target: "courseOutline",
        workflowRunId: randomUUID(),
      }),
    ).resolves.toBe("claimed");
  });

  it("fails loudly for a row that doesn't exist", async () => {
    await expect(
      claimLibraryGeneration({ id: randomUUID(), target: "lessonContent", workflowRunId: "run" }),
    ).rejects.toThrow("missing row");
  });
});

describe(finishLibraryGeneration, () => {
  it("only lets the run holding the claim finish it", async () => {
    const lesson = await libraryLessonFixture();
    const workflowRunId = randomUUID();

    await claimLibraryGeneration({ id: lesson.id, target: "lessonContent", workflowRunId });

    await expect(
      finishLibraryGeneration({
        id: lesson.id,
        status: "completed",
        target: "lessonContent",
        workflowRunId: randomUUID(),
      }),
    ).resolves.toBe(false);

    await expect(
      finishLibraryGeneration({
        id: lesson.id,
        status: "completed",
        target: "lessonContent",
        workflowRunId,
      }),
    ).resolves.toBe(true);

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ contentRunId: workflowRunId, contentStatus: "completed" });
  });

  it("lets another run claim work that failed", async () => {
    const chapter = await libraryChapterFixture();
    const failedRun = randomUUID();

    await claimLibraryGeneration({
      id: chapter.id,
      target: "chapterOutline",
      workflowRunId: failedRun,
    });

    await finishLibraryGeneration({
      id: chapter.id,
      status: "failed",
      target: "chapterOutline",
      workflowRunId: failedRun,
    });

    await expect(
      claimLibraryGeneration({
        id: chapter.id,
        target: "chapterOutline",
        workflowRunId: randomUUID(),
      }),
    ).resolves.toBe("claimed");
  });
});
