import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { generateCourseCategories } from "@zoonk/ai/tasks/courses/categories";
import { generateCourseChapters } from "@zoonk/ai/tasks/courses/chapters";
import { generateCourseDescription } from "@zoonk/ai/tasks/courses/description";
import { resolveCourseIdentity } from "@zoonk/ai/tasks/courses/identity";
import { generateCourseIdentitySearchQueries } from "@zoonk/ai/tasks/courses/identity-search";
import { generateCourseIntroduction } from "@zoonk/ai/tasks/courses/introduction";
import { generateCourseLandingPage } from "@zoonk/ai/tasks/courses/landing-page";
import { generateContentThumbnailImage } from "@zoonk/core/content/thumbnail";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import {
  COURSE_COMPLETION_STEP,
  INTRODUCTION_LESSON_COMPLETION_STEP,
} from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseStartRequestFixture } from "@zoonk/testing/fixtures/course-start-requests";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { normalizeString } from "@zoonk/utils/string";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getOrCreateCourse } from "./_internal/get-or-create-course";
import { chapterImagesWorkflow } from "./chapter-images-workflow";
import { courseGenerationWorkflow } from "./course-generation-workflow";

const { startMock } = vi.hoisted(() => ({
  startMock: vi.fn().mockResolvedValue({ runId: "chapter-images-run-id" }),
}));

vi.mock("workflow/api", () => ({ start: startMock }));

vi.mock("@zoonk/ai/tasks/courses/description", () => ({
  generateCourseDescription: vi
    .fn()
    .mockResolvedValue({ data: { description: "Generated course description" } }),
}));

vi.mock("@zoonk/ai/tasks/courses/landing-page", () => ({
  generateCourseLandingPage: vi
    .fn()
    .mockResolvedValue({
      data: {
        audience: ["New learners"],
        opportunities: ["Use this in real projects"],
        outcomes: ["Build practical skill"],
        valueProposition: "A clear path into the subject.",
      },
    }),
}));

