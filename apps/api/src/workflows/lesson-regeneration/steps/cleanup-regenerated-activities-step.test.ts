import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { cleanupRegeneratedActivitiesStep } from "./cleanup-regenerated-activities-step";

describe(cleanupRegeneratedActivitiesStep, () => {
  let chapterId: number;
  let organizationId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Cleanup Activities Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  test("removes only unpublished replacement activities for the lesson", async () => {
    const lesson = await lessonFixture({
      chapterId,
      generationStatus: "completed",
      isPublished: true,
      managementMode: "ai",
      organizationId,
      title: `Cleanup Activities Lesson ${randomUUID()}`,
    });

    const [publishedActivity, replacementActivity, otherUnpublishedActivity] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        managementMode: "ai",
        organizationId,
        position: 0,
      }),
      activityFixture({
        generationRunId: "run-1",
        generationStatus: "pending",
        isPublished: false,
        lessonId: lesson.id,
        managementMode: "ai",
        organizationId,
        position: 1,
      }),
      activityFixture({
        generationRunId: "run-2",
        generationStatus: "pending",
        isPublished: false,
        lessonId: lesson.id,
        managementMode: "ai",
        organizationId,
        position: 2,
      }),
    ]);

    await cleanupRegeneratedActivitiesStep({
      lessonId: lesson.id,
    });

    const remainingActivities = await prisma.activity.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    });

    expect(remainingActivities.map((activity) => activity.id)).toEqual([publishedActivity.id]);

    await expect(
      cleanupRegeneratedActivitiesStep({
        lessonId: lesson.id,
      }),
    ).resolves.toBeUndefined();

    const deletedActivity = await prisma.activity.findUnique({
      where: { id: replacementActivity.id },
    });

    expect(deletedActivity).toBeNull();
    await expect(
      prisma.activity.findUnique({
        where: { id: otherUnpublishedActivity.id },
      }),
    ).resolves.toBeNull();
  });
});
