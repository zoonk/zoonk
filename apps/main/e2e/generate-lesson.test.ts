import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { type Page, type Route } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

/**
 * Test Architecture for Lesson Generation Page
 *
 * The generation page has 4 access states:
 * 1. Unauthenticated free preview - Shows generation UI
 * 2. Authenticated later chapter without subscription - Shows upgrade CTA
 * 3. Authenticated first chapter - Shows generation UI without subscription
 * 4. Authenticated with subscription - Shows generation UI
 *
 * The generation flow interacts with 2 APIs on the API server:
 * 1. POST ${API_BASE_URL}/v1/workflows/lesson-generation/trigger - Starts the workflow, returns { runId: string }
 * 2. GET ${API_BASE_URL}/v1/workflows/lesson-generation/status?runId=X&startIndex=N - Returns SSE stream of step updates
 */

const TEST_RUN_ID = "test-run-id-lesson-12345";

type MockApiOptions = {
  triggerResponse?: { runId?: string; error?: string; status?: number };
  streamMessages?: { reason?: string; step: string; status: string }[];
  streamError?: boolean;
  statusDelayMs?: number;
};

/**
 * Creates a mock SSE stream response from an array of messages.
 */
function createSSEStream(messages: { reason?: string; step: string; status: string }[]): string {
  return messages.map((msg) => `data: ${JSON.stringify(msg)}\n\n`).join("");
}

/**
 * Creates the route handler function for mocking APIs.
 */
function createRouteHandler(options: MockApiOptions) {
  const {
    statusDelayMs = 0,
    triggerResponse = { runId: TEST_RUN_ID },
    streamMessages = [],
    streamError = false,
  } = options;

  return async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Mock trigger API
    if (url.includes("/v1/workflows/lesson-generation/trigger") && method === "POST") {
      if (triggerResponse.error) {
        await route.fulfill({
          body: JSON.stringify({ error: triggerResponse.error }),
          contentType: "application/json",
          status: triggerResponse.status ?? 500,
        });

        return;
      }

      await route.fulfill({
        body: JSON.stringify({ message: "Workflow started", runId: triggerResponse.runId }),
        contentType: "application/json",
        status: 200,
      });

      return;
    }

    // Mock status stream API
    if (url.includes("/v1/workflows/lesson-generation/status")) {
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
 * Sets up route interception for lesson generation APIs.
 */
async function setupMockApis(page: Page, options: MockApiOptions = {}): Promise<void> {
  const handler = createRouteHandler(options);
  await page.route("**/v1/workflows/lesson-generation/**", handler);
}

/**
 * Creates a lesson with pending generation status for testing the generation workflow.
 */
async function createPendingLesson({
  chapterPosition = 0,
  lessonPosition = 0,
}: { chapterPosition?: number; lessonPosition?: number } = {}) {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);
  const courseTitle = `E2E Lesson Course ${uniqueId}`;
  const chapterTitle = `E2E Lesson Chapter ${uniqueId}`;
  const lessonTitle = `E2E Generation Lesson ${uniqueId}`;

  const course = await courseFixture({
    isPublished: true,
    normalizedTitle: normalizeString(courseTitle),
    organizationId: org.id,
    slug: `e2e-lesson-course-${uniqueId}`,
    title: courseTitle,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    generationStatus: "completed",
    isPublished: true,
    normalizedTitle: normalizeString(chapterTitle),
    organizationId: org.id,
    position: chapterPosition,
    slug: `e2e-lesson-chapter-${uniqueId}`,
    title: chapterTitle,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "pending",
    isPublished: true,
    normalizedTitle: normalizeString(lessonTitle),
    organizationId: org.id,
    position: lessonPosition,
    slug: `e2e-gen-lesson-${uniqueId}`,
    title: lessonTitle,
  });

  return { chapter, course, lesson, organizationId: org.id };
}

/**
 * A pending practice lesson is locked until the explanation lessons in its
 * source range are completed. This creates the smallest chapter shape that can
 * prove the generate page sends learners to the missing explanation instead.
 */
async function createBlockedPracticeLesson() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);
  const courseTitle = `E2E Blocked Course ${uniqueId}`;
  const chapterTitle = `E2E Blocked Chapter ${uniqueId}`;
  const explanationTitle = `E2E Required Explanation ${uniqueId}`;
  const practiceTitle = `E2E Blocked Practice ${uniqueId}`;

  const course = await courseFixture({
    isPublished: true,
    normalizedTitle: normalizeString(courseTitle),
    organizationId: org.id,
    slug: `e2e-blocked-course-${uniqueId}`,
    title: courseTitle,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    generationStatus: "completed",
    isPublished: true,
    normalizedTitle: normalizeString(chapterTitle),
    organizationId: org.id,
    slug: `e2e-blocked-chapter-${uniqueId}`,
    title: chapterTitle,
  });

  const [explanation, practice] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "explanation",
      normalizedTitle: normalizeString(explanationTitle),
      organizationId: org.id,
      position: 0,
      slug: `e2e-required-explanation-${uniqueId}`,
      title: explanationTitle,
    }),
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "practice",
      normalizedTitle: normalizeString(practiceTitle),
      organizationId: org.id,
      position: 1,
      slug: `e2e-blocked-practice-${uniqueId}`,
      title: practiceTitle,
    }),
  ]);

  return { explanation, practice };
}

