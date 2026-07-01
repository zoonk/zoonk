import { randomUUID } from "node:crypto";
import { type Browser, type Route } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseStartRequestFixture } from "@zoonk/testing/fixtures/course-start-requests";
import {
  courseCategoryFixture,
  courseFixture,
  courseUserFixture,
} from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

const TEST_RUN_ID = "test-run-id-course-detail";
const UUID_SHORT_LENGTH = 8;

/**
 * Mock the workflow APIs to avoid hitting real services.
 */
async function mockWorkflowApis(route: Route) {
  const url = route.request().url();
  const method = route.request().method();

  if (url.includes("/v1/workflows/course-generation/trigger") && method === "POST") {
    await route.fulfill({
      body: JSON.stringify({ message: "Workflow started", runId: TEST_RUN_ID }),
      contentType: "application/json",
      status: 200,
    });

    return;
  }

  if (url.includes("/v1/workflows/course-generation/status")) {
    await route.fulfill({
      body: `data: ${JSON.stringify({ status: "running", step: "getCourseStartRequest" })}\n\n`,
      contentType: "text/event-stream",
      status: 200,
    });

    return;
  }

  await route.continue();
}

/**
 * A hidden-kind preference is user-specific, so this helper creates an isolated
 * browser context for tests that need a learner with no progress but custom
 * lesson filters.
 */
async function createHiddenQuizPage({ browser }: { browser: Browser }) {
  const user = await createE2EUser(getBaseURL(), { orgRole: "member" });

  await prisma.userLearningProfile.create({
    data: { preferences: { hiddenLessonKinds: ["quiz"] }, userId: user.id },
  });

  const context = await browser.newContext({ storageState: user.storageState });
  const page = await context.newPage();

  return { context, page };
}

const testData: {
  courseNoImageTitle: string;
  courseNoImageUrl: string;
  courseWithImageChapterSlug: string;
  courseWithImageChapterTitle: string;
  courseWithImageDescription: string;
  courseWithImageId: string;
  courseWithImageLessonId: string;
  courseWithImageLessonSlug: string;
  courseWithImageSlug: string;
  courseWithImageTitle: string;
  courseWithImageUrl: string;
  courseWithImageValueProposition: string;
  languageCourseGeneratedValueProposition: string;
  languageCourseTitle: string;
  languageCourseUrl: string;
  ptCourseUrl: string;
} = {
  courseNoImageTitle: "",
  courseNoImageUrl: "",
  courseWithImageChapterSlug: "",
  courseWithImageChapterTitle: "",
  courseWithImageDescription: "",
  courseWithImageId: "",
  courseWithImageLessonId: "",
  courseWithImageLessonSlug: "",
  courseWithImageSlug: "",
  courseWithImageTitle: "",
  courseWithImageUrl: "",
  courseWithImageValueProposition: "",
  languageCourseGeneratedValueProposition: "",
  languageCourseTitle: "",
  languageCourseUrl: "",
  ptCourseUrl: "",
};

