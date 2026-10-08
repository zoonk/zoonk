import { generateCourseDetails } from "@zoonk/ai/tasks/v2/courses/details";
import { prisma } from "@zoonk/db";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COURSE_LIST_CACHE_TAG, getCourseCacheTag } from "../../cache/tags";
import { writeCourseDetails } from "./course-details";

/** The model is the external boundary; reads, rules and storage run for real. */
vi.mock("@zoonk/ai/tasks/v2/courses/details", () => ({ generateCourseDetails: vi.fn() }));

const details = {
  categories: ["health" as const, "science" as const],
  description: "Immunology is how the body tells friend from foe.",
  landingPage: {
    audience: ["Parents deciding on vaccines"],
    outcomes: ["Explain how a vaccine trains memory cells"],
    valueProposition: "Make sense of vaccine news.",
  },
};

/** The run that wrote the copy; the course keeps it apart from the run that named the course. */
const provenance = {
  generatedAt: "2026-09-27T12:00:00.000Z",
  model: "openai/gpt-6-luna",
  promptVersion: "details-v1",
  runId: "details-run-1",
};

const storedLandingPage = {
  audience: ["Nurses"],
  outcomes: ["Read a lab result"],
  valueProposition: "Read lab results.",
};

/** A course as the outline writer leaves it: a title and chapters, nothing for its page yet. */
async function outlinedCourse(attrs?: Parameters<typeof courseFixture>[0]) {
  const course = await courseFixture({ title: "Immunology", ...attrs });

  const [chapter] = await Promise.all([
    libraryChapterFixture({ description: "How antibodies find germs", title: "Antibodies" }),
    attrs?.description
      ? null
      : prisma.course.update({ data: { description: null }, where: { id: course.id } }),
  ]);

  await courseChapterFixture({ chapterId: chapter.id, courseId: course.id, level: "overview" });

  return course;
}

async function readCourse(courseId: string) {
  return prisma.course.findUniqueOrThrow({
    include: { categories: { orderBy: { category: "asc" } } },
    where: { id: courseId },
  });
}

describe(writeCourseDetails, () => {
  beforeEach(() => {
    vi.mocked(generateCourseDetails).mockResolvedValue(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Core reads only the details.
      { data: details, provenance } as Awaited<ReturnType<typeof generateCourseDetails>>,
    );
  });

  it("writes the description, landing copy and categories of a new shared course from its outline", async () => {
    const course = await outlinedCourse();

    await expect(writeCourseDetails({ courseId: course.id })).resolves.toBe("written");

    const stored = await readCourse(course.id);

    expect(stored).toMatchObject({
      description: details.description,
      detailsGeneratedAt: new Date(provenance.generatedAt),
      detailsModel: provenance.model,
      detailsPromptVersion: provenance.promptVersion,
      detailsRunId: provenance.runId,
      landingPage: details.landingPage,
    });

    expect(stored.runId).not.toBe(provenance.runId);
    expect(stored.categories.map((item) => item.category)).toStrictEqual(["health", "science"]);

    expect(vi.mocked(generateCourseDetails).mock.calls[0]?.[0]).toMatchObject({
      chapters: [
        { description: "How antibodies find germs", level: "overview", title: "Antibodies" },
      ],
      courseTitle: "Immunology",
      language: "en",
      targetLanguage: null,
    });

    expect(revalidateTag).toHaveBeenCalledWith(getCourseCacheTag(course.id), { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith(COURSE_LIST_CACHE_TAG, { expire: 0 });
  });

  it("keeps what a course found through identity already has and fills only the rest", async () => {
    const course = await outlinedCourse({
      description: "A course people already know",
      landingPage: storedLandingPage,
    });

    await writeCourseDetails({ courseId: course.id });

    const stored = await readCourse(course.id);

    expect(stored).toMatchObject({
      description: "A course people already know",
      landingPage: storedLandingPage,
    });

    expect(stored.categories.map((item) => item.category)).toStrictEqual(["health", "science"]);
  });

  it("lists a language course under languages whatever the model says", async () => {
    const course = await outlinedCourse({ targetLanguage: "es", title: "Espanhol" });

    await writeCourseDetails({ courseId: course.id });

    const stored = await readCourse(course.id);

    expect(stored.description).toBe(details.description);
    expect(stored.categories.map((item) => item.category)).toStrictEqual(["languages"]);
  });

  it("needs no model for a language course that only lacks its category", async () => {
    const course = await outlinedCourse({
      description: "Spanish for real conversations",
      landingPage: storedLandingPage,
      targetLanguage: "es",
    });

    await writeCourseDetails({ courseId: course.id });

    const stored = await readCourse(course.id);

    expect(generateCourseDetails).not.toHaveBeenCalled();
    expect(stored.categories.map((item) => item.category)).toStrictEqual(["languages"]);
    expect(stored.detailsRunId).toBeNull();
  });

  it("leaves a course with everything its page needs untouched", async () => {
    const course = await outlinedCourse({
      description: "A complete course",
      landingPage: storedLandingPage,
    });

    await courseCategoryFixture({ category: "math", courseId: course.id });

    await expect(writeCourseDetails({ courseId: course.id })).resolves.toBe("skipped");
    expect(generateCourseDetails).not.toHaveBeenCalled();
  });

  it("skips private courses and courses without an outline yet", async () => {
    const [privateCourse, emptyCourse] = await Promise.all([
      outlinedCourse({ visibility: "private" }),
      courseFixture(),
    ]);

    await expect(writeCourseDetails({ courseId: privateCourse.id })).resolves.toBe("skipped");
    await expect(writeCourseDetails({ courseId: emptyCourse.id })).resolves.toBe("skipped");

    const stored = await readCourse(privateCourse.id);

    expect(generateCourseDetails).not.toHaveBeenCalled();
    expect(stored.description).toBeNull();
    expect(stored.categories).toStrictEqual([]);
  });
});
