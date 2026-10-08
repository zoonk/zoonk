import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { openUserAsGuest } from "./guest-session";
import { createLanguageLearner } from "./language-learner";
import { CHARACTER_CHECK_IN, CHARACTER_REPLY, answerLiveCalls } from "./live-gateway";
import { continueToLastStep, nextStep } from "./result-steps";
import { openAs } from "./study-day";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

/** The free plan's call time a day and a month, in seconds. */
const FREE_CALL_SECONDS = 120;
const FREE_CALL_SECONDS_A_MONTH = 300;
const GOAL_DAYS_AHEAD = 90;

/** Every onboarding question before the level test, so `/start/:goalId` opens on the test. */
const ANSWERED = [
  "reason",
  "targetDate",
  "level",
  "schedule",
  "age",
  "memory",
  "buddy",
  "followUps",
];

/** The first minute of this month by the server's clock (UTC), when the month's calls count from. */
function startOfThisMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

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

const CLIP_URL = "https://audio.e2e.zoonk.test/listening.wav";
const CLIP_SAMPLE_RATE = 8000;
const CLIP_SAMPLES = 2400;

/** A short, quiet WAV the browser can really play to its end. */
function clipAudio(): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + CLIP_SAMPLES, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(CLIP_SAMPLE_RATE, 24);
  header.writeUInt32LE(CLIP_SAMPLE_RATE, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(CLIP_SAMPLES, 40);

  return Buffer.concat([header, Buffer.alloc(CLIP_SAMPLES, 128)]);
}

/**
 * `POST /v1/speech-clips` as the API answers it (main's E2E runs without the API, whose own tests
 * cover the endpoint), and the generated file it points to.
 */
async function routeSpeechClips(page: Page) {
  const requests: unknown[] = [];
  let fileLoaded = false;

  await page.route("**/v1/speech-clips", async (route) => {
    requests.push(route.request().postDataJSON());

    await route.fulfill({
      json: { durationMs: 300, id: randomUUID(), language: "en", url: CLIP_URL },
    });
  });

  await page.route(CLIP_URL, async (route) => {
    fileLoaded = true;
    await route.fulfill({ body: clipAudio(), contentType: "audio/wav" });
  });

  return { fileLoaded: () => fileLoaded, requests };
}

