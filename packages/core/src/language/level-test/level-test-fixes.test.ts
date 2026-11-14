import { assessPronunciation } from "@zoonk/ai/tasks/language/assess-pronunciation";
import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { levelTestBankFixture } from "@zoonk/testing/fixtures/level-tests";
import { ONE_SECOND_RECORDING } from "@zoonk/testing/fixtures/recordings";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { appliedFixFixture } from "../../staff/content-fixes/_test-utils/applied-fix";
import { toJson } from "../../staff/content-fixes/_utils/resolved-change";
import { readGoalDetails } from "../_utils/language-goal";
import { answerLanguageLevelTest } from "./answer-language-level-test";
import { finishLanguageLevelTest } from "./finish-language-level-test";
import { getLanguageLevelTest } from "./get-language-level-test";
import { gradeLevelTestSpeech } from "./grade-level-test-speech";
import { levelTestPart } from "./level-test-parts";

const MINUTE_MS = 60_000;

/** A learner of a pair only this test uses, so its bank fixes reach no other test. */
async function learnerWithBank() {
  const [{ goal, user }, bank] = await Promise.all([
    languageGoalFixture(),
    levelTestBankFixture({ levels: ["A1", "A2", "B1"] }),
  ]);

  await prisma.goal.update({ data: bank.pair, where: { id: goal.id } });

  const row = await prisma.languageLevelTest.findUniqueOrThrow({
    where: { languagePair: bank.pair },
  });

  mockSession(user.id);

  return { bankId: row.id, goalId: goal.id, questions: bank.questions };
}

async function nextQuestionId(goalId: string): Promise<string> {
  const view = await getLanguageLevelTest(goalId);

  if (
    view.status !== "ready" ||
    view.test.status !== "ready" ||
    view.test.next.kind !== "question"
  ) {
    throw new Error("Expected a question");
  }

  return view.test.next.question.id;
}

/** Moves the question's right option from the first to the second, as an approved fix would. */
async function moveAnswerKey({
  bankId,
  decidedAt,
  questionId,
}: {
  bankId: string;
  decidedAt?: Date;
  questionId: string;
}) {
  const row = await prisma.languageLevelTest.findUniqueOrThrow({ where: { id: bankId } });
  const before = toJson(row.content);
  const bank = row.content as { questions: { answerIndex: number; id: string }[] };

  const after = {
    ...bank,
    questions: bank.questions.map((question) =>
      question.id === questionId ? { ...question, answerIndex: 1 } : question,
    ),
  };

  await prisma.languageLevelTest.update({ data: { content: after }, where: { id: bankId } });

  await appliedFixFixture({
    changes: [
      {
        fields: [{ after: toJson(after), before, field: "content" }],
        id: bankId,
        model: "LanguageLevelTest",
        op: "set",
        parts: [levelTestPart({ kind: "question", questionId })],
      },
    ],
    decidedAt,
    unit: "levelTest",
    unitId: bankId,
  });
}

async function lastAnswer(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  const progress = readGoalDetails(goal).levelTest as { answers: unknown[]; startedAt?: string };
  return { answer: progress.answers.at(-1), startedAt: progress.startedAt };
}

