import { put } from "@vercel/blob";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { checkLevelTestQuestions } from "@zoonk/ai/tasks/language/check-level-test-questions";
import { generateLevelTestBankLevel } from "@zoonk/ai/tasks/language/level-test-bank";
import { LEVEL_TEST_LEVELS } from "@zoonk/ai/tasks/language/level-test-levels";
import { prisma } from "@zoonk/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { writtenLevel } from "../_test-utils/level-test-bank";
import { getStreamedEvents } from "../_test-utils/parse-stream-events";
import { levelTestBankWorkflow } from "./level-test-bank-workflow";

const TEST_LEVELS = LEVEL_TEST_LEVELS;

function mockWriter(passage: string) {
  vi.mocked(generateLevelTestBankLevel).mockImplementation(async ({ level }) =>
    writtenLevel({ level, passage }),
  );
}

function voicedAudio(): Awaited<ReturnType<typeof generateLanguageAudio>> {
  return {
    data: {
      audio: new Uint8Array([1, 2, 3]),
      durationMs: 2400,
      format: "mp3",
      provenance: writtenLevel({ level: "A1", passage: "voice" }).provenance,
    },
    error: null,
  };
}

function freshPair() {
  return { language: `x${crypto.randomUUID().slice(0, 8)}`, targetLanguage: "ja" };
}

function streamedSteps() {
  return getStreamedEvents().map((event) => `${String(event.step)}:${String(event.status)}`);
}

describe(levelTestBankWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generateLevelTestBankLevel).mockReset();

    vi.mocked(generateLanguageAudio).mockResolvedValue(voicedAudio());

    vi.mocked(put).mockImplementation(async (pathname) => ({
      contentDisposition: "inline",
      contentType: "audio/mpeg",
      downloadUrl: `https://blob.test/${pathname}`,
      etag: "",
      pathname,
      url: `https://blob.test/${pathname}`,
    }));
  });

  it("writes the pair's questions once, saying so on its stream", async () => {
    const pair = freshPair();
    mockWriter("Bank");

    await expect(
      levelTestBankWorkflow({ analytics: { distinctId: "learner-id", goalId: "goal-id" }, pair }),
    ).resolves.toStrictEqual({ status: "written" });

    const writes = vi.mocked(generateLevelTestBankLevel).mock.calls.map(([input]) => input);
    expect(writes.map((input) => input.level)).toStrictEqual([...TEST_LEVELS]);

    expect(
      writes.every(
        ({ analytics, learnerLanguage, targetLanguage }) =>
          analytics?.distinctId === "learner-id" &&
          analytics.goalId === "goal-id" &&
          learnerLanguage === pair.language &&
          targetLanguage === "ja",
      ),
    ).toBe(true);

    expect(
      vi
        .mocked(checkLevelTestQuestions)
        .mock.calls.map(([input]) => new Set(input.questions.map((question) => question.passage))),
    ).toStrictEqual(TEST_LEVELS.map((level) => new Set([`Bank ${level}`])));

    expect(streamedSteps()).toStrictEqual([
      "writeLevelTestBank:started",
      "levelTestBankReady:completed",
    ]);

    await expect(levelTestBankWorkflow({ pair })).resolves.toStrictEqual({ status: "ready" });
    expect(generateLevelTestBankLevel).toHaveBeenCalledTimes(TEST_LEVELS.length);
  });

  it("announces the test is ready while its listening clips are still being prepared", async () => {
    const pair = freshPair();
    const audio = Promise.withResolvers<Awaited<ReturnType<typeof generateLanguageAudio>>>();

    mockWriter(crypto.randomUUID());
    vi.mocked(generateLanguageAudio).mockReturnValue(audio.promise);
    const writing = levelTestBankWorkflow({ pair });

    await expect
      .poll(() => vi.mocked(generateLanguageAudio).mock.calls.length)
      .toBe(TEST_LEVELS.length);

    expect(streamedSteps()).toStrictEqual([
      "writeLevelTestBank:started",
      "levelTestBankReady:completed",
    ]);

    audio.resolve(voicedAudio());
    await expect(writing).resolves.toStrictEqual({ status: "written" });
  });

  it("finishes with its questions ready when no clip can be voiced", async () => {
    const pair = freshPair();
    mockWriter(crypto.randomUUID());

    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: null,
      error: new Error("Voice unavailable"),
    });

    await expect(levelTestBankWorkflow({ pair })).resolves.toStrictEqual({ status: "written" });

    expect(streamedSteps()).toStrictEqual([
      "writeLevelTestBank:started",
      "levelTestBankReady:completed",
    ]);

    expect(generateLevelTestBankLevel).toHaveBeenCalledTimes(TEST_LEVELS.length);
  });

  it("keeps the clips that were voiced when another one fails, and voices only the missing one on the pair's next run", async () => {
    const pair = freshPair();
    const passage = crypto.randomUUID();
    mockWriter(passage);
    const failing = `${passage} B1`;

    vi.mocked(generateLanguageAudio).mockImplementation(async ({ text }) =>
      text === failing ? { data: null, error: new Error("Voice unavailable") } : voicedAudio(),
    );

    await expect(levelTestBankWorkflow({ pair })).resolves.toStrictEqual({ status: "written" });

    const clips = await prisma.mediaAsset.findMany({
      orderBy: { prompt: "asc" },
      select: { prompt: true },
      where: { prompt: { startsWith: passage } },
    });

    expect(clips.map((clip) => clip.prompt)).toStrictEqual(
      TEST_LEVELS.map((level) => `${passage} ${level}`).filter((text) => text !== failing),
    );

    vi.mocked(generateLanguageAudio).mockClear();
    await expect(levelTestBankWorkflow({ pair })).resolves.toStrictEqual({ status: "ready" });

    expect(vi.mocked(generateLanguageAudio).mock.calls.map(([input]) => input.text)).toStrictEqual([
      failing,
    ]);
  });

  it("waits for another writer's questions instead of writing them twice", async () => {
    const pair = freshPair();

    await prisma.languageLevelTest.create({
      data: {
        ...pair,
        content: {},
        generatedAt: new Date(),
        model: "",
        promptVersion: "",
        runId: "other",
      },
    });

    vi.mocked(sleep).mockImplementationOnce(async () => {
      const levels = TEST_LEVELS.map((level) => writtenLevel({ level, passage: "Other" }));

      await prisma.languageLevelTest.updateMany({
        data: {
          content: {
            questions: levels
              .flatMap(({ data }) => data.questions)
              .map((question, index) => ({ ...question, id: `q${index}` })),
            speaking: levels.map(({ data }) => data.speaking),
          },
          model: "anthropic/claude-fable-5.2",
        },
        where: pair,
      });
    });

    await expect(levelTestBankWorkflow({ pair })).resolves.toStrictEqual({ status: "ready" });

    expect(generateLevelTestBankLevel).not.toHaveBeenCalled();
    expect(streamedSteps().at(-1)).toBe("levelTestBankReady:completed");
  });

  it("reports a writer that failed, giving the pair's claim up so the level test can start it again", async () => {
    const pair = freshPair();
    vi.mocked(generateLevelTestBankLevel).mockRejectedValue(new Error("Provider down"));

    await expect(levelTestBankWorkflow({ pair })).rejects.toThrow("Provider down");

    expect(getStreamedEvents().at(-1)).toMatchObject({
      reason: "aiGenerationFailed",
      status: "error",
      step: "workflowError",
    });

    const row = await prisma.languageLevelTest.findUniqueOrThrow({ where: { languagePair: pair } });
    expect(row.generatedAt.getTime()).toBe(0);
  });
});
