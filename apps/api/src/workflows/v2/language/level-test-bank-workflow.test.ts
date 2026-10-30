import { put } from "@vercel/blob";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { generateLevelTestBank } from "@zoonk/ai/tasks/v2/language/level-test-bank";
import { prisma } from "@zoonk/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHook, sleep } from "workflow";
import { mockHookConflict } from "../../../../mocks/workflow";
import { getStreamedEvents } from "../../_test-utils/parse-stream-events";
import { levelTestBankWorkflow } from "./level-test-bank-workflow";

const TEST_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

type Written = Awaited<ReturnType<typeof generateLevelTestBank>>;

function bankFrom(passage: string): Written {
  return {
    data: {
      questions: TEST_LEVELS.flatMap((level) =>
        (["reading", "listening"] as const).map((skill) => ({
          answerIndex: 0,
          level,
          options: ["a", "b", "c", "d"],
          passage: `${passage} ${level}`,
          question: "O que diz?",
          skill,
        })),
      ),
      speaking: TEST_LEVELS.map((level) => ({
        level,
        sentence: `Say ${level}`,
        translation: "Diga",
      })),
    },
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "anthropic/claude-opus-5.5",
      promptVersion: "test-prompt",
      provider: "anthropic",
      requestedModel: "anthropic/claude-opus-5.5",
      runId: crypto.randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  };
}

function voicedAudio(): Awaited<ReturnType<typeof generateLanguageAudio>> {
  return {
    data: {
      audio: new Uint8Array([1, 2, 3]),
      durationMs: 2400,
      format: "mp3",
      provenance: bankFrom("voice").provenance,
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
    vi.mocked(generateLevelTestBank).mockReset();

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
    vi.mocked(generateLevelTestBank).mockResolvedValue(bankFrom("Bank"));

    await expect(
      levelTestBankWorkflow({ analytics: { distinctId: "learner-id", goalId: "goal-id" }, pair }),
    ).resolves.toStrictEqual({ status: "written" });

    expect(vi.mocked(createHook)).toHaveBeenCalledWith({
      token: `level-test-bank:${pair.language}:ja`,
    });

    expect(generateLevelTestBank).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        analytics: expect.objectContaining({ distinctId: "learner-id", goalId: "goal-id" }),
        learnerLanguage: pair.language,
        targetLanguage: "ja",
      }),
    );

    expect(streamedSteps()).toStrictEqual([
      "writeLevelTestBank:started",
      "levelTestBankReady:completed",
    ]);

    await expect(levelTestBankWorkflow({ pair })).resolves.toStrictEqual({ status: "ready" });
    expect(generateLevelTestBank).toHaveBeenCalledOnce();
  });

  it("announces the test is ready while its listening clips are still being prepared", async () => {
    const pair = freshPair();
    const audio = Promise.withResolvers<Awaited<ReturnType<typeof generateLanguageAudio>>>();

    vi.mocked(generateLevelTestBank).mockResolvedValue(bankFrom(crypto.randomUUID()));
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
    vi.mocked(generateLevelTestBank).mockResolvedValue(bankFrom(crypto.randomUUID()));

    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: null,
      error: new Error("Voice unavailable"),
    });

    await expect(levelTestBankWorkflow({ pair })).resolves.toStrictEqual({ status: "written" });

    expect(streamedSteps()).toStrictEqual([
      "writeLevelTestBank:started",
      "levelTestBankReady:completed",
    ]);

    expect(generateLevelTestBank).toHaveBeenCalledOnce();
  });

  it("keeps the clips that were voiced when another one fails, and voices only the missing one on the pair's next run", async () => {
    const pair = freshPair();
    const passage = crypto.randomUUID();
    vi.mocked(generateLevelTestBank).mockResolvedValue(bankFrom(passage));
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

  it("joins the run already writing the pair", async () => {
    mockHookConflict({ returnValue: Promise.resolve(null), runId: "writing-run" });

    await expect(levelTestBankWorkflow({ pair: freshPair() })).resolves.toStrictEqual({
      status: "joined",
    });

    expect(generateLevelTestBank).not.toHaveBeenCalled();

    expect(getStreamedEvents()).toStrictEqual([
      { entityId: "writing-run", status: "started", step: "joinLevelTestBank" },
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
      const { data, provenance } = bankFrom("Other");

      await prisma.languageLevelTest.updateMany({
        data: {
          content: {
            questions: data.questions.map((question, index) => ({ ...question, id: `q${index}` })),
            speaking: data.speaking,
          },
          model: provenance.model,
        },
        where: pair,
      });
    });

    await expect(levelTestBankWorkflow({ pair })).resolves.toStrictEqual({ status: "ready" });

    expect(generateLevelTestBank).not.toHaveBeenCalled();
    expect(streamedSteps().at(-1)).toBe("levelTestBankReady:completed");
  });

  it("reports a writer that failed, giving the pair's claim up so the level test can start it again", async () => {
    const pair = freshPair();
    vi.mocked(generateLevelTestBank).mockRejectedValue(new Error("Provider down"));

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
