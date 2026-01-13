import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { AI_ORG_ID } from "@zoonk/utils/constants";
import { beforeAll, describe, expect, test } from "vitest";
import { updateChapterGenerationStatus } from "./update-chapter-generation-status";

describe("updateChapterGenerationStatus", () => {
  let course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    course = await courseFixture({ organizationId: AI_ORG_ID });
  });

  test("updates generation status", async () => {
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId: AI_ORG_ID,
    });

    const result = await updateChapterGenerationStatus({
      chapterId: chapter.id,
      generationStatus: "completed",
    });

    expect(result.error).toBeNull();

    const dbChapter = await prisma.chapter.findUnique({
      where: { id: chapter.id },
    });

    expect(dbChapter?.generationRunId).toBeNull();
    expect(dbChapter?.generationStatus).toBe("completed");
  });

  test("updates generation status with run ID", async () => {
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId: AI_ORG_ID,
    });

    const runId = randomUUID();

    const result = await updateChapterGenerationStatus({
      chapterId: chapter.id,
      generationRunId: runId,
      generationStatus: "completed",
    });

    expect(result.error).toBeNull();

    const dbChapter = await prisma.chapter.findUnique({
      where: { id: chapter.id },
    });

    expect(dbChapter?.generationStatus).toBe("completed");
    expect(dbChapter?.generationRunId).toBe(runId);
  });
});