/**
 * Creates a test subscription for the given user.
 */
async function createTestSubscription(userId: string) {
  const uniqueId = randomUUID();

  const subscription = await prisma.subscription.create({
    data: {
      id: randomUUID(),
      plan: "hobby",
      referenceId: userId,
      status: "active",
      stripeCustomerId: `cus_test_e2e_lesson_${uniqueId}`,
      stripeSubscriptionId: `sub_test_e2e_lesson_${uniqueId}`,
    },
  });

  return subscription;
}

test.describe("Generate Lesson Page - Unauthenticated", () => {
  test("shows upgrade CTA for later chapter lessons", async ({ page }) => {
    const { lesson } = await createPendingLesson({ chapterPosition: 1 });
    await page.goto(`/generate/l/${lesson.id}`);

    await expect(page.getByText(/upgrade to create/iu)).toBeVisible();

    const upgradeLink = page.getByRole("link", { name: /upgrade/iu });
    await expect(upgradeLink).toBeVisible();
    await expect(upgradeLink).toHaveAttribute("href", /\/subscription/u);
  });
});

test.describe("Generate Lesson Page - No Subscription", () => {
  test("shows upgrade CTA with link to subscription page", async ({ authenticatedPage }) => {
    const { lesson } = await createPendingLesson({ chapterPosition: 1 });
    await authenticatedPage.goto(`/generate/l/${lesson.id}`);

    await expect(authenticatedPage.getByText(/upgrade to create/iu)).toBeVisible();

    const upgradeLink = authenticatedPage.getByRole("link", { name: /upgrade/iu });
    await expect(upgradeLink).toBeVisible();
    await expect(upgradeLink).toHaveAttribute("href", /\/subscription/u);
  });

  test("requires subscription to retry failed later-chapter generation", async ({
    authenticatedPage,
  }) => {
    const { lesson } = await createPendingLesson({ chapterPosition: 1 });

    await prisma.lesson.update({ data: { generationStatus: "failed" }, where: { id: lesson.id } });

    await setupMockApis(authenticatedPage, {
      statusDelayMs: 2500,
      streamMessages: [{ status: "started", step: "getLesson" }],
    });

    await authenticatedPage.goto(`/generate/l/${lesson.id}`);

    await expect(authenticatedPage.getByText(/upgrade to create/iu)).toBeVisible();
  });
});

