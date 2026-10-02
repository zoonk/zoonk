import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { type Mode, setDeviceMode } from "./learn-personas";

/**
 * Plays a Library lesson through the app: every teaching screen (the hook's guess, an explanation,
 * a worked example, a check, a typed and a spoken answer, the summary) for a signed-in learner in
 * Fun, checked by the server, to the completion and its vote; and the short break the page asks
 * for when lessons are read too fast. What single screens show is the player's to test
 * (`packages/player`).
 */

const RIGHT_TYPED = "It shows where the electron is likely to be";

async function openLesson(page: Page, { lessonId, mode }: { lessonId: string; mode: Mode }) {
  await setDeviceMode(page.context(), mode);
  await page.goto(`/learn/${lessonId}`);
}

function primary(page: Page, label: RegExp) {
  return page.getByRole("button", { name: label });
}

async function expectVerdict(page: Page, verdict: string) {
  await expect(page.getByRole("status").filter({ hasText: verdict })).toBeVisible();
}

/** Fun shows Hyperdrive (right answers in a row) from x2 on. */
async function expectHyperdrive(page: Page, level: number) {
  const badge = page.locator('[data-slot="lesson-hyperdrive"]');

  await (level >= 2 ? expect(badge).toContainText(`x${level}`) : expect(badge).toHaveCount(0));
}

async function answerHook(page: Page) {
  await expect(page.getByText("Guess first · no points")).toBeVisible();
  await page.getByRole("radio", { name: "No" }).click();
  await primary(page, /^See the answer/u).click();
  await expectVerdict(page, "Good guess!");
  await primary(page, /^Continue/u).click();
}

/** The tutor opens over the screen and Escape closes only the tutor, never the lesson. */
async function openAndCloseTutor(page: Page, { expectText }: { expectText: string }) {
  await page.getByRole("button", { name: "Ask a question" }).click();
  const tutor = page.getByRole("dialog", { name: "Ask questions" });
  await expect(tutor.getByText(expectText)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tutor).toBeHidden();
}

async function readExplanationWithHelp(page: Page) {
  await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

  await openAndCloseTutor(page, { expectText: "Part 2 of 7" });
  await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

  // Made with AI, said once in the screen's menu; Escape closes the menu, not the lesson.
  await page.getByRole("button", { name: "Screen options" }).click();
  await expect(page.getByText("Made with AI. It may contain mistakes.")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Report a problem" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Made with AI. It may contain mistakes.")).toBeHidden();
  await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

  await primary(page, /^Next/u).click();
}

async function followWorkedExample(page: Page) {
  await expect(page.getByText("Reading the cloud")).toBeVisible();
  await expect(page.getByText("The darkest part sits just around the nucleus.")).toBeHidden();

  await primary(page, /^Show the next step/u).click();
  await expect(page.getByText("The darkest part sits just around the nucleus.")).toBeVisible();
  await primary(page, /^Show the next step/u).click();

  await expect(
    page.getByText("Most likely just around the nucleus, where the cloud is densest."),
  ).toBeVisible();

  await page.keyboard.press("Enter");
}

async function answerCheckWithKeys(page: Page) {
  await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();
  await page.keyboard.press("2");

  await expect(
    page.getByRole("radio", { name: "Where the electron is most likely to be found" }),
  ).toBeChecked();

  await page.keyboard.press("Enter");
  await expectVerdict(page, "Correct!");
  await page.keyboard.press("Enter");
}

async function answerTyped(page: Page) {
  await page
    .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
    .fill(RIGHT_TYPED);

  await primary(page, /^Check/u).click();
  await expectVerdict(page, "Correct!");
  await primary(page, /^Continue/u).click();
}

async function answerSpokenByTyping(page: Page) {
  await expect(page.getByText("The electron is a cloud")).toBeVisible();
  const typeInstead = page.getByRole("button", { name: "Type it instead" });

  if (await typeInstead.isVisible()) {
    await typeInstead.click();
  }

  await page.getByRole("textbox", { name: "Say it out loud" }).fill("The electron is a cloud");
  await primary(page, /^Check/u).click();
  await expectVerdict(page, "Correct!");
  await primary(page, /^Continue/u).click();
}

test.describe("Library lesson player", () => {
  test("plays every teaching screen and finishes the lesson in Fun", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const [{ lesson }] = await Promise.all([
      playableLessonFixture(),
      learningProfileFixture({ experienceMode: "fun", userId: noProgressUser.id }),
    ]);

    await openLesson(page, { lessonId: lesson.id, mode: "fun" });

    await answerHook(page);
    await readExplanationWithHelp(page);
    await followWorkedExample(page);
    await answerCheckWithKeys(page);
    await expectHyperdrive(page, 1);
    await answerTyped(page);
    await expectHyperdrive(page, 2);
    await answerSpokenByTyping(page);
    await expectHyperdrive(page, 3);

    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await primary(page, /^Continue/u).click();

    await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    await expect(page.getByText("3 of 3 right the first time")).toBeVisible();

    // Brain Power v2: 2, 4 and 6 for three right answers in a row, and 10 for finishing.
    await expect(page.getByText("+22")).toBeVisible();

    await expect(page.getByText("Top Hyperdrive")).toHaveCount(1);

    // Quiet thumbs on the completion moment vote on the lesson.
    await expect(page.getByText("Was this lesson helpful?")).toBeVisible();
    const helpful = page.getByRole("button", { exact: true, name: "Helpful" });
    await helpful.click();
    await expect(helpful).toHaveAttribute("aria-pressed", "true");

    await expect
      .poll(() =>
        prisma.contentFeedback.findFirst({
          where: { contentId: lesson.id, userId: noProgressUser.id },
        }),
      )
      .toMatchObject({ contentKind: "lesson", vote: "up" });
  });

  test("asks for a short break when lessons are read too fast, then opens the lesson", async ({
    userWithoutProgress: page,
  }) => {
    const { lesson } = await playableLessonFixture({ steps: ["explanation", "check"] });

    // E2E servers stand in for the Vercel Firewall: this header answers as the rule's limit would.
    await page.setExtraHTTPHeaders({ "x-e2e-rate-limited": "lesson-steps" });
    await openLesson(page, { lessonId: lesson.id, mode: "focus" });

    await expect(page.getByRole("heading", { name: "Take a short break" })).toBeVisible();
    await expect(page.getByText(/This one opens in \d+ seconds\./u)).toBeVisible();
    await expect(page.getByText("A cloud, not a little ball")).toBeHidden();

    await page.setExtraHTTPHeaders({});
    await page.reload();
    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
  });
});
