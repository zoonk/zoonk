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
    await route.fulfill({ body: "", contentType: "text/event-stream", status: 200 });
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

    await expect(page.getByRole("heading", { name: /what's your goal/iu })).toBeVisible();

    const input = page.getByRole("textbox");
    await expect(input).toBeFocused();
  });

  test("clicking a suggestion link navigates to the subject page", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/learn");

    const suggestions = authenticatedPage.getByRole("navigation", { name: /suggested goals/iu });
    const firstLink = suggestions.getByRole("link").first();
    const subject = await firstLink.textContent();

    if (!subject) {
      throw new Error("No subject link text found");
    }

    await ensureSuggestionsForPrompt(subject);
    await firstLink.click();

    await expect(authenticatedPage).toHaveURL(/\/learn\/.+/u);
  });

  test("submitting prompt navigates signed-in users to suggestions page", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/learn");

    await authenticatedPage.getByRole("textbox").fill(prompt);
    await authenticatedPage.keyboard.press("Enter");

    await expect(
      authenticatedPage.getByRole("heading", { name: /course ideas for/iu }),
    ).toBeVisible();
  });

  test("submitting prompt navigates unauthenticated users to suggestions page", async ({
    page,
  }) => {
    await page.goto("/learn");

    await page.getByRole("textbox").fill(prompt);
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: /course ideas for/iu })).toBeVisible();
  });
});

test.describe("Course Suggestions", () => {
  test("shows suggestions to unauthenticated users", async ({ page }) => {
    await page.goto(`/learn/${encodeURIComponent(prompt)}`);

    await expect(
      page.getByRole("heading", { name: new RegExp(`course ideas for ${prompt}`, "iu") }),
    ).toBeVisible();

    await expect(page.getByText(suggestionTitle)).toBeVisible();
    await expect(page.getByText(suggestionDescription)).toBeVisible();
  });

  test("shows suggestions with title, description, and generate link", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto(`/learn/${encodeURIComponent(prompt)}`);

    await expect(
      authenticatedPage.getByRole("heading", {
        name: new RegExp(`course ideas for ${prompt}`, "iu"),
      }),
    ).toBeVisible();

    await expect(authenticatedPage.getByText(suggestionTitle)).toBeVisible();
    await expect(authenticatedPage.getByText(suggestionDescription)).toBeVisible();

    const generateLinks = authenticatedPage.getByRole("link", { name: /create/iu });
    await expect(generateLinks.first()).toBeVisible();
  });

  test("Generate link navigates unauthenticated users to generate page", async ({ page }) => {
    await mockCourseGenerationWorkflow(page);

    await page.goto(`/learn/${encodeURIComponent(prompt)}`);

    await expect(page.getByRole("heading", { name: /course ideas for/iu })).toBeVisible();

    const generateLink = page.getByRole("link", { name: /create/iu }).first();
    await generateLink.click();

    await expect(page).toHaveURL(/\/generate\/cs\/[-a-f0-9]+/u);
  });

  test("single-suggestion goals redirect directly to generate page", async ({ page }) => {
    const fixture = await searchPromptWithSuggestionsFixture({
      suggestions: [
        { description: "A direct generation suggestion", title: "Direct Generation Course" },
      ],
    });

    const [suggestion] = fixture.suggestions;

    if (!suggestion) {
      throw new Error("No suggestion created by fixture");
    }

    await mockCourseGenerationWorkflow(page);
    await page.goto(`/learn/${encodeURIComponent(fixture.prompt)}`);

    await expect(page).toHaveURL(new RegExp(`/generate/cs/${suggestion.id}`, "u"));
  });

  test("Change goal navigates back to learn form", async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/learn/${encodeURIComponent(prompt)}`);

    await expect(
      authenticatedPage.getByRole("heading", { name: /course ideas for/iu }),
    ).toBeVisible();

    await authenticatedPage.getByRole("link", { name: /change goal/iu }).click();

    await expect(
      authenticatedPage.getByRole("heading", { name: /what's your goal/iu }),
    ).toBeVisible();
  });
});
