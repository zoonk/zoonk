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
    lessonGenerationWorkflowMock.mockImplementation(
      async (
        lessonId: number,
        options?: {
          generationRunId?: string;
          regeneration?: boolean;
        },
      ) => {
        await activityFixture({
          generationRunId: options?.generationRunId ?? null,
          generationStatus: "pending",
          isPublished: false,
          lessonId,
          managementMode: "ai",
          organizationId,
          position: 0,
          title: `Replacement Activity ${randomUUID()}`,
        });

        return "ready";
      },
    );
    activityGenerationWorkflowMock.mockImplementation(async (lessonId: number) => {
      await prisma.activity.updateMany({
        data: { generationStatus: "completed" },
        where: {
          archivedAt: null,
          isPublished: false,
          lessonId,
        },
      });
    });
  });

  test("keeps the live lesson row and swaps in regenerated activities", async () => {
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

    const [updatedLiveLesson, matchingLiveLessons, lessonActivities, preservedProgress] =
      await Promise.all([
        prisma.lesson.findUniqueOrThrow({ where: { id: liveLesson.id } }),
        prisma.lesson.findMany({
          where: {
            archivedAt: null,
            slug: liveLesson.slug,
          },
        }),
        prisma.activity.findMany({
          orderBy: { position: "asc" },
          where: { lessonId: liveLesson.id },
        }),
        prisma.activityProgress.findUnique({
          where: {
            userActivity: {
              activityId: liveActivity.id,
              userId: Number(user.id),
            },
          },
        }),
      ]);

    const archivedActivities = lessonActivities.filter((activity) => activity.archivedAt);
    const currentActivities = lessonActivities.filter((activity) => !activity.archivedAt);

    expect(updatedLiveLesson.archivedAt).toBeNull();
    expect(updatedLiveLesson.isPublished).toBe(true);
    expect(updatedLiveLesson.slug).toBe(liveLesson.slug);
    expect(updatedLiveLesson.generationRunId).toBe("test-run-id");
    expect(updatedLiveLesson.generationStatus).toBe("completed");
    expect(updatedLiveLesson.generationVersion).toBe(
      getTargetLessonGenerationVersion(liveLesson.kind),
    );
    expect(updatedLiveLesson.isRegenerating).toBe(false);
    expect(lessonGenerationWorkflowMock).toHaveBeenCalledWith(liveLesson.id, {
      generationRunId: "test-run-id",
      regeneration: true,
    });
    expect(activityGenerationWorkflowMock).toHaveBeenCalledWith(liveLesson.id, {
      regeneration: true,
    });
    expect(matchingLiveLessons).toHaveLength(1);
    expect(matchingLiveLessons[0]?.id).toBe(liveLesson.id);
    expect(archivedActivities).toHaveLength(1);
    expect(archivedActivities[0]?.id).toBe(liveActivity.id);
    expect(archivedActivities[0]?.isPublished).toBe(false);
    expect(currentActivities).toHaveLength(1);
    expect(currentActivities[0]?.id).not.toBe(liveActivity.id);
    expect(currentActivities[0]?.isPublished).toBe(true);
    expect(preservedProgress).not.toBeNull();
  });

  test("deletes stale hidden replacement activities before starting a new regeneration", async () => {
    const liveLesson = await lessonFixture({
      chapterId,
      generationStatus: "completed",
      generationVersion: 0,
      isPublished: true,
      managementMode: "ai",
      organizationId,
      title: `Stale Replacement Lesson ${randomUUID()}`,
    });

    const staleReplacementActivity = await activityFixture({
      generationRunId: "old-regen-run",
      generationStatus: "failed",
      isPublished: false,
      lessonId: liveLesson.id,
      managementMode: "ai",
      organizationId,
      position: 99,
      title: `Stale Replacement Activity ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: liveLesson.id,
      managementMode: "ai",
      organizationId,
      position: 0,
      title: `Current Live Activity ${randomUUID()}`,
    });

    await lessonRegenerationWorkflow({
      liveLesson: await getLessonContext(liveLesson.id),
    });

    const [remainingActivities, deletedStaleActivity] = await Promise.all([
      prisma.activity.findMany({
        orderBy: { position: "asc" },
        where: { lessonId: liveLesson.id },
      }),
      prisma.activity.findUnique({
        where: { id: staleReplacementActivity.id },
      }),
    ]);

    expect(deletedStaleActivity).toBeNull();
    expect(remainingActivities.filter((activity) => activity.archivedAt)).toHaveLength(1);
    expect(remainingActivities.filter((activity) => !activity.archivedAt)).toHaveLength(1);
  });

  test("publishes regenerated activities with fresh zero-based positions", async () => {
    lessonGenerationWorkflowMock.mockImplementationOnce(
      async (
        lessonId: number,
        options?: {
          generationRunId?: string;
          regeneration?: boolean;
        },
      ) => {
        await Promise.all([
          activityFixture({
            generationRunId: options?.generationRunId ?? null,
            generationStatus: "pending",
            isPublished: false,
            lessonId,
            managementMode: "ai",
            organizationId,
            position: 0,
            title: `Replacement Zero ${randomUUID()}`,
          }),
          activityFixture({
            generationRunId: options?.generationRunId ?? null,
            generationStatus: "pending",
            isPublished: false,
            lessonId,
            managementMode: "ai",
            organizationId,
            position: 1,
            title: `Replacement One ${randomUUID()}`,
          }),
          activityFixture({
            generationRunId: options?.generationRunId ?? null,
            generationStatus: "pending",
            isPublished: false,
            lessonId,
            managementMode: "ai",
            organizationId,
            position: 2,
            title: `Replacement Two ${randomUUID()}`,
          }),
        ]);

        return "ready";
      },
    );
    activityGenerationWorkflowMock.mockImplementationOnce(async (lessonId: number) => {
      await prisma.activity.updateMany({
        data: { generationStatus: "completed" },
        where: {
          archivedAt: null,
          isPublished: false,
          lessonId,
        },
      });
    });

    const liveLesson = await lessonFixture({
      chapterId,
      generationStatus: "completed",
      generationVersion: 0,
      isPublished: true,
      managementMode: "ai",
      organizationId,
      title: `Positioned Replacement Lesson ${randomUUID()}`,
    });

    await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: liveLesson.id,
        managementMode: "ai",
        organizationId,
        position: 0,
        title: `Old Activity Zero ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: liveLesson.id,
        managementMode: "ai",
        organizationId,
        position: 1,
        title: `Old Activity One ${randomUUID()}`,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: liveLesson.id,
        managementMode: "ai",
        organizationId,
        position: 2,
        title: `Old Activity Two ${randomUUID()}`,
      }),
    ]);

    await lessonRegenerationWorkflow({
      liveLesson: await getLessonContext(liveLesson.id),
    });

    const currentActivities = await prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: {
        archivedAt: null,
        isPublished: true,
        lessonId: liveLesson.id,
      },
    });

    expect(currentActivities).toHaveLength(3);
    expect(currentActivities.map((activity) => activity.position)).toEqual([0, 1, 2]);
  });

  test("keeps the live lesson intact when regeneration crashes", async () => {
    lessonGenerationWorkflowMock.mockRejectedValueOnce(new Error("activity setup failed"));

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
    ).rejects.toThrow("activity setup failed");

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
    expect(updatedLiveLesson.generationRunId).toBe("test-run-id");
    expect(updatedLiveLesson.generationStatus).toBe("completed");
    expect(updatedLiveLesson.generationVersion).toBe(0);
    expect(updatedLiveLesson.isRegenerating).toBe(false);
    expect(updatedLiveLesson.slug).toBe(liveLesson.slug);
    expect(lessons).toHaveLength(1);
  });

  test("deletes hidden replacement activities when activity regeneration fails", async () => {
    activityGenerationWorkflowMock.mockImplementationOnce(async (lessonId: number) => {
      await prisma.activity.updateMany({
        data: { generationStatus: "running" },
        where: {
          archivedAt: null,
          isPublished: false,
          lessonId,
        },
      });

      throw new Error("replacement generation failed");
    });

    const liveLesson = await lessonFixture({
      chapterId,
      generationStatus: "completed",
      generationVersion: 0,
      isPublished: true,
      managementMode: "ai",
      organizationId,
      title: `Failed Replacement Lesson ${randomUUID()}`,
    });

    const liveActivity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: liveLesson.id,
      managementMode: "ai",
      organizationId,
      position: 0,
      title: `Existing Published Activity ${randomUUID()}`,
    });

    await expect(
      lessonRegenerationWorkflow({
        liveLesson: await getLessonContext(liveLesson.id),
      }),
    ).rejects.toThrow("replacement generation failed");

    const [updatedLiveLesson, remainingActivities] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({
        where: { id: liveLesson.id },
      }),
      prisma.activity.findMany({
        orderBy: { position: "asc" },
        where: { lessonId: liveLesson.id },
      }),
    ]);

    expect(updatedLiveLesson.generationVersion).toBe(0);
    expect(updatedLiveLesson.generationStatus).toBe("completed");
    expect(updatedLiveLesson.isRegenerating).toBe(false);
    expect(remainingActivities).toHaveLength(1);
    expect(remainingActivities[0]?.id).toBe(liveActivity.id);
    expect(remainingActivities[0]?.isPublished).toBe(true);
    expect(remainingActivities[0]?.archivedAt).toBeNull();
  });

  test("treats unexpected filtered regeneration as a failure and leaves the version outdated", async () => {
    lessonGenerationWorkflowMock.mockResolvedValueOnce("filtered");

    const liveLesson = await lessonFixture({
      chapterId,
      generationStatus: "completed",
      generationVersion: 0,
      isPublished: true,
      kind: "core",
      managementMode: "ai",
      organizationId,
      title: `Unexpected Filter ${randomUUID()}`,
    });

    const liveActivity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: liveLesson.id,
      managementMode: "ai",
      organizationId,
      position: 0,
      title: `Unexpected Filter Activity ${randomUUID()}`,
    });

    await expect(
      lessonRegenerationWorkflow({
        liveLesson: await getLessonContext(liveLesson.id),
      }),
    ).rejects.toThrow("Regeneration unexpectedly returned a filtered lesson");

    const [updatedLiveLesson, lessonActivities] = await Promise.all([
      prisma.lesson.findUniqueOrThrow({
        where: { id: liveLesson.id },
      }),
      prisma.activity.findMany({
        orderBy: { position: "asc" },
        where: {
          archivedAt: null,
          lessonId: liveLesson.id,
        },
      }),
    ]);

    expect(updatedLiveLesson.archivedAt).toBeNull();
    expect(updatedLiveLesson.generationRunId).toBe("test-run-id");
    expect(updatedLiveLesson.generationStatus).toBe("completed");
    expect(updatedLiveLesson.generationVersion).toBe(0);
    expect(updatedLiveLesson.isRegenerating).toBe(false);
    expect(lessonActivities).toHaveLength(1);
    expect(lessonActivities[0]?.id).toBe(liveActivity.id);
  });
});
