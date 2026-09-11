import { randomUUID } from "node:crypto";
import {
  COURSE_COMPLETION_STEP,
  INTRODUCTION_LESSON_COMPLETION_STEP,
} from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { type Page, type Route } from "@zoonk/e2e/fixtures";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { ensureLocaleSuffix, toSlug } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";
import {
  type GenerationTriggerResponse,
  getGenerationLimitResponse,
  getGenerationTriggerRequests,
  isGenerationEvents,
  isGenerationTrigger,
  routeGenerationApis,
} from "./generation-api";

/**
 * Test Architecture for Course Generation Page
 *
 * The generation page interacts with 2 APIs on the API server:
 * 1. POST ${API_BASE_URL}/v1/generations - Starts the workflow, returns the generation resource
 * 2. GET ${API_BASE_URL}/v1/generations/{generationId}/events?startIndex=N - Returns SSE stream of step updates
 *
 * Client behavior:
 * - Auto-triggers workflow on mount (no idle state)
 * - Shows the course-specific creation title while triggering/streaming
 * - Shows current step label + spinner while streaming
 * - Shows completed steps with checkmarks
 * - Workflow completes when the configured completion step is received
 * - Redirects to the configured completion target when workflow completes
 *
 * NOTE: Some error handling tests (trigger API failures) are not included because
 * the POST trigger request happens too quickly during page load for Playwright's
 * route interception to reliably catch it. Those scenarios should be tested via
 * integration tests or by testing the client component in isolation.
 */

const TEST_RUN_ID = "test-run-id-12345";

type MockApiOptions = {
  assertBearerAuth?: boolean;
  triggerResponseGate?: Promise<unknown>;
  triggerResponse?: GenerationTriggerResponse;
  streamMessages?: { entityId?: string; reason?: string; step: string; status: string }[];
  streamError?: boolean;
  statusDelayMs?: number;
};

/**
 * Creates a mock SSE stream response from an array of messages.
 * Each message follows the SSE format: "data: {...}\n\n"
 */
function createSSEStream(
  messages: { entityId?: string; reason?: string; step: string; status: string }[],
): string {
  return messages.map((msg) => `data: ${JSON.stringify(msg)}\n\n`).join("");
}

/**
 * Confirms authenticated workflow calls use the API's bearer-token contract
 * instead of depending on cross-origin cookies that do not work in previews
 * and custom-domain environments.
 */
function expectBearerAuthorization(route: Route): void {
  expect(route.request().headers().authorization).toMatch(/^Bearer .+/u);
}

/**
 * Creates the route handler function for mocking APIs.
 * Extracted to reduce complexity in test functions.
 */
function createRouteHandler(options: MockApiOptions) {
  const {
    assertBearerAuth = false,
    statusDelayMs = 0,
    triggerResponseGate,
    triggerResponse = { id: TEST_RUN_ID },
    streamMessages = [],
    streamError = false,
  } = options;

  return async (route: Route) => {
    const url = route.request().url();

    // Mock trigger API
    if (isGenerationTrigger({ request: route.request(), targetType: "coursePrompt" })) {
      if (assertBearerAuth) {
        expectBearerAuthorization(route);
      }

      await triggerResponseGate;

      if (triggerResponse.status && triggerResponse.status >= 400) {
        await route.fulfill({
          body: JSON.stringify(triggerResponse.body ?? { error: triggerResponse.error }),
          contentType: "application/json",
          status: triggerResponse.status ?? 500,
        });

        return;
      }

      await route.fulfill({
        body: JSON.stringify({ id: triggerResponse.id, status: "pending" }),
        contentType: "application/json",
        status: 202,
      });

      return;
    }

    // Mock status stream API
    if (isGenerationEvents(url)) {
      if (assertBearerAuth) {
        expectBearerAuthorization(route);
      }

      if (streamError) {
        await route.abort("failed");
        return;
      }

      if (statusDelayMs > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, statusDelayMs);
        });
      }

      await route.fulfill({
        body: createSSEStream(streamMessages),
        contentType: "text/event-stream",
        status: 200,
      });

      return;
    }

    // Continue with all other requests
    await route.continue();
  };
}

/**
 * Sets up route interception for course generation APIs.
 * Only intercepts specific API routes to avoid interfering with page navigation.
 * Must be called BEFORE navigation.
 */
async function setupMockApis(page: Page, options: MockApiOptions = {}): Promise<void> {
  const handler = createRouteHandler(options);
  await routeGenerationApis({ handler, page });
}

