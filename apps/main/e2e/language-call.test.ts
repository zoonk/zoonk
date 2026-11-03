import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { createLanguageLearner } from "./language-learner";
import {
  CHARACTER_CHECK_IN,
  CHARACTER_GOODBYE,
  CHARACTER_REPLY,
  answerLiveCalls,
  blockMicrophone,
} from "./live-peer";
import { openAs } from "./study-day";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
const GOAL_DAYS_AHEAD = 90;
const ANSWERED = ["reason", "targetDate", "level", "schedule", "buddy", "followUps"];
/** No run voices this bank's clips, so it's dated long ago: a missing clip is asked for on Play. */
const BANK_WRITTEN_AT = new Date("2026-01-01T00:00:00.000Z");

function createCall({
  chapterId,
  goalId,
  minutes = 2,
  userId,
}: {
  chapterId: string;
  goalId: string;
  minutes?: number;
  userId: string;
}) {
  return prisma.languageConversation.create({
    data: {
      chapterId,
      goalId,
      kind: "practice",
      language: "pt",
      level: "A2",
      liveModel: "openai/gpt-live-1",
      minutes,
      scenario: RENTING_SCENARIO,
      targetLanguage: "en",
      titleSnapshot: RENTING_SCENARIO.title,
      userId,
    },
  });
}

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
      generatedAt: BANK_WRITTEN_AT,
      language: "pt",
      model: "test",
      promptVersion: "test",
      runId: "test",
      targetLanguage: "en",
    },
    update: { content, generatedAt: BANK_WRITTEN_AT },
    where: { languagePair: { language: "pt", targetLanguage: "en" } },
  });
}

const CLIP_URL = "https://audio.e2e.zoonk.test/listening.wav";
const CLIP_SAMPLE_RATE = 8000;
const CLIP_SAMPLES = 2400;

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

async function routeSpeechClips(page: Page, { file = CLIP_URL, url = CLIP_URL } = {}) {
  const requests: unknown[] = [];
  let fileLoaded = false;

  await page.route("**/v1/speech-clips", async (route) => {
    requests.push(route.request().postDataJSON());

    await route.fulfill({ json: { durationMs: 300, id: randomUUID(), language: "en", url } });
  });

  await page.route(file, async (route) => {
    fileLoaded = true;
    await route.fulfill({ body: clipAudio(), contentType: "audio/wav" });
  });

  return { fileLoaded: () => fileLoaded, requests };
}