test.describe("Generate Lesson Page - First Chapter Free", () => {
  test("unauthenticated user sees generation UI through lesson five", async ({ page }) => {
    const { lesson } = await createPendingLesson({ chapterPosition: 0, lessonPosition: 4 });

    await setupMockApis(page, {
      statusDelayMs: 2500,
      streamMessages: [{ status: "started", step: "getLesson" }],
    });

    await page.goto(`/generate/l/${lesson.id}`);

    await expect(page.getByText(/upgrade to create/iu)).toHaveCount(0);

    await expect(page.getByRole("heading", { name: lesson.title ?? "" })).toBeVisible();
  });

  test("unauthenticated user sees login prompt for lessons six through ten", async ({ page }) => {
    const { lesson } = await createPendingLesson({ chapterPosition: 0, lessonPosition: 5 });

    await page.goto(`/generate/l/${lesson.id}`);

    await expect(page.getByRole("alert").filter({ hasText: /logged in/iu })).toBeVisible();

    const loginLink = page.getByRole("link", { name: /login/iu });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");
  });

  test("authenticated user without subscription sees generation UI for first chapter lesson", async ({
    authenticatedPage,
  }) => {
    const { lesson } = await createPendingLesson({ chapterPosition: 0, lessonPosition: 9 });

    await setupMockApis(authenticatedPage, {
      statusDelayMs: 2500,
      streamMessages: [{ status: "started", step: "getLesson" }],
    });

    await authenticatedPage.goto(`/generate/l/${lesson.id}`);

    await expect(authenticatedPage.getByText(/upgrade to create/iu)).toHaveCount(0);

    await expect(
      authenticatedPage.getByRole("heading", { name: lesson.title ?? "" }),
    ).toBeVisible();
  });

  test("authenticated user without subscription sees upgrade CTA from lesson eleven", async ({
    authenticatedPage,
  }) => {
    const { lesson } = await createPendingLesson({ chapterPosition: 0, lessonPosition: 10 });

    await authenticatedPage.goto(`/generate/l/${lesson.id}`);

    await expect(authenticatedPage.getByText(/upgrade to create/iu)).toBeVisible();
  });
});

test.describe("Generate Lesson Page - Prerequisites", () => {
  test("links to the required explanation when practice is blocked", async ({
    authenticatedPage,
  }) => {
    const { explanation, practice } = await createBlockedPracticeLesson();

    await authenticatedPage.goto(`/generate/l/${practice.id}`);

    await expect(
      authenticatedPage.getByRole("heading", { name: practice.title ?? "" }),
    ).toBeVisible();

    await expect(authenticatedPage.getByText("Lesson locked")).toBeVisible();
    await expect(authenticatedPage.getByText("Create the required lesson first.")).toBeVisible();

    const requiredLessonLink = authenticatedPage.getByRole("link", {
      name: "Open required lesson",
    });

    await expect(requiredLessonLink).toBeVisible();
    await expect(requiredLessonLink).toHaveAttribute("href", `/generate/l/${explanation.id}`);
  });
});

