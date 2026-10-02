import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { mediaAssetFixture, stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { mockFeedbackSubmission } from "./feedback";
import { type Page, expect, test } from "./fixtures";
import { type Mode, setDeviceMode } from "./learn-personas";

/**
 * Votes and reports on AI content from the lesson player: the screen's menu, the light downvote
 * sheet and "Report a problem". The completion moment's thumbs are voted in
 * `library-lesson-player.test.ts`, and the plan's in `plan-tab.test.ts`.
 */

async function openLesson(page: Page, { lessonId, mode }: { lessonId: string; mode: Mode }) {
  await setDeviceMode(page.context(), mode);
  await page.goto(`/learn/${lessonId}`);
  await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
}

function findVote({ contentId, userId }: { contentId: string; userId: string }) {
  return prisma.contentFeedback.findFirst({ where: { contentId, userId } });
}

async function openScreenMenu(page: Page) {
  await page.getByRole("button", { name: "Screen options" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
}

test.describe("Screen feedback", () => {
  test("votes on a screen, its simpler version and its image, each on its own, and keeps the vote", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const image = await mediaAssetFixture();

    const { lesson, steps } = await playableLessonFixture({
      steps: [
        {
          content: {
            ...playableStepContent.explanation,
            image: { alt: "A fuzzy cloud around a nucleus", prompt: "Electron cloud" },
          },
          kind: "explanation",
          mediaAssetId: image.id,
        },
      ],
    });

    const screen = { contentId: steps[0]!.id, userId: noProgressUser.id };

    const simpler = await stepVariantFixture({
      content: { text: "Think of a blur instead of a dot." },
      kind: "simpler",
      stepId: screen.contentId,
    });

    await openLesson(page, { lessonId: lesson.id, mode: "focus" });

    const helpful = page.getByRole("menuitemcheckbox", { exact: true, name: "Helpful" });
    const notHelpful = page.getByRole("menuitemcheckbox", { exact: true, name: "Not helpful" });

    await openScreenMenu(page);
    await helpful.click();
    await expect.poll(() => findVote(screen)).toMatchObject({ vote: "up" });

    // The menu shows the vote, and still does the next time the lesson opens.
    await openScreenMenu(page);
    await expect(helpful).toBeChecked();
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
    await openScreenMenu(page);
    await expect(helpful).toBeChecked();
    await expect(notHelpful).not.toBeChecked();

    // A downvote asks why, and replaces the vote rather than adding a second one.
    await notHelpful.click();

    const sheet = page.getByRole("dialog", { name: "What went wrong?" });
    await expect(sheet.getByText("This screen is attached")).toBeVisible();
    await sheet.getByRole("button", { name: "Hard to follow" }).click();

    await expect(sheet.getByRole("button", { name: "Hard to follow" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await sheet.getByRole("textbox", { name: "Tell us more (optional)" }).fill("Too many ideas");
    await sheet.getByRole("button", { name: "Send" }).click();
    await expect(sheet).toBeHidden();

    const screenVote = {
      comment: "Too many ideas",
      contentKind: "step",
      language: "en",
      reasons: ["hardToFollow"],
      vote: "down",
    };

    await expect
      .poll(() => prisma.contentFeedback.findMany({ where: screen }))
      .toMatchObject([screenVote]);

    // The simpler version has its own menu, in its sheet; skipping "why" keeps its downvote.
    await page.getByRole("button", { name: "Simpler" }).click();
    const version = page.getByRole("dialog", { name: "Simpler" });
    await expect(version.getByText("Think of a blur instead of a dot.")).toBeVisible();
    await version.getByRole("button", { name: "Version options" }).click();
    await notHelpful.click();
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(sheet).toBeHidden();

    await expect
      .poll(() => findVote({ contentId: simpler.id, userId: noProgressUser.id }))
      .toMatchObject({ contentKind: "stepVariant", reasons: [], vote: "down" });

    await version.getByRole("button", { name: "Got it" }).click();
    await expect(version).toBeHidden();

    // The image's votes sit one level down in the screen's menu.
    await openScreenMenu(page);
    await page.getByRole("menuitem", { name: "Image" }).click();

    await page
      .getByRole("menu", { name: "Image" })
      .getByRole("menuitemcheckbox", { exact: true, name: "Helpful" })
      .click();

    await expect
      .poll(() => findVote({ contentId: image.id, userId: noProgressUser.id }))
      .toMatchObject({ contentKind: "mediaAsset", vote: "up" });

    // Neither vote landed on the screen's own, and the lesson goes on where it was.
    await expect(prisma.contentFeedback.findMany({ where: screen })).resolves.toMatchObject([
      screenVote,
    ]);

    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
  });

  test("reports a problem with the screen attached", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { lesson, steps } = await playableLessonFixture({ steps: ["explanation"] });
    const submission = await mockFeedbackSubmission(page);
    await openLesson(page, { lessonId: lesson.id, mode: "fun" });

    await openScreenMenu(page);
    await page.getByRole("menuitem", { name: "Report a problem" }).click();

    const dialog = page.getByRole("dialog", { name: "Report a problem" });
    await expect(dialog.getByText("This screen is attached")).toBeVisible();

    await expect(dialog.getByRole("textbox", { name: "Email address" })).toHaveValue(
      noProgressUser.email,
    );

    await dialog.getByRole("textbox", { name: "Message" }).fill("The picture is upside down");
    await dialog.getByRole("button", { name: "Send message" }).click();
    await expect(dialog.getByText(/message sent successfully/iu)).toBeVisible();

    await expect(submission.requestBody).resolves.toStrictEqual({
      context: {
        contentId: steps[0]!.id,
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

/**
 * A finished tutor answer in the learner's own thread. The tutor reads threads from the public
 * API, which main's E2E doesn't run, so the thread request returns this stored answer.
 */
async function createTutorAnswer({
  lessonId,
  page,
  userId,
}: {
  lessonId: string;
  page: Page;
  userId: string;
}) {
  const thread = await prisma.lessonQuestionThread.create({ data: { userId } });

  const question = await prisma.lessonQuestion.create({
    data: {
      answer: "Think of a fan: spinning fast, you see a blur, not the blades.",
      contextKind: "lesson",
      contextSnapshot: {},
      model: "test/tutor-model",
      question: "Why a cloud?",
      requestFingerprint: randomUUID(),
      requestId: randomUUID(),
      status: "completed",
      threadId: thread.id,
    },
  });

  await page.route("**/v1/lessons/*/questions**", async (route) => {
    await route.fulfill({
      json: {
        hasMore: false,
        id: thread.id,
        lessonId,
        nextCursor: null,
        questions: [
          {
            answer: question.answer,
            context: { kind: "lesson" },
            createdAt: question.createdAt.toISOString(),
            id: question.id,
            question: question.question,
            status: "completed",
            updatedAt: question.updatedAt.toISOString(),
          },
        ],
      },
    });
  });

  return question;
}

test.describe("Tutor feedback", () => {
  test("thumbs under a tutor answer vote on it", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { lesson } = await playableLessonFixture({ steps: ["explanation"] });

    const question = await createTutorAnswer({
      lessonId: lesson.id,
      page,
      userId: noProgressUser.id,
    });

    await openLesson(page, { lessonId: lesson.id, mode: "fun" });

    await page.getByRole("button", { name: "Ask a question" }).click();
    const answer = page.getByRole("article", { name: "Your question" });
    await expect(answer.getByText(/Think of a fan/u)).toBeVisible();

    await answer.getByRole("button", { exact: true, name: "Helpful" }).click();

    await expect
      .poll(() => findVote({ contentId: question.id, userId: noProgressUser.id }))
      .toMatchObject({ vote: "up" });
  });
});

test.describe("Send feedback from anywhere", () => {
  test("the account menu opens the form with the page attached", async ({
    userWithoutProgress: page,
  }) => {
    const submission = await mockFeedbackSubmission(page);
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: /explore courses/iu })).toBeVisible();

    await page.getByRole("button", { name: "User menu" }).click();
    await page.getByRole("menuitem", { name: "Send feedback" }).click();

    const dialog = page.getByRole("dialog", { name: "Feedback" });
    await dialog.getByRole("textbox", { name: "Message" }).fill("Love the course catalog");
    await dialog.getByRole("button", { name: "Send message" }).click();
    await expect(dialog.getByText(/message sent successfully/iu)).toBeVisible();

    await expect(submission.requestBody).resolves.toMatchObject({
      context: { platform: "web", screen: "account-menu", url: "/courses" },
      message: "Love the course catalog",
    });
  });

  test("the command palette opens the same form", async ({ page }) => {
    await page.goto("/courses");
    const searchButton = page.getByRole("navigation").getByRole("button", { name: "Search" });
    const palette = page.getByRole("dialog", { name: "Search" });

    await expect(async () => {
      await searchButton.click();
      await expect(palette).toBeVisible({ timeout: 1000 });
    }).toPass();

    await palette.getByRole("combobox", { name: "Search" }).fill("feedback");
    await palette.getByRole("option", { name: "Send feedback" }).click();

    const form = page.getByRole("dialog", { name: "Feedback" });
    await expect(form).toBeVisible();
    await expect(form.getByRole("textbox", { name: "Message" })).toBeVisible();
  });
});
