import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { releaseLiveLessonRegenerationStep } from "./release-live-lesson-regeneration-step";

describe(releaseLiveLessonRegenerationStep, () => {
  let chapterId: string;
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Release Regen Claim Chapter ${randomUUID()}`,
    });
    chapterId = chapter.id;
  });

  test("clears the in-flight regeneration claim without restamping freshness", async () => {
    const lesson = await lessonFixture({
      chapterId,
      generationRunId: "run-1",
      generationStatus: "completed",
      generationVersion: 0,
      isRegenerating: true,
      kind: "core",
      managementMode: "ai",
      organizationId,
      title: `Release Regen Claim ${randomUUID()}`,
    });

    await releaseLiveLessonRegenerationStep({
      lessonId: lesson.id,
    });

    const updated = await prisma.lesson.findUniqueOrThrow({
      where: { id: lesson.id },
    });

    expect(updated.generationRunId).toBe("run-1");
    expect(updated.generationStatus).toBe("completed");
    expect(updated.generationVersion).toBe(0);
    expect(updated.isRegenerating).toBe(false);
  });
});
