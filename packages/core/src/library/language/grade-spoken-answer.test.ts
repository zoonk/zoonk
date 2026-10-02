import { explainSpokenAnswer } from "@zoonk/ai/tasks/v2/language/explain-spoken-answer";
import { transcribeSpeech } from "@zoonk/ai/tasks/v2/language/transcribe-speech";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../../_test-utils/deferred-work";
import { GUEST_OUT_OF_HELP, useGuestOutOfHelp } from "../../_test-utils/guest-out-of-help";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { trackServerEvent } from "../../analytics/server";
import { gradeSpokenAnswer } from "./grade-spoken-answer";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(async () => false),
}));

// Speech recognition, the explanation model and Blob storage are paid external services.
vi.mock("@zoonk/ai/tasks/v2/language/transcribe-speech", () => ({ transcribeSpeech: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/language/explain-spoken-answer", () => ({
  explainSpokenAnswer: vi.fn(),
}));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../../analytics/server", () => ({ trackServerEvent: vi.fn() }));

function sentTips() {
  return vi
    .mocked(trackServerEvent)
    .mock.calls.flatMap(([event]) => (event.name === "Pronunciation Tip Shown" ? [event] : []));
}

const TARGET_TEXT = "How much is the rent?";
const AUDIO = { bytes: new Uint8Array([1, 2, 3]), mediaType: "audio/webm;codecs=opus" };
const FIELDS = { durationMs: 2400, timeZone: "America/Sao_Paulo" };

function mockTranscript(text: string) {
  vi.mocked(transcribeSpeech).mockResolvedValueOnce({
    data: { text },
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "openai/gpt-transcribe",
      promptVersion: "test",
      provider: "openai",
      requestedModel: "openai/gpt-transcribe",
      runId: crypto.randomUUID(),
      usage: {},
    },
  });
}

