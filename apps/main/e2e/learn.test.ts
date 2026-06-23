import { randomUUID } from "node:crypto";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import { prisma } from "@zoonk/db";
import { type Page, type Route } from "@zoonk/e2e/fixtures";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

const TEST_RUN_ID = "test-run-id-learn-generate-link";

/**
 * The learn-flow tests only verify navigation into the generation page. Mocking
 * the workflow API keeps that page from starting real course generation after
 * the URL assertion has already proved the behavior under test.
 */
async function mockCourseGenerationWorkflow(page: Page): Promise<void> {
  await page.route("**/v1/workflows/course-generation/**", handleCourseGenerationRoute);
}

/**
 * The generation client expects the trigger endpoint to return a run id and
 * the status endpoint to speak SSE. Returning an empty stream is enough for
 * navigation tests while preventing the API app from touching AI providers.
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
 * Seeds one already-routed topic request so E2E can exercise the public page
 * without making an AI Gateway request, which is intentionally disabled in E2E.
 */
async function cacheTopicPrompt(rawPrompt: string) {
  const uniqueId = randomUUID().slice(0, 8);
  const language = "en";
  const title = `E2E Topic ${uniqueId}`;
  const normalizedPrompt = normalizeString(rawPrompt);

  const request = await prisma.courseStartRequest.upsert({
    create: {
      canonicalTitle: title,
      courseMode: "full",
      generationStatus: "pending",
      language,
      normalizedPrompt,
      prompt: rawPrompt,
      scope: "topic",
    },
    update: {
      canonicalTitle: title,
      courseMode: "full",
      generationStatus: "pending",
      prompt: rawPrompt,
      scope: "topic",
      targetLanguage: null,
    },
    where: { languageNormalizedPrompt: { language, normalizedPrompt } },
  });

  return { prompt: rawPrompt, request };
}

/**
 * Seeds one unsupported request so E2E can verify the waitlist surface without
 * calling the AI router or relying on model output to choose that branch.
 */
async function cacheWaitlistedPrompt(rawPrompt: string) {
  const language = "en";
  const normalizedPrompt = normalizeString(rawPrompt);

  const request = await prisma.courseStartRequest.upsert({
    create: {
      canonicalTitle: rawPrompt,
      courseMode: "quick",
      generationStatus: null,
      language,
      normalizedPrompt,
      prompt: rawPrompt,
      scope: "question",
    },
    update: {
      canonicalTitle: rawPrompt,
      courseMode: "quick",
      generationStatus: null,
      prompt: rawPrompt,
      scope: "question",
      targetLanguage: null,
    },
    where: { languageNormalizedPrompt: { language, normalizedPrompt } },
  });

  return { prompt: rawPrompt, request };
}

/**
 * Seeds the reusable-course branch without calling the AI router. This proves
 * the learn route can skip generation when the cached decision points to a
 * completed course that already exists in the AI catalog.
 */
async function cacheExistingCoursePrompt(rawPrompt: string) {
  const language = "en";
  const uniqueId = randomUUID().slice(0, 8);
  const title = `E2E Existing Course ${uniqueId}`;
  const slug = getCourseSlugForTitle({ language, title });
  const organization = await aiOrganizationFixture();

  const course = await courseFixture({
    generationStatus: "completed",
    isPublished: true,
    language,
    normalizedTitle: normalizeString(title),
    organizationId: organization.id,
    slug,
    title,
  });

  await chapterFixture({
    courseId: course.id,
    generationStatus: "completed",
    isPublished: true,
    language,
    organizationId: organization.id,
    slug: `e2e-existing-chapter-${uniqueId}`,
    title: `E2E Existing Chapter ${uniqueId}`,
  });

  await prisma.courseStartRequest.create({
    data: {
      canonicalTitle: title,
      courseId: course.id,
      courseMode: "full",
      generationStatus: "completed",
      language,
      normalizedPrompt: normalizeString(rawPrompt),
      prompt: rawPrompt,
      scope: "topic",
    },
  });

  return { course, prompt: rawPrompt };
}

test.describe("Learn Form", () => {
  test("shows form with auto-focused input", async ({ page }) => {
    await page.goto("/start/learn");

    await expect(page.getByRole("heading", { name: /what do you want to learn/iu })).toBeVisible();

    const input = page.getByRole("textbox");
    await expect(input).toBeFocused();
  });

  test("clicking a suggested subject starts topic course generation", async ({
    authenticatedPage,
  }) => {
    await mockCourseGenerationWorkflow(authenticatedPage);
    await authenticatedPage.goto("/start/learn");

    const suggestions = authenticatedPage.getByRole("navigation", { name: /suggested subjects/iu });
    const firstLink = suggestions.getByRole("link").first();
    const subject = await firstLink.textContent();

    if (!subject) {
      throw new Error("No subject link text found");
    }

    const cached = await cacheTopicPrompt(subject);

    await firstLink.click();

    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/generate/course/${cached.request.id}$`, "u"),
    );
  });

  test("submitting prompt starts topic course generation for signed-in users", async ({
    authenticatedPage,
  }) => {
    await mockCourseGenerationWorkflow(authenticatedPage);

    const cached = await cacheTopicPrompt(`e2e signed-in topic ${randomUUID()}`);

    await authenticatedPage.goto("/start/learn");
    await authenticatedPage.getByRole("textbox").fill(cached.prompt);
    await authenticatedPage.keyboard.press("Enter");

    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/generate/course/${cached.request.id}$`, "u"),
    );
  });

  test("submitting prompt starts topic course generation for unauthenticated users", async ({
    page,
  }) => {
    await mockCourseGenerationWorkflow(page);

    const cached = await cacheTopicPrompt(`e2e guest topic ${randomUUID()}`);

    await page.goto("/start/learn");
    await page.getByRole("textbox").fill(cached.prompt);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(new RegExp(`/generate/course/${cached.request.id}$`, "u"));
  });
});

test.describe("Course Start Routing", () => {
  test("redirects cached topic prompts to the generation page", async ({ page }) => {
    await mockCourseGenerationWorkflow(page);

    const cached = await cacheTopicPrompt(`e2e direct topic ${randomUUID()}`);

    await page.goto(`/start/learn/${encodeURIComponent(cached.prompt)}`);

    await expect(page).toHaveURL(new RegExp(`/generate/course/${cached.request.id}$`, "u"));
  });

  test("redirects cached topic prompts to existing reusable courses", async ({ page }) => {
    const cached = await cacheExistingCoursePrompt(`e2e existing topic ${randomUUID()}`);

    await page.goto(`/start/learn/${encodeURIComponent(cached.prompt)}`);

    await expect(page).toHaveURL(new RegExp(`/b/${AI_ORG_SLUG}/c/${cached.course.slug}$`, "u"));
    await expect(page.getByRole("heading", { level: 1, name: cached.course.title })).toBeVisible();
  });

  test("prefills the waitlist email for signed-in users", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const cached = await cacheWaitlistedPrompt(`e2e waitlist goal ${randomUUID()}`);

    await authenticatedPage.goto(`/start/learn/${encodeURIComponent(cached.prompt)}`);

    await expect(
      authenticatedPage.getByRole("heading", { name: /this option isn't available yet/iu }),
    ).toBeVisible();

    await expect(authenticatedPage.getByLabel(/email address/iu)).toHaveValue(
      withProgressUser.email,
    );

    await expect(authenticatedPage.getByText(cached.prompt, { exact: true })).toBeVisible();
  });
});
