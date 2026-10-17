import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { openPaletteWithKeyboard } from "./command-palette";
import { mockFeedbackSubmission } from "./feedback";
import { expect, test } from "./fixtures";
import { createStudyDay, openAs } from "./study-day";

/**
 * "Report a problem" from the lesson player's screen menu, with the screen attached. A signed-in
 * learner only writes the message; the reply goes to the email the app already knows.
 */
test.describe("Screen feedback", () => {
  test("reports a problem with the screen attached", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { lesson, steps } = await playableLessonFixture({ steps: ["explanation"] });
    const stepId = steps[0]!.id;

    const screenReport = await mockFeedbackSubmission(page);
    await page.goto(`/learn/${lesson.id}`);
    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

    await page.getByRole("button", { name: "Screen options" }).click();
    await expect(page.getByRole("menuitemcheckbox")).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Report a problem" }).click();

    const dialog = page.getByRole("dialog", { name: "Report a problem" });
    await expect(dialog.getByText("This screen is attached")).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Message" })).toBeFocused();
    await expect(dialog.getByRole("textbox", { name: /email/iu })).toHaveCount(0);

    await dialog.getByRole("textbox", { name: "Message" }).fill("The picture is upside down");
    await dialog.getByRole("button", { name: "Send message" }).click();
    await expect(dialog.getByText(/message sent successfully/iu)).toBeVisible();

    await expect(screenReport.requestBody).resolves.toStrictEqual({
      context: {
        contentId: stepId,
        contentKind: "step",
        platform: "web",
        screen: "lesson-step",
        url: `/learn/${lesson.id}`,
      },
      email: noProgressUser.email,
      message: "The picture is upside down",
    });
  });
});

test.describe("Send feedback from anywhere", () => {
  test("the account menu's Help opens the help form", async ({ browser }) => {
    // The account menu lives on the tabs' bar; sections such as the catalog reach help through
    // the command palette (below).
    const { user } = await createStudyDay();
    const page = await openAs(browser, user);
    await page.goto("/today");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await expect(async () => {
      await page.getByRole("button", { name: "User menu" }).click();
      await expect(page.getByRole("menuitem", { name: "Help" })).toBeVisible({ timeout: 1000 });
    }).toPass();

    await page.getByRole("menuitem", { name: "Help" }).click();

    await expect(page).toHaveURL(/\/support$/u);
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
    await page.context().close();
  });

  test("the command palette opens the form with the page attached", async ({
    userWithoutProgress: page,
  }) => {
    const submission = await mockFeedbackSubmission(page);
    await page.goto("/courses");
    const palette = await openPaletteWithKeyboard(page);

    await palette.getByRole("combobox", { name: "Search" }).fill("feedback");
    await palette.getByRole("option", { name: "Send feedback" }).click();

    const dialog = page.getByRole("dialog", { name: "Feedback" });
    await dialog.getByRole("textbox", { name: "Message" }).fill("Love the course catalog");
    await dialog.getByRole("button", { name: "Send message" }).click();
    await expect(dialog.getByText(/message sent successfully/iu)).toBeVisible();

    await expect(submission.requestBody).resolves.toMatchObject({
      context: { platform: "web", screen: "command-palette", url: "/courses" },
      message: "Love the course catalog",
    });
  });
});
