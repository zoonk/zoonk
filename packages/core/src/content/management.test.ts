import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import {
  getContentManagementState,
  getDefaultContentManagementMode,
  getLessonGenerationState,
  getTargetLessonGenerationVersion,
} from "./management";

describe("content management", () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await organizationFixture({ kind: "brand" });
    organizationId = organization.id;
  });

  test("treats ai-managed content as eligible for automatic regeneration", async () => {
    const course = await courseFixture({
      managementMode: "ai",
      organizationId,
    });

    expect(getContentManagementState({ content: course })).toEqual({
      allowsAutomaticRegeneration: true,
      isAiManaged: true,
      isManual: false,
      isPinned: false,
      managementMode: "ai",
    });
  });

  test("keeps manual content out of automatic regeneration", async () => {
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({ courseId: course.id, organizationId });
    const lesson = await lessonFixture({ chapterId: chapter.id, organizationId });
    const activity = await activityFixture({
      lessonId: lesson.id,
      managementMode: "manual",
      organizationId,
    });

    expect(getContentManagementState({ content: activity })).toEqual({
      allowsAutomaticRegeneration: false,
      isAiManaged: false,
      isManual: true,
      isPinned: false,
      managementMode: "manual",
    });
  });

  test("keeps pinned content protected from automatic regeneration", async () => {
    const course = await courseFixture({
      managementMode: "pinned",
      organizationId,
    });

    expect(getContentManagementState({ content: course })).toEqual({
      allowsAutomaticRegeneration: false,
      isAiManaged: false,
      isManual: false,
      isPinned: true,
      managementMode: "pinned",
    });
  });
});

describe("lesson generation state", () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await organizationFixture({ kind: "brand" });
    organizationId = organization.id;
  });

  test.each(["core", "custom", "language"] as const)(
    "keeps ai-managed %s lessons current when their generation version matches the target",
    async (kind) => {
      const course = await courseFixture({ organizationId });
      const chapter = await chapterFixture({ courseId: course.id, organizationId });
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationVersion: getTargetLessonGenerationVersion(kind),
        kind,
        managementMode: "ai",
        organizationId,
      });

      expect(getLessonGenerationState({ lesson })).toEqual({
        allowsAutomaticRegeneration: true,
        currentGenerationVersion: 1,
        hasGenerationVersionMismatch: false,
        isAiManaged: true,
        isManual: false,
        isOutdated: false,
        isPinned: false,
        managementMode: "ai",
        targetGenerationVersion: 1,
      });
    },
  );

  test.each(["core", "custom", "language"] as const)(
    "marks ai-managed %s lessons as outdated when their generation version is missing",
    async (kind) => {
      const course = await courseFixture({ organizationId });
      const chapter = await chapterFixture({ courseId: course.id, organizationId });
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationVersion: null,
        kind,
        managementMode: "ai",
        organizationId,
      });

      expect(getLessonGenerationState({ lesson })).toEqual({
        allowsAutomaticRegeneration: true,
        currentGenerationVersion: null,
        hasGenerationVersionMismatch: true,
        isAiManaged: true,
        isManual: false,
        isOutdated: true,
        isPinned: false,
        managementMode: "ai",
        targetGenerationVersion: 1,
      });
    },
  );

  test("keeps manual lessons protected even when their version mismatches", async () => {
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({ courseId: course.id, organizationId });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationVersion: null,
      kind: "core",
      managementMode: "manual",
      organizationId,
    });

    expect(getLessonGenerationState({ lesson })).toEqual({
      allowsAutomaticRegeneration: false,
      currentGenerationVersion: null,
      hasGenerationVersionMismatch: true,
      isAiManaged: false,
      isManual: true,
      isOutdated: false,
      isPinned: false,
      managementMode: "manual",
      targetGenerationVersion: 1,
    });
  });
});

describe("default content management mode", () => {
  test("keeps ai-org content ai-managed by default", () => {
    expect(getDefaultContentManagementMode({ organizationSlug: "ai" })).toBe("ai");
  });

  test("keeps non-ai org content manual by default", () => {
    expect(getDefaultContentManagementMode({ organizationSlug: "customer-org" })).toBe("manual");
  });

  test("defaults missing organization slugs to manual", () => {
    expect(getDefaultContentManagementMode({ organizationSlug: null })).toBe("manual");
  });
});
