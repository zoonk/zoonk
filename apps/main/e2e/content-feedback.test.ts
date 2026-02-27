import { openDialog } from "@zoonk/e2e/helpers";
import { searchPromptWithSuggestionsFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { expect, test } from "./fixtures";

let prompt: string;
let suggestionTitle: string;

test.beforeAll(async () => {
  const fixture = await searchPromptWithSuggestionsFixture();
  const firstSuggestion = fixture.suggestions[0];

  if (!firstSuggestion) {
    throw new Error("No suggestions created by fixture");
  }

  prompt = fixture.prompt;
  suggestionTitle = firstSuggestion.title;
});

// Content feedback is tested on the course suggestions page where it's used
test.describe("Content Feedback", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/learn/${encodeURIComponent(prompt)}`);

    // Wait for content to load
    await expect(page.getByText(suggestionTitle)).toBeVisible();
  });

  test("clicking feedback button marks it as pressed", async ({ page }) => {
    const thumbsUp = page.getByRole("button", { name: /i liked it/i });
    const thumbsDown = page.getByRole("button", { name: /i didn't like it/i });

    // Initially neither should be pressed
    await expect(thumbsUp).toHaveAttribute("aria-pressed", "false");
    await expect(thumbsDown).toHaveAttribute("aria-pressed", "false");

    // Click thumbs up
    await thumbsUp.click();
    await expect(thumbsUp).toHaveAttribute("aria-pressed", "true");
    await expect(thumbsDown).toHaveAttribute("aria-pressed", "false");

    // Switch to thumbs down
    await thumbsDown.click();
    await expect(thumbsDown).toHaveAttribute("aria-pressed", "true");
    await expect(thumbsUp).toHaveAttribute("aria-pressed", "false");
  });

  test("submit with valid data shows success message", async ({ page }) => {
    const feedbackButton = page.getByRole("button", { name: /send feedback/i });
    const dialog = page.getByRole("dialog");
    await openDialog(feedbackButton, dialog);

    const emailInput = dialog.getByRole("textbox", { name: /email address/i });
    const messageInput = dialog.getByRole("textbox", { name: /^message$/i });

    // Wait for dialog to be fully visible and inputs to be enabled
    await expect(emailInput).toBeEnabled();
    await expect(messageInput).toBeEnabled();

    await emailInput.fill("test@example.com");
    await messageInput.fill("This is test feedback");
    await dialog.getByRole("button", { name: /send message/i }).click();

    await expect(dialog.getByText(/message sent successfully/i)).toBeVisible();
  });

  test("submit with invalid email shows validation error", async ({ page }) => {
    const feedbackButton = page.getByRole("button", { name: /send feedback/i });
    const dialog = page.getByRole("dialog");
    await openDialog(feedbackButton, dialog);

    const emailInput = dialog.getByRole("textbox", { name: /email address/i });
    const messageInput = dialog.getByRole("textbox", { name: /^message$/i });

    // Wait for dialog to be fully visible and inputs to be enabled
    await expect(emailInput).toBeEnabled();
    await expect(messageInput).toBeEnabled();

    await emailInput.fill("invalid-email");
    await messageInput.fill("This is test feedback");
    await dialog.getByRole("button", { name: /send message/i }).click();

    // Browser validation prevents submission - verify semantically:
    // 1. Dialog remains visible (form wasn't submitted)
    await expect(dialog).toBeVisible();

    // 2. Email input is focused (browser focuses invalid fields)
    await expect(emailInput).toBeFocused();
  });

  test("submit failure shows error message", async ({ page }) => {
    const feedbackButton = page.getByRole("button", { name: /send feedback/i });
    const dialog = page.getByRole("dialog");
    await openDialog(feedbackButton, dialog);

    const emailInput = dialog.getByRole("textbox", { name: /email address/i });
    const messageInput = dialog.getByRole("textbox", { name: /^message$/i });

    // Wait for dialog to be fully visible and inputs to be enabled
    await expect(emailInput).toBeEnabled();
    await expect(messageInput).toBeEnabled();

    await emailInput.fill("test@example.com");

    // Whitespace passes HTML5 "required" but fails server-side when trimmed
    await messageInput.fill("   ");
    await dialog.getByRole("button", { name: /send message/i }).click();

    await expect(dialog.getByText(/failed to send message/i)).toBeVisible();
  });
});

test.describe("Content Feedback - Authenticated", () => {
  test("email field shows authenticated user's email", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    await authenticatedPage.goto(`/learn/${encodeURIComponent(prompt)}`);
    // Wait for content to load
    await expect(authenticatedPage.getByText(suggestionTitle)).toBeVisible();

    const feedbackButton = authenticatedPage.getByRole("button", { name: /send feedback/i });
    const dialog = authenticatedPage.getByRole("dialog");
    await openDialog(feedbackButton, dialog);

    const emailInput = dialog.getByRole("textbox", { name: /email address/i });

    await expect(emailInput).toBeEnabled();

    // Should be pre-filled with user's email
    await expect(emailInput).toHaveValue(
      new RegExp(withProgressUser.email.replaceAll(/[.]/g, String.raw`\.`)),
    );
  });
});
