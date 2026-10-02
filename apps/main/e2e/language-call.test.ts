import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { createLanguageLearner } from "./language-learner";
import { openAs } from "./study-day";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

/** The free plan's live calls a day. */
const FREE_CALLS_A_DAY = 3;
const GOAL_DAYS_AHEAD = 90;

/** Every onboarding question before the level test, so `/start/:goalId` opens on the test. */
const ANSWERED = ["reason", "targetDate", "level", "schedule", "age", "mode", "buddy", "followUps"];

/** When a writer started, this many seconds ago. */
function startedAt(secondsAgo: number): Date {
  return new Date(Date.now() - secondsAgo * 1000);
}

const CALL_FEEDBACK = {
  encouragement: "Você se fez entender. Muito bem!",
  improve: {
    better: "Is it still available?",
    said: "It is available?",
    why: "Em perguntas, o verbo vem antes do sujeito.",
  },
  kind: "call",
  pronunciation: [{ respelling: "a-VÊI-la-bol", tip: "A força vai no VAI.", word: "available" }],
  wentWell: ["Can I see it on Saturday?"],
};

/** A call on the learner's renting unit, whose call is written at A2. */
async function createCall({
  chapterId,
  goalId,
  kind = "practice",
  userId,
  ...finished
}: {
  chapterId: string;
  goalId: string;
  kind?: "checkpoint" | "practice";
  userId: string;
  objectivesMet?: string[];
  status?: "completed";
}) {
  return prisma.languageConversation.create({
    data: {
      chapterId,
      goalId,
      kind,
      language: "pt",
      level: "A2",
      liveModel: "openai/gpt-live-1",
      minutes: 2,
      scenario: RENTING_SCENARIO,
      targetLanguage: "en",
      titleSnapshot: RENTING_SCENARIO.title,
      userId,
      ...(finished.status
        ? { endedAt: new Date(), feedback: CALL_FEEDBACK, spokenSeconds: 70, status: "completed" }
        : {}),
      objectivesMet: finished.objectivesMet ?? [],
    },
  });
}

/** A language goal at A2 in onboarding, with every question answered up to the level test. */
function onboardingGoal({
  details,
  ...goal
}: {
  details: Record<string, string>;
  language: string;
  prompt: string;
  targetLanguage: string;
  title: string;
  userId: string;
}) {
  return goalFixture({
    details: { answered: ANSWERED, level: "A2", ...details },
    kind: "language",
    targetDate: new Date(Date.now() + GOAL_DAYS_AHEAD * MS_PER_DAY),
    ...goal,
  });
}

/** A written level test bank: two questions per skill and level, and a sentence per level. */
function levelTestBankContent() {
  const questions = LEVELS.flatMap((level) =>
    (["reading", "listening"] as const).flatMap((skill) =>
      [0, 1].map((index) => ({
        answerIndex: 0,
        id: `${skill}-${level}-${index}`,
        level,
        options: [`Right ${level}`, "Wrong one", "Wrong two", "Wrong three"],
        passage: `A short ${skill} text at ${level}.`,
        question: `Question at ${level}?`,
        skill,
      })),
    ),
  );

  return {
    questions,
    speaking: LEVELS.map((level) => ({
      level,
      sentence: `Say it at ${level}.`,
      translation: "Diga.",
    })),
  };
}

async function ensureLevelTestBank() {
  const content = levelTestBankContent();

  await prisma.languageLevelTest.upsert({
    create: {
      content,
      language: "pt",
      model: "test",
      promptVersion: "test",
      runId: "test",
      targetLanguage: "en",
    },
    update: { content },
    where: { languagePair: { language: "pt", targetLanguage: "en" } },
  });
}

test.describe("Language calls", () => {
  test("a finished checkpoint call shows what went well and one thing to improve in Fun", async ({
    browser,
  }) => {
    const { goal, renting, user } = await createLanguageLearner("fun");

    const call = await createCall({
      chapterId: renting.id,
      goalId: goal.id,
      kind: "checkpoint",
      objectivesMet: RENTING_SCENARIO.objectives.map((objective) => objective.label),
      status: "completed",
      userId: user.id,
    });

    const page = await openAs(browser, user);
    await page.goto(`/conversation/${call.id}`);

    await expect(page.getByText("Boss beaten")).toBeVisible();

    await expect(page.getByText("Can I see it on Saturday?")).toBeVisible();
    await expect(page.locator("p", { hasText: "Is it still available?" })).toBeVisible();
    await expect(page.getByText("Em perguntas, o verbo vem antes do sujeito.")).toBeVisible();
    await expect(page.getByText("available", { exact: true })).toBeVisible();

    await expect(page.getByRole("img", { name: "3 of 3 stars" })).toBeVisible();

    // A checkpoint goes back to today's session, which opens the next block.
    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/session");
    await expectAccessibleScreen(page, "a finished call");
    await page.context().close();
  });

  test("the free plan's calls for the day run out, and the call says so", async ({ browser }) => {
    const { goal, renting, user } = await createLanguageLearner("focus");

    const [call] = await Promise.all([
      createCall({ chapterId: renting.id, goalId: goal.id, userId: user.id }),
      usageRecordsFixture({ count: FREE_CALLS_A_DAY, kind: "conversation", userId: user.id }),
    ]);

    const page = await openAs(browser, user);
    await page.goto(`/conversation/${call.id}`);

    await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();
    await expectAccessibleScreen(page, "a call");
    await page.getByRole("button", { name: "Start the call" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "No more calls on your plan today" }),
    ).toBeVisible();

    await page.context().close();
  });
});