/**
 * Creates enough course content for completion redirects to land on a real
 * course page. The generation page only checks the URL, but the destination
 * route still needs a published course with playable content.
 */
async function createPublishedCourseWithLesson({
  format,
  generationStatus,
  language = "en",
  slug,
  targetLanguage,
  title,
}: {
  format?: "core" | "language";
  generationStatus?: "completed" | "running";
  language?: string;
  slug: string;
  targetLanguage?: string;
  title: string;
}) {
  const org = await getAiOrganization();

  const course = await courseFixture({
    ...(format ? { format } : {}),
    ...(generationStatus ? { generationStatus } : {}),
    isPublished: true,
    language,
    organizationId: org.id,
    slug,
    ...(targetLanguage ? { targetLanguage } : {}),
    title,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    language,
    organizationId: org.id,
    position: 0,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    language,
    organizationId: org.id,
    position: 0,
  });

  return { chapter, course, lesson };
}

/**
 * Mirrors the API's `completeIntroductionLesson` entity id. Non-language course
 * generation now completes from the first intro lesson, so the stream sends the
 * lesson route suffix rather than only the course slug.
 */
function getIntroLessonCompletionTarget({
  chapter,
  course,
  lesson,
}: Awaited<ReturnType<typeof createPublishedCourseWithLesson>>): string {
  return `${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`;
}

/** The workflow fails durably but its error event never reaches the browser. */
async function setupFailedRunWithoutEvent({
  beforeRunStatus,
  page,
  runStatus = "failed",
}: {
  beforeRunStatus?: (coursePromptId: string) => Promise<void>;
  page: Page;
  runStatus?: "completed" | "failed";
}) {
  const runId = `failed-progress-${randomUUID()}`;

  const prompt = await coursePromptFixture({
    canonicalTitle: `Failed course ${randomUUID()}`,
    courseFormat: "language",
    generationRunId: runId,
    generationStatus: "running",
    language: "en",
    targetLanguage: "ja",
  });

  await routeGenerationApis({
    handler: async (route) => {
      const url = new URL(route.request().url());

      if (isGenerationEvents(url.toString())) {
        await prisma.coursePrompt.updateMany({
          data: { generationRunId: null, generationStatus: "failed" },
          where: { generationRunId: runId, id: prompt.id },
        });

        await route.abort("failed");
        return;
      }

      if (url.pathname === `/v1/generations/${runId}`) {
        await beforeRunStatus?.(prompt.id);

        await route.fulfill({
          body: JSON.stringify({ id: runId, status: runStatus }),
          contentType: "application/json",
          status: 200,
        });

        return;
      }

      await route.continue();
    },
    page,
  });

  return prompt;
}

