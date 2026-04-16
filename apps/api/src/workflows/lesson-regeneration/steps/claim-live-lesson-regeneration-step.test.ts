import { randomUUID } from "node:crypto";
import { type LessonContext } from "@/workflows/lesson-generation/steps/get-lesson-step";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { claimLiveLessonRegenerationStep } from "./claim-live-lesson-regeneration-step";

/**
 * The regeneration claim step needs the same lesson shape that the workflow
 * passes in after loading the live lesson. Keeping that query in the test
 * avoids inventing a partial object that would diverge from production.
 */
async function getLessonContext(lessonId: number): Promise<LessonContext> {
  return prisma.lesson.findUniqueOrThrow({
    include: {
      _count: { select: { activities: true } },
      chapter: { include: { course: true } },
    },
    where: { id: lessonId },
  });
}

describe(claimLiveLessonRegenerationStep, () => {
  let chapterId: number;
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Regeneration Claim Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  test.each(["completed", "failed", "pending"] as const)(
    "claims an outdated %s ai lesson exactly once",
    async (generationStatus) => {
      const lesson = await lessonFixture({
        chapterId,
        generationStatus,
        generationVersion: 0,
        managementMode: "ai",
        organizationId,
        title: `Claim ${generationStatus} ${randomUUID()}`,
      });

      const firstClaim = await claimLiveLessonRegenerationStep({
        lesson: await getLessonContext(lesson.id),
        workflowRunId: "run-1",
      });

      const secondClaim = await claimLiveLessonRegenerationStep({
        lesson: await getLessonContext(lesson.id),
        workflowRunId: "run-2",
      });

      const updated = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });

      expect(firstClaim).toBe(true);
      expect(secondClaim).toBe(false);
      expect(updated.generationStatus).toBe(generationStatus);
      expect(updated.generationRunId).toBe("run-1");
      expect(updated.isRegenerating).toBe(true);
    },
  );

  test("does not claim outdated lessons that already have an in-flight regeneration run", async () => {
    const lesson = await lessonFixture({
      chapterId,
      generationStatus: "completed",
      generationVersion: 0,
      isRegenerating: true,
      managementMode: "ai",
      organizationId,
      title: `running ${randomUUID()}`,
    });

    const claimed = await claimLiveLessonRegenerationStep({
      lesson: await getLessonContext(lesson.id),
      workflowRunId: "run-running",
    });

    const updated = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });

    expect(claimed).toBe(false);
    expect(updated.generationStatus).toBe("completed");
    expect(updated.generationRunId).toBeNull();
    expect(updated.isRegenerating).toBe(true);
  });

  test("does not claim current or manual lessons", async () => {
    const [currentLesson, manualLesson] = await Promise.all([
      lessonFixture({
        chapterId,
        generationStatus: "completed",
        generationVersion: 1,
        managementMode: "ai",
        organizationId,
        title: `Current ${randomUUID()}`,
      }),
      lessonFixture({
        chapterId,
        generationStatus: "completed",
        generationVersion: 0,
        managementMode: "manual",
        organizationId,
        title: `Manual ${randomUUID()}`,
      }),
    ]);

    const [currentClaimed, manualClaimed] = await Promise.all([
      claimLiveLessonRegenerationStep({
        lesson: await getLessonContext(currentLesson.id),
        workflowRunId: "run-current",
      }),
      claimLiveLessonRegenerationStep({
        lesson: await getLessonContext(manualLesson.id),
        workflowRunId: "run-manual",
      }),
    ]);

    const [updatedCurrent, updatedManual] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({ where: { id: currentLesson.id } }),
      prisma.lesson.findUniqueOrThrow({ where: { id: manualLesson.id } }),
    ]);

    expect(currentClaimed).toBe(false);
    expect(manualClaimed).toBe(false);
    expect(updatedCurrent.generationStatus).toBe("completed");
    expect(updatedManual.generationStatus).toBe("completed");
    expect(updatedCurrent.generationRunId).toBeNull();
    expect(updatedManual.generationRunId).toBeNull();
    expect(updatedCurrent.isRegenerating).toBe(false);
    expect(updatedManual.isRegenerating).toBe(false);
  });
});
