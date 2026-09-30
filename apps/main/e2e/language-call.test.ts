import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

/** The free plan's live calls a day. */
const FREE_CALLS_A_DAY = 3;
const MS_PER_DAY = 86_400_000;
const GOAL_DAYS_AHEAD = 90;

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

/** The seeded renting unit: Marcos's current situation, whose call is cached at A2. */
async function findRentingUnit() {
  return prisma.chapter.findFirstOrThrow({
    where: { targetLanguage: "en", title: "Alugando um apartamento" },
  });
}

async function createCall({
  goalId,
  kind = "practice",
  userId,
  ...finished
}: {
  goalId: string;
  kind?: "checkpoint" | "practice";
  userId: string;
  objectivesMet?: string[];
  status?: "completed";
}) {
  const unit = await findRentingUnit();

  return prisma.languageConversation.create({
    data: {
      chapterId: unit.id,
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
  test("a practice call runs from its intro to its result", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "language" }, async ({ page, user }) => {
      const call = await createCall({ goalId: user.goalId, userId: user.id });

      await page.goto(`/conversation/${call.id}`);

      await expect(page.getByRole("heading", { level: 1, name: "Linda" })).toBeVisible();
      await expect(page.getByText("proprietária · Queen Street")).toBeVisible();
      await expect(page.getByText("Book a viewing")).toBeVisible();

      await page.getByRole("button", { name: "Start the call" }).click();

      // No voice model answers in tests: the call can't connect, and ending it still saves it.
      await expect(page.getByText("The call dropped")).toBeVisible();
      await page.getByRole("button", { name: "End the call" }).click();

      await expect(page.getByText("Call finished")).toBeVisible();

      await expect(page.getByText("We didn't hear you this time.", { exact: false })).toBeVisible();

      const saved = await prisma.languageConversation.findUniqueOrThrow({ where: { id: call.id } });

      expect(saved.status).toBe("completed");
    });
  });

  test("a finished call shows what went well and one thing to improve in Fun", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "fun", persona: "language" }, async ({ page, user }) => {
      const call = await createCall({
        goalId: user.goalId,
        kind: "checkpoint",
        objectivesMet: RENTING_SCENARIO.objectives.map((objective) => objective.label),
        status: "completed",
        userId: user.id,
      });

      await page.goto(`/conversation/${call.id}`);

      await expect(page.getByText("Boss beaten")).toBeVisible();

      await expect(page.getByText("Can I see it on Saturday?")).toBeVisible();
      await expect(page.locator("p", { hasText: "Is it still available?" })).toBeVisible();
      await expect(page.getByText("Em perguntas, o verbo vem antes do sujeito.")).toBeVisible();
      await expect(page.getByText("available", { exact: true })).toBeVisible();

      await expect(page.getByRole("img", { name: "3 of 3 stars" })).toBeVisible();

      await page.getByRole("link", { name: "Continue" }).click();
      await expect(page).toHaveURL(/\/session/u);
    });
  });

  test("the free plan's calls for the day run out, and the call says so", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "language" }, async ({ page, user }) => {
      const [call] = await Promise.all([
        createCall({ goalId: user.goalId, userId: user.id }),
        usageRecordsFixture({ count: FREE_CALLS_A_DAY, kind: "conversation", userId: user.id }),
      ]);

      await page.goto(`/conversation/${call.id}`);

      await page.getByRole("button", { name: "Start the call" }).click();

      await expect(
        page.getByRole("alert").filter({ hasText: "No more calls on your plan today" }),
      ).toBeVisible();

      // Nothing was charged and the call never started.
      await expect(
        prisma.usageRecord.count({ where: { kind: "conversation", userId: user.id } }),
      ).resolves.toBe(FREE_CALLS_A_DAY);

      await expect(
        prisma.languageConversation.findUniqueOrThrow({ where: { id: call.id } }),
      ).resolves.toMatchObject({ startedAt: null });
    });
  });

  test("a language goal's checkpoint opens the unit's call", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "language" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      const session = await prisma.studySession.findFirstOrThrow({
        where: { goalId: user.goalId },
      });

      const boss = await prisma.planItem.findFirstOrThrow({
        where: { kind: "boss", planId: plan.id, status: "todo" },
      });

      const position = await prisma.studySessionBlock.count({ where: { sessionId: session.id } });

      const block = await prisma.studySessionBlock.create({
        data: {
          kind: "checkpoint",
          payload: {
            checkpoint: {
              kind: "boss",
              mock: false,
              passMark: 0,
              phase: boss.phase,
              rematch: false,
              timeLimitMinutes: null,
            },
            planItemId: boss.id,
          },
          position,
          sessionId: session.id,
        },
      });

      await page.goto(`/checkpoint/${block.id}`);

      await expect(page).toHaveURL(/\/conversation\//u);
      await expect(page.getByText("Unit checkpoint")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: "Linda" })).toBeVisible();
    });
  });
});