test.beforeAll(async () => {
  const uniqueId = randomUUID().slice(0, UUID_SHORT_LENGTH);
  const org = await getAiOrganization();

  testData.courseWithImageTitle = `E2E Image Course ${uniqueId}`;
  testData.courseWithImageDescription = `Description for image course ${uniqueId}`;

  testData.courseWithImageValueProposition =
    "Turn your ideas into great websites and apps people will love to use.";

  testData.courseNoImageTitle = `E2E No Image Course ${uniqueId}`;
  testData.languageCourseTitle = `E2E Spanish Course ${uniqueId}`;

  testData.languageCourseGeneratedValueProposition =
    "Generated language landing copy should not appear.";

  const ptCourseTitle = `E2E Curso PT ${uniqueId}`;

  const [courseWithImage, courseNoImage, languageCourse, ptCourse] = await Promise.all([
    courseFixture({
      description: testData.courseWithImageDescription,
      imageUrl: "https://placehold.co/200x200.png",
      isPublished: true,
      landingPage: {
        audience: [
          "Beginners who want a practical path into web interfaces",
          "Design-minded learners who want to build usable pages",
          "Product teammates who want to collaborate with engineers",
        ],
        opportunities: [
          "Contribute to product teams",
          "Build client or personal websites",
          "Collaborate across design and engineering",
        ],
        outcomes: [
          "Structure responsive web pages",
          "Create clear interface flows",
          "Improve accessibility decisions",
          "Review existing web experiences",
        ],
        valueProposition: testData.courseWithImageValueProposition,
      },
      language: "en",
      normalizedTitle: normalizeString(testData.courseWithImageTitle),
      organizationId: org.id,
      slug: `e2e-img-course-${uniqueId}`,
      title: testData.courseWithImageTitle,
    }),
    courseFixture({
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(testData.courseNoImageTitle),
      organizationId: org.id,
      slug: `e2e-noimg-course-${uniqueId}`,
      title: testData.courseNoImageTitle,
    }),
    courseFixture({
      isPublished: true,
      landingPage: {
        audience: ["Language audience should not appear"],
        opportunities: ["Language opportunity should not appear"],
        outcomes: ["Language outcome should not appear"],
        valueProposition: testData.languageCourseGeneratedValueProposition,
      },
      language: "en",
      normalizedTitle: normalizeString(testData.languageCourseTitle),
      organizationId: org.id,
      slug: `e2e-language-course-${uniqueId}`,
      targetLanguage: "es",
      title: testData.languageCourseTitle,
    }),
    courseFixture({
      isPublished: true,
      language: "pt",
      normalizedTitle: normalizeString(ptCourseTitle),
      organizationId: org.id,
      slug: `e2e-pt-course-${uniqueId}`,
      title: ptCourseTitle,
    }),
  ]);

  // Courses need at least one chapter to avoid the generate redirect
  const [courseWithImageChapter] = await Promise.all([
    chapterFixture({
      courseId: courseWithImage.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-img-ch-${uniqueId}`,
      title: `Image Course Chapter ${uniqueId}`,
    }),
    chapterFixture({
      courseId: courseNoImage.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-noimg-ch-${uniqueId}`,
      title: `No Image Course Chapter ${uniqueId}`,
    }),
    chapterFixture({
      courseId: languageCourse.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-language-ch-${uniqueId}`,
      title: `Language Course Chapter ${uniqueId}`,
    }),
    chapterFixture({
      courseId: ptCourse.id,
      isPublished: true,
      language: "pt",
      organizationId: org.id,
      position: 0,
      slug: `e2e-pt-ch-${uniqueId}`,
      title: `Capítulo PT ${uniqueId}`,
    }),
    courseCategoryFixture({ category: "tech", courseId: courseWithImage.id }),
    courseCategoryFixture({ category: "health", courseId: courseNoImage.id }),
  ]);

  testData.courseWithImageSlug = courseWithImage.slug;
  testData.courseWithImageId = courseWithImage.id;
  testData.courseWithImageChapterSlug = courseWithImageChapter.slug;
  testData.courseWithImageChapterTitle = courseWithImageChapter.title;

  const courseWithImageLesson = await lessonFixture({
    chapterId: courseWithImageChapter.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    title: `Image Course Lesson ${uniqueId}`,
  });

  testData.courseWithImageLessonId = courseWithImageLesson.id;
  testData.courseWithImageLessonSlug = courseWithImageLesson.slug;

  testData.courseWithImageUrl = `/b/${AI_ORG_SLUG}/c/${courseWithImage.slug}`;
  testData.courseNoImageUrl = `/b/${AI_ORG_SLUG}/c/${courseNoImage.slug}`;
  testData.languageCourseUrl = `/b/${AI_ORG_SLUG}/c/${languageCourse.slug}`;
  testData.ptCourseUrl = `/b/${AI_ORG_SLUG}/c/${ptCourse.slug}`;
});

test.describe("Course Detail Page", () => {
  test("shows course landing content with title, value proposition, and image", async ({
    page,
  }) => {
    await page.goto(testData.courseWithImageUrl);

    await expect(
      page.getByRole("heading", { level: 1, name: testData.courseWithImageTitle }),
    ).toBeVisible();

    await expect(page.getByText(testData.courseWithImageValueProposition).first()).toBeVisible();

    const courseImage = page.getByRole("img", { name: testData.courseWithImageTitle });
    await expect(courseImage).toBeVisible();
  });

  test("non-existent course shows 404 page", async ({ page }) => {
    await page.goto(`/b/${AI_ORG_SLUG}/c/nonexistent-course`);

    await expect(page.getByText(/not found|404/iu)).toBeVisible();
  });

  test("redirects to generate page when course has no chapters", async ({ authenticatedPage }) => {
    const org = await getAiOrganization();

    const slug = `e2e-no-chapters-${randomUUID().slice(0, UUID_SHORT_LENGTH)}`;

    const title = "E2E No Chapters Course";

    const course = await courseFixture({
      generationStatus: "running",
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(title),
      organizationId: org.id,
      slug,
      title,
    });

    const request = await courseStartRequestFixture({
      canonicalTitle: title,
      courseId: course.id,
      generationStatus: "running",
      prompt: `Generate ${title} ${slug}`,
    });

    await authenticatedPage.route("**/v1/workflows/**", mockWorkflowApis);

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${slug}`);

    await authenticatedPage.waitForURL(`/generate/course/${request.id}`, { timeout: 10_000 });

    await expect(
      authenticatedPage.getByRole("heading", { name: `Creating the ${title} course` }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("non-AI courses with no chapters stay on the course page", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, UUID_SHORT_LENGTH);
    const org = await createOrganization();

    const course = await courseFixture({
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(`Non AI Empty Course ${uniqueId}`),
      organizationId: org.id,
      slug: `non-ai-empty-course-${uniqueId}`,
      title: `Non AI Empty Course ${uniqueId}`,
    });

    const url = `/b/${org.slug}/c/${course.slug}`;

    await page.goto(url);

    await expect(page).toHaveURL(url);

    await expect(
      page.getByRole("heading", { level: 1, name: `Non AI Empty Course ${uniqueId}` }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /^start$/iu })).not.toBeVisible();
  });

  test("shows fallback icon when course has no image", async ({ page }) => {
    await page.goto(testData.courseNoImageUrl);

    await expect(page.getByRole("heading", { name: testData.courseNoImageTitle })).toBeVisible();

    const fallbackIcon = page.getByRole("img", { name: testData.courseNoImageTitle }).first();
    await expect(fallbackIcon).toBeVisible();
    await expect(fallbackIcon).not.toHaveAttribute("src");
  });

  test("shows landing copy before the learner starts", async ({ page }) => {
    await page.goto(testData.courseWithImageUrl);

    const main = page.getByRole("main");

    await expect(main.getByRole("heading", { name: testData.courseWithImageTitle })).toBeVisible();

    await expect(main.getByText("First chapter free").first()).toBeVisible();

    await expect(main.getByRole("link", { name: /start free chapter/iu }).first()).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${testData.courseWithImageSlug}/ch/${testData.courseWithImageChapterSlug}/l/${testData.courseWithImageLessonSlug}`,
    );

    await expect(main.getByRole("link", { name: /explore courses/iu }).first()).toHaveAttribute(
      "href",
      "/start",
    );

    await expect(main.getByRole("heading", { name: "What you'll learn" })).toBeVisible();
    await expect(main.getByText("Structure responsive web pages")).toBeVisible();

    const questions = main.getByRole("tablist", { name: "Course questions" });
    await expect(questions.getByText("What", { exact: true })).toBeVisible();
    await expect(questions.getByText("Who", { exact: true })).toBeVisible();
    await expect(questions.getByText("Where", { exact: true })).toBeVisible();
    await expect(questions.getByText("How", { exact: true })).toBeVisible();
    await expect(questions.getByText("Content", { exact: true })).toBeVisible();

    await questions.getByRole("tab", { name: /who/iu }).click();
    await expect(main.getByRole("heading", { name: "Who this course is for" })).toBeVisible();
    await expect(main.getByText(/curious beginners/iu)).toBeVisible();

    await questions.getByRole("tab", { name: /where/iu }).click();
    await expect(main.getByRole("heading", { name: "Where you'll use it" })).toBeVisible();
    await expect(main.getByText("Contribute to product teams")).toBeVisible();

    await questions.getByRole("tab", { name: /how/iu }).click();
    await expect(main.getByRole("heading", { name: "How our lessons work" })).toBeVisible();

    await expect(
      main.getByRole("heading", { name: "Abstract ideas get a real situation" }),
    ).toBeVisible();

    await expect(main.getByRole("tab", { name: "Understand" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await expect(main.getByText(/coffee falls when you knock over the mug/iu)).toBeVisible();

    await questions.getByRole("tab", { name: /content/iu }).click();
    await expect(main.getByRole("heading", { name: "Course content" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "A course, not a credential" })).toHaveCount(0);
    await expect(main.getByText(testData.courseWithImageChapterTitle).first()).toBeVisible();
  });

  test("shows the credential note for health courses", async ({ page }) => {
    await page.goto(testData.courseNoImageUrl);

    const main = page.getByRole("main");

    await expect(main.getByRole("heading", { name: testData.courseNoImageTitle })).toBeVisible();

    const questions = main.getByRole("tablist", { name: "Course questions" });

    await questions.getByRole("tab", { name: /content/iu }).click();

    await expect(main.getByRole("heading", { name: "A course, not a credential" })).toBeVisible();
  });

  test("omits tabs for empty generated landing sections", async ({ page }) => {
    await page.goto(testData.courseNoImageUrl);

    const main = page.getByRole("main");
    const questions = main.getByRole("tablist", { name: "Course questions" });

    await expect(questions.getByRole("tab", { name: "What" })).toHaveCount(0);
    await expect(questions.getByRole("tab", { name: "Where" })).toHaveCount(0);
    await expect(questions.getByRole("tab", { name: "Who" })).toBeVisible();
    await expect(questions.getByRole("tab", { name: "How" })).toBeVisible();
    await expect(questions.getByRole("tab", { name: "Content" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Who this course is for" })).toBeVisible();
  });

  test("shows language-specific teaching method for language courses", async ({ page }) => {
    await page.goto(testData.languageCourseUrl);

    const main = page.getByRole("main");

    await expect(main.getByRole("heading", { name: testData.languageCourseTitle })).toBeVisible();
    await expect(main.getByText(testData.languageCourseGeneratedValueProposition)).toHaveCount(0);

    await expect(main.getByRole("heading", { name: "How our lessons work" })).toBeVisible();

    await expect(main.getByText("Vocabulary", { exact: true })).toBeVisible();
    await expect(main.getByText("Reading", { exact: true })).toBeVisible();
    await expect(main.getByText("Listening", { exact: true })).toBeVisible();
    await expect(main.getByText("Grammar", { exact: true })).toBeVisible();
    await expect(main.getByText("Pronunciation", { exact: true })).toBeVisible();

    await expect(
      main.getByRole("heading", { name: "Abstract ideas get a real situation" }),
    ).toHaveCount(0);

    await expect(main.getByRole("heading", { name: "Who this course is for" })).toHaveCount(0);
    await expect(main.getByRole("heading", { name: "Where you'll use it" })).toHaveCount(0);
  });

  test("links the primary CTA to the lesson while the first lesson is generating", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, UUID_SHORT_LENGTH);
    const org = await getAiOrganization();
    const courseTitle = `E2E Pending Lesson Course ${uniqueId}`;

    const course = await courseFixture({
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(courseTitle),
      organizationId: org.id,
      slug: `e2e-pending-lesson-course-${uniqueId}`,
      title: courseTitle,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-pending-lesson-ch-${uniqueId}`,
      title: `Pending Lesson Chapter ${uniqueId}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      organizationId: org.id,
      position: 0,
      title: `Pending Lesson ${uniqueId}`,
    });

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const main = page.getByRole("main");

    await expect(main.getByRole("heading", { name: courseTitle })).toBeVisible();

    await expect(main.getByRole("link", { name: /start free chapter/iu }).first()).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`,
    );
  });

  test("uses the shared visible lesson target for the landing CTA", async ({ browser }) => {
    const uniqueId = randomUUID().slice(0, UUID_SHORT_LENGTH);
    const org = await getAiOrganization();
    const courseTitle = `E2E Hidden First Lesson Course ${uniqueId}`;

    const course = await courseFixture({
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(courseTitle),
      organizationId: org.id,
      slug: `e2e-hidden-first-lesson-course-${uniqueId}`,
      title: courseTitle,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-hidden-first-lesson-ch-${uniqueId}`,
      title: `Hidden First Lesson Chapter ${uniqueId}`,
    });

    const [, visibleLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "quiz",
        organizationId: org.id,
        position: 0,
        title: `Hidden Quiz ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        organizationId: org.id,
        position: 1,
        title: `Visible Explanation ${uniqueId}`,
      }),
    ]);

    const { context, page } = await createHiddenQuizPage({ browser });

    try {
      await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

      const main = page.getByRole("main");

      await expect(main.getByRole("heading", { name: courseTitle })).toBeVisible();

      await expect(
        main.getByRole("link", { name: /start free chapter/iu }).first(),
      ).toHaveAttribute(
        "href",
        `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${visibleLesson.slug}`,
      );
    } finally {
      await context.close();
    }
  });

  test("keeps the chapter grid after the learner starts", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    await Promise.all([
      courseUserFixture({ courseId: testData.courseWithImageId, userId: withProgressUser.id }),
      lessonProgressFixture({
        completedAt: null,
        durationSeconds: null,
        lessonId: testData.courseWithImageLessonId,
        userId: withProgressUser.id,
      }),
    ]);

    await authenticatedPage.goto(testData.courseWithImageUrl);

    const main = authenticatedPage.getByRole("main");

    await expect(main.getByPlaceholder("Search chapters...")).toBeVisible();

    await expect(
      main.getByRole("link", { name: new RegExp(testData.courseWithImageChapterTitle, "u") }),
    ).toBeVisible();

    await expect(main.getByRole("link", { name: /start free chapter/iu })).toHaveCount(0);
  });
});

test.describe("Course Detail Page - Locale", () => {
  test("course page renders in Portuguese locale", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto(testData.ptCourseUrl);

    await expect(page).toHaveURL(new RegExp(`/b/${AI_ORG_SLUG}/c/`, "u"));
  });
});
