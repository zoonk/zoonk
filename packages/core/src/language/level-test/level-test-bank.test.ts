import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { generateLevelTestBank } from "@zoonk/ai/tasks/v2/language/level-test-bank";
import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../_test-utils/blob-uploads";
import { useGuestOutOfHelp } from "../../_test-utils/guest-out-of-help";
import { mockSession } from "../../_test-utils/mock-session";
import * as speechClips from "../../audio/_utils/speech-clips";
import { requestSpeechClip } from "../../audio/request-speech-clip";
import { getSpeechClipKey } from "../../audio/speech-clip-key";
import { answerLanguageLevelTest } from "./answer-language-level-test";
import { getLanguageLevelTest } from "./get-language-level-test";
import { prepareLanguageLevelTest } from "./prepare-language-level-test";
import { prepareLevelTestBankAudio } from "./prepare-level-test-audio";
import { writeLevelTestBank } from "./write-level-test-bank";

const TEST_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

type Written = Awaited<ReturnType<typeof generateLevelTestBank>>;

function voicedAudio(): Awaited<ReturnType<typeof generateLanguageAudio>> {
  return {
    data: {
      audio: new Uint8Array([1, 2, 3]),
      durationMs: 2400,
      format: "mp3",
      provenance: { ...bankFrom("voice").provenance, model: "test-voice" },
    },
    error: null,
  };
}

function mockAudio() {
  storeBlobUploads();
  vi.mocked(generateLanguageAudio).mockResolvedValue(voicedAudio());
}

function bankFrom(passage: string): Written {
  return {
    data: {
      questions: TEST_LEVELS.flatMap((level) =>
        (["reading", "listening"] as const).flatMap((skill) =>
          [0, 1].map(() => ({
            answerIndex: 0,
            level,
            options: ["a", "b", "c", "d"],
            passage: `${passage} ${level}`,
            question: "O que diz?",
            skill,
          })),
        ),
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

function pendingWriter() {
  const { promise, resolve } = Promise.withResolvers<Written>();
  vi.mocked(generateLevelTestBank).mockReturnValueOnce(promise);
  return { finish: (passage: string) => resolve(bankFrom(passage)) };
}

function freshPair() {
  return { language: `x${crypto.randomUUID().slice(0, 8)}`, targetLanguage: "ja" };
}

async function learnerOfFreshPair() {
  const pair = freshPair();
  const setup = await languageGoalFixture();

  await prisma.goal.update({ data: pair, where: { id: setup.goal.id } });
  mockSession(setup.user.id);

  return { goalId: setup.goal.id, pair, userId: setup.user.id };
}

function findRow(pair: { language: string; targetLanguage: string }) {
  return prisma.languageLevelTest.findUniqueOrThrow({ where: { languagePair: pair } });
}

describe("the level test's question bank", () => {
  beforeEach(() => {
    vi.mocked(generateLevelTestBank).mockClear();
  });

  it("is never written by showing the test, which says since when a run has been writing it", async () => {
    const { goalId, pair } = await learnerOfFreshPair();

    await expect(getLanguageLevelTest(goalId)).resolves.toStrictEqual({
      status: "ready",
      test: { expectedSeconds: 120, startedAt: null, status: "preparing" },
    });

    await expect(prisma.languageLevelTest.count({ where: pair })).resolves.toBe(0);

    const writer = pendingWriter();
    const writing = writeLevelTestBank({ pair });

    await expect.poll(() => vi.mocked(generateLevelTestBank).mock.calls.length).toBe(1);

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { startedAt: expect.any(String), status: "preparing" },
    });

    writer.finish("Bank");
    await expect(writing).resolves.toStrictEqual({ status: "written" });

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { next: { kind: "question" }, status: "ready" },
    });

    await expect(findRow(pair)).resolves.toMatchObject({
      model: "anthropic/claude-opus-5.5",
      promptVersion: "test-prompt",
    });

    expect(generateLevelTestBank).toHaveBeenCalledOnce();
  });

  it("isn't started by an answer", async () => {
    const { goalId, pair } = await learnerOfFreshPair();

    await expect(
      answerLanguageLevelTest({ goalId, input: { answerIndex: 0, questionId: "reading-A2-0" } }),
    ).resolves.toStrictEqual({ status: "notReady" });

    await expect(prisma.languageLevelTest.count({ where: pair })).resolves.toBe(0);
  });

  it("reads a run that went quiet or failed as nothing writing it, so the app starts one", async () => {
    const { goalId, pair } = await learnerOfFreshPair();

    vi.mocked(generateLevelTestBank).mockRejectedValueOnce(new Error("Provider down"));
    await expect(writeLevelTestBank({ pair })).rejects.toThrow("Provider down");

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { startedAt: null, status: "preparing" },
    });

    const quiet = pendingWriter();
    void writeLevelTestBank({ pair });
    await expect.poll(() => vi.mocked(generateLevelTestBank).mock.calls.length).toBe(2);

    await prisma.languageLevelTest.updateMany({
      data: { generatedAt: new Date(Date.now() - 3_600_000) },
      where: pair,
    });

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { startedAt: null, status: "preparing" },
    });

    quiet.finish("Late");
  });
});

