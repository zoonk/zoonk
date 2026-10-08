import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { mockFeedbackSubmission } from "./feedback";
import { expect, test } from "./fixtures";

test.describe("Support page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/support");

    await expect(page.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();
  });

  test("sends a valid message from the contact form on the page", async ({ page }) => {
    const emailInput = page.getByRole("textbox", { name: "Your email, for our reply" });
    const messageInput = page.getByRole("textbox", { name: /^message$/iu });

    await expect(page.getByRole("link", { name: /github discussions/iu })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /send message/iu })).toBeVisible();
    await expect(emailInput).toBeEnabled();
    await expect(messageInput).toBeEnabled();
    await expectAccessibleScreen(page, "the support page");

    const feedbackSubmission = await mockFeedbackSubmission(page);

    await emailInput.click();
    await emailInput.fill("test@example.com");
    await messageInput.click();
    await messageInput.fill("Test message");
    await page.getByRole("button", { name: /send message/iu }).click();

    await expect(page.getByText(/message sent successfully/iu)).toBeVisible();

    await expect(feedbackSubmission.requestBody).resolves.toStrictEqual({
      context: { platform: "web", screen: "support", url: "/support" },
      email: "test@example.com",
      message: "Test message",
    });
  });

  test("keeps an invalid email focused, then shows an error when the message can't be sent", async ({
    page,
  }) => {
    const emailInput = page.getByRole("textbox", { name: "Your email, for our reply" });
    const messageInput = page.getByRole("textbox", { name: /^message$/iu });

    await expect(emailInput).toBeEnabled();
    await expect(messageInput).toBeEnabled();

    await emailInput.click();
    await emailInput.fill("invalid-email");
    await messageInput.click();
    await messageInput.fill("Test message");
    await page.getByRole("button", { name: /send message/iu }).click();

    await expect(emailInput).toBeFocused();

    await emailInput.fill("test@example.com");

    // Whitespace passes HTML5 "required" but fails server-side when trimmed
    await messageInput.click();
    await messageInput.fill("   ");
    await page.getByRole("button", { name: /send message/iu }).click();

    await expect(page.getByText(/couldn't send your message/iu)).toBeVisible();
  });
});

test.describe("Support page - Room to write and where to follow us", () => {
  test("the message box is tall enough to write in, and Zoonk's profiles open in a new tab", async ({
    page,
  }) => {
    await page.goto("/support");

    const message = page.getByRole("textbox", { name: /^message$/iu });
    const box = await message.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(128);

    const followUs = page.getByRole("region", { name: "Follow us" });
    const profiles = followUs.getByRole("link");

    await expect(profiles).toHaveCount(10);

    await expect(followUs.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://www.instagram.com/zoonkcom",
    );

    await expect(followUs.getByRole("link", { name: "YouTube" })).toHaveAttribute(
      "target",
      "_blank",
    );

    // Portuguese gets the Brazilian profiles.
    await page.goto("/pt/support");

    await expect(page.getByRole("link", { name: "Instagram" })).toHaveAttribute(
      "href",
      "https://www.instagram.com/zoonkbr",
    );
  });
});

test.describe("Support page - Authenticated", () => {
  test("a signed-in learner just writes: the reply goes to their account's email", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await page.goto("/support");

    await expect(page.getByRole("textbox", { name: "Your email, for our reply" })).toHaveCount(0);

    const feedbackSubmission = await mockFeedbackSubmission(page);
    await page.getByRole("textbox", { name: /^message$/iu }).fill("Where is my plan?");
    await page.getByRole("button", { name: /send message/iu }).click();

    await expect(page.getByText(/message sent successfully/iu)).toBeVisible();

    await expect(feedbackSubmission.requestBody).resolves.toMatchObject({
      email: noProgressUser.email,
      message: "Where is my plan?",
    });
  });
});

test("the help address people guess opens the Help page, in their language", async ({ page }) => {
  await page.goto("/help");
  await expect(page).toHaveURL(/\/support$/u);
  await expect(page.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();

  await page.goto("/pt/help");
  await expect(page).toHaveURL(/\/pt\/support$/u);
});
