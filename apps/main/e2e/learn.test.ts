import { searchPromptWithSuggestionsFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { expect, test } from "./fixtures";

let prompt: string;
let suggestionTitle: string;
let suggestionDescription: string;

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
  test("shows form with auto-focused input and reveals button on typing", async ({ page }) => {
    await page.goto("/learn");

    await expect(page.getByRole("heading", { name: /learn anything/i })).toBeVisible();

    const input = page.getByRole("textbox");
    await expect(input).toBeFocused();

    await input.fill("test");
    await expect(page.getByRole("button", { name: /start/i })).toBeVisible();
  });

  test("clicking a suggestion link navigates to the subject page", async ({ page }) => {
    await page.goto("/learn");

    const suggestions = page.getByRole("navigation", { name: /suggested subjects/i });
    const firstLink = suggestions.getByRole("link").first();
    await firstLink.click();

    await expect(page).toHaveURL(/\/learn\/.+/);
    await expect(page.getByRole("heading", { name: /course ideas for/i })).toBeVisible();
  });

  test("submitting prompt navigates to suggestions page", async ({ page }) => {
    await page.goto("/learn");

    await page.getByRole("textbox").fill(prompt);
    await page.getByRole("button", { name: /start/i }).click();

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

    const generateLinks = page.getByRole("link", { name: /generate/i });
    await expect(generateLinks.first()).toBeVisible();
  });

  test("Generate link navigates to generate page", async ({ page }) => {
    await page.goto(`/learn/${encodeURIComponent(prompt)}`);

    await expect(page.getByRole("heading", { name: /course ideas for/i })).toBeVisible();

    const generateLink = page.getByRole("link", { name: /generate/i }).first();
    await generateLink.click();

    await expect(page).toHaveURL(/\/generate\/cs\/\d+/);
  });

  test("Change subject navigates back to learn form", async ({ page }) => {
    await page.goto(`/learn/${encodeURIComponent(prompt)}`);

    await expect(page.getByRole("heading", { name: /course ideas for/i })).toBeVisible();

    await page.getByRole("link", { name: /change subject/i }).click();

    await expect(page.getByRole("heading", { name: /learn anything/i })).toBeVisible();
  });

  test("submits form using Enter key", async ({ page }) => {
    await page.goto("/learn");

    const input = page.getByRole("textbox");
    await input.fill(prompt);
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: /course ideas for/i })).toBeVisible();
  });
});
