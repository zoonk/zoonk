import { randomUUID } from "node:crypto";
import { type LessonContext } from "@/workflows/lesson-generation/steps/get-lesson-step";
import { getTargetLessonGenerationVersion } from "@zoonk/core/content/management";
import { prisma } from "@zoonk/db";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { lessonRegenerationWorkflow } from "./lesson-regeneration-workflow";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: writeMock,
    }),
  }),
}));

const { activityGenerationWorkflowMock } = vi.hoisted(() => ({
  activityGenerationWorkflowMock: vi.fn(),
}));

const { lessonGenerationWorkflowMock } = vi.hoisted(() => ({
  lessonGenerationWorkflowMock: vi.fn(),
}));

vi.mock("../activity-generation/activity-generation-workflow", () => ({
  activityGenerationWorkflow: activityGenerationWorkflowMock,
}));

vi.mock("../lesson-generation/lesson-generation-workflow", () => ({
  lessonGenerationWorkflow: lessonGenerationWorkflowMock,
}));

/**
 * The regeneration workflow receives a fully loaded live lesson context. Tests
 * use the same query shape so promotion and cleanup assertions run against the
 * exact data contract the workflow consumes in production.
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

/**
 * The mocked nested generation workflow needs to leave the draft lesson in the
 * same state the real generator would: completed and stamped with the target
 * version for that lesson kind.
 */
async function completeDraftLesson(lessonId: number) {
  const draftLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });

  await prisma.lesson.update({
    data: {
      generationRunId: "test-run-id",
      generationStatus: "completed",
      generationVersion: getTargetLessonGenerationVersion(draftLesson.kind),
    },
    where: { id: lessonId },
  });
}

describe(lessonRegenerationWorkflow, () => {
  let chapterId: number;
  let organizationId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Regeneration Workflow Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    lessonGenerationWorkflowMock.mockImplementation(async (lessonId: number) => {
      await completeDraftLesson(lessonId);
    });
    activityGenerationWorkflowMock.mockImplementation(async (lessonId: number) => {
      const draftLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });

      await activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: draftLesson.id,
        managementMode: "ai",
        organizationId: draftLesson.organizationId,
        position: 0,
        title: `Draft Activity ${randomUUID()}`,
      });
    });
  });

  test("archives learner-touched live lessons and promotes the draft", async () => {
    const user = await userFixture();
    const liveLesson = await lessonFixture({
      chapterId,
      generationStatus: "completed",
      generationVersion: 0,
      isPublished: true,
      managementMode: "ai",
      organizationId,
      title: `Live Lesson ${randomUUID()}`,
    });

    const liveActivity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: liveLesson.id,
      managementMode: "ai",
      organizationId,
      position: 0,
      title: `Live Activity ${randomUUID()}`,
    });

    await activityProgressFixture({
      activityId: liveActivity.id,
      completedAt: new Date(),
      durationSeconds: 30,
      userId: Number(user.id),
    });

    await lessonRegenerationWorkflow({
      liveLesson: await getLessonContext(liveLesson.id),
    });

    const archivedLiveLesson = await prisma.lesson.findUniqueOrThrow({
      where: { id: liveLesson.id },
    });
    const promotedLesson = await prisma.lesson.findFirstOrThrow({
      where: {
        archivedAt: null,
        chapterId,
        slug: liveLesson.slug,
      },
    });

    expect(archivedLiveLesson.archivedAt).toBeTruthy();
    expect(archivedLiveLesson.isPublished).toBe(false);
    expect(archivedLiveLesson.generationVersion).toBe(0);
    expect(archivedLiveLesson.slug).toContain(`archived-${liveLesson.id}`);
    expect(promotedLesson.id).not.toBe(liveLesson.id);
    expect(promotedLesson.isPublished).toBe(true);
    expect(promotedLesson.generationStatus).toBe("completed");
    expect(promotedLesson.generationVersion).toBe(1);
  });

  test("hard-deletes untouched live lessons before promoting the draft", async () => {
    const liveLesson = await lessonFixture({
      chapterId,
      generationStatus: "completed",
      generationVersion: 0,
      isPublished: true,
      managementMode: "ai",
      organizationId,
      title: `Delete Live Lesson ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: liveLesson.id,
      managementMode: "ai",
      organizationId,
      position: 0,
      title: `Delete Live Activity ${randomUUID()}`,
    });

    await lessonRegenerationWorkflow({
      liveLesson: await getLessonContext(liveLesson.id),
    });

    const [deletedLiveLesson, promotedLesson] = await Promise.all([
      prisma.lesson.findUnique({ where: { id: liveLesson.id } }),
      prisma.lesson.findFirstOrThrow({
        where: {
          archivedAt: null,
          chapterId,
          slug: liveLesson.slug,
        },
      }),
    ]);

    expect(deletedLiveLesson).toBeNull();
    expect(promotedLesson.id).not.toBe(liveLesson.id);
    expect(promotedLesson.generationVersion).toBe(1);
  });

  test("keeps the live lesson intact and marks it failed when regeneration crashes", async () => {
    lessonGenerationWorkflowMock.mockRejectedValueOnce(new Error("draft generation failed"));

    const liveLesson = await lessonFixture({
      chapterId,
      generationStatus: "completed",
      generationVersion: 0,
      isPublished: true,
      managementMode: "ai",
      organizationId,
      title: `Failed Live Lesson ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: liveLesson.id,
      managementMode: "ai",
      organizationId,
      position: 0,
      title: `Failed Live Activity ${randomUUID()}`,
    });

    await expect(
      lessonRegenerationWorkflow({
        liveLesson: await getLessonContext(liveLesson.id),
      }),
    ).rejects.toThrow("draft generation failed");

    const lessons = await prisma.lesson.findMany({
      where: {
        OR: [{ id: liveLesson.id }, { slug: liveLesson.slug }],
        chapterId,
      },
    });
    const updatedLiveLesson = await prisma.lesson.findUniqueOrThrow({
      where: { id: liveLesson.id },
    });

    expect(updatedLiveLesson.archivedAt).toBeNull();
    expect(updatedLiveLesson.generationStatus).toBe("failed");
    expect(updatedLiveLesson.generationVersion).toBe(0);
    expect(updatedLiveLesson.slug).toBe(liveLesson.slug);
    expect(lessons).toHaveLength(1);
  });
});
