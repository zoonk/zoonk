import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { checkLevelTestQuestions } from "@zoonk/ai/tasks/language/check-level-test-questions";
import { generateLevelTestBankLevel } from "@zoonk/ai/tasks/language/level-test-bank";
import { LEVEL_TEST_LEVELS } from "@zoonk/ai/tasks/language/level-test-levels";
import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../_test-utils/blob-uploads";
import { useGuestOutOfHelp } from "../../_test-utils/guest-out-of-help";
import { checkLikeTheKeys, writtenLevel } from "../../_test-utils/level-test-bank";
import { mockSession } from "../../_test-utils/mock-session";
import * as speechClips from "../../audio/_utils/speech-clips";
import { requestSpeechClip } from "../../audio/request-speech-clip";
import { getSpeechClipKey } from "../../audio/speech-clip-key";
import { answerLanguageLevelTest } from "./answer-language-level-test";
import {
  checkLevelTestBankQuestions,
  claimLevelTestBankCheck,
  keepCheckedLevelTestQuestions,
  listOwedLevelTestBankChecks,
} from "./check-level-test-bank";
import { finishLanguageLevelTest } from "./finish-language-level-test";
import { getLanguageLevelTest } from "./get-language-level-test";
import { levelTestBankSchema } from "./level-test-contract";
import { prepareLanguageLevelTest } from "./prepare-language-level-test";
import { listLevelTestPassagesToVoice, voiceLevelTestPassage } from "./prepare-level-test-audio";
import {
  claimLevelTestBank,
  releaseLevelTestBankClaim,
  storeLevelTestBank,
  writeLevelTestBankLevel,
} from "./write-level-test-bank";

const TEST_LEVELS = LEVEL_TEST_LEVELS;

type Pair = { language: string; targetLanguage: string };

function voicedAudio(): Awaited<ReturnType<typeof generateLanguageAudio>> {
  return {
    data: {
      audio: new Uint8Array([1, 2, 3]),
      durationMs: 2400,
      format: "mp3",
      provenance: {
        ...writtenLevel({ level: "A1", passage: "voice" }).provenance,
        model: "test-voice",
      },
    },
    error: null,
  };
}

function mockAudio() {
  storeBlobUploads();
  vi.mocked(generateLanguageAudio).mockResolvedValue(voicedAudio());
}

function mockWriter(passage: string) {
  vi.mocked(generateLevelTestBankLevel).mockImplementation(async ({ level }) =>
    writtenLevel({ level, passage }),
  );
}

function pendingWriter() {
  const { promise, resolve } = Promise.withResolvers<string>();

  vi.mocked(generateLevelTestBankLevel).mockImplementation(async ({ level }) =>
    writtenLevel({ level, passage: await promise }),
  );

  return { finish: (passage: string) => resolve(passage) };
}

/** What the API's bank workflow runs, one capability per step. */
async function writeLevelTestBank({
  analytics,
  pair,
}: {
  analytics?: { distinctId?: string; goalId?: string };
  pair: Pair;
}) {
  const claim = await claimLevelTestBank(pair);

  if (claim.status !== "claimed") {
    return { status: claim.status };
  }

  try {
    const levels = await Promise.all(
      TEST_LEVELS.map(async (level) => {
        const written = await writeLevelTestBankLevel({ analytics, level, pair });

        const questions = await checkLevelTestBankQuestions({
          pair,
          questions: written.questions,
          wait: "soon",
        });

        return { ...written, questions };
      }),
    );

    return { status: await storeLevelTestBank({ claimId: claim.claimId, levels, pair }) };
  } catch (error) {
    await releaseLevelTestBankClaim({ claimId: claim.claimId, pair });
    throw error;
  }
}

