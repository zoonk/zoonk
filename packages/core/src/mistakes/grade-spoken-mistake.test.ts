import { assessPronunciation } from "@zoonk/ai/tasks/language/assess-pronunciation";
import { transcribeSpeech } from "@zoonk/ai/tasks/language/transcribe-speech";
import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { ONE_SECOND_RECORDING } from "@zoonk/testing/fixtures/recordings";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getUsageRule } from "../entitlements/limits";
import { gradeSpokenAnswer } from "../library/language/grade-spoken-answer";
import { answerMistakePractice } from "./answer-mistake-practice";
import { getMistakePractice } from "./get-mistake-practice";
import { loadMistakeReplay } from "./mistake-replay";

const AUDIO = { bytes: ONE_SECOND_RECORDING, mediaType: "audio/webm" };
const TARGET_TEXT = "How much is the rent?";

async function setup() {
  const [user, lesson, skill] = await Promise.all([
    userFixture(),
    libraryLessonFixture({ language: "pt", targetLanguage: "en" }),
    skillFixture(),
  ]);

  const step = await libraryStepFixture({
    content: {
      language: "en",
      prompt: "Ask about the rent.",
      targetText: TARGET_TEXT,
      translation: "Quanto é o aluguel?",
    },
    kind: "spokenAnswer",
    lessonId: lesson.id,
    skillId: skill.id,
  });

  const mistake = await mistakeFixture({
    createdAt: new Date(Date.now() - 86_400_000),
    skillId: skill.id,
    snapshot: {
      answer: "How much rent?",
      correctAnswer: TARGET_TEXT,
      question: `Ask about the rent.\n\n${TARGET_TEXT}`,
    },
    stepId: step.id,
    userId: user.id,
  });

  mockSession(user.id);
  const replay = await loadMistakeReplay({ mistake, userId: user.id });
  expect(replay).not.toBeNull();

  await prisma.mistake.update({
    data: {
      snapshot: {
        answer: "How much rent?",
        correctAnswer: TARGET_TEXT,
        question: `Ask about the rent.\n\n${TARGET_TEXT}`,
        replay,
      },
    },
    where: { id: mistake.id },
  });

  return { mistake, step, user };
}

function targetTranscript() {
  return {
    data: { text: TARGET_TEXT },
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
  };
}

function hearTarget() {
  vi.mocked(transcribeSpeech).mockResolvedValue(targetTranscript());
}