test.describe("Language practice in the plan", () => {
  test(`"Skip writing" leaves writing out until the plan brings it back`, async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "language" }, async ({ page, user }) => {
      const { lesson } = await playableLessonFixture({
        lesson: { language: "pt", targetLanguage: "en" },
        steps: ["explanation", "typedAnswer", "summary"],
      });

      await page.goto(`/learn/${lesson.id}`);
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Skip writing" }).click();

      await expect(page.getByRole("button", { name: "Skip writing" })).toBeHidden();

      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
      expect(plan.settings).toMatchObject({ skippedActivities: ["writing"] });

      await page.goto("/plan");

      const writing = page
        .getByRole("region", { name: "What you practice" })
        .getByRole("button", { name: "Writing" });

      await expect(writing).toHaveAttribute("aria-pressed", "false");
      await writing.click();
      await expect(writing).toHaveAttribute("aria-pressed", "true");

      await expect
        .poll(async () => {
          const saved = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
          return saved.settings;
        })
        .toMatchObject({ skippedActivities: [] });
    });
  });

  test("the level test offers the app in the language the learner speaks best", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "focus", persona: "language" }, async ({ page, user }) => {
      const goal = await prisma.goal.create({
        data: {
          dailyMinutes: 20,
          details: {
            answered: [
              "reason",
              "targetDate",
              "level",
              "schedule",
              "age",
              "mode",
              "buddy",
              "followUps",
            ],
            level: "A2",
            nativeLanguage: "pt",
            reason: "Work",
          },
          kind: "language",
          language: "en",
          prompt: "I want to speak Spanish",
          targetDate: new Date(Date.now() + GOAL_DAYS_AHEAD * MS_PER_DAY),
          targetLanguage: "es",
          title: "Spanish for work",
          userId: user.id,
        },
      });

      await page.goto(`/start/${goal.id}`);
      await page.getByRole("button", { name: "Use the app in português" }).click();

      await expect(page).toHaveURL(new RegExp(`/pt/start/${goal.id}$`, "u"));
    });
  });

  test("the first learner of a new pair waits with the questions' progress, and the test opens by itself", async ({
    browser,
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

    await prisma.languageLevelTest.upsert({
      create: { ...pair, ...writing },
      update: writing,
      where: { languagePair: pair },
    });

    await asPersona(browser, { mode: "fun", persona: "language" }, async ({ page, user }) => {
      const goal = await prisma.goal.create({
        data: {
          dailyMinutes: 20,
          details: {
            answered: [
              "reason",
              "targetDate",
              "level",
              "schedule",
              "age",
              "mode",
              "buddy",
              "followUps",
            ],
            level: "A2",
            reason: "Viagem",
          },
          kind: "language",
          ...pair,
          prompt: "quero aprender",
          targetDate: new Date(Date.now() + GOAL_DAYS_AHEAD * MS_PER_DAY),
          title: "Idioma para viajar",
          userId: user.id,
        },
      });

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
  });

  test("the level test places each skill during onboarding", async ({ browser }) => {
    await ensureLevelTestBank();

    await asPersona(browser, { mode: "focus", persona: "language" }, async ({ page, user }) => {
      const goal = await prisma.goal.create({
        data: {
          dailyMinutes: 20,
          details: {
            answered: [
              "reason",
              "targetDate",
              "level",
              "schedule",
              "age",
              "mode",
              "buddy",
              "followUps",
            ],
            level: "A2",
            reason: "Trabalho",
          },
          kind: "language",
          language: "pt",
          prompt: "quero melhorar meu inglês",
          targetDate: new Date(Date.now() + GOAL_DAYS_AHEAD * MS_PER_DAY),
          targetLanguage: "en",
          title: "Inglês para o trabalho",
          userId: user.id,
        },
      });

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
});
