import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import {
  getDefaultContentManagementMode,
  getLessonGenerationState,
  getTargetLessonGenerationVersion,
} from "./management";

function createLessonEligibilityInput(input: { managementMode: "ai" | "manual" | "pinned" }) {
  return {
    generationStatus: "completed" as const,
    generationVersion: 1,
    kind: "core" as const,
    managementMode: input.managementMode,
  };
}

describe("content management", () => {
  test("treats ai-managed lessons as eligible for automatic regeneration", () => {
    expect(
      getLessonGenerationState({
        lesson: createLessonEligibilityInput({ managementMode: "ai" }),
      }),
    ).toMatchObject({
      allowsAutomaticRegeneration: true,
      managementMode: "ai",
    });
  });

  test("keeps manual lessons out of automatic regeneration", () => {
    expect(
      getLessonGenerationState({
        lesson: createLessonEligibilityInput({ managementMode: "manual" }),
      }),
    ).toMatchObject({
      allowsAutomaticRegeneration: false,
      managementMode: "manual",
    });
  });

  test("keeps pinned lessons protected from automatic regeneration", () => {
    expect(
      getLessonGenerationState({
        lesson: createLessonEligibilityInput({ managementMode: "pinned" }),
      }),
    ).toMatchObject({
      allowsAutomaticRegeneration: false,
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
        needsInitialGeneration: false,
        shouldAutoEnqueueRegeneration: false,
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
        needsInitialGeneration: true,
        shouldAutoEnqueueRegeneration: false,
        targetGenerationVersion: 1,
      });
    },
  );

  test.each([
    { generationStatus: "completed" as const, shouldAutoEnqueueRegeneration: true },
    { generationStatus: "failed" as const, shouldAutoEnqueueRegeneration: true },
    { generationStatus: "pending" as const, shouldAutoEnqueueRegeneration: true },
    { generationStatus: "running" as const, shouldAutoEnqueueRegeneration: false },
  ])(
    "routes outdated versioned ai lessons with status $generationStatus into the right regeneration path",
    async ({ generationStatus, shouldAutoEnqueueRegeneration }) => {
      const course = await courseFixture({ organizationId });
      const chapter = await chapterFixture({ courseId: course.id, organizationId });
      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus,
        generationVersion: 0,
        kind: "core",
        managementMode: "ai",
        organizationId,
      });

      expect(getLessonGenerationState({ lesson })).toMatchObject({
        isOutdated: true,
        needsInitialGeneration: false,
        shouldAutoEnqueueRegeneration,
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
      hasGenerationVersionMismatch: false,
      isAiManaged: false,
      isManual: true,
      isOutdated: false,
      isPinned: false,
      managementMode: "manual",
      needsInitialGeneration: false,
      shouldAutoEnqueueRegeneration: false,
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