function mockExplanation(explanation: string) {
  vi.mocked(explainSpokenAnswer).mockResolvedValueOnce({
    data: { explanation },
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "openai/gpt-6-luna",
      promptVersion: "test",
      provider: "openai",
      requestedModel: "openai/gpt-6-luna",
      runId: crypto.randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

async function createSpokenStep(lesson: Parameters<typeof libraryLessonFixture>[0] = {}) {
  const [createdLesson, skill] = await Promise.all([
    libraryLessonFixture({ language: "pt", targetLanguage: "en", ...lesson }),
    skillFixture(),
  ]);

  return libraryStepFixture({
    content: {
      language: "en",
      prompt: "Pergunte quanto é o aluguel.",
      targetText: TARGET_TEXT,
      translation: "Quanto é o aluguel?",
    },
    kind: "spokenAnswer",
    lessonId: createdLesson.id,
    skillId: skill.id,
  });
}

describe(gradeSpokenAnswer, () => {
  it("requires a signed-in learner", async () => {
    mockSession(null);

    await expect(
      gradeSpokenAnswer({ audio: AUDIO, fields: FIELDS, stepId: crypto.randomUUID() }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("rejects audio it can't grade before calling any model", async () => {
    const [step, user] = await Promise.all([createSpokenStep(), userFixture()]);
    mockSession(user.id);

    const results = await Promise.all(
      [
        { bytes: new Uint8Array(), mediaType: "audio/webm" },
        { bytes: new Uint8Array([1]), mediaType: "video/mp4" },
        { bytes: new Uint8Array(2_000_001), mediaType: "audio/webm" },
      ].map((audio) => gradeSpokenAnswer({ audio, fields: FIELDS, stepId: step.id })),
    );

    expect(results).toStrictEqual(Array.from({ length: 3 }, () => ({ status: "invalidAudio" })));
    expect(transcribeSpeech).not.toHaveBeenCalled();
  });

  it("hides another learner's private lesson and steps that aren't spoken", async () => {
    const [owner, learner] = await Promise.all([userFixture(), userFixture()]);
    const privateStep = await createSpokenStep({ ownerId: owner.id, visibility: "private" });
    const lesson = await libraryLessonFixture();
    const explanationStep = await libraryStepFixture({ lessonId: lesson.id });

    mockSession(learner.id);

    await expect(
      gradeSpokenAnswer({ audio: AUDIO, fields: FIELDS, stepId: privateStep.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      gradeSpokenAnswer({ audio: AUDIO, fields: FIELDS, stepId: explanationStep.id }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("grades a sentence said as expected and records the attempt, for guests too", async () => {
    const [step, guest] = await Promise.all([createSpokenStep(), userFixture()]);
    mockGuestSession(guest.id);
    mockTranscript("How much is the rent");

    const result = await gradeSpokenAnswer({ audio: AUDIO, fields: FIELDS, stepId: step.id });

    expect(result.status).toBe("graded");

    const grade = result.status === "graded" ? result.grade : null;

    expect(grade).toMatchObject({
      explanation: null,
      isCorrect: true,
      score: 1,
      wordsToPractice: [],
    });

    expect(explainSpokenAnswer).not.toHaveBeenCalled();

    // Lessons take the transcription default (gpt-transcribe) in the step's language.
    expect(transcribeSpeech).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ language: "en" }),
    );

    expect(vi.mocked(transcribeSpeech).mock.calls[0]?.[0]).not.toHaveProperty("model");

    const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: grade?.attemptId } });

    expect(attempt).toMatchObject({
      answer: { kind: "spoken", transcript: "How much is the rent" },
      durationMs: 2400,
      isCorrect: true,
      skillId: step.skillId,
      stepId: step.id,
      targetLanguage: "en",
      userId: guest.id,
    });
  });

  it("gives each word to practice its native audio, respelling and tip", async () => {
    const word = `quay${crypto.randomUUID().slice(0, 6)}`;

    const [organization, learner, skill, lesson] = await Promise.all([
      organizationFixture(),
      userFixture(),
      skillFixture(),
      libraryLessonFixture({ language: "pt", targetLanguage: "en" }),
    ]);

    const [step] = await Promise.all([
      libraryStepFixture({
        content: {
          language: "en",
          prompt: "Pergunte onde fica o cais.",
          targetText: `Where is the ${word} and the train?`,
        },
        kind: "spokenAnswer",
        lessonId: lesson.id,
        skillId: skill.id,
      }),
      prisma.word.create({
        data: {
          audioUrl: `https://audio.test/${word}.mp3`,
          organizationId: organization.id,
          pronunciations: {
            create: {
              pronunciation: "kii",
              tip: "Soa como a letra K dita em inglês.",
              userLanguage: "pt",
            },
          },
          targetLanguage: "en",
          word,
        },
      }),
    ]);

    mockSession(learner.id);
    mockTranscript("Where is the key and the rain?");
    mockExplanation('Ouvimos "key" e "rain".');

    const result = await gradeSpokenAnswer({ audio: AUDIO, fields: FIELDS, stepId: step.id });

    expect(result.status === "graded" && result.grade.wordsToPractice).toStrictEqual([
      {
        audioUrl: `https://audio.test/${word}.mp3`,
        heard: "key",
        respelling: "kii",
        status: "different",
        text: word,
        tip: "Soa como a letra K dita em inglês.",
      },
      {
        audioUrl: null,
        heard: "rain",
        respelling: null,
        status: "different",
        text: "train?",
        tip: null,
      },
    ]);

    expect(vi.mocked(explainSpokenAnswer).mock.calls.at(-1)?.[0]).toMatchObject({
      words: [
        { expected: word, heard: "key", respelling: "kii" },
        { expected: "train?", heard: "rain" },
      ],
    });
  });

  it("explains a mistake once and reuses it for the next learner who says the same thing", async () => {
    const [step, learner, nextLearner] = await Promise.all([
      createSpokenStep(),
      userFixture(),
      userFixture(),
    ]);

    mockSession(learner.id);
    mockTranscript("How much is the hent?");
    mockExplanation('Ouvimos "hent". Comece "rent" com a língua curvada para trás.');
    const flush = runDeferredWork();

    const first = await gradeSpokenAnswer({ audio: AUDIO, fields: FIELDS, stepId: step.id });

    mockSession(nextLearner.id);
    mockTranscript("how much is the hent");

    const second = await gradeSpokenAnswer({ audio: AUDIO, fields: FIELDS, stepId: step.id });

    expect(explainSpokenAnswer).toHaveBeenCalledOnce();

    expect(vi.mocked(explainSpokenAnswer).mock.calls[0]?.[0]).toMatchObject({
      expectedSentence: TARGET_TEXT,
      learnerLanguage: "pt",
      targetLanguage: "en",
      words: [{ expected: "rent?", heard: "hent" }],
    });

    for (const result of [first, second]) {
      expect(result).toMatchObject({
        grade: {
          explanation: 'Ouvimos "hent". Comece "rent" com a língua curvada para trás.',
          isCorrect: false,
          score: 0.8,
          wordsToPractice: [expect.objectContaining({ heard: "hent", text: "rent?" })],
        },
        status: "graded",
      });
    }

    await flush();

    const tip = { skill_id: step.skillId, target_language: "en" };

    expect(sentTips()).toStrictEqual([
      expect.objectContaining({ distinctId: learner.id, properties: tip }),
      expect.objectContaining({ distinctId: nextLearner.id, properties: tip }),
    ]);

    const mistake = await prisma.mistake.findFirstOrThrow({
      where: { stepId: step.id, userId: nextLearner.id },
    });

    expect(mistake.snapshot).toMatchObject({
      answer: "how much is the hent",
      correctAnswer: TARGET_TEXT,
      format: "spoken",
    });
  });

  it("still grades the answer when the explanation can't be written", async () => {
    const [step, user] = await Promise.all([createSpokenStep(), userFixture()]);
    mockSession(user.id);
    mockTranscript("How much is the hand?");
    vi.mocked(explainSpokenAnswer).mockRejectedValueOnce(new Error("provider down"));
    const flush = runDeferredWork();

    const result = await gradeSpokenAnswer({ audio: AUDIO, fields: FIELDS, stepId: step.id });
    await flush();

    expect(result).toMatchObject({ grade: { explanation: null, isCorrect: false } });
    expect(sentTips()).toStrictEqual([]);
    await expect(prisma.answerExplanation.count({ where: { stepId: step.id } })).resolves.toBe(0);
  });

  it("slows down a burst of answers before calling any model", async () => {
    const [step, user] = await Promise.all([createSpokenStep(), userFixture()]);
    mockSession(user.id);
    vi.mocked(isRateLimited).mockResolvedValueOnce(true);

    await expect(
      gradeSpokenAnswer({ audio: AUDIO, fields: FIELDS, stepId: step.id }),
    ).resolves.toStrictEqual({ retryAfterSeconds: 60, status: "slowDown" });

    expect(transcribeSpeech).not.toHaveBeenCalled();
  });

  it("asks a guest who used today's help to sign up before calling any model", async () => {
    const step = await createSpokenStep();
    await useGuestOutOfHelp();

    await expect(
      gradeSpokenAnswer({ audio: AUDIO, fields: FIELDS, stepId: step.id }),
    ).resolves.toStrictEqual(GUEST_OUT_OF_HELP);

    expect(transcribeSpeech).not.toHaveBeenCalled();
  });

  it("asks to try again without recording anything when no words were heard", async () => {
    const [step, user] = await Promise.all([createSpokenStep(), userFixture()]);
    mockSession(user.id);
    mockTranscript("");

    await expect(
      gradeSpokenAnswer({ audio: AUDIO, fields: FIELDS, stepId: step.id }),
    ).resolves.toStrictEqual({ status: "noSpeech" });

    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("links the attempt to the learner's own study session only", async () => {
    const [step, learner, other] = await Promise.all([
      createSpokenStep(),
      userFixture(),
      userFixture(),
    ]);

    const [ownSession, otherSession] = await Promise.all([
      studySessionFixture({ userId: learner.id }),
      studySessionFixture({ userId: other.id }),
    ]);

    mockSession(learner.id);
    mockTranscript(TARGET_TEXT);
    mockTranscript(TARGET_TEXT);

    const own = await gradeSpokenAnswer({
      audio: AUDIO,
      fields: { ...FIELDS, studySessionId: ownSession.id },
      stepId: step.id,
    });

    const foreign = await gradeSpokenAnswer({
      audio: AUDIO,
      fields: { ...FIELDS, studySessionId: otherSession.id },
      stepId: step.id,
    });

    const attempts = await prisma.attempt.findMany({
      where: {
        id: {
          in: [own, foreign].flatMap((result) =>
            result.status === "graded" ? [result.grade.attemptId] : [],
          ),
        },
      },
    });

    expect(attempts).toHaveLength(2);

    expect(attempts.map((attempt) => attempt.studySessionId)).toStrictEqual(
      expect.arrayContaining([ownSession.id, null]),
    );
  });

  it("brings the words that sounded different back as pronunciation reviews", async () => {
    const [step, learner] = await Promise.all([createSpokenStep(), userFixture()]);

    mockSession(learner.id);
    mockTranscript("How much is the hent?");
    mockExplanation('Ouvimos "hent".');

    await gradeSpokenAnswer({ audio: AUDIO, fields: FIELDS, stepId: step.id });

    const reviews = await prisma.pronunciationReview.findMany({
      include: { word: true },
      where: { userId: learner.id },
    });

    expect(reviews.map((review) => review.word.word.toLowerCase())).toStrictEqual(["rent"]);
    expect(reviews[0]).toMatchObject({ language: "en", stage: 0, userLanguage: "pt" });
    expect(reviews[0]?.dueAt?.getTime()).toBeGreaterThan(Date.now());
  });
});
