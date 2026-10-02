import { generateCourseDetails } from "@zoonk/ai/tasks/v2/courses/details";
import { generateCourseIcon } from "@zoonk/ai/tasks/v2/courses/icon";
import { uploadImage } from "@zoonk/core/images/upload";
import { prisma } from "@zoonk/db";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHookConflict } from "../../../../mocks/workflow";
import { TEST_IMAGE, imageProvenance } from "../images/_test-utils/image-results";
import { courseDetailsWorkflow } from "./course-details-workflow";

// The text and image models and Vercel Blob are external; reads, checks and saves run for real.
vi.mock("@zoonk/ai/tasks/v2/courses/details", () => ({ generateCourseDetails: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/courses/icon", () => ({ generateCourseIcon: vi.fn() }));
vi.mock("@zoonk/core/images/upload", () => ({ uploadImage: vi.fn() }));

const ICON_URL = "https://blob.test/library/courses/immunology.webp";

const details = {
  categories: ["health", "science"],
  description: "Immunology is how the body tells friend from foe.",
  landingPage: {
    audience: ["Parents deciding on vaccines"],
    outcomes: ["Explain how a vaccine trains memory cells"],
    valueProposition: "Make sense of vaccine news.",
  },
};

/** A shared course right after its first band landed: chapters, nothing for its page yet. */
async function outlinedCourse(attrs?: Parameters<typeof courseFixture>[0]) {
  const [course, chapter] = await Promise.all([
    courseFixture({ isPublished: true, outlineStatus: "completed", title: "Immunology", ...attrs }),
    libraryChapterFixture({ description: "How antibodies find germs", level: "overview" }),
  ]);

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, level: "overview" }),
    attrs?.description
      ? null
      : prisma.course.update({ data: { description: null }, where: { id: course.id } }),
  ]);

  return { chapter, course };
}

describe(courseDetailsWorkflow, () => {
  beforeEach(() => {
    vi.mocked(uploadImage).mockResolvedValue({ data: ICON_URL, error: null });

    vi.mocked(generateCourseDetails).mockResolvedValue({
      data: details,
      provenance: { ...imageProvenance, model: "openai/gpt-6-luna", runId: "test-details-run" },
    } as never);

    vi.mocked(generateCourseIcon).mockResolvedValue({
      data: { image: { mediaType: "image/webp", uint8Array: TEST_IMAGE } },
      prompt: "test prompt",
      provenance: imageProvenance,
    } as never);
  });

  it("writes a new course's details, then draws its icon", async () => {
    const { course } = await outlinedCourse();

    await expect(courseDetailsWorkflow({ courseId: course.id })).resolves.toStrictEqual({
      details: "written",
      iconUrl: ICON_URL,
    });

    const stored = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(stored).toMatchObject({
      description: details.description,
      detailsRunId: "test-details-run",
      iconRunId: imageProvenance.runId,
      imageUrl: ICON_URL,
      landingPage: details.landingPage,
    });

    const categories = await prisma.courseCategory.findMany({ where: { courseId: course.id } });
    expect(categories.map((item) => item.category).toSorted()).toStrictEqual(["health", "science"]);

    expect(vi.mocked(generateCourseIcon).mock.calls[0]?.[0]).toMatchObject({
      description: details.description,
      title: "Immunology",
    });
  });

  it("still draws the icon when the details fail", async () => {
    const { course } = await outlinedCourse();
    vi.mocked(generateCourseDetails).mockRejectedValue(new Error("The model is down"));

    await expect(courseDetailsWorkflow({ courseId: course.id })).resolves.toStrictEqual({
      details: "failed",
      iconUrl: ICON_URL,
    });
  });

  it("waits for the run already filling the course, then fills nothing it already has", async () => {
    const { course } = await outlinedCourse({
      description: "A complete course",
      imageUrl: "https://blob.test/old.webp",
      landingPage: details.landingPage,
    });

    await courseCategoryFixture({ category: "health", courseId: course.id });

    mockHookConflict({
      returnValue: Promise.resolve({ details: "written", iconUrl: null }),
      runId: "owner-run",
    });

    await expect(courseDetailsWorkflow({ courseId: course.id })).resolves.toStrictEqual({
      details: "skipped",
      iconUrl: "https://blob.test/old.webp",
    });

    expect(generateCourseDetails).not.toHaveBeenCalled();
    expect(generateCourseIcon).not.toHaveBeenCalled();
  });

  it("keeps the details it wrote when the icon fails", async () => {
    const { course } = await outlinedCourse();
    vi.mocked(generateCourseIcon).mockRejectedValue(new Error("The image model is down"));

    await expect(courseDetailsWorkflow({ courseId: course.id })).resolves.toStrictEqual({
      details: "written",
      iconUrl: null,
    });

    await expect(
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
    ).resolves.toMatchObject({ description: details.description, imageUrl: null });
  });

  it("fills what's still missing when the run it waited for failed", async () => {
    const { course } = await outlinedCourse();
    const failedRun = Promise.reject(new Error("The model is down"));

    // Handled by the workflow when it awaits the run; this only keeps Node from flagging it first.
    failedRun.catch(() => null);
    mockHookConflict({ returnValue: failedRun, runId: "owner-run" });

    await expect(courseDetailsWorkflow({ courseId: course.id })).resolves.toStrictEqual({
      details: "written",
      iconUrl: ICON_URL,
    });

    expect(generateCourseDetails).toHaveBeenCalledOnce();
  });
});