/** A bank as the release before checks stored it: never checked. */
function uncheckedBank(passage: string) {
  const questions = TEST_LEVELS.flatMap((level) =>
    writtenLevel({ level, passage }).data.questions.map((question, index) => ({
      ...question,
      id: `${question.skill}-${level}-${index % 2}`,
    })),
  );

  return {
    questions,
    speaking: TEST_LEVELS.map((level) => writtenLevel({ level, passage }).data.speaking),
  };
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

function voiceBank(pair: Pair) {
  return listLevelTestPassagesToVoice(pair).then((passages) =>
    Promise.allSettled(
      passages.map((text) => voiceLevelTestPassage({ language: pair.targetLanguage, text })),
    ),
  );
}

async function answerFirstQuestion(goalId: string) {
  const view = await getLanguageLevelTest(goalId);

  const questionId =
    view.status === "ready" && view.test.status === "ready" && view.test.next.kind === "question"
      ? view.test.next.question.id
      : "";

  return answerLanguageLevelTest({
    goalId,
    input: { answerIndex: 0, durationMs: 30_000, questionId },
  });
}

function findRow(pair: Pair) {
  return prisma.languageLevelTest.findUniqueOrThrow({ where: { languagePair: pair } });
}

describe("the level test's question bank", () => {
  beforeEach(() => {
    vi.mocked(generateLevelTestBankLevel).mockReset();
  });

  it("is never written by showing the test, which says since when a run has been writing it", async () => {
    const { goalId, pair } = await learnerOfFreshPair();

    await expect(getLanguageLevelTest(goalId)).resolves.toStrictEqual({
      status: "ready",
      test: { expectedSeconds: 120, showAlphabetNote: true, startedAt: null, status: "preparing" },
    });

    await expect(prisma.languageLevelTest.count({ where: pair })).resolves.toBe(0);

    const writer = pendingWriter();
    const writing = writeLevelTestBank({ pair });

    await expect
      .poll(() => vi.mocked(generateLevelTestBankLevel).mock.calls.length)
      .toBe(TEST_LEVELS.length);

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { startedAt: expect.any(String), status: "preparing" },
    });

    writer.finish("Bank");
    await expect(writing).resolves.toStrictEqual({ status: "written" });

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { next: { kind: "question" }, status: "ready" },
    });

    await expect(findRow(pair)).resolves.toMatchObject({
      checkedAt: expect.any(Date),
      model: "anthropic/claude-fable-5.2",
      promptVersion: "test-prompt",
    });

    expect(generateLevelTestBankLevel).toHaveBeenCalledTimes(TEST_LEVELS.length);
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

    vi.mocked(generateLevelTestBankLevel).mockRejectedValue(new Error("Provider down"));
    await expect(writeLevelTestBank({ pair })).rejects.toThrow("Provider down");

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { startedAt: null, status: "preparing" },
    });

    const quiet = pendingWriter();
    void writeLevelTestBank({ pair });

    await expect
      .poll(() => vi.mocked(generateLevelTestBankLevel).mock.calls.length)
      .toBe(2 * TEST_LEVELS.length);

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
    vi.mocked(generateLevelTestBankLevel).mockReset();
  });

  it("writes it before the first learner opens the test, which then starts at once", async () => {
    const { goalId, pair } = await learnerOfFreshPair();
    mockWriter("Ahead");

    await expect(
      writeLevelTestBank({ analytics: { distinctId: "learner-id", goalId }, pair }),
    ).resolves.toStrictEqual({ status: "written" });

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { next: { question: { passage: "Ahead A2" } }, status: "ready" },
    });

    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "ready" });

    expect(vi.mocked(generateLevelTestBankLevel).mock.calls).toStrictEqual(
      TEST_LEVELS.map((level) => [
        {
          analytics: { contentScope: "shared", distinctId: "learner-id", goalId },
          learnerLanguage: pair.language,
          level,
          targetLanguage: pair.targetLanguage,
        },
      ]),
    );
  });

  it("leaves the pair to the run already writing it", async () => {
    const pair = freshPair();
    const writer = pendingWriter();
    const first = writeLevelTestBank({ pair });

    await expect
      .poll(() => vi.mocked(generateLevelTestBankLevel).mock.calls.length)
      .toBe(TEST_LEVELS.length);

    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "running" });

    writer.finish("First");
    await expect(first).resolves.toStrictEqual({ status: "written" });

    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "ready" });
    expect(generateLevelTestBankLevel).toHaveBeenCalledTimes(TEST_LEVELS.length);
  });

  it("gives its claim up when the writer fails, so a retry writes it", async () => {
    const pair = freshPair();
    vi.mocked(generateLevelTestBankLevel).mockRejectedValue(new Error("Provider down"));

    await expect(writeLevelTestBank({ pair })).rejects.toThrow("Provider down");

    mockWriter("Retry");

    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "written" });
  });

  it("drops a late write when a newer run took its claim over", async () => {
    const pair = freshPair();
    const late = pendingWriter();
    const first = writeLevelTestBank({ pair });

    await expect
      .poll(() => vi.mocked(generateLevelTestBankLevel).mock.calls.length)
      .toBe(TEST_LEVELS.length);

    await prisma.languageLevelTest.updateMany({
      data: { generatedAt: new Date(Date.now() - 3_600_000) },
      where: pair,
    });

    mockWriter("Current");
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
    mockWriter(passage);

    await writeLevelTestBank({ pair });
    await voiceBank(pair);

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

    await expect(listLevelTestPassagesToVoice(pair)).resolves.toStrictEqual([]);
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
    mockWriter(crypto.randomUUID());
    await writeLevelTestBank({ pair });
    const writing = voiceBank(pair);

    await expect.poll(() => vi.mocked(generateLanguageAudio).mock.calls.length).toBeGreaterThan(0);

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { status: "ready" },
    });

    await expect(
      answerLanguageLevelTest({ goalId, input: { answerIndex: 0, questionId: "reading-A2-0" } }),
    ).resolves.toMatchObject({ status: "ready" });

    audio.resolve(voiced);
    await writing;
  });

  it("says a listening question's audio is still being made, then gives the clip once it's voiced", async () => {
    const { goalId, pair } = await learnerOfFreshPair();
    const passage = crypto.randomUUID();
    mockWriter(passage);
    await writeLevelTestBank({ pair });

    await expect(answerFirstQuestion(goalId)).resolves.toMatchObject({
      test: { next: { question: { audio: null, audioPending: true, skill: "listening" } } },
    });

    await voiceBank(pair);

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: {
        next: {
          question: {
            audio: { url: expect.stringContaining("blob.test") },
            audioPending: false,
            skill: "listening",
          },
        },
      },
    });
  });

  it("doesn't keep the learner waiting for a clip the bank's run is no longer making", async () => {
    const { goalId, pair } = await learnerOfFreshPair();
    mockWriter(crypto.randomUUID());
    await writeLevelTestBank({ pair });

    await prisma.languageLevelTest.updateMany({
      data: { generatedAt: new Date(Date.now() - 3_600_000) },
      where: pair,
    });

    await expect(answerFirstQuestion(goalId)).resolves.toMatchObject({
      test: { next: { question: { audio: null, audioPending: false, skill: "listening" } } },
    });
  });

  it("lets an early listening tap join a long passage being prepared without another model call or AI help", async () => {
    const { pair, userId } = await learnerOfFreshPair();
    const passage = `Un messaggio lungo ${crypto.randomUUID()} `.repeat(20);
    const audio = Promise.withResolvers<Awaited<ReturnType<typeof generateLanguageAudio>>>();
    mockWriter(passage);
    vi.mocked(generateLanguageAudio).mockReturnValueOnce(audio.promise);
    await writeLevelTestBank({ pair });
    const preparing = voiceBank(pair);

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
    mockWriter(crypto.randomUUID());

    vi.mocked(generateLanguageAudio).mockResolvedValueOnce({
      data: null,
      error: new Error("Voice unavailable"),
    });

    await writeLevelTestBank({ pair });
    const voiced = await voiceBank(pair);

    expect(voiced.filter((clip) => clip.status === "rejected")).toStrictEqual([
      { reason: new Error("Could not voice a placement passage"), status: "rejected" },
    ]);

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { status: "ready" },
    });

    const failedRow = await findRow(pair);
    const questions = failedRow.content;
    await expect(listLevelTestPassagesToVoice(pair)).resolves.toHaveLength(1);
    await voiceBank(pair);
    const retriedRow = await findRow(pair);
    expect(retriedRow.content).toStrictEqual(questions);
    expect(generateLevelTestBankLevel).toHaveBeenCalledTimes(TEST_LEVELS.length);
    expect(generateLanguageAudio).toHaveBeenCalledTimes(TEST_LEVELS.length + 1);
  });

  it("prepares an existing text bank without rewriting it, including long advanced passages", async () => {
    const { goalId, pair } = await learnerOfFreshPair();
    const written = uncheckedBank(`Un messaggio lungo ${crypto.randomUUID()} `.repeat(20));

    const content = {
      ...written,
      questions: written.questions.map((question, index) => ({ ...question, id: `q${index}` })),
    };

    await prisma.languageLevelTest.create({
      data: { ...pair, content, model: "test", promptVersion: "test", runId: "old-bank" },
    });

    await expect(prepareLanguageLevelTest(goalId)).resolves.toMatchObject({ status: "ready" });

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { status: "ready" },
    });

    expect(generateLanguageAudio).not.toHaveBeenCalled();
    await voiceBank(pair);
    expect(generateLevelTestBankLevel).not.toHaveBeenCalled();
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
    mockWriter(crypto.randomUUID());

    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "written" });
    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "ready" });
    await expect(listLevelTestPassagesToVoice(pair)).resolves.toStrictEqual([]);
  });
});