test.describe("Language practice in the plan", () => {
  test(`"Skip writing" leaves writing out until the plan brings it back`, async ({ browser }) => {
    const [{ goal, user }, { lesson }] = await Promise.all([
      createLanguageLearner("fun"),
      playableLessonFixture({
        lesson: { language: "pt", targetLanguage: "en" },
        steps: ["explanation", "typedAnswer", "summary"],
      }),
    ]);

    const page = await openAs(browser, user);
    await page.goto(`/learn/${lesson.id}`);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Skip writing" }).click();

    await expect(page.getByRole("button", { name: "Skip writing" })).toBeHidden();

    await page.goto("/plan");

    const writing = page
      .getByRole("region", { name: "What you practice" })
      .getByRole("button", { name: "Writing" });

    await expect(writing).toHaveAttribute("aria-pressed", "false");
    await expectAccessibleScreen(page, "the Route for a language goal");
    await writing.click();
    await expect(writing).toHaveAttribute("aria-pressed", "true");

    await expect
      .poll(async () => {
        const saved = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
        return saved.settings;
      })
      .toMatchObject({ skippedActivities: [] });

    await page.context().close();
  });

  test("the level test offers the app in the language the learner speaks best", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await onboardingGoal({
      details: { nativeLanguage: "pt", reason: "Work" },
      language: "en",
      prompt: "I want to speak Spanish",
      targetLanguage: "es",
      title: "Spanish for work",
      userId: noProgressUser.id,
    });

    await page.goto(`/start/${goal.id}`);
    await page.getByRole("button", { name: "Use the app in português" }).click();

    await expect(page).toHaveURL(new RegExp(`/pt/start/${goal.id}$`, "u"));
  });

  test("the first learner of a new pair waits with the questions' progress, and the test opens by itself", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    // A pair no other test has, whose questions another run is writing.
    const pair = { language: "pt", targetLanguage: "nl" };

    const writing = {
      content: {},
      generatedAt: startedAt(65),
      model: "",
      promptVersion: "",
      runId: "e2e-writer",
    };

    const [goal] = await Promise.all([
      onboardingGoal({
        details: { reason: "Viagem" },
        ...pair,
        prompt: "quero aprender",
        title: "Idioma para viajar",
        userId: noProgressUser.id,
      }),
      prisma.languageLevelTest.upsert({
        create: { ...pair, ...writing },
        update: writing,
        where: { languagePair: pair },
      }),
    ]);

    await page.goto(`/start/${goal.id}`);
    await page.getByRole("button", { name: "Take the quick test" }).click();

    await expect(page.getByRole("heading", { name: "Preparing your level test" })).toBeVisible();

    await expect(
      page.getByText(/is new in your language, so its questions are being written now/u),
    ).toBeVisible();

    await expect(
      page.getByRole("progressbar", { name: "Preparing your level test" }),
    ).toBeVisible();

    await expect(
      page.getByRole("list", { name: "Preparing your level test" }).getByRole("listitem"),
    ).toContainText("Writing the level test questions, in progress");

    await expect(page.getByRole("button", { name: "Skip the test" })).toBeVisible();

    // The writer finishes: the first question shows without a refresh.
    await prisma.languageLevelTest.update({
      data: { content: levelTestBankContent(), model: "test" },
      where: { languagePair: pair },
    });

    await expect(page.getByText("A short reading text at A2.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Preparing your level test" })).toBeHidden();
  });

  test("the level test places each skill during onboarding", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const [goal] = await Promise.all([
      onboardingGoal({
        details: { reason: "Trabalho" },
        language: "pt",
        prompt: "quero melhorar meu inglês",
        targetLanguage: "en",
        title: "Inglês para o trabalho",
        userId: noProgressUser.id,
      }),
      ensureLevelTestBank(),
    ]);

    await page.goto(`/start/${goal.id}`);
    await page.getByRole("button", { name: "Take the quick test" }).click();

    await expect(page.getByText("A short reading text at A2.")).toBeVisible();
    await page.getByRole("radio", { name: "Right A2" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(page.getByRole("button", { name: "Play the message" })).toBeVisible();
    await page.getByRole("button", { name: "Stop here and see my plan" }).click();

    await expect(page.getByRole("heading", { name: "Your level today" })).toBeVisible();

    // Stopping before the sentence out loud leaves speaking without a level.
    await expect(page.getByRole("listitem").filter({ hasText: "Reading" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Speaking" })).toHaveCount(0);

    // Building the plan saves the levels the test placed.
    await page.getByRole("button", { name: "Build my plan" }).click();

    await expect
      .poll(async () => {
        const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
        return saved.details;
      })
      .toMatchObject({
        levelTest: { answers: [{ answerIndex: 0, id: "reading-A2-0" }] },
        skillLevels: { listening: "A2", reading: expect.any(String) },
      });

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(saved.details).not.toHaveProperty("skillLevels.speaking");
  });
});