describe("writing a pair's question bank ahead", () => {
  beforeEach(() => {
    vi.mocked(generateLevelTestBank).mockClear();
  });

  it("writes it before the first learner opens the test, which then starts at once", async () => {
    const { goalId, pair } = await learnerOfFreshPair();
    vi.mocked(generateLevelTestBank).mockResolvedValueOnce(bankFrom("Ahead"));

    await expect(
      writeLevelTestBank({ analytics: { distinctId: "learner-id", goalId }, pair }),
    ).resolves.toStrictEqual({ status: "written" });

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { next: { question: { passage: "Ahead A2" } }, status: "ready" },
    });

    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "ready" });

    expect(generateLevelTestBank).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        analytics: { contentScope: "shared", distinctId: "learner-id", goalId },
        learnerLanguage: pair.language,
        targetLanguage: pair.targetLanguage,
      }),
    );
  });

  it("leaves the pair to the run already writing it", async () => {
    const pair = freshPair();
    const writer = pendingWriter();
    const first = writeLevelTestBank({ pair });

    await expect.poll(() => vi.mocked(generateLevelTestBank).mock.calls.length).toBe(1);
    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "running" });

    writer.finish("First");
    await expect(first).resolves.toStrictEqual({ status: "written" });

    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "ready" });
    expect(generateLevelTestBank).toHaveBeenCalledOnce();
  });

  it("gives its claim up when the writer fails, so a retry writes it", async () => {
    const pair = freshPair();
    vi.mocked(generateLevelTestBank).mockRejectedValueOnce(new Error("Provider down"));

    await expect(writeLevelTestBank({ pair })).rejects.toThrow("Provider down");

    vi.mocked(generateLevelTestBank).mockResolvedValueOnce(bankFrom("Retry"));

    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "written" });
  });

  it("drops a late write when a newer run took its claim over", async () => {
    const pair = freshPair();
    const late = pendingWriter();
    const first = writeLevelTestBank({ pair });

    await expect.poll(() => vi.mocked(generateLevelTestBank).mock.calls.length).toBe(1);

    await prisma.languageLevelTest.updateMany({
      data: { generatedAt: new Date(Date.now() - 3_600_000) },
      where: pair,
    });

    vi.mocked(generateLevelTestBank).mockResolvedValueOnce(bankFrom("Current"));
    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "written" });

    late.finish("Late");
    await expect(first).resolves.toStrictEqual({ status: "lost" });

    const row = await findRow(pair);
    expect(JSON.stringify(row.content)).toContain("Current A1");
    expect(JSON.stringify(row.content)).not.toContain("Late");
  });
});

