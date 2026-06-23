import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { type Page, type Route } from "@zoonk/e2e/fixtures";
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
