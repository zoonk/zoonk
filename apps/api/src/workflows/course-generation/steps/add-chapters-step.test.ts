import { courseContext, curriculumChapters } from "@/workflows/_test-utils/curriculum";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { addChaptersStep } from "./add-chapters-step";

const chapters = ["overview", "basic", "intermediate", "advanced"].flatMap((level) =>
  curriculumChapters(level as "overview" | "basic" | "intermediate" | "advanced"),
);

describe(addChaptersStep, () => {
  it("atomically installs the complete outline, levels, outcomes and prerequisites from position zero", async () => {
    const organization = await aiOrganizationFixture();

    const course = await courseFixture({
      generationRunId: "outline-run",
      generationStatus: "running",
      organizationId: organization.id,
    });

    const result = await addChaptersStep({ chapters, course: courseContext(course) });

    expect(result.map((chapter) => chapter.level)).toStrictEqual([
      "overview",
      "overview",
      "overview",
      "basic",
      "intermediate",
      "advanced",
    ]);

    expect(result.map((chapter) => chapter.position)).toStrictEqual([0, 1, 2, 3, 4, 5]);
    expect(result[1]?.prerequisiteIds).toStrictEqual([result[0]?.id]);
    expect(result[0]?.outcomes).toStrictEqual(chapters[0]?.outcomes);

    await expect(
      prisma.lesson.count({ where: { chapter: { courseId: course.id } } }),
    ).resolves.toBe(0);

    const installed = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(installed.contentRevision).toBe(course.contentRevision + 1);
    expect(installed.curriculumVersion).toBe(2);
  });

  it("rejects an incomplete outline without changing saved content or revision", async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    await expect(
      addChaptersStep({ chapters: curriculumChapters("overview"), course: courseContext(course) }),
    ).rejects.toThrow();

    await expect(prisma.chapter.count({ where: { courseId: course.id } })).resolves.toBe(0);

    const savedSnapshot1 = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(savedSnapshot1.contentRevision).toBe(course.contentRevision);
  });

  it("ignores results from a superseded run", async () => {
    const organization = await aiOrganizationFixture();

    const course = await courseFixture({
      generationRunId: "new-run",
      organizationId: organization.id,
    });

    const result = await addChaptersStep({
      chapters,
      course: { ...courseContext(course), generationRunId: "old-run" },
    });

    expect(result).toStrictEqual([]);
    await expect(prisma.chapter.count({ where: { courseId: course.id } })).resolves.toBe(0);
  });
});