describe("level test answers to a question fixed during the test", () => {
  it("saves the old right answer as a skip once the test began, and the first answer starts it", async () => {
    const { bankId, goalId } = await learnerWithBank();
    const first = await nextQuestionId(goalId);

    await answerLanguageLevelTest({ goalId, input: { answerIndex: 0, questionId: first } });
    await expect(lastAnswer(goalId)).resolves.toMatchObject({ startedAt: expect.any(String) });

    const fixed = await nextQuestionId(goalId);
    await moveAnswerKey({ bankId, questionId: fixed });

    await expect(
      answerLanguageLevelTest({ goalId, input: { answerIndex: 0, questionId: fixed } }),
    ).resolves.toMatchObject({ status: "ready", test: { lastCorrect: null } });

    await expect(lastAnswer(goalId)).resolves.toMatchObject({
      answer: { answerIndex: null, id: fixed, skipped: true },
    });
  });

  it("excuses the test's first answer when the fix landed just before it", async () => {
    const { bankId, goalId } = await learnerWithBank();
    const first = await nextQuestionId(goalId);

    await moveAnswerKey({
      bankId,
      decidedAt: new Date(Date.now() - 2 * MINUTE_MS),
      questionId: first,
    });

    await answerLanguageLevelTest({ goalId, input: { answerIndex: 0, questionId: first } });

    await expect(lastAnswer(goalId)).resolves.toMatchObject({
      answer: { answerIndex: null, skipped: true },
    });
  });

  it("counts a wrong answer to a question fixed well before the test began", async () => {
    const { bankId, goalId } = await learnerWithBank();
    const first = await nextQuestionId(goalId);

    await moveAnswerKey({
      bankId,
      decidedAt: new Date(Date.now() - 10 * MINUTE_MS),
      questionId: first,
    });

    await expect(
      answerLanguageLevelTest({ goalId, input: { answerIndex: 0, questionId: first } }),
    ).resolves.toMatchObject({ status: "ready", test: { lastCorrect: false } });

    const { answer } = await lastAnswer(goalId);
    expect(answer).toStrictEqual({ answerIndex: 0, correct: false, durationMs: 0, id: first });
  });

  it("excuses the first answer to a question fixed while the learner was on it", async () => {
    const { bankId, goalId } = await learnerWithBank();

    await prisma.goal.update({
      data: { createdAt: new Date(Date.now() - 60 * MINUTE_MS) },
      where: { id: goalId },
    });

    const first = await nextQuestionId(goalId);

    await moveAnswerKey({
      bankId,
      decidedAt: new Date(Date.now() - 10 * MINUTE_MS),
      questionId: first,
    });

    await answerLanguageLevelTest({ goalId, input: { answerIndex: 0, questionId: first } });

    await expect(lastAnswer(goalId)).resolves.toMatchObject({
      answer: { answerIndex: null, skipped: true },
    });
  });

  it("counts the right answer to a question fixed during the test", async () => {
    const { bankId, goalId } = await learnerWithBank();
    const first = await nextQuestionId(goalId);
    await moveAnswerKey({ bankId, questionId: first });

    await expect(
      answerLanguageLevelTest({ goalId, input: { answerIndex: 1, questionId: first } }),
    ).resolves.toMatchObject({ status: "ready", test: { lastCorrect: true } });
  });
});

describe("level test answers saved before a fix", () => {
  it("keeps the verdict each answer got when it was given", async () => {
    const { bankId, goalId } = await learnerWithBank();
    const answered = await nextQuestionId(goalId);
    await answerLanguageLevelTest({ goalId, input: { answerIndex: 0, questionId: answered } });

    const before = await getLanguageLevelTest(goalId);
    await moveAnswerKey({ bankId, questionId: answered });

    await expect(getLanguageLevelTest(goalId)).resolves.toStrictEqual(before);

    const levels =
      before.status === "ready" && before.test.status === "ready" && before.test.levels;

    await expect(finishLanguageLevelTest(goalId)).resolves.toMatchObject({ levels });
  });

  it("grades answers saved without a verdict by the bank's key", async () => {
    const { goalId } = await learnerWithBank();
    const answered = await nextQuestionId(goalId);
    await answerLanguageLevelTest({ goalId, input: { answerIndex: 0, questionId: answered } });

    const before = await getLanguageLevelTest(goalId);
    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
    const details = readGoalDetails(goal);
    const progress = details.levelTest as { answers: { correct?: boolean | null }[] };

    await prisma.goal.update({
      data: {
        details: {
          ...details,
          levelTest: {
            ...progress,
            answers: progress.answers.map(({ correct: _verdict, ...answer }) => answer),
          },
        },
      },
      where: { id: goalId },
    });

    await expect(getLanguageLevelTest(goalId)).resolves.toStrictEqual(before);
    await finishLanguageLevelTest(goalId);

    await expect(
      prisma.learningEvent.findFirst({ where: { goalId, lessonKind: "levelTest" } }),
    ).resolves.toMatchObject({ correctAnswers: 1, incorrectAnswers: 0 });
  });
});

const SPEAKING_LEVELS = ["A1", "A2", "B1"];

function speakingSentences(suffix: string) {
  return SPEAKING_LEVELS.map((level) => ({
    level,
    sentence: `Say ${level}${suffix}`,
    translation: "Diga",
  }));
}

