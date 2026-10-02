import { assessPronunciation } from "@zoonk/ai/tasks/v2/language/assess-pronunciation";
import { transcribeSpeech } from "@zoonk/ai/tasks/v2/language/transcribe-speech";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { pronunciationReviewFixture } from "@zoonk/testing/fixtures/pronunciation-reviews";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { describe, expect, it, vi } from "vitest";
import { GUEST_OUT_OF_HELP } from "../../_test-utils/guest-out-of-help";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { getUsageRule } from "../../entitlements/limits";
import { getLanguageTodayView } from "../../view-models/language/get-language-today-view";
import { answerPronunciationReview } from "./answer-pronunciation-review";
import { finishPronunciationRound } from "./finish-pronunciation-round";
import { getPronunciationReviews } from "./get-pronunciation-reviews";
import { schedulePronunciationReviews } from "./schedule-pronunciation-reviews";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(async () => false),
}));

// The audio model that judges a word, and the transcription it falls back to, are paid external services.
vi.mock("@zoonk/ai/tasks/v2/language/assess-pronunciation", () => ({
  assessPronunciation: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/language/transcribe-speech", () => ({ transcribeSpeech: vi.fn() }));

const AUDIO = { bytes: new Uint8Array([1, 2, 3]), mediaType: "audio/webm;codecs=opus" };
const TIME_ZONE = "America/Sao_Paulo";
const DAY_MS = 86_400_000;

function mockHeard({ heard, word }: { heard: string; word: string }) {
  const isCorrect = heard === word;

  vi.mocked(assessPronunciation).mockResolvedValueOnce({
    data: {
      transcript: heard,
      words: [
        {
          heard: isCorrect ? null : heard,
          issue: isCorrect ? null : "sound",
          status: isCorrect ? "correct" : "different",
          text: word,
        },
      ],
    },
  } as Awaited<ReturnType<typeof assessPronunciation>>);
}

async function learnerWithWord(text = `rent${crypto.randomUUID().slice(0, 8)}`) {
  const [{ goal, user }, organization] = await Promise.all([
    languageGoalFixture(),
    aiOrganizationFixture(),
  ]);

  const word = await wordFixture({
    audioUrl: `https://audio.test/${text}.mp3`,
    organizationId: organization.id,
    targetLanguage: "en",
    word: text,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);

  return { goal, user, word };
}

describe(schedulePronunciationReviews, () => {
  it("brings mispronounced words back tomorrow, restarting a word already under review", async () => {
    const { user, word } = await learnerWithWord();
    const newWord = `deposit${crypto.randomUUID().slice(0, 8)}`;

    await pronunciationReviewFixture({ stage: 2, userId: user.id, wordId: word.id });

    vi.useFakeTimers({ now: new Date("2026-09-28T00:30:00.000Z"), toFake: ["Date"] });

    const ids = await schedulePronunciationReviews({
      targetLanguage: "en",
      timeZone: TIME_ZONE,
      userId: user.id,
      userLanguage: "pt",
      words: [`${word.word.toUpperCase()}?`, `${newWord},`],
    });

    vi.useRealTimers();

    const reviews = await prisma.pronunciationReview.findMany({
      include: { word: true },
      where: { id: { in: ids } },
    });

    expect(reviews.map((review) => [review.word.word, review.stage, review.dueAt])).toStrictEqual(
      expect.arrayContaining([
        [word.word, 0, new Date("2026-09-28T03:00:00.000Z")],
        [newWord, 0, new Date("2026-09-28T03:00:00.000Z")],
      ]),
    );

    expect(reviews).toHaveLength(2);
  });
});

describe(getPronunciationReviews, () => {
  it("lists the goal language's due words with the respelling and tip for the learner", async () => {
    const { goal, user, word } = await learnerWithWord();
    const other = await userFixture();

    await prisma.wordPronunciation.create({
      data: { pronunciation: "RÉNT", tip: "O r é suave.", userLanguage: "pt", wordId: word.id },
    });

    const [later, learned, spanish] = await Promise.all([
      wordFixture({ organizationId: word.organizationId, targetLanguage: "en" }),
      wordFixture({ organizationId: word.organizationId, targetLanguage: "en" }),
      wordFixture({ organizationId: word.organizationId, targetLanguage: "es" }),
    ]);

    const [due] = await Promise.all([
      pronunciationReviewFixture({ userId: user.id, wordId: word.id }),
      pronunciationReviewFixture({
        dueAt: new Date(Date.now() + DAY_MS),
        userId: user.id,
        wordId: later.id,
      }),
      pronunciationReviewFixture({ dueAt: null, stage: 3, userId: user.id, wordId: learned.id }),
      pronunciationReviewFixture({ language: "es", userId: user.id, wordId: spanish.id }),
      pronunciationReviewFixture({ userId: other.id, wordId: word.id }),
    ]);

    const result = await getPronunciationReviews({ goalId: goal.id });

    expect(result).toStrictEqual({
      reviews: {
        goalId: goal.id,
        language: "en",
        words: [
          {
            audioUrl: word.audioUrl,
            id: due.id,
            respelling: "RÉNT",
            romanization: null,
            tip: "O r é suave.",
            word: word.word,
          },
        ],
      },
      status: "ready",
    });
  });

  it("shows nothing for a goal that isn't a language", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "learn", userId: user.id });
    mockSession(user.id);

    await expect(getPronunciationReviews({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notLanguage",
    });
  });
});

describe(answerPronunciationReview, () => {
  it("asks a guest who used today's help to sign up before calling any model", async () => {
    const { user, word } = await learnerWithWord();
    const review = await pronunciationReviewFixture({ userId: user.id, wordId: word.id });

    await usageRecordsFixture({
      count: getUsageRule({ kind: "assist", tier: "guest" }).day ?? 0,
      createdAt: new Date(),
      kind: "assist",
      userId: user.id,
    });

    mockGuestSession(user.id);

    await expect(
      answerPronunciationReview({
        audio: AUDIO,
        fields: { durationMs: 1200, roundId: crypto.randomUUID(), timeZone: TIME_ZONE },
        reviewId: review.id,
      }),
    ).resolves.toStrictEqual(GUEST_OUT_OF_HELP);

    expect(assessPronunciation).not.toHaveBeenCalled();
  });

  it("climbs a rung when the word is said right and records it as time spoken", async () => {
    const { user, word } = await learnerWithWord();
    const review = await pronunciationReviewFixture({ userId: user.id, wordId: word.id });
    const roundId = crypto.randomUUID();

    mockHeard({ heard: word.word, word: word.word });

    const result = await answerPronunciationReview({
      audio: AUDIO,
      fields: { durationMs: 1200, roundId, timeZone: TIME_ZONE },
      reviewId: review.id,
    });

    expect(result).toMatchObject({ grade: { isCorrect: true }, status: "graded" });

    const [updated, attempt] = await Promise.all([
      prisma.pronunciationReview.findUniqueOrThrow({ where: { id: review.id } }),
      prisma.attempt.findFirstOrThrow({ where: { userId: user.id } }),
    ]);

    expect(updated.stage).toBe(1);
    expect(updated.dueAt?.getTime()).toBeGreaterThan(Date.now() + DAY_MS);

    expect(result.status === "graded" && result.grade.nextReviewAt).toBe(
      updated.dueAt?.toISOString(),
    );

    expect(attempt).toMatchObject({
      answer: { kind: "spoken", pronunciationReviewId: review.id, roundId, transcript: word.word },
      durationMs: 1200,
      isCorrect: true,
      targetLanguage: "en",
    });
  });

  it("starts the word over when it still sounds different", async () => {
    const { user, word } = await learnerWithWord();
    const review = await pronunciationReviewFixture({ stage: 2, userId: user.id, wordId: word.id });

    mockHeard({ heard: "hent", word: word.word });

    const result = await answerPronunciationReview({
      audio: AUDIO,
      fields: { durationMs: 900, roundId: crypto.randomUUID(), timeZone: TIME_ZONE },
      reviewId: review.id,
    });

    expect(result).toMatchObject({ grade: { isCorrect: false, transcript: "hent" } });

    await expect(
      prisma.pronunciationReview.findUniqueOrThrow({ where: { id: review.id } }),
    ).resolves.toMatchObject({ stage: 0 });

    // A miss isn't a mistake for the notebook: the word already comes back as a review.
    await expect(prisma.mistake.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("transcribes with the default model when the audio model fails", async () => {
    const { user, word } = await learnerWithWord();
    const review = await pronunciationReviewFixture({ userId: user.id, wordId: word.id });

    vi.mocked(assessPronunciation).mockRejectedValueOnce(new Error("provider down"));

    vi.mocked(transcribeSpeech).mockResolvedValueOnce({ data: { text: "hent" } } as Awaited<
      ReturnType<typeof transcribeSpeech>
    >);

    const result = await answerPronunciationReview({
      audio: AUDIO,
      fields: { durationMs: 900, roundId: crypto.randomUUID(), timeZone: TIME_ZONE },
      reviewId: review.id,
    });

    expect(result).toMatchObject({ grade: { isCorrect: false, transcript: "hent" } });

    expect(transcribeSpeech).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ language: "en" }),
    );

    expect(vi.mocked(transcribeSpeech).mock.calls[0]?.[0]).not.toHaveProperty("model");
  });

  it("hides another learner's review and rejects audio it can't grade", async () => {
    const { word } = await learnerWithWord();
    const owner = await userFixture();
    const review = await pronunciationReviewFixture({ userId: owner.id, wordId: word.id });
    const fields = { durationMs: 900, roundId: crypto.randomUUID(), timeZone: TIME_ZONE };

    await expect(
      answerPronunciationReview({ audio: AUDIO, fields, reviewId: review.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      answerPronunciationReview({
        audio: { bytes: new Uint8Array(), mediaType: "audio/webm" },
        fields,
        reviewId: review.id,
      }),
    ).resolves.toStrictEqual({ status: "invalidAudio" });

    expect(assessPronunciation).not.toHaveBeenCalled();
  });
});

describe(finishPronunciationRound, () => {
  it("counts a round once toward today's totals, Brain Power and the ledger", async () => {
    const { goal, user, word } = await learnerWithWord();
    const second = await wordFixture({ organizationId: word.organizationId, targetLanguage: "en" });

    const [first, next] = await Promise.all([
      pronunciationReviewFixture({ userId: user.id, wordId: word.id }),
      pronunciationReviewFixture({ userId: user.id, wordId: second.id }),
    ]);

    const roundId = crypto.randomUUID();
    const fields = { durationMs: 1500, roundId, timeZone: TIME_ZONE };

    mockHeard({ heard: word.word, word: word.word });
    await answerPronunciationReview({ audio: AUDIO, fields, reviewId: first.id });

    mockHeard({ heard: "wrong", word: second.word });
    await answerPronunciationReview({ audio: AUDIO, fields, reviewId: next.id });

    const input = { goalId: goal.id, timeZone: TIME_ZONE };

    const [finished, again] = await Promise.all([
      finishPronunciationRound({ input, roundId }),
      finishPronunciationRound({ input, roundId }),
    ]);

    expect(finished).toStrictEqual(again);
    expect(finished).toMatchObject({ result: { correct: 1, total: 2 }, status: "ready" });

    const events = await prisma.learningEvent.findMany({ where: { userId: user.id } });

    expect(events).toHaveLength(1);

    expect(events[0]).toMatchObject({
      contentIds: { pronunciationRoundId: roundId },
      correctAnswers: 1,
      goalId: goal.id,
      incorrectAnswers: 1,
      kind: "review",
      lessonKind: "pronunciationReview",
    });

    const progress = await prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } });

    expect(Number(progress.totalBrainPower)).toBe(
      finished.status === "ready" ? finished.result.brainPower : -1,
    );
  });

  it("refuses a round with no answers and another learner's goal", async () => {
    const { goal } = await learnerWithWord();
    const other = await userFixture();
    const otherGoal = await goalFixture({ kind: "language", userId: other.id });
    const input = { goalId: goal.id, timeZone: TIME_ZONE };

    await expect(
      finishPronunciationRound({ input, roundId: crypto.randomUUID() }),
    ).resolves.toStrictEqual({ status: "invalid" });

    await expect(
      finishPronunciationRound({
        input: { ...input, goalId: otherGoal.id },
        roundId: crypto.randomUUID(),
      }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});

describe("the pronunciation row on a language goal's Today", () => {
  it("names the first due words and counts them all", async () => {
    const { goal, user, word } = await learnerWithWord();

    const words = await Promise.all(
      Array.from({ length: 3 }, () =>
        wordFixture({ organizationId: word.organizationId, targetLanguage: "en" }),
      ),
    );

    await pronunciationReviewFixture({
      dueAt: new Date(Date.now() - DAY_MS),
      userId: user.id,
      wordId: word.id,
    });

    await Promise.all(
      words.map((row) => pronunciationReviewFixture({ userId: user.id, wordId: row.id })),
    );

    const result = await getLanguageTodayView({ goalId: goal.id });

    expect(result.status === "ready" && result.today.pronunciation).toStrictEqual({
      count: 4,
      words: [word.word, expect.any(String), expect.any(String)],
    });
  });
});
