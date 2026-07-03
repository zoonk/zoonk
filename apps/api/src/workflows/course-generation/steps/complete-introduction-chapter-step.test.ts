import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { completeIntroductionChapterStep } from "./complete-introduction-chapter-step";

describe(completeIntroductionChapterStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("marks an intro chapter completed without changing its run id", async () => {
    const course = await courseFixture({ organizationId });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationRunId: `run-${randomUUID()}`,
      generationStatus: "running",
      organizationId,
      position: 0,
      title: `Intro ${randomUUID()}`,
    });

    await completeIntroductionChapterStep(chapter.id);

    const updatedChapter = await prisma.chapter.findUniqueOrThrow({ where: { id: chapter.id } });

    expect(updatedChapter.generationStatus).toBe("completed");
    expect(updatedChapter.generationRunId).toBe(chapter.generationRunId);
  });
});
