import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { createLanguageLearner } from "./language-learner";
import { answerLiveCalls } from "./live-peer";
import { openAs } from "./study-day";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
const GOAL_DAYS_AHEAD = 90;
const ANSWERED = ["reason", "targetDate", "level", "schedule", "buddy", "followUps"];

function createCall({
  chapterId,
  goalId,
  userId,
}: {
  chapterId: string;
  goalId: string;
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
      minutes: 2,
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
  test("a silent call ends automatically and saves its completion", async ({ browser }) => {
    const { goal, renting, user } = await createLanguageLearner();
    const call = await createCall({ chapterId: renting.id, goalId: goal.id, userId: user.id });
    const page = await openAs(browser, user);

    await answerLiveCalls(page, "answers");
    await page.clock.install();
    await page.goto(`/conversation/${call.id}`);
    await page.getByRole("button", { name: "Start the call" }).click();

    const transcript = page.getByRole("log", { name: "Conversation" });
    await expect(transcript.getByText("Hi! Are you calling about the apartment?")).toBeVisible();

    await page.clock.fastForward("00:21");

    await page.clock.fastForward("00:25");
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

    await page.getByRole("textbox", { name: "Type your reply" }).fill("Hello?");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("log", { name: "Conversation" }).getByText("Hello?")).toBeVisible();

    await gateway.asked;
    await page.clock.fastForward("00:16");

    await expect(
      page.getByRole("alert").filter({ hasText: "The call didn't connect" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Calling…")).toBeVisible();

    await page.getByRole("button", { exact: true, name: "End" }).click();
    await expect(page.getByRole("button", { name: "Start the call" })).toBeVisible();

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