test.describe("Generate Lesson Page - With Subscription", () => {
  test("shows completion UI before redirecting when lesson is already ready", async ({
    authenticatedPage,
  }) => {
    const { lesson } = await createPendingLesson();
    const uniqueId = randomUUID().slice(0, 8);

    await Promise.all([
      stepFixture({
        content: {
          text: `E2E Ready Lesson ${uniqueId}`,
          title: `E2E Ready Lesson ${uniqueId}`,
          variant: "text",
        },
        isPublished: true,
        kind: "static",
        lessonId: lesson.id,
      }),
      prisma.lesson.update({ data: { generationStatus: "completed" }, where: { id: lesson.id } }),
    ]);

    await authenticatedPage.goto(`/generate/l/${lesson.id}`);

    await expect(authenticatedPage.getByText(/your lesson is ready/iu)).toBeVisible();
    await expect(authenticatedPage.getByText(/taking you to your lesson/iu)).toBeVisible();

    await authenticatedPage.waitForURL(
      new RegExp(`/b/${AI_ORG_SLUG}/c/.+/ch/.+/l/${lesson.slug}`, "u"),
      { timeout: 10_000 },
    );
  });

  test("shows generation UI and completes workflow", async ({
    userWithoutProgress,
    noProgressUser,
  }) => {
    await createTestSubscription(noProgressUser.id);
    const { lesson } = await createPendingLesson();

    const uniqueId = randomUUID().slice(0, 8);

    await stepFixture({
      content: {
        text: `E2E Generated Lesson ${uniqueId}`,
        title: `E2E Generated Lesson ${uniqueId}`,
        variant: "text",
      },
      isPublished: true,
      kind: "static",
      lessonId: lesson.id,
    });

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLesson" },
        { status: "completed", step: "getLesson" },
        { status: "started", step: "setLessonAsRunning" },
        { status: "completed", step: "setLessonAsRunning" },
        { status: "started", step: "generateExplanationContent" },
        { status: "completed", step: "generateExplanationContent" },
        { status: "started", step: "generateImagePrompts" },
        { status: "completed", step: "generateImagePrompts" },
        { status: "started", step: "generateStepImages" },
        { status: "completed", step: "generateStepImages" },
        { status: "started", step: "saveExplanationLesson" },
        { status: "completed", step: "saveExplanationLesson" },
        { status: "started", step: "setLessonAsCompleted" },
        { status: "completed", step: "setLessonAsCompleted" },
      ],
    });

    await userWithoutProgress.goto(`/generate/l/${lesson.id}`);

    await expect(userWithoutProgress.getByText(/your lesson is ready/iu)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByText(/taking you to your lesson/iu)).toBeVisible();

    await prisma.lesson.update({
      data: { generationStatus: "completed" },
      where: { id: lesson.id },
    });

    await userWithoutProgress.waitForURL(/\/b\/ai\/c\/.+\/ch\/.+\/l\/.+$/u, { timeout: 10_000 });
  });

  test("shows time estimate during generation", async ({ userWithoutProgress, noProgressUser }) => {
    await createTestSubscription(noProgressUser.id);
    const { lesson } = await createPendingLesson();

    await setupMockApis(userWithoutProgress, {
      statusDelayMs: 2500,
      streamMessages: [{ status: "started", step: "getLesson" }],
    });

    await userWithoutProgress.goto(`/generate/l/${lesson.id}`);

    await expect(userWithoutProgress.getByText(/this usually takes 1-2 minutes/iu)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows error when stream returns error status", async ({
    userWithoutProgress,
    noProgressUser,
  }) => {
    await createTestSubscription(noProgressUser.id);
    const { lesson } = await createPendingLesson();

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLesson" },
        { reason: "notFound", status: "error", step: "getLesson" },
      ],
    });

    await userWithoutProgress.goto(`/generate/l/${lesson.id}`);

    await expect(userWithoutProgress.getByText(/something went wrong/iu)).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Generate Lesson Page - Running Later Lesson Requires Subscription", () => {
  test("unauthenticated user sees upgrade CTA when status is running", async ({ page }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      normalizedTitle: normalizeString(`E2E Running Lesson Course ${uniqueId}`),
      organizationId: org.id,
      slug: `e2e-running-lesson-course-${uniqueId}`,
      title: `E2E Running Lesson Course ${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationStatus: "completed",
      isPublished: true,
      normalizedTitle: normalizeString(`E2E Running Lesson Chapter ${uniqueId}`),
      organizationId: org.id,
      position: 1,
      slug: `e2e-running-lesson-chapter-${uniqueId}`,
      title: `E2E Running Lesson Chapter ${uniqueId}`,
    });

    const lessonTitle = `E2E Running Lesson ${uniqueId}`;

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationRunId: `run-${uniqueId}`,
      generationStatus: "running",
      isPublished: true,
      normalizedTitle: normalizeString(lessonTitle),
      organizationId: org.id,
      slug: `e2e-running-lesson-${uniqueId}`,
      title: lessonTitle,
    });

    await page.goto(`/generate/l/${lesson.id}`);

    await expect(page.getByText(/upgrade to create/iu)).toBeVisible();
  });
});

test.describe("Generate Lesson Page - Not Found", () => {
  test("invalid lesson ID shows 404 page", async ({ page }) => {
    await page.goto("/generate/l/999999");
    await expect(page.getByText(/not found|404/iu)).toBeVisible();
  });

  test("non-numeric lesson ID shows 404 page", async ({ page }) => {
    await page.goto("/generate/l/invalid-id");
    await expect(page.getByText(/not found|404/iu)).toBeVisible();
  });
});
