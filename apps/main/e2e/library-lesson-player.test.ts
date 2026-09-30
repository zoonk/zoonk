import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  languageLessonFixture,
  playableLessonFixture,
} from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { MODES, type Mode, setDeviceMode } from "./learn-personas";

/**
 * Plays Library lessons in the lesson player, in Focus and in Fun: every teaching screen (the
 * hook's guess, an explanation, a worked example, a check, a typed and a spoken answer, the
 * summary) for a signed-in learner, and the language screens for a visitor, who becomes a guest on
 * the first answer.
 */

const RIGHT_TYPED = "It shows where the electron is likely to be";

/** Word-bank words keep their punctuation ("aluguel?"), which a name pattern must match as text. */
function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

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

/** Both modes count Hyperdrive (right answers in a row); only Fun shows it, from x2 on. */
async function expectHyperdrive(page: Page, { level, mode }: { level: number; mode: Mode }) {
  const badge = page.locator('[data-slot="lesson-hyperdrive"]');

  await (mode === "fun" && level >= 2
    ? expect(badge).toContainText(`x${level}`)
    : expect(badge).toHaveCount(0));
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

for (const mode of MODES) {
  test.describe(`Library lesson player in ${mode} mode`, () => {
    test("plays every teaching screen and finishes the lesson", async ({
      noProgressUser,
      userWithoutProgress: page,
    }) => {
      const [{ lesson }] = await Promise.all([
        playableLessonFixture(),
        learningProfileFixture({ experienceMode: mode, userId: noProgressUser.id }),
      ]);

      await openLesson(page, { lessonId: lesson.id, mode });

      await answerHook(page);
      await readExplanationWithHelp(page);
      await followWorkedExample(page);
      await answerCheckWithKeys(page);
      await expectHyperdrive(page, { level: 1, mode });
      await answerTyped(page);
      await expectHyperdrive(page, { level: 2, mode });
      await answerSpokenByTyping(page);
      await expectHyperdrive(page, { level: 3, mode });

      await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
      await primary(page, /^Continue/u).click();

      await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
      await expect(page.getByText("3 of 3 right the first time")).toBeVisible();

      // Brain Power v2: 2, 4 and 6 for three right answers in a row, and 10 for finishing.
      await expect(page.getByText("+22")).toBeVisible();

      await expect(page.getByText("Top Hyperdrive")).toHaveCount(mode === "fun" ? 1 : 0);
    });

    test("asks for a short break when lessons are read too fast, then opens the lesson", async ({
      noProgressUser,
      userWithoutProgress: page,
    }) => {
      const [{ lesson }] = await Promise.all([
        playableLessonFixture({ steps: ["explanation", "check"] }),
        learningProfileFixture({ experienceMode: mode, userId: noProgressUser.id }),
      ]);

      // E2E servers stand in for the Vercel Firewall: this header answers as the rule's limit would.
      await page.setExtraHTTPHeaders({ "x-e2e-rate-limited": "lesson-steps" });
      await openLesson(page, { lessonId: lesson.id, mode });

      await expect(page.getByRole("heading", { name: "Take a short break" })).toBeVisible();
      await expect(page.getByText(/This one opens in \d+ seconds\./u)).toBeVisible();
      await expect(page.getByText("A cloud, not a little ball")).toBeHidden();

      await page.setExtraHTTPHeaders({});
      await page.reload();
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
    });

    test("shows the lesson's minutes and keeps its summary card in the screen's menu", async ({
      page,
    }) => {
      const { lesson } = await playableLessonFixture({
        lesson: {
          estimatedMinutes: 4,
          summary: {
            ideas: [
              { text: "Electrons live in clouds." },
              { text: "The densest part is likeliest." },
            ],
          },
        },
        steps: ["explanation", "check"],
      });

      await openLesson(page, { lessonId: lesson.id, mode });
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();

      // Focus's header has the title and minutes; Fun's has the dots instead.
      await expect(page.getByText("4 min", { exact: true })).toHaveCount(mode === "focus" ? 1 : 0);

      await page.getByRole("button", { name: "Screen options" }).click();
      await page.getByRole("menuitem", { name: "Lesson summary" }).click();

      const summary = page.getByRole("dialog", { name: "Lesson summary" });
      await expect(summary.getByText("Electrons live in clouds.")).toBeVisible();
      await expect(summary.getByText("The densest part is likeliest.")).toBeVisible();

      await summary.getByRole("button", { name: "Got it" }).click();
      await expect(summary).toBeHidden();
      await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
    });

    test("counts a typo as right and shows the spelling", async ({
      noProgressUser,
      userWithoutProgress: page,
    }) => {
      const [{ lesson }] = await Promise.all([
        playableLessonFixture({ steps: ["typedAnswer", "summary"] }),
        learningProfileFixture({ experienceMode: mode, userId: noProgressUser.id }),
      ]);

      await openLesson(page, { lessonId: lesson.id, mode });

      await page
        .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
        .fill("It shows where the electorn is likely to be");

      await primary(page, /^Check/u).click();
      await expectVerdict(page, "Right, watch the spelling");

      await expect(
        page.getByRole("status").getByText("It shows where the electron is likely to be"),
      ).toBeVisible();

      await primary(page, /^Continue/u).click();
      await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    });

    test("plays a spoken screen as listening when the learner can't talk now", async ({
      browser,
    }) => {
      const { lesson } = await languageLessonFixture();

      await prisma.step.deleteMany({
        where: { kind: { not: "spokenAnswer" }, lessonId: lesson.id },
      });

      // Chromium's fake microphone, so speaking is offered first, as on a phone.
      const context = await browser.newContext({ permissions: ["microphone"] });
      const page = await context.newPage();

      try {
        await openLesson(page, { lessonId: lesson.id, mode });
        await expect(page.getByText("How much is the rent?")).toBeVisible();
        await page.getByRole("button", { name: "I can't talk now" }).click();

        const bank = page.getByRole("group", { name: "Word bank" });

        for (const word of ["quanto", "é", "o", "aluguel?"]) {
          // oxlint-disable-next-line no-await-in-loop -- The words go in one at a time, in order.
          await bank
            .getByRole("button", { name: new RegExp(`^${escapeRegExp(word)}$`, "iu") })
            .click();
        }

        await primary(page, /^Check/u).click();
        await expectVerdict(page, "Correct!");

        // The choice lasts for the visit: the screen opens as listening again, until they can talk.
        await page.reload();
        await expect(page.getByRole("group", { name: "Word bank" })).toBeVisible();
        await page.getByRole("button", { name: "I can talk now" }).click();
        await expect(page.getByRole("button", { name: "Start speaking" })).toBeVisible();
      } finally {
        await context.close();
      }
    });

    test("teaches a word with its note and tip, then checks it", async ({ page }) => {
      const { lesson } = await languageLessonFixture();
      await openLesson(page, { lessonId: lesson.id, mode });

      // A visitor can open the tutor, which asks them to sign in first.
      await openAndCloseTutor(page, { expectText: "Sign in to ask questions" });

      await expect(page.getByRole("region", { name: "Vocabulary: rent" })).toBeVisible();
      await expect(page.getByText("aluguel", { exact: true })).toBeVisible();
      await expect(page.getByText("Não confunda com renda, que é income.")).toBeVisible();
      await expect(page.getByText("O r do começo é suave, não como em rato.")).toBeVisible();
      await primary(page, /^Next/u).click();

      await expect(page.getByText("Translate this word:")).toBeVisible();
      await page.getByRole("radio", { name: "Rent" }).click();
      await primary(page, /^Check/u).click();
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("Não confunda com renda, que é income.")).toBeVisible();
      await primary(page, /^Continue/u).click();

      await expect(page.getByRole("group", { name: "Word bank" })).toBeVisible();
    });
  });
}