test.describe("Generate Course Page", () => {
  for (const language of ["en", "pt"] as const) {
    test(`refreshes a warmed empty ${language} course after generation finishes`, async ({
      authenticatedPage,
    }) => {
      const organization = await getAiOrganization();
      const runId = `warm-course-${randomUUID()}`;
      const releaseStream = Promise.withResolvers<null>();

      const course = await courseFixture({
        format: "language",
        generationRunId: runId,
        generationStatus: "running",
        isPublished: true,
        language,
        organizationId: organization.id,
        slug: `warm-course-${randomUUID()}-${language}`,
        targetLanguage: "ja",
        title: `Japanese ${randomUUID()}`,
      });

      const prompt = await coursePromptFixture({
        canonicalTitle: course.title,
        courseFormat: "language",
        courseId: course.id,
        generationRunId: runId,
        generationStatus: "running",
        language,
        targetLanguage: "ja",
      });

      await routeGenerationApis({
        handler: async (route) => {
          if (!isGenerationEvents(route.request().url())) {
            await route.continue();
            return;
          }

          await releaseStream.promise;

          await route.fulfill({
            body: createSSEStream([
              { entityId: course.slug, status: "completed", step: COURSE_COMPLETION_STEP },
            ]),
            contentType: "text/event-stream",
            status: 200,
          });
        },
        page: authenticatedPage,
      });

      const prefix = language === "en" ? "" : `/${language}`;
      const courseHref = `${prefix}/b/ai/c/${course.slug}?edition=original`;
      await setLocale(authenticatedPage, "de");

      // Visiting the empty course first warms the exact cache entries that
      // completion must expire before returning to the selected edition.
      await authenticatedPage.goto(courseHref);
      await expect(authenticatedPage).toHaveURL(`${prefix}/generate/course/${prompt.id}`);
      await expect(authenticatedPage.getByRole("progressbar")).toBeVisible();

      await expect(authenticatedPage.evaluate(() => document.documentElement.lang)).resolves.toBe(
        language,
      );

      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        language,
        organizationId: organization.id,
        title: `Completed curriculum ${randomUUID()}`,
      });

      await Promise.all([
        prisma.course.update({ data: { generationStatus: "completed" }, where: { id: course.id } }),
        prisma.coursePrompt.update({
          data: { generationStatus: "completed" },
          where: { id: prompt.id },
        }),
      ]);

      releaseStream.resolve(null);

      await expect(
        authenticatedPage.getByRole("link", { name: new RegExp(chapter.title, "u") }),
      ).toBeVisible({ timeout: 15_000 });

      await expect(authenticatedPage).toHaveURL(courseHref);
    });
  }

  test("keeps an English edition action in English despite a saved German preference", async ({
    authenticatedPage,
  }) => {
    const { course } = await createPublishedCourseWithLesson({
      language: "pt",
      slug: `english-edition-action-${randomUUID()}-pt`,
      title: `Portuguese course ${randomUUID()}`,
    });

    const prompt = await coursePromptFixture({
      canonicalTitle: `English edition ${randomUUID()}`,
      generationStatus: "pending",
      language: "en",
    });

    await prisma.courseEditionRequest.create({
      data: { coursePromptId: prompt.id, language: "en", sourceCourseId: course.id },
    });

    await setupMockApis(authenticatedPage, {
      streamMessages: [{ status: "started", step: "getCoursePrompt" }],
    });

    await setLocale(authenticatedPage, "de");
    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);
    await authenticatedPage.getByRole("button", { name: "Learn in English" }).click();

    await expect(authenticatedPage).toHaveURL(`/generate/course/${prompt.id}`);

    await expect(
      authenticatedPage.getByRole("heading", {
        name: `Creating the ${prompt.canonicalTitle} course`,
      }),
    ).toBeVisible();

    await expect(authenticatedPage.evaluate(() => document.documentElement.lang)).resolves.toBe(
      "en",
    );
  });

  test("keeps English edition sign-in in English despite a saved German preference", async ({
    page,
  }) => {
    const { course } = await createPublishedCourseWithLesson({
      language: "pt",
      slug: `english-edition-login-${randomUUID()}-pt`,
      title: `Portuguese course ${randomUUID()}`,
    });

    const courseHref = `/b/ai/c/${course.slug}`;
    const authUrls: URL[] = [];

    await page.route("**/auth/login**", async (route) => {
      authUrls.push(new URL(route.request().url()));
      await route.fulfill({ body: "Auth app", contentType: "text/html", status: 200 });
    });

    await setLocale(page, "de");
    await page.goto(courseHref);
    await page.getByRole("button", { name: "Learn in English" }).click();
    await expect.poll(() => authUrls.length).toBe(1);

    const authUrl = authUrls.at(0);
    expect(authUrl?.searchParams.get("locale")).toBe("en");

    const callbackUrl = new URL(authUrl?.searchParams.get("redirectTo") ?? "");
    expect(callbackUrl.searchParams.get("next")).toBe(courseHref);
  });

  test("lets guests follow an existing run without starting generation", async ({ page }) => {
    const { course } = await createPublishedCourseWithLesson({
      format: "language",
      generationStatus: "running",
      slug: `guest-progress-${randomUUID()}`,
      targetLanguage: "ja",
      title: `Japanese ${randomUUID()}`,
    });

    const runId = `guest-progress-${randomUUID()}`;

    const prompt = await coursePromptFixture({
      canonicalTitle: course.title,
      courseFormat: "language",
      courseId: course.id,
      generationRunId: runId,
      generationStatus: "running",
      language: "en",
      targetLanguage: "ja",
    });

    // Only the external workflow service is replaced. Readiness remains a real
    // server-action read of the persisted course and prompt.
    await routeGenerationApis({
      handler: async (route) => {
        if (!isGenerationEvents(route.request().url())) {
          await route.continue();
          return;
        }

        await Promise.all([
          prisma.course.update({
            data: { generationStatus: "completed" },
            where: { id: course.id },
          }),
          prisma.coursePrompt.update({
            data: { generationStatus: "completed" },
            where: { id: prompt.id },
          }),
        ]);

        await route.fulfill({
          body: createSSEStream([{ status: "started", step: "getCoursePrompt" }]),
          contentType: "text/event-stream",
          status: 200,
        });
      },
      page,
    });

    await page.goto(`/generate/course/${prompt.id}`);
    await expect(page.getByRole("progressbar")).toBeVisible();

    await expect(page).toHaveURL(`/b/ai/c/${course.slug}?edition=original`, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();

    await expect(
      getGenerationTriggerRequests({ page, targetType: "coursePrompt" }),
    ).resolves.toHaveLength(0);
  });

  test("asks unauthenticated users to log in without starting generation", async ({ page }) => {
    const coursePrompt = await coursePromptFixture({
      canonicalTitle: "E2E Unauth Course Generation",
      generationStatus: "pending",
      language: "en",
    });

    await page.goto(`/generate/course/${coursePrompt.id}`);

    await expect(page.getByRole("heading", { name: "Log in to create with AI" })).toBeVisible();

    await expect(
      page.getByText(
        "You need to log in to create new courses and lessons with AI. You can explore existing courses without logging in.",
      ),
    ).toBeVisible();

    const exploreCoursesLink = page.getByRole("link", { name: "Explore courses" });

    await expect(exploreCoursesLink).toHaveAttribute("href", "/courses");

    const loginLink = page.getByRole("link", { name: "Log in" });

    await expect(loginLink).toHaveAttribute(
      "href",
      `/login?next=%2Fgenerate%2Fcourse%2F${coursePrompt.id}`,
    );

    await expect(
      getGenerationTriggerRequests({ page, targetType: "coursePrompt" }),
    ).resolves.toHaveLength(0);

    await exploreCoursesLink.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/courses$/u);
  });

  test("offers a subscription when an authenticated user reaches a monthly limit", async ({
    authenticatedPage,
  }) => {
    const request = await coursePromptFixture({
      canonicalTitle: "E2E Authenticated Course Limit",
      generationStatus: "pending",
      language: "en",
    });

    await setupMockApis(authenticatedPage, {
      triggerResponse: getGenerationLimitResponse({
        period: "month",
        resource: "course",
        viewer: "authenticated",
      }),
    });

    await authenticatedPage.goto(`/generate/course/${request.id}`);

    await expect(
      authenticatedPage.getByRole("heading", { name: "Monthly course limit reached" }),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("link", { name: "Subscribe" })).toHaveAttribute(
      "href",
      "/subscription",
    );
  });

  test("offers support when a subscriber reaches a daily limit", async ({ authenticatedPage }) => {
    const request = await coursePromptFixture({
      canonicalTitle: "E2E Subscriber Course Limit",
      generationStatus: "pending",
      language: "en",
    });

    await setupMockApis(authenticatedPage, {
      triggerResponse: getGenerationLimitResponse({
        period: "day",
        resource: "course",
        viewer: "subscriber",
      }),
    });

    await authenticatedPage.goto(`/generate/course/${request.id}`);

    await expect(
      authenticatedPage.getByRole("heading", { name: "Daily course limit reached" }),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("link", { name: "Contact support" })).toHaveAttribute(
      "href",
      "/support",
    );
  });

  test.describe("Initial triggering state", () => {
    test("hydrates localized progress values consistently", async ({
      browser,
      withProgressUser,
    }) => {
      const request = await coursePromptFixture({
        canonicalTitle: "E2E Localized Progress",
        generationStatus: "pending",
        language: "de",
      });

      const browserContext = await browser.newContext({
        locale: "de-DE",
        storageState: withProgressUser.storageState,
      });

      const localizedPage = await browserContext.newPage();
      const hydrationErrors: Error[] = [];

      localizedPage.on("pageerror", (error) => hydrationErrors.push(error));

      await setupMockApis(localizedPage, {
        statusDelayMs: 2500,
        streamMessages: [{ status: "started", step: "getCoursePrompt" }],
      });

      const triggerRequest = localizedPage.waitForRequest(
        (pageRequest) =>
          pageRequest.method() === "POST" &&
          isGenerationTrigger({ request: pageRequest, targetType: "coursePrompt" }),
      );

      try {
        await localizedPage.goto(`/de/generate/course/${request.id}`);
        await triggerRequest;
        await expect(localizedPage.getByRole("progressbar")).toBeVisible();

        expect(hydrationErrors).toEqual([]);
      } finally {
        await browserContext.close();
      }
    });

    test("shows active generation feedback while the workflow is still starting", async ({
      authenticatedPage,
    }) => {
      const request = await coursePromptFixture({
        canonicalTitle: "E2E Immediate Generation Feedback",
        generationStatus: "pending",
        language: "en",
      });

      const triggerResponse = Promise.withResolvers<null>();

      await setupMockApis(authenticatedPage, { triggerResponseGate: triggerResponse.promise });

      const triggerRequest = authenticatedPage.waitForRequest(
        (pageRequest) =>
          pageRequest.method() === "POST" &&
          isGenerationTrigger({ request: pageRequest, targetType: "coursePrompt" }),
      );

      try {
        await authenticatedPage.goto(`/generate/course/${request.id}`);
        await triggerRequest;

        await expect(
          authenticatedPage.getByRole("heading", {
            name: "Creating the E2E Immediate Generation Feedback course",
          }),
        ).toBeVisible();

        await expect(
          authenticatedPage.getByText("Getting started...", { exact: true }),
        ).toBeVisible();
      } finally {
        triggerResponse.resolve(null);
      }
    });

    test("shows triggering state immediately on page load", async ({ authenticatedPage }) => {
      // Create a unique request to avoid PPR caching issues with seeded data
      const request = await coursePromptFixture({
        canonicalTitle: "E2E Triggering Test",
        generationStatus: "running",
        language: "en",
      });

      // Set up route mocking before navigation
      await setupMockApis(authenticatedPage, {
        streamMessages: [{ status: "started", step: "getCoursePrompt" }],
      });

      // Navigate directly to the generate page with the unique request
      await authenticatedPage.goto(`/generate/course/${request.id}`);

      // Should show triggering or streaming state (no idle state)
      await expect(
        authenticatedPage.getByRole("heading", { name: "Creating the E2E Triggering Test course" }),
      ).toBeVisible({ timeout: 10_000 });

      await expect(
        authenticatedPage.getByText(/this usually takes about 2 minutes/iu),
      ).toBeVisible();

      const exitLink = authenticatedPage.getByRole("link", { name: /back home/iu });
      await expect(exitLink).toBeVisible();
      await expect(exitLink).toHaveAttribute("href", "/");
    });
  });

  test.describe("Workflow completion and redirect", () => {
    test("redirects linked completed regular course to the first intro lesson", async ({
      authenticatedPage,
    }) => {
      const courseSlug = `e2e-linked-course-${randomUUID().slice(0, 8)}`;

      const courseContent = await createPublishedCourseWithLesson({
        generationStatus: "completed",
        slug: courseSlug,
        title: "E2E Linked Completed Course",
      });

      const introLessonTarget = getIntroLessonCompletionTarget(courseContent);

      const request = await coursePromptFixture({
        canonicalTitle: "E2E Linked Completed Request",
        courseId: courseContent.course.id,
        generationStatus: "pending",
        language: "en",
      });

      await routeGenerationApis({
        handler: async (route) => {
          throw new Error(`Generation workflow should not start: ${route.request().url()}`);
        },
        page: authenticatedPage,
      });

      await authenticatedPage.goto(`/generate/course/${request.id}`);

      await authenticatedPage.waitForURL(`/b/ai/c/${introLessonTarget}`, { timeout: 10_000 });
    });

    test("redirects to the first intro lesson when the linked course is still generating", async ({
      authenticatedPage,
    }) => {
      const courseSlug = `e2e-linked-running-course-${randomUUID().slice(0, 8)}`;

      const { chapter, course, lesson } = await createPublishedCourseWithLesson({
        generationStatus: "running",
        slug: courseSlug,
        title: "E2E Linked Running Course",
      });

      const request = await coursePromptFixture({
        canonicalTitle: "E2E Linked Running Request",
        courseId: course.id,
        generationStatus: "pending",
        language: "en",
      });

      await routeGenerationApis({
        handler: async (route) => {
          throw new Error(`Generation workflow should not start: ${route.request().url()}`);
        },
        page: authenticatedPage,
      });

      await authenticatedPage.goto(`/generate/course/${request.id}`);

      await authenticatedPage.waitForURL(
        `/b/ai/c/${courseSlug}/ch/${chapter.slug}/l/${lesson.slug}`,
        { timeout: 10_000 },
      );
    });

    test("redirects linked completed language course to the course page", async ({
      authenticatedPage,
    }) => {
      const courseSlug = `e2e-linked-language-course-${randomUUID().slice(0, 8)}`;

      const { course } = await createPublishedCourseWithLesson({
        format: "language",
        generationStatus: "completed",
        slug: courseSlug,
        targetLanguage: "es",
        title: "E2E Linked Completed Language Course",
      });

      const request = await coursePromptFixture({
        canonicalTitle: "E2E Linked Completed Language Request",
        courseFormat: "language",
        courseId: course.id,
        generationStatus: "pending",
        language: "en",
        targetLanguage: "es",
      });

      await routeGenerationApis({
        handler: async (route) => {
          throw new Error(`Generation workflow should not start: ${route.request().url()}`);
        },
        page: authenticatedPage,
      });

      await authenticatedPage.goto(`/generate/course/${request.id}`);

      await authenticatedPage.waitForURL(`/b/ai/c/${courseSlug}?edition=original`, {
        timeout: 10_000,
      });
    });

    test("shows completion state and redirects to the first intro lesson", async ({
      authenticatedPage,
    }) => {
      const title = "E2E Completion Test";
      const slug = `e2e-completion-${randomUUID().slice(0, 8)}`;

      const request = await coursePromptFixture({
        canonicalTitle: title,
        generationStatus: "pending",
        language: "en",
      });

      const courseContent = await createPublishedCourseWithLesson({ slug, title });

      const introLessonTarget = getIntroLessonCompletionTarget(courseContent);

      await setupMockApis(authenticatedPage, {
        assertBearerAuth: true,
        streamMessages: [
          { status: "started", step: "getCoursePrompt" },
          { status: "completed", step: "getCoursePrompt" },
          { status: "started", step: INTRODUCTION_LESSON_COMPLETION_STEP },
          {
            entityId: introLessonTarget,
            status: "completed",
            step: INTRODUCTION_LESSON_COMPLETION_STEP,
          },
        ],
      });

      await authenticatedPage.goto(`/generate/course/${request.id}`);

      await expect(authenticatedPage.getByText(/taking you to your first lesson/iu)).toBeVisible();
      expect(await authenticatedPage.getByRole("link", { name: /back home/iu }).count()).toBe(0);

      await authenticatedPage.waitForURL(`/b/ai/c/${introLessonTarget}`, { timeout: 10_000 });
    });

    test("redirects to the completed workflow intro lesson", async ({ authenticatedPage }) => {
      const courseSlug = `e2e-identity-course-${randomUUID().slice(0, 8)}`;

      const request = await coursePromptFixture({
        canonicalTitle: "E2E Identity Redirect Request",
        generationStatus: "pending",
        language: "en",
      });

      const courseContent = await createPublishedCourseWithLesson({
        slug: courseSlug,
        title: "E2E Identity Redirect Course",
      });

      const introLessonTarget = getIntroLessonCompletionTarget(courseContent);

      await setupMockApis(authenticatedPage, {
        streamMessages: [
          { status: "started", step: "getCoursePrompt" },
          { status: "completed", step: "getCoursePrompt" },
          { status: "started", step: INTRODUCTION_LESSON_COMPLETION_STEP },
          {
            entityId: introLessonTarget,
            status: "completed",
            step: INTRODUCTION_LESSON_COMPLETION_STEP,
          },
        ],
      });

      await authenticatedPage.goto(`/generate/course/${request.id}`);

      await authenticatedPage.waitForURL(`/b/ai/c/${introLessonTarget}`, { timeout: 10_000 });

      expect(authenticatedPage.url()).not.toContain(request.id);
    });

    test("redirects language course completion to the course page", async ({
      authenticatedPage,
    }) => {
      const org = await getAiOrganization();
      const title = `E2E Language Completion ${randomUUID().slice(0, 8)}`;
      const courseSlug = `e2e-language-completion-${randomUUID().slice(0, 8)}`;

      const course = await courseFixture({
        format: "language",
        generationStatus: "running",
        isPublished: true,
        organizationId: org.id,
        slug: courseSlug,
        targetLanguage: "es",
        title,
      });

      await chapterFixture({ courseId: course.id, isPublished: true, organizationId: org.id });

      const request = await coursePromptFixture({
        canonicalTitle: title,
        courseFormat: "language",
        courseId: course.id,
        generationStatus: "pending",
        language: "en",
        targetLanguage: "es",
      });

      await setupMockApis(authenticatedPage, {
        streamMessages: [
          { status: "started", step: "getCoursePrompt" },
          { status: "completed", step: "getCoursePrompt" },
          { status: "started", step: COURSE_COMPLETION_STEP },
          { entityId: courseSlug, status: "completed", step: COURSE_COMPLETION_STEP },
        ],
      });

      await authenticatedPage.goto(`/generate/course/${request.id}`);

      await authenticatedPage.waitForURL(`/b/ai/c/${courseSlug}?edition=original`, {
        timeout: 10_000,
      });
    });

    test("redirects to suffixed slug intro lesson for non-English courses", async ({
      authenticatedPage,
    }) => {
      const title = `E2E Locale Redirect ${randomUUID().slice(0, 8)}`;
      const suffixedSlug = ensureLocaleSuffix(toSlug(title), "pt");

      const [request, courseContent] = await Promise.all([
        coursePromptFixture({ canonicalTitle: title, generationStatus: "pending", language: "pt" }),
        createPublishedCourseWithLesson({ generationStatus: "running", slug: suffixedSlug, title }),
      ]);

      const introLessonTarget = getIntroLessonCompletionTarget(courseContent);

      await setupMockApis(authenticatedPage, {
        streamMessages: [
          { status: "started", step: "getCoursePrompt" },
          { status: "completed", step: "getCoursePrompt" },
          { status: "started", step: INTRODUCTION_LESSON_COMPLETION_STEP },
          {
            entityId: introLessonTarget,
            status: "completed",
            step: INTRODUCTION_LESSON_COMPLETION_STEP,
          },
        ],
      });

      await authenticatedPage.goto(`/generate/course/${request.id}`);

      // Should redirect to the suffixed slug, not the raw canonical slug.
      await authenticatedPage.waitForURL(`/b/ai/c/${introLessonTarget}`, { timeout: 10_000 });
    });
  });

  test.describe("Error handling", () => {
    test("recovers the actual failed run when its error event is lost", async ({
      authenticatedPage,
    }) => {
      const prompt = await setupFailedRunWithoutEvent({ page: authenticatedPage });
      await authenticatedPage.goto(`/generate/course/${prompt.id}`);

      await expect(authenticatedPage.getByRole("button", { name: "Try again" })).toBeVisible({
        timeout: 15_000,
      });

      await expect(
        prisma.coursePrompt.findUniqueOrThrow({ where: { id: prompt.id } }),
      ).resolves.toMatchObject({ generationRunId: null, generationStatus: "failed" });

      await expect(
        getGenerationTriggerRequests({ page: authenticatedPage, targetType: "coursePrompt" }),
      ).resolves.toHaveLength(0);
    });

    test("detects a failed joined winner after the initiating run already completed", async ({
      authenticatedPage,
    }) => {
      // An identity handoff completes the initiating workflow before the first
      // poll. Its winner then fails, clearing the prompt's winning run ID.
      const prompt = await setupFailedRunWithoutEvent({
        page: authenticatedPage,
        runStatus: "completed",
      });

      await authenticatedPage.goto(`/generate/course/${prompt.id}`);

      await expect(authenticatedPage.getByRole("button", { name: "Try again" })).toBeVisible({
        timeout: 15_000,
      });

      await expect(
        getGenerationTriggerRequests({ page: authenticatedPage, targetType: "coursePrompt" }),
      ).resolves.toHaveLength(0);
    });

    test("rereads a failed prompt after its followed run finishes before showing an error", async ({
      authenticatedPage,
    }) => {
      const { course } = await createPublishedCourseWithLesson({
        format: "language",
        slug: `completed-during-status-${randomUUID()}`,
        targetLanguage: "ja",
        title: `Japanese ${randomUUID()}`,
      });

      const prompt = await setupFailedRunWithoutEvent({
        beforeRunStatus: async (coursePromptId) => {
          await prisma.coursePrompt.update({
            data: { courseId: course.id, generationStatus: "completed" },
            where: { id: coursePromptId },
          });
        },
        page: authenticatedPage,
        runStatus: "completed",
      });

      await authenticatedPage.goto(`/generate/course/${prompt.id}`);

      await expect(authenticatedPage.getByRole("button", { name: "Try again" })).toHaveCount(0);

      await expect(authenticatedPage).toHaveURL(`/b/ai/c/${course.slug}?edition=original`, {
        timeout: 15_000,
      });

      await expect(
        authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
      ).toBeVisible();
    });

    test("requires guest sign-in before retrying a followed run that failed", async ({ page }) => {
      const prompt = await setupFailedRunWithoutEvent({ page });
      await page.goto(`/generate/course/${prompt.id}`);

      await expect(page.getByRole("button", { name: "Try again" })).toBeVisible({
        timeout: 15_000,
      });

      await page.getByRole("button", { name: "Try again" }).click();

      await expect(page).toHaveURL(
        `/login?next=${encodeURIComponent(`/en/generate/course/${prompt.id}`)}`,
      );

      await expect(
        getGenerationTriggerRequests({ page, targetType: "coursePrompt" }),
      ).resolves.toHaveLength(0);
    });

    test("accepts prompt readiness when a retry starts during an older run status read", async ({
      authenticatedPage,
    }) => {
      const oldRunId = `older-status-${randomUUID()}`;
      const retryRunId = `retry-status-${randomUUID()}`;
      const oldStatusRequested = Promise.withResolvers<null>();
      const releaseOldStatus = Promise.withResolvers<null>();
      const retryStarted = Promise.withResolvers<null>();

      const { course } = await createPublishedCourseWithLesson({
        format: "language",
        slug: `retry-during-status-${randomUUID()}`,
        targetLanguage: "ja",
        title: `Japanese ${randomUUID()}`,
      });

      const prompt = await coursePromptFixture({
        canonicalTitle: course.title,
        courseFormat: "language",
        generationRunId: oldRunId,
        generationStatus: "running",
        language: "en",
        targetLanguage: "ja",
      });

      // Hold only the external run resource. Prompt readiness stays a real
      // server-action read, including the read that crosses a local retry.
      await routeGenerationApis({
        handler: async (route) => {
          const request = route.request();
          const pathname = new URL(request.url()).pathname;

          if (isGenerationTrigger({ request, targetType: "coursePrompt" })) {
            await route.fulfill({
              body: JSON.stringify({ id: retryRunId, status: "pending" }),
              contentType: "application/json",
              status: 202,
            });

            return;
          }

          if (pathname === `/v1/generations/${oldRunId}/events`) {
            await prisma.coursePrompt.updateMany({
              data: { generationRunId: null, generationStatus: "failed" },
              where: { generationRunId: oldRunId, id: prompt.id },
            });

            await oldStatusRequested.promise;

            await route.fulfill({
              body: createSSEStream([
                { reason: "notFound", status: "error", step: "getCoursePrompt" },
              ]),
              contentType: "text/event-stream",
              status: 200,
            });

            return;
          }

          if (pathname === `/v1/generations/${oldRunId}`) {
            oldStatusRequested.resolve(null);
            await releaseOldStatus.promise;

            await route.fulfill({
              body: JSON.stringify({ id: oldRunId, status: "completed" }),
              contentType: "application/json",
              status: 200,
            });

            return;
          }

          if (pathname === `/v1/generations/${retryRunId}/events`) {
            await prisma.coursePrompt.update({
              data: { courseId: course.id, generationStatus: "completed" },
              where: { id: prompt.id },
            });

            retryStarted.resolve(null);

            await route.fulfill({
              body: createSSEStream([{ status: "started", step: "getCoursePrompt" }]),
              contentType: "text/event-stream",
              status: 200,
            });

            return;
          }

          await route.continue();
        },
        page: authenticatedPage,
      });

      await authenticatedPage.goto(`/generate/course/${prompt.id}`);
      await oldStatusRequested.promise;
      await authenticatedPage.getByRole("button", { name: "Try again" }).click();
      await retryStarted.promise;
      releaseOldStatus.resolve(null);

      await expect(authenticatedPage).toHaveURL(`/b/ai/c/${course.slug}?edition=original`, {
        timeout: 15_000,
      });

      await expect(
        authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
      ).toBeVisible();
    });

    test("shows error when stream returns error status", async ({ authenticatedPage }) => {
      const request = await coursePromptFixture({
        canonicalTitle: "E2E Error Handling Test",
        generationStatus: "pending",
        language: "en",
      });

      await setupMockApis(authenticatedPage, {
        streamMessages: [
          { status: "started", step: "getCoursePrompt" },
          { reason: "notFound", status: "error", step: "getCoursePrompt" },
        ],
      });

      await authenticatedPage.goto(`/generate/course/${request.id}`);

      // Should show error message when a step errors
      await expect(authenticatedPage.getByText(/something went wrong/iu)).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  test.describe("Not found", () => {
    test("unknown request ID shows 404 page", async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/generate/course/${randomUUID()}`);
      await expect(authenticatedPage.getByText(/not found|404/iu)).toBeVisible();
    });

    test("invalid request ID shows 404 page", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/generate/course/invalid-id");
      await expect(authenticatedPage.getByText(/not found|404/iu)).toBeVisible();
    });
  });
});
