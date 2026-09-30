import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { type Page, expect, test } from "./fixtures";
import { setDeviceMode } from "./learn-personas";

/**
 * A language lesson played to its end by a signed-in learner: the word, then building sentences
 * from a word bank (reading and listening), a blank to fill, a sentence to write and the summary.
 * The run is counted from its start to its end: the start opens it in the ledger and the
 * completion closes it with what the server graded.
 */

const SENTENCE = "How much is the rent?";
const WRITING_QUESTION = "Escreva em inglês: quanto é o aluguel?";
const SELF_CORRECT = "Not quite. Look again and fix it yourself, then check.";

/** What a language lesson ends with: practice on the pattern, a sentence to write, the summary. */
const CLOSING_STEPS = [
  {
    content: {
      answers: ["much"],
      distractors: ["many"],
      feedback: "Much vai com o que não se conta, como dinheiro.",
      question: "Complete a pergunta.",
      template: "How [BLANK] is the rent?",
    },
    kind: "fillBlank" as const,
  },
  {
    content: {
      acceptedAnswers: [SENTENCE],
      keyPoints: ["How much pergunta o preço."],
      question: WRITING_QUESTION,
      sampleAnswer: SENTENCE,
    },
    kind: "typedAnswer" as const,
  },
  {
    content: { ideas: [{ text: "How much pergunta o preço de algo." }] },
    kind: "summary" as const,
  },
];

/**
 * The shared language lesson (the word "rent" and "How much is the rent?"), without its spoken
 * screen, which speech covers, and with the screens it ends with.
 */
async function createLanguageLesson() {
  const { lesson, steps } = await languageLessonFixture();

  await prisma.step.deleteMany({ where: { kind: "spokenAnswer", lessonId: lesson.id } });

  await Promise.all(
    CLOSING_STEPS.map((step, index) =>
      libraryStepFixture({ ...step, lessonId: lesson.id, position: steps.length + index }),
    ),
  );

  return lesson;
}

/** Word-bank words keep their punctuation ("rent?"), which a name pattern must match as text. */
function exactWord(word: string): RegExp {
  return new RegExp(`^${word.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)}$`, "iu");
}

function primary(page: Page, label: RegExp) {
  return page.getByRole("button", { name: label });
}

async function expectVerdict(page: Page, verdict: string) {
  await expect(page.getByRole("status").filter({ hasText: verdict })).toBeVisible();
}

async function pickWords(page: Page, words: string[]) {
  const bank = page.getByRole("group", { name: "Word bank" });

  for (const word of words) {
    // oxlint-disable-next-line no-await-in-loop -- The words go in one at a time, in order.
    await bank.getByRole("button", { name: exactWord(word) }).click();
  }
}

async function checkRightAndContinue(page: Page) {
  await primary(page, /^Check/u).click();
  await expectVerdict(page, "Correct!");
  await primary(page, /^Continue/u).click();
}

async function learnTheWord(page: Page) {
  await expect(page.getByRole("region", { name: "Vocabulary: rent" })).toBeVisible();
  await primary(page, /^Next/u).click();

  await expect(page.getByText("Translate this word:")).toBeVisible();
  await page.getByRole("radio", { name: "Rent" }).click();
  await checkRightAndContinue(page);
}

/** Reading builds the sentence from its translation; listening builds the translation. */
async function buildTheSentences(page: Page) {
  await expect(page.getByText("Translate this sentence:")).toBeVisible();
  await pickWords(page, ["How", "much", "is", "the", "rent?"]);
  await checkRightAndContinue(page);

  await expect(page.getByText(SENTENCE, { exact: true })).toBeVisible();
  await pickWords(page, ["quanto", "é", "o", "aluguel?"]);
  await checkRightAndContinue(page);
}

/** A wrong word gets one chance to fix it before the answer is shown. */
async function fillTheBlankAfterAMistake(page: Page) {
  await expect(page.getByText("Complete a pergunta.")).toBeVisible();
  await pickWords(page, ["many"]);
  await primary(page, /^Check/u).click();

  await expect(page.getByRole("status").filter({ hasText: SELF_CORRECT })).toBeVisible();

  await page.getByRole("button", { name: "Blank 1: many. Tap to remove." }).click();
  await pickWords(page, ["much"]);
  await primary(page, /^Check/u).click();

  const feedback = page.getByRole("region", { name: "Answer feedback" });
  await expect(feedback.getByText("Correct!")).toBeVisible();
  await expect(feedback.getByText("Much vai com o que não se conta, como dinheiro.")).toBeVisible();
  await primary(page, /^Continue/u).click();
}

async function writeTheSentence(page: Page) {
  await page.getByRole("textbox", { name: WRITING_QUESTION }).fill(SENTENCE);
  await checkRightAndContinue(page);
}

/** The learner's runs of Library lessons, as the ledger keeps them. */
async function findRuns(userId: string) {
  const runs = await prisma.learningEvent.findMany({ where: { lessonKind: "library", userId } });

  return runs.map((run) => ({
    contentIds: run.contentIds,
    correctAnswers: run.correctAnswers,
    ended: run.endedAt !== null,
    incorrectAnswers: run.incorrectAnswers,
    mode: run.mode,
  }));
}

test.describe("A language lesson", () => {
  test("plays its word-bank, blank and writing screens to the end, and counts the run", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const [lesson] = await Promise.all([
      createLanguageLesson(),
      learningProfileFixture({ experienceMode: "focus", userId: noProgressUser.id }),
    ]);

    await setDeviceMode(page.context(), "focus");
    await page.goto(`/learn/${lesson.id}`);
    await learnTheWord(page);

    // Starting the lesson opened its run in the ledger, still unfinished.
    await expect
      .poll(() => findRuns(noProgressUser.id))
      .toStrictEqual([
        {
          contentIds: expect.objectContaining({ lessonId: lesson.id }),
          correctAnswers: 0,
          ended: false,
          incorrectAnswers: 0,
          mode: "focus",
        },
      ]);

    await buildTheSentences(page);
    await fillTheBlankAfterAMistake(page);
    await writeTheSentence(page);

    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await primary(page, /^Continue/u).click();

    await expect(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    // The blank's first answer was wrong, so it counts as a miss even though it was fixed.
    await expect(page.getByText("4 of 5 right the first time")).toBeVisible();

    await expect
      .poll(() => findRuns(noProgressUser.id))
      .toStrictEqual([
        {
          contentIds: expect.objectContaining({ lessonId: lesson.id }),
          correctAnswers: 4,
          ended: true,
          incorrectAnswers: 1,
          mode: "focus",
        },
      ]);

    await expect
      .poll(() => prisma.dailyProgress.findFirst({ where: { userId: noProgressUser.id } }))
      .toMatchObject({ correctAnswers: 4, incorrectAnswers: 1, lessonsCompleted: 1 });
  });
});
