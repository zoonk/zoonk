import { prisma } from "@zoonk/db";
import { type Page, type Route } from "@zoonk/e2e/fixtures";
import { searchPromptWithSuggestionsFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

const TEST_RUN_ID = "test-run-id-learn-generate-link";

let prompt: string;
let suggestionTitle: string;
let suggestionDescription: string;

/**
 * The suggestion-link test only verifies navigation into the generation page.
 * Mocking the workflow API keeps that page from starting real course generation
 * after the URL assertion has already proved the behavior under test.
 */
async function mockCourseGenerationWorkflow(page: Page): Promise<void> {
  await page.route("**/v1/workflows/course-generation/**", handleCourseGenerationRoute);
}

/**
 * The generation client expects the trigger endpoint to return a run id and
 * the status endpoint to speak SSE. Returning an empty stream is enough for
 * the navigation test while preventing the API app from touching AI providers.
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
    await route.fulfill({
      body: "",
      contentType: "text/event-stream",
      status: 200,
    });
    return;
  }

  await route.continue();
}

/**
 * The visible subject links are shuffled from fixed copy on the learn page.
 * Seeding the clicked prompt before navigation keeps the destination page on
 * the cached DB path instead of asking AI to create suggestions during e2e.
 */
async function ensureSuggestionsForPrompt(rawPrompt: string): Promise<void> {
  const normalizedPrompt = normalizeString(rawPrompt);

  const existing = await prisma.searchPrompt.findUnique({
    include: { suggestions: true },
    where: { languagePrompt: { language: "en", prompt: normalizedPrompt } },
  });

  if (existing && existing.suggestions.length > 0) {
    return;
  }

  await searchPromptWithSuggestionsFixture({ prompt: rawPrompt });
}

test.beforeAll(async () => {
  const fixture = await searchPromptWithSuggestionsFixture();
  const firstSuggestion = fixture.suggestions[0];

  if (!firstSuggestion) {
    throw new Error("No suggestions created by fixture");
  }

  prompt = fixture.prompt;
  suggestionTitle = firstSuggestion.title;
  suggestionDescription = firstSuggestion.description;
});

test.describe("Learn Form", () => {
  test("shows form with auto-focused input", async ({ page }) => {
    await page.goto("/learn");

    await expect(page.getByRole("heading", { name: /learn anything/i })).toBeVisible();

    const input = page.getByRole("textbox");
    await expect(input).toBeFocused();
  });

  test("clicking a suggestion link navigates to the subject page", async ({ page }) => {
    await page.goto("/learn");

    const suggestions = page.getByRole("navigation", { name: /suggested subjects/i });
    const firstLink = suggestions.getByRole("link").first();
    const subject = await firstLink.textContent();

    if (!subject) {
      throw new Error("No subject link text found");
    }

    await ensureSuggestionsForPrompt(subject);
    await firstLink.click();

    await expect(page).toHaveURL(/\/learn\/.+/);
  });

  test("submitting prompt navigates to suggestions page", async ({ page }) => {
    await page.goto("/learn");

    await page.getByRole("textbox").fill(prompt);
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: /course ideas for/i })).toBeVisible();
  });
});

test.describe("Course Suggestions", () => {
  test("shows suggestions with title, description, and generate link", async ({ page }) => {
    await page.goto(`/learn/${encodeURIComponent(prompt)}`);

    await expect(
      page.getByRole("heading", { name: new RegExp(`course ideas for ${prompt}`, "i") }),
    ).toBeVisible();

    await expect(page.getByText(suggestionTitle)).toBeVisible();
    await expect(page.getByText(suggestionDescription)).toBeVisible();

    const generateLinks = page.getByRole("link", { name: /create/i });
    await expect(generateLinks.first()).toBeVisible();
  });

  test("Generate link navigates to generate page", async ({ page }) => {
    await mockCourseGenerationWorkflow(page);

    await page.goto(`/learn/${encodeURIComponent(prompt)}`);

    await expect(page.getByRole("heading", { name: /course ideas for/i })).toBeVisible();

    const generateLink = page.getByRole("link", { name: /create/i }).first();
    await generateLink.click();

    await expect(page).toHaveURL(/\/generate\/cs\/\d+/);
  });

  test("Change subject navigates back to learn form", async ({ page }) => {
    await page.goto(`/learn/${encodeURIComponent(prompt)}`);

    await expect(page.getByRole("heading", { name: /course ideas for/i })).toBeVisible();

    await page.getByRole("link", { name: /change subject/i }).click();

    await expect(page.getByRole("heading", { name: /learn anything/i })).toBeVisible();
  });
});