describe("Original notebook questions", () => {
  it("grades the saved spoken question after deletion and replays its recording without another model call", async () => {
    const { mistake, step, user } = await setup();
    await prisma.step.delete({ where: { id: step.id } });
    hearTarget();

    const input = {
      audio: AUDIO,
      fields: {
        attemptId: crypto.randomUUID(),
        durationMs: 2400,
        mistakeId: mistake.id,
        timeZone: "UTC",
      },
      stepId: step.id,
    };

    const first = await gradeSpokenAnswer(input);
    const second = await gradeSpokenAnswer(input);

    expect(first).toMatchObject({
      grade: {
        isCorrect: true,
        practice: { fixed: true, fixedMistakeIds: [mistake.id], mistakeStatus: "fixed" },
        transcript: TARGET_TEXT,
      },
      status: "graded",
    });

    expect(second).toMatchObject(first);
    expect(transcribeSpeech).toHaveBeenCalledOnce();
    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("rejects another learner's mistake and a different question before spending", async () => {
    const { mistake, step } = await setup();
    const foreign = await userFixture();

    const input = {
      audio: AUDIO,
      fields: { attemptId: crypto.randomUUID(), durationMs: 2400, mistakeId: mistake.id },
      stepId: crypto.randomUUID(),
    };

    await expect(gradeSpokenAnswer(input)).resolves.toStrictEqual({ status: "notFound" });
    mockSession(foreign.id);

    await expect(gradeSpokenAnswer({ ...input, stepId: step.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    expect(transcribeSpeech).not.toHaveBeenCalled();
  });

  it("uses the whole question time instead of only the recording for timed practice", async () => {
    const { mistake, step, user } = await setup();
    await prisma.mistake.update({ data: { cause: "time" }, where: { id: mistake.id } });
    hearTarget();

    const result = await gradeSpokenAnswer({
      audio: AUDIO,
      fields: {
        attemptId: crypto.randomUUID(),
        durationMs: 2400,
        mistakeId: mistake.id,
        practiceDurationMs: 50_000,
        timeZone: "UTC",
      },
      stepId: step.id,
    });

    expect(result).toMatchObject({
      grade: {
        isCorrect: true,
        practice: { fixed: false, isCorrect: false, mistakeStatus: "open" },
      },
      status: "graded",
    });

    await expect(prisma.attempt.findFirst({ where: { userId: user.id } })).resolves.toMatchObject({
      durationMs: 50_000,
      isCorrect: false,
    });
  });

  it("admits concurrent recording retries once and allows the saved result to be read again", async () => {
    const { mistake, step, user } = await setup();
    const started = Promise.withResolvers<boolean>();
    const finish = Promise.withResolvers<boolean>();

    vi.mocked(transcribeSpeech).mockImplementationOnce(async () => {
      started.resolve(true);
      await finish.promise;
      return targetTranscript();
    });

    const input = {
      audio: AUDIO,
      fields: {
        attemptId: crypto.randomUUID(),
        durationMs: 2400,
        mistakeId: mistake.id,
        timeZone: "UTC",
      },
      stepId: step.id,
    };

    const first = gradeSpokenAnswer(input);
    await started.promise;

    try {
      await expect(gradeSpokenAnswer(input)).resolves.toStrictEqual({
        retryAfterSeconds: 1,
        status: "slowDown",
      });
    } finally {
      finish.resolve(true);
    }

    const recorded = await first;
    expect(recorded.status).toBe("graded");
    await expect(gradeSpokenAnswer(input)).resolves.toMatchObject(recorded);
    expect(transcribeSpeech).toHaveBeenCalledOnce();
    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);

    await expect(
      prisma.usageRecord.count({ where: { kind: "assist", userId: user.id } }),
    ).resolves.toBe(1);
  });

  it("keeps other block questions available at the spoken limit and completes after they are answered", async () => {
    const { mistake, step, user } = await setup();
    const userId = user.id;

    const [session, item] = await Promise.all([
      studySessionFixture({ startedAt: new Date(), status: "active", userId }),
      itemFixture({ content: choiceItemContent(), skillId: mistake.skillId! }),
    ]);

    const choice = await mistakeFixture({ itemId: item.id, skillId: mistake.skillId, userId });

    const block = await studySessionBlockFixture({
      kind: "review",
      payload: { mistakeIds: [mistake.id, choice.id] },
      sessionId: session.id,
      status: "active",
    });

    const count = getUsageRule({ kind: "assist", tier: "free" }).day ?? 0;

    await prisma.usageRecord.createMany({
      data: Array.from({ length: count }, () => ({
        kind: "assist",
        targetId: crypto.randomUUID(),
        userId,
      })),
    });

    await expect(
      gradeSpokenAnswer({
        audio: AUDIO,
        fields: {
          attemptId: crypto.randomUUID(),
          blockId: block.id,
          durationMs: 2400,
          mistakeId: mistake.id,
          timeZone: "UTC",
        },
        stepId: step.id,
      }),
    ).resolves.toMatchObject({ status: "limitReached" });

    expect(transcribeSpeech).not.toHaveBeenCalled();

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "active" });

    const practice = await getMistakePractice({ blockId: block.id });

    expect(
      practice.status === "ready" && practice.practice.map((entry) => entry.mistakeId),
    ).toContain(choice.id);

    await expect(
      answerMistakePractice({
        input: {
          answer: { selectedIndex: 0 },
          durationMs: 2000,
          itemId: item.id,
          run: { answerIds: [], blockId: block.id },
          timeZone: "UTC",
        },
        mistakeId: choice.id,
      }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "completed" });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ status: "open" });
  });

  it("releases a failed recording grade so its retry can finish without another usage charge", async () => {
    const { mistake, step, user } = await setup();

    vi.mocked(transcribeSpeech)
      .mockRejectedValueOnce(new Error("Speech provider unavailable"))
      .mockResolvedValueOnce(targetTranscript());

    vi.mocked(assessPronunciation).mockRejectedValueOnce(new Error("Speech provider unavailable"));

    const input = {
      audio: AUDIO,
      fields: {
        attemptId: crypto.randomUUID(),
        durationMs: 2400,
        mistakeId: mistake.id,
        timeZone: "UTC",
      },
      stepId: step.id,
    };

    await expect(gradeSpokenAnswer(input)).rejects.toThrow("Speech provider unavailable");

    await expect(gradeSpokenAnswer(input)).resolves.toMatchObject({
      grade: { practice: { fixed: true } },
      status: "graded",
    });

    await expect(
      prisma.usageRecord.count({ where: { kind: "assist", userId: user.id } }),
    ).resolves.toBe(1);

    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(1);
  });
});