describe("placement listening audio", () => {
  beforeEach(mockAudio);

  it("prepares listening passages in parallel and reuses them for playback without AI help", async () => {
    const { goalId, pair, userId } = await learnerOfFreshPair();
    const passage = crypto.randomUUID();
    vi.mocked(generateLevelTestBank).mockResolvedValueOnce(bankFrom(passage));

    await writeLevelTestBank({ pair });
    await prepareLevelTestBankAudio({ pair });

    expect(generateLanguageAudio).toHaveBeenCalledTimes(TEST_LEVELS.length);

    await Promise.all(
      TEST_LEVELS.map((level) =>
        expect(
          prisma.mediaAsset.findUnique({
            where: {
              reuseKey: getSpeechClipKey({
                language: pair.targetLanguage,
                text: `${passage} ${level}`,
              }),
            },
          }),
        ).resolves.toMatchObject({ kind: "audio", ownerId: null, visibility: "public" }),
      ),
    );

    await useGuestOutOfHelp();

    await expect(
      requestSpeechClip({ language: pair.targetLanguage, text: `${passage} A2` }),
    ).resolves.toMatchObject({ status: "ready" });

    expect(generateLanguageAudio).toHaveBeenCalledTimes(TEST_LEVELS.length);

    await prepareLevelTestBankAudio({ pair });
    expect(generateLanguageAudio).toHaveBeenCalledTimes(TEST_LEVELS.length);
    mockSession(userId);

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { status: "ready" },
    });
  });

  it("lets the learner start and answer while audio is still being generated", async () => {
    const { goalId, pair } = await learnerOfFreshPair();
    const audio = Promise.withResolvers<Awaited<ReturnType<typeof generateLanguageAudio>>>();
    const voiced = voicedAudio();
    vi.mocked(generateLanguageAudio).mockClear().mockReturnValueOnce(audio.promise);
    vi.mocked(generateLevelTestBank).mockResolvedValueOnce(bankFrom(crypto.randomUUID()));
    await writeLevelTestBank({ pair });
    const writing = prepareLevelTestBankAudio({ pair });

    await expect.poll(() => vi.mocked(generateLanguageAudio).mock.calls.length).toBeGreaterThan(0);

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { status: "ready" },
    });

    await expect(
      answerLanguageLevelTest({ goalId, input: { answerIndex: 0, questionId: "reading-A2-0" } }),
    ).resolves.toMatchObject({ status: "ready" });

    audio.resolve(voiced);
    await expect(writing).resolves.toBeUndefined();
  });

  it("lets an early listening tap join a long passage being prepared without another model call or AI help", async () => {
    const { pair, userId } = await learnerOfFreshPair();
    const passage = `Un messaggio lungo ${crypto.randomUUID()} `.repeat(20);
    const audio = Promise.withResolvers<Awaited<ReturnType<typeof generateLanguageAudio>>>();
    vi.mocked(generateLevelTestBank).mockResolvedValueOnce(bankFrom(passage));
    vi.mocked(generateLanguageAudio).mockReturnValueOnce(audio.promise);
    await writeLevelTestBank({ pair });
    const preparing = prepareLevelTestBankAudio({ pair });

    await expect
      .poll(() => vi.mocked(generateLanguageAudio).mock.calls.length)
      .toBe(TEST_LEVELS.length);

    const pendingRead = vi.spyOn(speechClips, "getPendingSpeechClip");
    const playing = requestSpeechClip({ language: pair.targetLanguage, text: `${passage} A1` });
    await expect.poll(() => pendingRead.mock.calls.length).toBe(1);

    audio.resolve(voicedAudio());
    await preparing;
    await expect(playing).resolves.toMatchObject({ status: "ready" });
    expect(generateLanguageAudio).toHaveBeenCalledTimes(TEST_LEVELS.length);
    await expect(prisma.usageRecord.count({ where: { kind: "assist", userId } })).resolves.toBe(0);
    pendingRead.mockRestore();
  });

  it("keeps the test usable if a clip fails and retries only the missing audio", async () => {
    const { goalId, pair } = await learnerOfFreshPair();
    vi.mocked(generateLevelTestBank).mockResolvedValueOnce(bankFrom(crypto.randomUUID()));

    vi.mocked(generateLanguageAudio).mockResolvedValueOnce({
      data: null,
      error: new Error("Voice unavailable"),
    });

    await writeLevelTestBank({ pair });
    await expect(prepareLevelTestBankAudio({ pair })).rejects.toThrow("placement audio");

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { status: "ready" },
    });

    const failedRow = await findRow(pair);
    const questions = failedRow.content;
    await expect(prepareLevelTestBankAudio({ pair })).resolves.toBeUndefined();
    const retriedRow = await findRow(pair);
    expect(retriedRow.content).toStrictEqual(questions);
    expect(generateLevelTestBank).toHaveBeenCalledOnce();
    expect(generateLanguageAudio).toHaveBeenCalledTimes(TEST_LEVELS.length + 1);
  });

  it("prepares an existing text bank without rewriting it, including long advanced passages", async () => {
    const { goalId, pair } = await learnerOfFreshPair();
    const written = bankFrom(`Un messaggio lungo ${crypto.randomUUID()} `.repeat(20));

    const content = {
      ...written.data,
      questions: written.data.questions.map((question, index) => ({
        ...question,
        id: `q${index}`,
      })),
    };

    await prisma.languageLevelTest.create({
      data: { ...pair, content, model: "test", promptVersion: "test", runId: "old-bank" },
    });

    await expect(prepareLanguageLevelTest(goalId)).resolves.toMatchObject({ status: "ready" });

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { status: "ready" },
    });

    expect(generateLanguageAudio).not.toHaveBeenCalled();
    await expect(prepareLevelTestBankAudio({ pair })).resolves.toBeUndefined();
    expect(generateLevelTestBank).not.toHaveBeenCalled();
    const preparedRow = await findRow(pair);
    expect(preparedRow.content).toStrictEqual(content);
    await expect(prepareLanguageLevelTest(goalId)).resolves.toMatchObject({ status: "ready" });

    await expect(
      requestSpeechClip({
        language: pair.targetLanguage,
        text: content.questions[0]?.passage ?? "",
      }),
    ).resolves.toMatchObject({ status: "ready" });

    expect(generateLanguageAudio).toHaveBeenCalledTimes(TEST_LEVELS.length);
  });

  it("keeps languages without a voice available as text", async () => {
    const pair = { ...freshPair(), targetLanguage: "xx" };
    vi.mocked(generateLevelTestBank).mockResolvedValueOnce(bankFrom(crypto.randomUUID()));

    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "written" });
    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "ready" });
    await expect(prepareLevelTestBankAudio({ pair })).resolves.toBeUndefined();
    expect(generateLanguageAudio).not.toHaveBeenCalled();
  });
});
