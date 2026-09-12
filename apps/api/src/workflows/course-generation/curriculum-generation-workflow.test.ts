import { curriculumChapters } from "@/workflows/_test-utils/curriculum";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateCourseCurriculumLevel } from "@zoonk/ai/tasks/courses/curriculum";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { curriculumGenerationWorkflow } from "./curriculum-generation-workflow";

vi.mock("@zoonk/ai/tasks/courses/curriculum", () => ({
  generateCourseCurriculumLevel: vi.fn(({ level }) =>
    Promise.resolve({ data: { chapters: curriculumChapters(level) } }),
  ),
}));

vi.mock("workflow/api", () => ({
  start: vi.fn().mockResolvedValue({ runId: "chapter-images-run" }),
}));

describe(curriculumGenerationWorkflow, () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the legacy outline readable until all segments succeed, then installs and completes the new revision", async () => {
    const organization = await aiOrganizationFixture();

    const course = await courseFixture({
      curriculumVersion: 1,
      generationStatus: "completed",
      isPublished: true,
      organizationId: organization.id,
    });

    const oldChapter = await chapterFixture({
      courseId: course.id,
      organizationId: organization.id,
    });

    const held = Promise.withResolvers<{
      data: { chapters: ReturnType<typeof curriculumChapters> };
    }>();

    vi.mocked(generateCourseCurriculumLevel).mockImplementationOnce(
      () => held.promise as ReturnType<typeof generateCourseCurriculumLevel>,
    );

    const workflow = curriculumGenerationWorkflow({
      contentRevision: course.contentRevision,
      courseId: course.id,
    });

    await vi.waitFor(() => expect(generateCourseCurriculumLevel).toHaveBeenCalledTimes(4));

    await expect(
      prisma.chapter.findUnique({ where: { id: oldChapter.id } }),
    ).resolves.not.toBeNull();

    const savedSnapshot1 = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(savedSnapshot1.isPublished).toBe(true);

    held.resolve({ data: { chapters: curriculumChapters("overview") } });
    await workflow;

    const saved = await prisma.course.findUniqueOrThrow({
      include: { chapters: true },
      where: { id: course.id },
    });

    expect(saved.contentRevision).toBe(course.contentRevision + 1);
    expect(saved.curriculumVersion).toBe(2);
    expect(saved.generationStatus).toBe("completed");
    expect(saved.chapters).toHaveLength(6);
    await expect(prisma.chapter.findUnique({ where: { id: oldChapter.id } })).resolves.toBeNull();

    expect(getStreamedEvents()).toContainEqual(
      expect.objectContaining({
        entityId: course.slug,
        status: "completed",
        step: "completeCourseSetup",
      }),
    );

    expect(start).toHaveBeenCalledOnce();
  });

  it("leaves old chapters and publication intact when a level fails", async () => {
    const organization = await aiOrganizationFixture();

    const course = await courseFixture({
      curriculumVersion: 1,
      generationStatus: "completed",
      isPublished: true,
      organizationId: organization.id,
    });

    const chapter = await chapterFixture({ courseId: course.id, organizationId: organization.id });
    vi.mocked(generateCourseCurriculumLevel).mockRejectedValueOnce(new Error("Unavailable level"));

    await expect(
      curriculumGenerationWorkflow({
        contentRevision: course.contentRevision,
        courseId: course.id,
      }),
    ).rejects.toThrow("Unavailable level");

    const saved = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(saved).toMatchObject({
      contentRevision: course.contentRevision,
      curriculumVersion: 1,
      generationStatus: "failed",
      isPublished: true,
    });

    await expect(prisma.chapter.findUnique({ where: { id: chapter.id } })).resolves.not.toBeNull();
    expect(start).not.toHaveBeenCalled();
  });

  it("uses the owner private brief and inexpensive model and schedules thumbnails for its full outline", async () => {
    const owner = await userFixture();

    const brief = {
      description: "Make a board for my team",
      learningGoal: "Review the team's workflow",
      requirements: ["Use my existing board"],
      startingKnowledge: "I know the tool",
      title: "A useful team board",
    };

    const course = await courseFixture({
      curriculumVersion: 2,
      discoveryBrief: brief,
      format: "personalized",
      generationStatus: "pending",
      organizationId: null,
      userId: owner.id,
    });

    await curriculumGenerationWorkflow({
      contentRevision: course.contentRevision,
      courseId: course.id,
    });

    expect(generateCourseCurriculumLevel).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        brief,
        format: "personalized",
        level: null,
        model: "openai/gpt-5.6-luna",
        useFallback: false,
      }),
    );

    expect(start).toHaveBeenCalledExactlyOnceWith(expect.any(Function), [course.id]);

    const savedSnapshot2 = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(savedSnapshot2.generationStatus).toBe("completed");
  });

  it("does no new work for an already current outline or a stale revision", async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ curriculumVersion: 2, organizationId: organization.id });
    await chapterFixture({ courseId: course.id, organizationId: organization.id });

    await curriculumGenerationWorkflow({
      contentRevision: course.contentRevision,
      courseId: course.id,
    });

    await curriculumGenerationWorkflow({
      contentRevision: course.contentRevision - 1,
      courseId: course.id,
    });

    expect(generateCourseCurriculumLevel).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });
});