test.describe("Language calls", () => {
  test("a finished checkpoint call shows what went well and one thing to improve", async ({
    browser,
  }) => {
    const { goal, renting, user } = await createLanguageLearner();

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

    await expect(page.getByRole("heading", { level: 1, name: "Challenge passed" })).toBeVisible();

    // Every goal across, without Help: all three stars, so nothing to explain about them.
    await expect(page.getByRole("img", { name: "3 of 3 stars" })).toBeVisible();
    await expect(page.getByText(/A star for finishing/u)).toBeHidden();
    await expect(page.getByText("Você se fez entender. Muito bem!")).toBeVisible();
    await expectAccessibleScreen(page, "a finished call");

    // Then what went well: the goals got across and the phrases said well.
    await nextStep(page);
    await expect(page.getByRole("heading", { level: 1, name: "What went well" })).toBeVisible();
    await expect(page.getByText("Book a viewing")).toBeVisible();
    await expect(page.getByText("Can I see it on Saturday?")).toBeVisible();

    // Then one thing to say better, with why, and a word to practice saying.
    await nextStep(page);
    await expect(page.getByRole("heading", { level: 1, name: "To improve" })).toBeVisible();
    await expect(page.locator("p", { hasText: "Is it still available?" })).toBeVisible();
    await expect(page.getByText("Em perguntas, o verbo vem antes do sujeito.")).toBeVisible();
    await expect(page.getByText("available", { exact: true })).toBeVisible();

    // A checkpoint goes back to today's session, which opens the next block; closing goes to Today.
    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/session");
    await expect(page.getByRole("link", { name: "Leave" })).toHaveAttribute("href", "/today");
    await page.context().close();
  });

  test("a practice call connects, takes typed replies and ends with its stars", async ({
    browser,
  }) => {
    const { goal, renting, user } = await createLanguageLearner();
    const call = await createCall({ chapterId: renting.id, goalId: goal.id, userId: user.id });
    const page = await openAs(browser, user);

    await answerLiveCalls(page, "answers");
    await page.goto(`/conversation/${call.id}`);
    await page.getByRole("button", { name: "Start the call" }).click();

    const transcript = page.getByRole("log", { name: "Conversation" });
    await expect(transcript.getByText("Hi! Are you calling about the apartment?")).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 1, name: RENTING_SCENARIO.title }),
    ).toBeVisible();

    await expect(page.getByText(/^0:0\d \/ 2:00$/u)).toBeVisible();

    await page.getByRole("textbox", { name: "Type your reply" }).fill("Is it still available?");
    await page.keyboard.press("Enter");

    await expect(transcript.getByText("Is it still available?")).toBeVisible();
    await expect(transcript.getByText(CHARACTER_REPLY)).toBeVisible();
    await expectAccessibleScreen(page, "a live call");

    await page.getByRole("button", { exact: true, name: "End" }).click();

    // No model marks the goals in tests: a star for finishing and one without Help.
    await expect(page.getByRole("img", { name: "2 of 3 stars" })).toBeVisible();

    await expect(
      page.getByText(
        "A star for finishing, one for getting everything across and one without Help.",
      ),
    ).toBeVisible();

    // No goal was marked, so the last step lists the ones still to get across.
    await continueToLastStep(page);
    await expect(page.getByText("Ask about the deposit")).toBeVisible();

    const unit = `/content/units/${renting.id}`;
    await expect(page.getByRole("link", { name: "Leave" })).toHaveAttribute("href", unit);
    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", unit);

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: call.id } }),
    ).resolves.toMatchObject({ status: "completed", usedHelp: false });

    await page.context().close();
  });

  test("a call where the learner stays quiet checks in once, then ends on its own with its feedback", async ({
    browser,
  }) => {
    const { goal, renting, user } = await createLanguageLearner();
    const call = await createCall({ chapterId: renting.id, goalId: goal.id, userId: user.id });
    const page = await openAs(browser, user);

    await answerLiveCalls(page, "answers");
    await page.clock.install();
    await page.goto(`/conversation/${call.id}`);
    await page.getByRole("button", { name: "Start the call" }).click();

    const transcript = page.getByRole("log", { name: "Conversation" });
    await expect(transcript.getByText("Hi! Are you calling about the apartment?")).toBeVisible();

    // Twenty seconds without a word: the character asks once whether the learner is there.
    await page.clock.fastForward("00:21");
    await expect(transcript.getByText(CHARACTER_CHECK_IN)).toBeVisible();

    // Still quiet: the call ends before its two minutes, since the voice is paid by the second.
    await page.clock.fastForward("00:25");
    await expect(page.getByRole("img", { name: "2 of 3 stars" })).toBeVisible();

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: call.id } }),
    ).resolves.toMatchObject({ status: "completed" });

    await page.context().close();
  });

  test("a call opened again after going back still connects", async ({ browser }) => {
    const { goal, renting, user } = await createLanguageLearner();
    const call = await createCall({ chapterId: renting.id, goalId: goal.id, userId: user.id });
    const page = await openAs(browser, user);

    await answerLiveCalls(page, "answers");
    await page.goto(`/conversation/${call.id}`);
    await page.getByRole("link", { name: "Leave" }).click();
    await expect(page).toHaveURL(new RegExp(`/content/units/${renting.id}$`, "u"));

    await page.goBack();
    await page.getByRole("button", { name: "Start the call" }).click();

    await expect(
      page.getByRole("log", { name: "Conversation" }).getByText("Hi! Are you calling"),
    ).toBeVisible();

    await page.context().close();
  });

  test("a call that drops can end there and still saves what was said", async ({ browser }) => {
    const { goal, renting, user } = await createLanguageLearner();
    const call = await createCall({ chapterId: renting.id, goalId: goal.id, userId: user.id });
    const page = await openAs(browser, user);

    await answerLiveCalls(page, "drops");
    await page.goto(`/conversation/${call.id}`);
    await page.getByRole("button", { name: "Start the call" }).click();
    await page.getByRole("textbox", { name: "Type your reply" }).fill("Is it still available?");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("alert").filter({ hasText: "The call dropped" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Call again" })).toBeVisible();
    await page.getByRole("button", { name: "End the call" }).click();

    await expect(page.getByRole("img", { name: "2 of 3 stars" })).toBeVisible();

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: call.id } }),
    ).resolves.toMatchObject({ status: "completed" });

    await page.context().close();
  });

  test("a call that doesn't connect says so, takes typed replies while it rings and calls again", async ({
    browser,
  }) => {
    const { goal, renting, user } = await createLanguageLearner();
    const call = await createCall({ chapterId: renting.id, goalId: goal.id, userId: user.id });
    const page = await openAs(browser, user);

    const gateway = await answerLiveCalls(page, "silent");
    await page.clock.install();
    await page.goto(`/conversation/${call.id}`);
    await page.getByRole("button", { name: "Start the call" }).click();
    await expect(page.getByText("Calling…")).toBeVisible();

    // Typing works from the first ring: the reply waits for the call to connect.
    await page.getByRole("textbox", { name: "Type your reply" }).fill("Hello?");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("log", { name: "Conversation" }).getByText("Hello?")).toBeVisible();

    // The session never starts: after a while the call says so, without blaming anyone.
    await gateway.asked;
    await page.clock.fastForward("00:16");

    await expect(
      page.getByRole("alert").filter({ hasText: "The call didn't connect" }),
    ).toBeVisible();

    await expectAccessibleScreen(page, "a call that didn't connect");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Calling…")).toBeVisible();

    // Ending a call that never connected saves nothing: it goes back to its intro.
    await page.getByRole("button", { exact: true, name: "End" }).click();
    await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: call.id } }),
    ).resolves.toMatchObject({ endedAt: null, status: "ready" });

    await page.context().close();
  });

  test("a free learner's call sheet offers only the lengths left today, with Plus's longer ones locked", async ({
    browser,
  }) => {
    const { renting, user } = await createLanguageLearner();
    const page = await openAs(browser, user);

    await page.goto(`/content/units/${renting.id}`);
    await page.getByRole("button", { name: "Practice a conversation" }).click();

    const sheet = page.getByRole("dialog", { name: "Practice a conversation" });
    const lengths = sheet.getByRole("group", { name: "Call length" }).getByRole("radio");

    await expect(lengths).toHaveCount(4);
    await expect(sheet.getByRole("radio", { name: "2 min" })).toBeChecked();
    await expect(sheet.getByRole("radio", { name: "3 min Available with Plus" })).toBeVisible();
    await expect(sheet.getByRole("radio", { name: "5 min Available with Plus" })).toBeVisible();
    await expectAccessibleScreen(page, "the call sheet of a free learner");

    // A longer call is Plus's: picking it says so in place of the start, without numbers.
    await sheet.getByText("5 min").click();
    await expect(sheet.getByRole("button", { name: "Start the call" })).toHaveCount(0);
    await expect(sheet.getByText("Longer calls come with Plus.")).toBeVisible();

    await expect(sheet.getByRole("link", { name: "See Plus" })).toHaveAttribute(
      "href",
      "/subscription",
    );

    await sheet.getByText("1 min").click();
    await expect(sheet.getByRole("button", { name: "Start the call" })).toBeVisible();

    // A call of 90 seconds today leaves no length that fits: the sheet says until when.
    await usageRecordsFixture({ count: 1, kind: "conversation", seconds: 90, userId: user.id });
    await page.reload();
    await page.getByRole("button", { name: "Practice a conversation" }).click();

    const used = sheet.getByRole("alert").filter({ hasText: "No more calls today" });
    await expect(used).toBeVisible();
    await expect(used.getByText(/minute/iu)).toHaveCount(0);
    await expect(sheet.getByRole("radio")).toHaveCount(0);

    await page.context().close();
  });

  for (const used of [
    {
      createdAt: () => new Date(),
      message: "Your calls come back tomorrow, or get Plus for higher call limits.",
      period: "day",
      seconds: FREE_CALL_SECONDS,
      title: "No more calls today",
    },
    {
      createdAt: startOfThisMonth,
      message: "Your calls come back next month, or get Plus for higher call limits.",
      period: "month",
      seconds: FREE_CALL_SECONDS_A_MONTH,
      title: "No more calls this month",
    },
  ] as const) {
    test(`the free plan's call time for the ${used.period} runs out: the call says until when and offers Plus, without numbers`, async ({
      browser,
    }) => {
      const { goal, renting, user } = await createLanguageLearner();

      const [call] = await Promise.all([
        createCall({ chapterId: renting.id, goalId: goal.id, userId: user.id }),
        usageRecordsFixture({
          count: 1,
          createdAt: used.createdAt(),
          kind: "conversation",
          seconds: used.seconds,
          userId: user.id,
        }),
      ]);

      const page = await openAs(browser, user);
      await page.goto(`/conversation/${call.id}`);

      await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();
      await expectAccessibleScreen(page, "a call");
      await page.getByRole("button", { name: "Start the call" }).click();

      const problem = page.getByRole("alert").filter({ hasText: used.title });
      await expect(problem).toBeVisible();
      await expect(problem.getByText(used.message)).toBeVisible();
      await expect(problem.getByText(/minute/iu)).toHaveCount(0);

      await expect(problem.getByRole("link", { name: "See Plus" })).toHaveAttribute(
        "href",
        "/subscription",
      );

      await expectAccessibleScreen(page, `calls used for the ${used.period}`);
      await page.context().close();
    });
  }

  test("a guest's plan has no calls: the call asks for a free account", async ({ browser }) => {
    const { goal, renting, user } = await createLanguageLearner();
    const call = await createCall({ chapterId: renting.id, goalId: goal.id, userId: user.id });
    const { context, page } = await openUserAsGuest(browser, user);

    await page.goto(`/conversation/${call.id}`);
    await page.getByRole("button", { name: "Start the call" }).click();

    const problem = page.getByRole("alert").filter({ hasText: "Calls need a free account" });
    await expect(problem).toBeVisible();

    await expect(problem.getByRole("link", { name: "Create a free account" })).toHaveAttribute(
      "href",
      "/login",
    );

    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(0);
    await context.close();
  });

  for (const left of [
    {
      createdAt: () => new Date(),
      period: "day",
      seconds: FREE_CALL_SECONDS - 90,
      status: "Your call time for today is almost up.",
    },
    {
      createdAt: startOfThisMonth,
      period: "month",
      seconds: FREE_CALL_SECONDS_A_MONTH - 90,
      status: "Your call time for this month is almost up.",
    },
  ] as const) {
    test(`a call that reaches the ${left.period}'s call time ends early, says so as it wraps up and gives its feedback`, async ({
      browser,
    }) => {
      test.skip(
        left.period === "month" && new Date().getUTCDate() === 1,
        "On the 1st, every call this month is today's, so today's call time ends first",
      );

      const { goal, renting, user } = await createLanguageLearner();

      // A minute and a half of the free plan's call time is left: the two-minute call runs that.
      const [call] = await Promise.all([
        createCall({ chapterId: renting.id, goalId: goal.id, userId: user.id }),
        usageRecordsFixture({
          count: 1,
          createdAt: left.createdAt(),
          kind: "conversation",
          seconds: left.seconds,
          userId: user.id,
        }),
      ]);

      const page = await openAs(browser, user);
      await answerLiveCalls(page, "answers");
      await page.clock.install();
      await page.goto(`/conversation/${call.id}`);

      // Nothing about the plan's call time before the call.
      await expect(page.getByText(/call time/iu)).toHaveCount(0);
      await page.getByRole("button", { name: "Start the call" }).click();

      const transcript = page.getByRole("log", { name: "Conversation" });
      await expect(transcript.getByText("Hi! Are you calling about the apartment?")).toBeVisible();
      // The call's clock counts to what it may run.
      await expect(page.getByText(/^0:0\d \/ 1:30$/u)).toBeVisible();

      const reply = page.getByRole("textbox", { name: "Type your reply" });
      const status = page.getByRole("status").filter({ hasText: "almost up" });

      // The learner keeps talking; twenty seconds before the time is up the call wraps up and says why.
      for (const seconds of ["00:19", "00:19", "00:19", "00:15"]) {
        // oxlint-disable-next-line no-await-in-loop -- Each reply comes after the clock moves on.
        await reply.fill("Can I see it on Saturday?");
        // oxlint-disable-next-line no-await-in-loop -- Sent before the clock moves on.
        await page.keyboard.press("Enter");
        // oxlint-disable-next-line no-await-in-loop -- The call's clock moves on between replies.
        await page.clock.fastForward(seconds);
      }

      await expect(status).toHaveText(left.status);
      await expectAccessibleScreen(page, `a call wrapping up at the ${left.period}'s call time`);

      await page.clock.fastForward("00:30");
      await expect(page.getByRole("img", { name: /of 3 stars/u })).toBeVisible();

      // The plan's call time keeps only what the call ran, never more than it held.
      const record = await prisma.usageRecord.findFirstOrThrow({ where: { targetId: call.id } });
      expect(record.seconds).toBeLessThan(90);

      await page.context().close();
    });
  }
});

test.describe("Language practice in the plan", () => {
  test(`"Skip writing" leaves writing out until the plan brings it back`, async ({ browser }) => {
    const [{ goal, user }, { lesson }] = await Promise.all([
      createLanguageLearner(),
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

    await page.goto("/journey");
    await page.getByRole("button", { name: "Adjust plan" }).click();

    const writing = page
      .getByRole("dialog", { name: "Adjust your plan" })
      .getByRole("group", { name: "What you practice" })
      .getByRole("button", { name: "Writing" });

    await expect(writing).toHaveAttribute("aria-pressed", "false");
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
    await page.getByRole("button", { exact: true, name: "Start" }).click();

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
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    await expect(page.getByText("A short reading text at A2.")).toBeVisible();
    await page.getByRole("radio", { name: "Right A2" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();

    // The voice message is a clip generated in the language tested, played to its end.
    const clip = await routeSpeechClips(page);
    await page.getByRole("button", { name: "Play the message" }).click();
    await expect(page.getByRole("button", { name: "Play the message again" })).toBeVisible();

    expect(clip.requests).toStrictEqual([
      { language: "en", text: expect.stringMatching(/^A short listening text at [ABC][12]\.$/u) },
    ]);

    expect(clip.fileLoaded()).toBe(true);

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