/** Rewrites every speaking sentence from `from` to `to` suffixes, as an approved fix would. */
async function fixSpeakingSentences({
  bankId,
  from,
  questions,
  to,
}: {
  bankId: string;
  from: string;
  questions: Awaited<ReturnType<typeof learnerWithBank>>["questions"];
  to: string;
}) {
  const before = { questions, speaking: speakingSentences(from) };
  const after = { questions, speaking: speakingSentences(to) };

  await prisma.languageLevelTest.update({ data: { content: after }, where: { id: bankId } });

  await appliedFixFixture({
    changes: [
      {
        fields: [{ after: toJson(after), before: toJson(before), field: "content" }],
        id: bankId,
        model: "LanguageLevelTest",
        op: "set",
        parts: SPEAKING_LEVELS.map((level) => levelTestPart({ kind: "speaking", level })),
      },
    ],
    unit: "levelTest",
    unitId: bankId,
  });
}

async function reachSpeakingPart(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

  await prisma.goal.update({
    data: {
      details: {
        ...readGoalDetails(goal),
        levelTest: {
          answers: ["reading", "listening"].flatMap((skill) =>
            SPEAKING_LEVELS.map((level) => ({ answerIndex: 0, id: `${skill}-${level}-0` })),
          ),
          speaking: null,
          startedAt: new Date().toISOString(),
        },
      },
    },
    where: { id: goalId },
  });
}

/** The learner says the sentence they were shown, so the word a later fix added is missed. */
function learnerMisses(word: string) {
  vi.mocked(assessPronunciation).mockImplementation(async ({ expectedText }) => ({
    data: {
      transcript: expectedText.replace(` ${word}`, ""),
      words: expectedText
        .split(" ")
        .map((text) => ({
          heard: null,
          issue: null,
          status: text === word ? ("missed" as const) : ("correct" as const),
          text,
        })),
    },
    provenance: {
      generatedAt: "",
      latencyMs: 1,
      model: "m",
      promptVersion: "v",
      provider: "p",
      requestedModel: "m",
      runId: "r",
      usage: {},
    },
    systemPrompt: "",
    usage: undefined as never,
    userPrompt: "",
  }));
}

async function savedSpeaking(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return (readGoalDetails(goal).levelTest as { speaking: unknown }).speaking;
}

const audio = { bytes: ONE_SECOND_RECORDING, mediaType: "audio/webm" };

describe("level test sentence fixed during the test", () => {
  it("doesn't score a take of the old sentence, asks the fixed one again, then scores it", async () => {
    const { bankId, goalId, questions } = await learnerWithBank();
    await fixSpeakingSentences({ bankId, from: "", questions, to: " now" });
    await reachSpeakingPart(goalId);
    learnerMisses("now");

    await expect(gradeLevelTestSpeech({ audio, goalId })).resolves.toMatchObject({
      status: "ready",
      test: { next: { kind: "speaking", speaking: { sentence: expect.stringContaining("now") } } },
    });

    await expect(savedSpeaking(goalId)).resolves.toBeNull();

    await expect(gradeLevelTestSpeech({ audio, goalId })).resolves.toMatchObject({
      status: "ready",
      test: { next: { kind: "done" } },
    });

    await expect(savedSpeaking(goalId)).resolves.toMatchObject({ score: expect.any(Number) });
  });

  it("doesn't score a take of the shown fixed sentence once staff fix it again, then scores", async () => {
    const { bankId, goalId, questions } = await learnerWithBank();
    await fixSpeakingSentences({ bankId, from: "", questions, to: " now" });
    await reachSpeakingPart(goalId);
    learnerMisses("now");
    await gradeLevelTestSpeech({ audio, goalId });

    await fixSpeakingSentences({ bankId, from: " now", questions, to: " now please" });
    learnerMisses("please");

    await expect(gradeLevelTestSpeech({ audio, goalId })).resolves.toMatchObject({
      status: "ready",
      test: {
        next: { kind: "speaking", speaking: { sentence: expect.stringContaining("please") } },
      },
    });

    await expect(savedSpeaking(goalId)).resolves.toBeNull();

    await expect(gradeLevelTestSpeech({ audio, goalId })).resolves.toMatchObject({
      test: { next: { kind: "done" } },
    });
  });
});