vi.mock("@zoonk/ai/tasks/courses/chapters", () => ({
  generateCourseChapters: vi.fn().mockResolvedValue({
    data: {
      chapters: [
        { description: "Chapter 1 description", title: "Chapter 1" },
        { description: "Chapter 2 description", title: "Chapter 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/courses/introduction", () => ({
  generateCourseIntroduction: vi.fn().mockResolvedValue({
    data: {
      chapter: {
        description: "A short, friendly tour of what this field is and where it can take you.",
        title: "A quick guide to the field",
      },
      lessons: [
        {
          description: "See what people in the field actually study and build.",
          title: "What this field does",
        },
        {
          description: "Connect the field to everyday problems, tools, and decisions.",
          title: "Why it matters",
        },
        {
          description: "Map the roles, projects, and paths learners can explore next.",
          title: "Where it can take you",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/courses/language-chapters", () => ({
  generateLanguageCourseChapters: vi.fn().mockResolvedValue({
    data: {
      chapters: [
        { description: "Lang Chapter 1 description", title: "Lang Chapter 1" },
        { description: "Lang Chapter 2 description", title: "Lang Chapter 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/chapters/lessons", () => ({
  generateChapterLessons: vi.fn().mockResolvedValue({
    data: {
      lessons: [
        { description: "Lesson 1 description", title: "Lesson 1" },
        { description: "Lesson 2 description", title: "Lesson 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/chapters/language-lessons", () => ({
  generateLanguageChapterLessons: vi.fn().mockResolvedValue({
    data: {
      lessons: [
        { description: "Lang Lesson 1 description", kind: "vocabulary", title: "Lang Lesson 1" },
        { description: "Lang Lesson 2 description", kind: "vocabulary", title: "Lang Lesson 2" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/kind", () => ({
  generateLessonKind: vi.fn().mockResolvedValue({ data: { kind: "explanation" } }),
}));

vi.mock("@zoonk/ai/tasks/courses/identity-search", () => ({
  generateCourseIdentitySearchQueries: vi
    .fn()
    .mockResolvedValue({ data: { queries: [] }, systemPrompt: "", usage: {}, userPrompt: "" }),
}));

vi.mock("@zoonk/ai/tasks/courses/identity", () => ({
  resolveCourseIdentity: vi
    .fn()
    .mockResolvedValue({
      data: { courseSlug: null, decision: "createNew", reason: "no matching course" },
      systemPrompt: "",
      usage: {},
      userPrompt: "",
    }),
}));

vi.mock("@zoonk/ai/tasks/courses/categories", () => ({
  generateCourseCategories: vi
    .fn()
    .mockResolvedValue({ data: { categories: ["programming", "technology"] } }),
}));

vi.mock("@zoonk/core/content/thumbnail", () => ({
  generateContentThumbnailImage: vi.fn(({ kind, title }: { kind: string; title: string }) =>
    Promise.resolve({
      data: `https://example.com/${kind}/${encodeURIComponent(title)}.webp`,
      error: null,
    }),
  ),
}));

vi.mock("@/workflows/lesson-generation/lesson-generation-workflow", () => ({
  lessonGenerationWorkflow: vi.fn().mockResolvedValue("ready"),
}));

vi.mock("./_internal/get-or-create-course", async (importOriginal) => {
  const mod = await importOriginal();

  return {
    getOrCreateCourse: vi.fn(
      (mod as { getOrCreateCourse: typeof getOrCreateCourse }).getOrCreateCourse,
    ),
  };
});

describe(courseGenerationWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
  });

  describe("early returns", () => {
    it("returns when request not found", async () => {
      const nonExistentId = randomUUID();

      await expect(courseGenerationWorkflow(nonExistentId)).rejects.toThrow(
        "Course start request not found",
      );

      expect(generateCourseDescription).not.toHaveBeenCalled();
    });

    it("returns when request status is 'running' without streaming completion", async () => {
      const request = await courseStartRequestFixture({
        canonicalTitle: `Running Request ${randomUUID()}`,
        generationStatus: "running",
      });

      await courseGenerationWorkflow(request.id);

      const dbRequest = await prisma.courseStartRequest.findUnique({ where: { id: request.id } });

      expect(dbRequest?.generationStatus).toBe("running");
      expect(generateCourseDescription).not.toHaveBeenCalled();

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === COURSE_COMPLETION_STEP && event.status === "completed",
      );

      expect(completionEvent).toBeUndefined();
    });

    it("streams completion when request status is 'completed'", async () => {
      const request = await courseStartRequestFixture({
        canonicalTitle: `Completed Request ${randomUUID()}`,
        generationStatus: "completed",
      });

      await courseGenerationWorkflow(request.id);

      const dbRequest = await prisma.courseStartRequest.findUnique({ where: { id: request.id } });

      expect(dbRequest?.generationStatus).toBe("completed");
      expect(generateCourseDescription).not.toHaveBeenCalled();

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === COURSE_COMPLETION_STEP && event.status === "completed",
      );

      expect(completionEvent).toBeDefined();
    });

    it("returns when existing course status is 'running' without streaming completion", async () => {
      const title = `Existing Running Course ${randomUUID()}`;
      const slug = getCourseSlugForTitle({ language: "en", title });

      await courseFixture({ generationStatus: "running", organizationId, slug, title });

      const request = await courseStartRequestFixture({
        canonicalTitle: title,
        generationStatus: "pending",
      });

      await courseGenerationWorkflow(request.id);

      const dbRequest = await prisma.courseStartRequest.findUnique({ where: { id: request.id } });

      expect(dbRequest?.generationStatus).toBe("pending");
      expect(dbRequest?.courseId).not.toBeNull();
      expect(generateCourseDescription).not.toHaveBeenCalled();

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === COURSE_COMPLETION_STEP && event.status === "completed",
      );

      expect(completionEvent).toBeUndefined();
    });

    it("streams completion when existing course status is 'completed'", async () => {
      const title = `Existing Completed Course ${randomUUID()}`;
      const slug = getCourseSlugForTitle({ language: "en", title });

      await courseFixture({ generationStatus: "completed", organizationId, slug, title });

      const request = await courseStartRequestFixture({
        canonicalTitle: title,
        generationStatus: "pending",
      });

      await courseGenerationWorkflow(request.id);

      const dbRequest = await prisma.courseStartRequest.findUnique({ where: { id: request.id } });

      expect(dbRequest?.courseId).not.toBeNull();
      expect(dbRequest?.generationStatus).toBe("completed");
      expect(generateCourseDescription).not.toHaveBeenCalled();

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === COURSE_COMPLETION_STEP && event.status === "completed",
      );

      expect(completionEvent).toBeDefined();
    });
  });

  describe("happy path", () => {
    it("creates an intro chapter, enqueues intro lessons, then generates the first main chapter", async () => {
      const title = `Intro Chapter Course ${randomUUID()}`;
      const slug = getCourseSlugForTitle({ language: "en", title });

      const request = await courseStartRequestFixture({
        canonicalTitle: title,
        generationStatus: "pending",
      });

      await courseGenerationWorkflow(request.id);

      const course = await prisma.course.findFirstOrThrow({
        include: {
          chapters: {
            include: { lessons: { orderBy: { position: "asc" } } },
            orderBy: { position: "asc" },
          },
        },
        where: { slug },
      });

      const firstChapter = course.chapters[0]!;
      expect(firstChapter.generationStatus).toBe("completed");
      expect(firstChapter.title).toBe("A quick guide to the field");

      expect(firstChapter.lessons.map((lesson) => lesson.kind)).toStrictEqual([
        "explanation",
        "quiz",
        "practice",
        "explanation",
        "quiz",
        "practice",
        "explanation",
        "quiz",
        "practice",
        "review",
      ]);

      expect(firstChapter.imageUrl).toBeNull();

      const secondChapter = course.chapters[1]!;
      expect(secondChapter.generationStatus).toBe("completed");
      expect(secondChapter.position).toBe(1);
      expect(secondChapter.title).toBe("Chapter 1");

      expect(secondChapter.lessons.map((lesson) => lesson.kind)).toStrictEqual([
        "explanation",
        "quiz",
        "practice",
        "explanation",
        "quiz",
        "practice",
        "review",
      ]);

      expect(secondChapter.imageUrl).toBeNull();

      const thirdChapter = course.chapters[2]!;
      expect(thirdChapter.position).toBe(2);
      expect(thirdChapter.title).toBe("Chapter 2");

      const firstLesson = firstChapter.lessons[0]!;
      const secondLesson = firstChapter.lessons[1]!;
      const thirdLesson = firstChapter.lessons[2]!;

      expect(lessonGenerationWorkflow).toHaveBeenCalledWith(firstLesson.id);
      expect(startMock).toHaveBeenCalledWith(lessonGenerationWorkflow, [secondLesson.id]);
      expect(startMock).toHaveBeenCalledWith(lessonGenerationWorkflow, [thirdLesson.id]);

      expect(startMock).toHaveBeenCalledWith(chapterImagesWorkflow, [course.id]);

      expect(generateCourseIntroduction).toHaveBeenCalledWith({
        courseTitle: title,
        language: "en",
      });
    });

    it("starts the first intro lesson before the main course setup finishes", async () => {
      startMock.mockClear();
      vi.mocked(lessonGenerationWorkflow).mockClear();

      const title = `Parallel Intro Course ${randomUUID()}`;
      type ChapterOutlineResult = Awaited<ReturnType<typeof generateCourseChapters>>;

      const chapterOutline = Promise.withResolvers<ChapterOutlineResult>();

      vi.mocked(generateCourseChapters).mockReturnValueOnce(chapterOutline.promise);

      const request = await courseStartRequestFixture({
        canonicalTitle: title,
        generationStatus: "pending",
      });

      const workflow = courseGenerationWorkflow(request.id);

      try {
        await vi.waitFor(() => {
          expect(generateCourseIntroduction).toHaveBeenCalledWith({
            courseTitle: title,
            language: "en",
          });
        });

        await vi.waitFor(
          () => {
            expect(lessonGenerationWorkflow).toHaveBeenCalledWith(expect.any(String));
          },
          { timeout: 500 },
        );
      } finally {
        chapterOutline.resolve({
          data: { chapters: [{ description: "Main chapter description", title: "Main chapter" }] },
          systemPrompt: "",
          usage: {} as ChapterOutlineResult["usage"],
          userPrompt: "",
        });

        await workflow.catch(() => {});
      }
    });

    it("streams the first intro lesson target before the chapter outline finishes", async () => {
      startMock.mockClear();
      vi.mocked(lessonGenerationWorkflow).mockClear();

      const title = `Intro Ready Redirect Course ${randomUUID()}`;
      const slug = getCourseSlugForTitle({ language: "en", title });
      type ChapterOutlineResult = Awaited<ReturnType<typeof generateCourseChapters>>;

      const firstIntroLesson = Promise.withResolvers<"ready">();
      const chapterOutline = Promise.withResolvers<ChapterOutlineResult>();

      vi.mocked(lessonGenerationWorkflow).mockReturnValueOnce(firstIntroLesson.promise);
      vi.mocked(generateCourseChapters).mockReturnValueOnce(chapterOutline.promise);

      const request = await courseStartRequestFixture({
        canonicalTitle: title,
        generationStatus: "pending",
      });

      const workflow = courseGenerationWorkflow(request.id);

      try {
        await vi.waitFor(() => {
          expect(lessonGenerationWorkflow).toHaveBeenCalledWith(expect.any(String));
        });

        const completionBeforeFirstLesson = getStreamedEvents().find(
          (event) =>
            event.step === INTRODUCTION_LESSON_COMPLETION_STEP && event.status === "completed",
        );

        expect(completionBeforeFirstLesson).toBeUndefined();

        firstIntroLesson.resolve("ready");

        await vi.waitFor(() => {
          const completionAfterFirstLesson = getStreamedEvents().find(
            (event) =>
              event.step === INTRODUCTION_LESSON_COMPLETION_STEP && event.status === "completed",
          );

          expect(completionAfterFirstLesson?.entityId).toBe(
            `${slug}/ch/a-quick-guide-to-the-field/l/what-this-field-does`,
          );
        });

        const courseCompletionEvent = getStreamedEvents().find(
          (event) => event.step === COURSE_COMPLETION_STEP && event.status === "completed",
        );

        expect(courseCompletionEvent).toBeUndefined();
      } finally {
        chapterOutline.resolve({
          data: { chapters: [{ description: "Main chapter description", title: "Main chapter" }] },
          systemPrompt: "",
          usage: {} as ChapterOutlineResult["usage"],
          userPrompt: "",
        });

        await workflow.catch(() => {});
      }
    });

    it("keeps language courses on the existing course completion path", async () => {
      vi.mocked(generateCourseIntroduction).mockClear();
      startMock.mockClear();

      const title = `Language Course ${randomUUID()}`;

      const existingCourse = await courseFixture({
        generationStatus: "failed",
        organizationId,
        targetLanguage: "es",
        title,
      });

      const request = await courseStartRequestFixture({
        canonicalTitle: title,
        courseId: existingCourse.id,
        generationStatus: "pending",
        language: "en",
        targetLanguage: "es",
      });

      await courseGenerationWorkflow(request.id);

      const updatedRequest = await prisma.courseStartRequest.findUniqueOrThrow({
        where: { id: request.id },
      });

      const course = await prisma.course.findUniqueOrThrow({
        include: {
          chapters: {
            include: { lessons: { orderBy: { position: "asc" } } },
            orderBy: { position: "asc" },
          },
        },
        where: { id: updatedRequest.courseId! },
      });

      expect(course.targetLanguage).toBe("es");

      expect(course.chapters.map((chapter) => chapter.title)).toStrictEqual([
        "Lang Chapter 1",
        "Lang Chapter 2",
      ]);

      const firstChapter = course.chapters[0]!;
      expect(firstChapter.generationStatus).toBe("completed");
      expect(firstChapter.lessons.map((lesson) => lesson.title)).toContain("Lang Lesson 1");

      const completionEvent = getStreamedEvents().find(
        (event) => event.step === COURSE_COMPLETION_STEP && event.status === "completed",
      );

      expect(completionEvent?.entityId).toBe(course.slug);
      expect(generateCourseIntroduction).not.toHaveBeenCalled();

      expect(startMock).toHaveBeenCalledExactlyOnceWith(chapterImagesWorkflow, [course.id]);
    });
  });

  describe("existing course resumption", () => {
    it("resumes generation for failed course", async () => {
      const title = `Failed Course Resume ${randomUUID()}`;
      const slug = getCourseSlugForTitle({ language: "en", title });

      const existingCourse = await prisma.course.create({
        data: {
          description: null,
          generationRunId: null,
          generationStatus: "failed",
          imageUrl: null,
          isPublished: true,
          language: "en",
          normalizedTitle: normalizeString(title),
          organizationId,
          slug,
          title,
        },
      });

      const request = await courseStartRequestFixture({
        canonicalTitle: title,
        courseId: existingCourse.id,
        generationStatus: "failed",
      });

      await courseGenerationWorkflow(request.id);

      const course = await prisma.course.findUnique({ where: { id: existingCourse.id } });

      expect(course?.generationStatus).toBe("completed");
      expect(course?.description).toBe("Generated course description");

      expect(course?.landingPage).toStrictEqual({
        audience: ["New learners"],
        opportunities: ["Use this in real projects"],
        outcomes: ["Build practical skill"],
        valueProposition: "A clear path into the subject.",
      });
    });

    it("skips generation for content that already exists", async () => {
      const title = `Partial Course ${randomUUID()}`;
      const slug = getCourseSlugForTitle({ language: "en", title });

      const existingCourse = await courseFixture({
        description: "Existing description",
        generationStatus: "failed",
        imageUrl: "https://example.com/existing-image.webp",
        landingPage: {
          audience: ["Existing audience"],
          opportunities: ["Existing opportunity"],
          outcomes: ["Existing outcome"],
          valueProposition: "Existing value.",
        },
        organizationId,
        slug,
        title,
      });

      const introChapter = await chapterFixture({
        courseId: existingCourse.id,
        organizationId,
        position: 0,
        title: `Existing Intro ${randomUUID()}`,
      });

      const [request] = await Promise.all([
        courseStartRequestFixture({
          canonicalTitle: title,
          courseId: existingCourse.id,
          generationStatus: "failed",
        }),
        courseCategoryFixture({ category: "programming", courseId: existingCourse.id }),
        lessonFixture({
          chapterId: introChapter.id,
          isPublished: true,
          organizationId,
          title: `Existing Intro Lesson ${randomUUID()}`,
        }),
        chapterFixture({
          courseId: existingCourse.id,
          organizationId,
          position: 1,
          title: `Existing Chapter ${randomUUID()}`,
        }),
      ]);

      await courseGenerationWorkflow(request.id);

      expect(generateCourseDescription).not.toHaveBeenCalled();
      expect(generateCourseLandingPage).not.toHaveBeenCalled();
      expect(generateCourseIdentitySearchQueries).not.toHaveBeenCalled();
      expect(resolveCourseIdentity).not.toHaveBeenCalled();
      expect(generateCourseCategories).not.toHaveBeenCalled();
      expect(generateCourseChapters).not.toHaveBeenCalled();
      expect(generateCourseIntroduction).not.toHaveBeenCalled();

      expect(generateContentThumbnailImage).not.toHaveBeenCalledWith(
        expect.objectContaining({ kind: "course" }),
      );
    });
  });

  describe("error handling", () => {
    it("marks course and request as 'failed' when generation fails after retries", async () => {
      vi.mocked(generateCourseDescription).mockRejectedValueOnce(new Error("AI generation failed"));

      const title = `Error Course ${randomUUID()}`;
      const slug = getCourseSlugForTitle({ language: "en", title });

      const request = await courseStartRequestFixture({
        canonicalTitle: title,
        generationStatus: "pending",
      });

      await expect(courseGenerationWorkflow(request.id)).rejects.toThrow();

      const course = await prisma.course.findFirst({ where: { slug } });

      const dbRequest = await prisma.courseStartRequest.findUnique({ where: { id: request.id } });

      expect(course?.generationStatus).toBe("failed");
      expect(course?.generationRunId).toBeNull();
      expect(dbRequest?.generationStatus).toBe("failed");
      expect(dbRequest?.generationRunId).toBeNull();

      const errorEvent = getStreamedEvents().find(
        (event) => event.status === "error" && event.step === "workflowError",
      );

      expect(errorEvent).toBeDefined();
    });

    it("marks request as 'failed' when getOrCreateCourse fails", async () => {
      vi.mocked(getOrCreateCourse).mockRejectedValueOnce(new Error("Organization not found"));

      const title = `Init Fail Course ${randomUUID()}`;

      const request = await courseStartRequestFixture({
        canonicalTitle: title,
        generationStatus: "pending",
      });

      await expect(courseGenerationWorkflow(request.id)).rejects.toThrow();

      const dbRequest = await prisma.courseStartRequest.findUnique({ where: { id: request.id } });

      expect(dbRequest?.generationStatus).toBe("failed");

      const errorEvent = getStreamedEvents().find(
        (event) => event.status === "error" && event.step === "workflowError",
      );

      expect(errorEvent).toBeDefined();
    });

    it("chapter image workflow start errors don't fail the course workflow", async () => {
      startMock.mockImplementation((workflow: unknown) => {
        if (workflow === chapterImagesWorkflow) {
          return Promise.reject(new Error("Chapter image workflow failed to start"));
        }

        return Promise.resolve({ runId: "intro-lesson-run-id" });
      });

      const title = `Chapter Image Error Course ${randomUUID()}`;
      const slug = getCourseSlugForTitle({ language: "en", title });

      const request = await courseStartRequestFixture({
        canonicalTitle: title,
        generationStatus: "pending",
      });

      await expect(courseGenerationWorkflow(request.id)).resolves.toBeUndefined();

      const course = await prisma.course.findFirst({
        include: { chapters: { orderBy: { position: "asc" } } },
        where: { slug },
      });

      expect(course?.generationStatus).toBe("completed");
      expect(course?.chapters[0]?.generationStatus).toBe("completed");
      expect(course?.chapters[0]?.imageUrl).toBeNull();
      expect(course?.chapters[1]?.imageUrl).toBeNull();
    });
  });
});
