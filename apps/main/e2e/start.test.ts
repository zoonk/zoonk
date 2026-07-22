import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { type Page, type Route } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { normalizeString } from "@zoonk/utils/string";
import { mockFeedbackSubmission } from "./feedback";
import { expect, test } from "./fixtures";

const TEST_RUN_ID = "test-run-id-start-language";

/**
 * Language selection only needs to prove it enters the generation page. The
 * workflow itself is covered by API tests, so this keeps the browser test from
 * starting real AI generation.
 */
async function mockCourseGenerationWorkflow(page: Page): Promise<void> {
  await page.route("**/v1/workflows/course-generation/**", handleCourseGenerationRoute);
}

/**
 * The generation page starts the course workflow from the browser. Returning a
 * run id and an empty SSE stream gives that client enough contract to render
 * without depending on the API app.
 */
async function handleCourseGenerationRoute(route: Route): Promise<void> {
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
    await route.fulfill({ body: "", contentType: "text/event-stream", status: 200 });
    return;
  }

  await route.continue();
}

/**
 * Creates the completed Icelandic destination before the language picker can
 * warm its public cache. Keeping the setup ahead of every route visit mirrors
 * production, where generation invalidates this cache before redirecting.
 */
async function createCompletedIcelandicCourseFixture(): Promise<void> {
  const uniqueId = randomUUID().slice(0, 8);
  const organization = await getAiOrganization();
  const title = `E2E Icelandic ${uniqueId}`;

  const course = await courseFixture({
    format: "language",
    generationStatus: "completed",
    isPublished: true,
    language: "en",
    normalizedTitle: normalizeString(title),
    organizationId: organization.id,
    slug: `e2e-icelandic-${uniqueId}`,
    targetLanguage: "is",
    title,
  });

  await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: organization.id,
    position: 0,
    title: `E2E Icelandic Chapter ${uniqueId}`,
  });
}

test.describe("Start page", () => {
  test("shows goal cards and opens the learn path", async ({ page }) => {
    await page.goto("/start");

    await expect(page.getByRole("heading", { name: "What's your goal?" })).toBeVisible();
    await expect(page.getByRole("link", { name: /speak a language/iu })).toBeVisible();
    await expect(page.getByRole("link", { name: /learn something/iu })).toBeVisible();
    await expect(page.getByRole("link", { name: /pass an exam/iu })).toBeVisible();
    await expect(page.getByText(/coming soon/iu)).toBeVisible();

    await page.getByRole("link", { name: /learn something/iu }).click();

    await expect(page).toHaveURL(/\/start\/learn$/u);
    await expect(page.getByRole("heading", { name: /what do you want to learn/iu })).toBeVisible();
  });
});

test.describe("Start language path", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(createCompletedIcelandicCourseFixture);

  test("filters languages and creates a controlled language request", async ({ page }) => {
    await mockCourseGenerationWorkflow(page);
    await page.goto("/start/speak");

    await expect(
      page.getByRole("heading", { name: /what language do you want to learn/iu }),
    ).toBeVisible();

    await expect(page.getByRole("button", { name: "Português" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /^english/iu })).not.toBeVisible();

    await page.getByRole("searchbox", { name: /search languages/iu }).fill("Javanese");

    await expect(page.getByRole("link", { name: /javanese/iu })).toBeVisible();
    await expect(page.getByRole("link", { name: /^english/iu })).not.toBeVisible();

    const javaneseLink = page.getByRole("link", { name: /javanese/iu });

    await expect(javaneseLink).toHaveAttribute("href", "/start/speak/jv");
    await expect(javaneseLink).toHaveAttribute("rel", "nofollow");

    await javaneseLink.click();

    await expect(page).toHaveURL(/\/generate\/course\/[-a-f0-9]+$/u);

    const requestId = page.url().split("/").at(-1);

    if (!requestId) {
      throw new Error("Missing generated request id in URL");
    }

    const request = await prisma.coursePrompt.findUnique({ where: { id: requestId } });

    expect(request?.targetLanguage).toBe("jv");
  });

  test("does not generate a course for the current app language", async ({ page }) => {
    await mockCourseGenerationWorkflow(page);

    await page.goto("/start/speak/en");

    await expect(page).toHaveURL(/\/start\/speak$/u);

    await expect(
      page.getByRole("heading", { name: /what language do you want to learn/iu }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /^english/iu })).not.toBeVisible();
  });

  test("opens an existing completed language course without generation", async ({ page }) => {
    await page.goto("/start/speak");
    await page.getByRole("searchbox", { name: /search languages/iu }).fill("Icelandic");

    const icelandicLink = page.getByRole("link", { name: /icelandic/iu });
    const organization = await getAiOrganization();
    const courseHref = await icelandicLink.getAttribute("href");

    if (!courseHref) {
      throw new Error("Missing completed Icelandic course href");
    }

    expect(courseHref).toMatch(
      new RegExp(`^/b/${organization.slug}/c/e2e-icelandic-[a-f0-9]+$`, "u"),
    );

    await expect(icelandicLink).not.toHaveAttribute("rel", "nofollow");

    await icelandicLink.click();

    await expect(page).toHaveURL(new RegExp(`${courseHref}$`, "u"));
  });
});

test.describe("Start exam path", () => {
  test("submits exam waitlist details to feedback", async ({ page }) => {
    const feedbackSubmission = await mockFeedbackSubmission(page);

    await page.goto("/start/exam");

    await expect(page.getByRole("heading", { name: /pass an exam/iu })).toBeVisible();
    await expect(page.getByText(/not available yet/iu)).toBeVisible();

    await page.getByRole("textbox", { name: /email address/iu }).fill("test@example.com");
    await page.getByRole("textbox", { name: /exam/iu }).fill("CFA Level I");
    await page.getByRole("button", { name: /notify me/iu }).click();

    await expect(page.getByText(/you're on the list/iu)).toBeVisible();

    await expect(feedbackSubmission.requestBody).resolves.toStrictEqual({
      email: "test@example.com",
      message: "Exam waitlist request\n\nExam: CFA Level I",
    });
  });
});