describe("checking a bank's questions", () => {
  beforeEach(() => {
    vi.mocked(generateLevelTestBankLevel).mockReset();
  });

  it("stores only the questions that pass, each keeping an id by its skill and level", async () => {
    const pair = freshPair();
    mockWriter("Checked");

    vi.mocked(checkLevelTestQuestions).mockImplementation(async (params) => {
      const result = await checkLikeTheKeys(params);
      const [first, ...rest] = result.data.checks;

      return params.questions[0]?.passage === "Checked B2" && first
        ? { ...result, data: { checks: [{ ...first, literal: true }, ...rest] } }
        : result;
    });

    await expect(writeLevelTestBank({ pair })).resolves.toStrictEqual({ status: "written" });

    const row = await findRow(pair);
    const ids = levelTestBankSchema.parse(row.content).questions.map((question) => question.id);

    expect(ids).toHaveLength(4 * TEST_LEVELS.length - 1);
    expect(ids.filter((id) => id.startsWith("reading-B2"))).toStrictEqual(["reading-B2-0"]);

    expect(vi.mocked(checkLevelTestQuestions).mock.calls.map(([input]) => input)).toContainEqual(
      expect.objectContaining({
        learnerLanguage: pair.language,
        targetLanguage: pair.targetLanguage,
      }),
    );

    await expect(listOwedLevelTestBankChecks()).resolves.not.toContainEqual(pair);
  });

  it("checks a bank stored before questions were checked once, and the test asks another question in place of a removed one", async () => {
    const { goalId, pair } = await learnerOfFreshPair();
    const content = uncheckedBank(crypto.randomUUID());

    await prisma.languageLevelTest.create({
      data: { ...pair, content, model: "test", promptVersion: "test", runId: "old-bank" },
    });

    const answered = await answerFirstQuestion(goalId);
    const firstId = content.questions.find((question) => question.passage.endsWith("A2"))?.id;
    expect(answered).toMatchObject({ status: "ready" });

    await expect(listOwedLevelTestBankChecks()).resolves.toContainEqual(pair);

    const questions = await claimLevelTestBankCheck(pair);
    await expect(claimLevelTestBankCheck(pair)).resolves.toBeNull();
    await expect(listOwedLevelTestBankChecks()).resolves.not.toContainEqual(pair);

    const keptIds = (questions ?? []).flatMap((question) =>
      question.id === firstId ? [] : [question.id],
    );

    await expect(keepCheckedLevelTestQuestions({ keptIds, pair })).resolves.toStrictEqual({
      removed: 1,
    });

    await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
      test: { next: { kind: "question" }, status: "ready" },
    });

    const row = await findRow(pair);
    const stored = levelTestBankSchema.parse(row.content).questions.map((question) => question.id);
    expect(stored).toStrictEqual(keptIds);

    await expect(finishLanguageLevelTest(goalId)).resolves.toMatchObject({ status: "ready" });

    await expect(
      prisma.learningEvent.findFirst({ where: { goalId, lessonKind: "levelTest" } }),
    ).resolves.toMatchObject({ correctAnswers: 0, incorrectAnswers: 0, seconds: 30 });
  });

  it.each([
    { saved: "its scores" },
    { saved: "only its labels, as tests finished before scores were saved" },
  ])(
    "keeps the levels and placement of a test that saved $saved when the check later removes an answered question",
    async ({ saved }) => {
      const { goalId, pair } = await learnerOfFreshPair();
      const content = uncheckedBank(crypto.randomUUID());

      await prisma.languageLevelTest.create({
        data: { ...pair, content, model: "test", promptVersion: "test", runId: "old-bank" },
      });

      await answerFirstQuestion(goalId);
      const finished = await finishLanguageLevelTest(goalId);

      if (saved !== "its scores") {
        await prisma.$executeRaw`
        UPDATE goals SET details = details #- '{levelTest,scores}' WHERE id = ${goalId}::uuid
      `;
      }

      const placedGoal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
      const firstId = content.questions.find((question) => question.passage.endsWith("A2"))?.id;
      const questions = await claimLevelTestBankCheck(pair);

      const keptIds = (questions ?? []).flatMap((question) =>
        question.id === firstId ? [] : [question.id],
      );

      await keepCheckedLevelTestQuestions({ keptIds, pair });

      await expect(finishLanguageLevelTest(goalId)).resolves.toStrictEqual(finished);

      await expect(prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).resolves.toMatchObject(
        { details: placedGoal.details },
      );

      await expect(getLanguageLevelTest(goalId)).resolves.toMatchObject({
        test: {
          levels: finished.status === "ready" ? finished.levels : [],
          next: { kind: "done" },
        },
      });
    },
  );

  it("moves a learner on when the check removes the question on their screen", async () => {
    const { goalId, pair } = await learnerOfFreshPair();

    await prisma.languageLevelTest.create({
      data: {
        ...pair,
        content: uncheckedBank(crypto.randomUUID()),
        model: "test",
        promptVersion: "test",
        runId: "old-bank",
      },
    });

    const shown = await getLanguageLevelTest(goalId);

    const shownId =
      shown.status === "ready" &&
      shown.test.status === "ready" &&
      shown.test.next.kind === "question"
        ? shown.test.next.question.id
        : "";

    const questions = await claimLevelTestBankCheck(pair);

    const keptIds = (questions ?? []).flatMap((question) =>
      question.id === shownId ? [] : [question.id],
    );

    await keepCheckedLevelTestQuestions({ keptIds, pair });

    const answered = await answerLanguageLevelTest({
      goalId,
      input: { answerIndex: 0, questionId: shownId },
    });

    expect(answered).toMatchObject({
      status: "ready",
      test: { answered: 0, next: { kind: "question" }, status: "ready" },
    });

    expect(
      answered.status === "ready" &&
        answered.test.status === "ready" &&
        answered.test.next.kind === "question" &&
        answered.test.next.question.id,
    ).not.toBe(shownId);
  });

  it("leaves a stored bank as it was when every question fails, since the check misfired", async () => {
    const pair = freshPair();
    const content = uncheckedBank(crypto.randomUUID());

    await prisma.languageLevelTest.create({
      data: { ...pair, content, model: "test", promptVersion: "test", runId: "old-bank" },
    });

    await expect(claimLevelTestBankCheck(pair)).resolves.toHaveLength(4 * TEST_LEVELS.length);

    await expect(keepCheckedLevelTestQuestions({ keptIds: [], pair })).resolves.toStrictEqual({
      removed: 0,
    });

    await expect(findRow(pair)).resolves.toMatchObject({ content, model: "test" });
  });
});
