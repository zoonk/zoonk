import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { getContentManagementState } from "./management";

describe("content management", () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await organizationFixture({ kind: "brand" });
    organizationId = organization.id;
  });

  test("treats stale AI-managed lessons as eligible for automatic regeneration", async () => {
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({ courseId: course.id, organizationId });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      managementMode: "ai",
      organizationId,
      staleAt: new Date("2026-04-10T12:00:00.000Z"),
    });

    const result = getContentManagementState({
      content: lesson,
      now: new Date("2026-04-10T12:01:00.000Z"),
    });

    expect(result).toEqual({
      isAiManaged: true,
      isAutomaticRegenerationEligible: true,
      isManual: false,
      isPinned: false,
      isStale: true,
      managementMode: "ai",
    });
  });

  test("keeps manual lessons out of automatic regeneration even when staleAt has passed", async () => {
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({ courseId: course.id, organizationId });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      managementMode: "manual",
      organizationId,
      staleAt: new Date("2026-04-10T12:00:00.000Z"),
    });

    const result = getContentManagementState({
      content: lesson,
      now: new Date("2026-04-10T12:01:00.000Z"),
    });

    expect(result).toEqual({
      isAiManaged: false,
      isAutomaticRegenerationEligible: false,
      isManual: true,
      isPinned: false,
      isStale: false,
      managementMode: "manual",
    });
  });

  test("keeps pinned activities out of automatic regeneration even when staleAt has passed", async () => {
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({ courseId: course.id, organizationId });
    const lesson = await lessonFixture({ chapterId: chapter.id, organizationId });
    const activity = await activityFixture({
      lessonId: lesson.id,
      managementMode: "pinned",
      organizationId,
      staleAt: new Date("2026-04-10T12:00:00.000Z"),
    });

    const result = getContentManagementState({
      content: activity,
      now: new Date("2026-04-10T12:01:00.000Z"),
    });

    expect(result).toEqual({
      isAiManaged: false,
      isAutomaticRegenerationEligible: false,
      isManual: false,
      isPinned: true,
      isStale: false,
      managementMode: "pinned",
    });
  });

  test("keeps AI-managed content fresh until staleAt is reached", async () => {
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({ courseId: course.id, organizationId });
    const lesson = await lessonFixture({ chapterId: chapter.id, organizationId });
    const activity = await activityFixture({
      lessonId: lesson.id,
      managementMode: "ai",
      organizationId,
      staleAt: new Date("2026-04-10T12:05:00.000Z"),
    });

    const result = getContentManagementState({
      content: activity,
      now: new Date("2026-04-10T12:01:00.000Z"),
    });

    expect(result).toEqual({
      isAiManaged: true,
      isAutomaticRegenerationEligible: false,
      isManual: false,
      isPinned: false,
      isStale: false,
      managementMode: "ai",
    });
  });
});