test.describe("Language calls", () => {
  test("a quiet learner is checked on, then the call says goodbye, hangs up and saves", async ({
    browser,
  }) => {
    const { goal, renting, user } = await createLanguageLearner();
    const call = await createCall({ chapterId: renting.id, goalId: goal.id, userId: user.id });
    const page = await openAs(browser, user);

    await answerLiveCalls(page, "answers");
    await page.clock.install();
    await page.goto(`/conversation/${call.id}`);
    await page.getByRole("button", { name: "Call Linda" }).click();

    const transcript = page.getByRole("log", { name: "Conversation" });
    await expect(transcript.getByText("Hi! Are you calling about the apartment?")).toBeVisible();

    await page.clock.fastForward("00:30");
    await expect(transcript.getByText(CHARACTER_CHECK_IN)).toBeVisible();
    await expect(transcript.getByText(CHARACTER_GOODBYE)).toBeHidden();

    await page.clock.fastForward("00:25");
    await expect(transcript.getByText(CHARACTER_GOODBYE)).toBeVisible();
    await expect(page.getByText("Linda is saying goodbye")).toBeVisible();

    await page.clock.fastForward("00:04");
    await expect(page.getByRole("img", { name: "2 of 3 stars" })).toBeVisible();

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: call.id } }),
    ).resolves.toMatchObject({ status: "completed" });

    await page.context().close();
  });

  test("past its talk time, the call says goodbye after the learner's typed answer and hangs up only once the goodbye had time to play", async ({
    browser,
  }) => {
    const { goal, renting, user } = await createLanguageLearner();

    const call = await createCall({
      chapterId: renting.id,
      goalId: goal.id,
      minutes: 1,
      userId: user.id,
    });

    const page = await openAs(browser, user);
    await answerLiveCalls(page, "answers");
    await page.clock.install();
    await page.goto(`/conversation/${call.id}`);
    await page.getByRole("button", { name: "Call Linda" }).click();

    const transcript = page.getByRole("log", { name: "Conversation" });
    const reply = page.getByRole("textbox", { name: "Type your reply" });

    const wrapUp = page
      .locator('[data-slot="call-turn"]')
      .getByText("Almost time. Linda will say goodbye after your answer.");

    await expect(transcript.getByText("Hi! Are you calling about the apartment?")).toBeVisible();
    // Held from here, the call's clock moves only with the test, however slow the machine is.
    await page.clock.pauseAt(new Date(Date.now() + 1000));

    const answerAfter20Seconds = async (text: string) => {
      await page.clock.runFor("00:20");
      await reply.fill(text);
      await page.keyboard.press("Enter");
    };

    // A reply every 20 s keeps the call's check-in away until its minute is nearly up.
    await answerAfter20Seconds("Yes, is it free?");
    await answerAfter20Seconds("How much is it?");
    await page.clock.runFor("00:10");
    await reply.fill("Can I see it on Saturday?");

    // Still typing as the minute ends: the goodbye waits for the reply.
    await expect(async () => {
      await page.keyboard.type(" ");
      await page.clock.runFor(1000);
      await expect(wrapUp).toBeVisible({ timeout: 100 });
    }).toPass();

    await expect(transcript.getByText(CHARACTER_GOODBYE)).toBeHidden();
    await page.keyboard.press("Enter");
    await page.clock.runFor("00:01");
    await expect(transcript.getByText("Can I see it on Saturday?")).toBeVisible();
    await expect(transcript.getByText(CHARACTER_REPLY)).toHaveCount(3);
    await expect(transcript.getByText(CHARACTER_GOODBYE)).toBeHidden();

    // Linda answers the reply first, then says goodbye once she stopped.
    await page.clock.runFor("00:02");
    await expect(transcript.getByText(CHARACTER_GOODBYE)).toBeVisible();
    await expect(page.getByText("Linda is saying goodbye")).toBeVisible();

    await page.clock.runFor("00:02");
    await expect(page.getByRole("button", { exact: true, name: "End" })).toBeVisible();

    await page.clock.runFor(1500);
    await expect(page.getByRole("img", { name: "2 of 3 stars" })).toBeVisible();

    await page.context().close();
  });

  test("a blocked microphone offers to type instead, before anything is reserved", async ({
    browser,
  }) => {
    const { goal, renting, user } = await createLanguageLearner();
    const call = await createCall({ chapterId: renting.id, goalId: goal.id, userId: user.id });
    const page = await openAs(browser, user);

    await blockMicrophone(page);
    await answerLiveCalls(page, "answers");
    await page.goto(`/conversation/${call.id}`);
    await page.getByRole("button", { name: "Call Linda" }).click();

    await expect(page.getByText("Your microphone is off")).toBeVisible();

    await expect(
      prisma.liveCallConnection.count({ where: { conversationId: call.id } }),
    ).resolves.toBe(0);

    await page.getByRole("button", { name: "Type instead" }).click();

    await expect(
      page
        .getByRole("log", { name: "Conversation" })
        .getByText("Hi! Are you calling about the apartment?"),
    ).toBeVisible();

    await expect(page.getByText("Type your reply below.")).toBeVisible();
    await page.context().close();
  });

  test("calling again with a blocked microphone asks first instead of reserving a typed call", async ({
    browser,
  }) => {
    const { goal, renting, user } = await createLanguageLearner();
    const call = await createCall({ chapterId: renting.id, goalId: goal.id, userId: user.id });
    const page = await openAs(browser, user);

    const connections = () =>
      prisma.liveCallConnection.count({ where: { conversationId: call.id } });

    await blockMicrophone(page);
    const gateway = await answerLiveCalls(page, "silent");
    await page.clock.install();
    await page.goto(`/conversation/${call.id}`);
    await page.getByRole("button", { name: "Call Linda" }).click();
    await page.getByRole("button", { name: "Type instead" }).click();
    await gateway.asked;
    await page.clock.fastForward("00:16");
    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page.getByText("Your microphone is off")).toBeVisible();
    await expect.poll(connections).toBe(1);
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
    await page.getByRole("button", { name: "Call Linda" }).click();
    await expect(page.getByText("Calling Linda…")).toBeVisible();

    await page.getByRole("textbox", { name: "Type your reply" }).fill("Hello?");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("log", { name: "Conversation" }).getByText("Hello?")).toBeVisible();

    await gateway.asked;
    await page.clock.fastForward("00:16");

    await expect(
      page.getByRole("alert").filter({ hasText: "The call didn't connect" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Calling Linda…")).toBeVisible();

    await page.getByRole("button", { exact: true, name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "Call Linda" })).toBeVisible();

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: call.id } }),
    ).resolves.toMatchObject({ endedAt: null, status: "ready" });

    await page.context().close();
  });
});

test.describe("Language practice in the plan", () => {
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

    const clip = await routeSpeechClips(page);
    await page.getByRole("button", { name: "Play the message" }).click();
    await expect(page.getByRole("button", { name: "Play the message again" })).toBeVisible();

    expect(clip.requests).toStrictEqual([
      {
        language: "en",
        personal: false,
        text: expect.stringMatching(/^A short listening text at [ABC][12]\.$/u),
      },
    ]);

    expect(clip.fileLoaded()).toBe(true);

    await page.getByRole("button", { name: "Stop here and see my plan" }).click();

    await expect(page.getByRole("heading", { name: "Your level today" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Build my plan" })).toBeEnabled();

    await page.reload();

    await expect(page.getByRole("heading", { name: "Your level today" })).toBeVisible();
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
