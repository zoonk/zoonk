import { LEVEL_TEST_LEVELS } from "@zoonk/ai/tasks/language/level-test-levels";
import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import {
  levelTestBankFixture,
  recordedLevelTestsFixture,
} from "@zoonk/testing/fixtures/level-tests";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { readGoalDetails } from "../_utils/language-goal";
import { answerLanguageLevelTest } from "./answer-language-level-test";
import { checkLevelTestAnswers } from "./check-level-test-answers";
import { keepCheckedLevelTestQuestions } from "./check-level-test-bank";
import { getLanguageLevelTest } from "./get-language-level-test";
import { levelTestBankSchema, levelTestProgressSchema } from "./level-test-contract";

type Pair = { language: string; targetLanguage: string };

async function learnerOfStoredBank() {
  const { pair, questions, runId } = await levelTestBankFixture({ levels: LEVEL_TEST_LEVELS });
  const setup = await languageGoalFixture();

  await prisma.goal.update({ data: pair, where: { id: setup.goal.id } });
  mockSession(setup.user.id);

  return { goalId: setup.goal.id, pair, questions, runId, userId: setup.user.id };
}

async function shownQuestionId(goalId: string) {
  const view = await getLanguageLevelTest(goalId);

  return view.status === "ready" &&
    view.test.status === "ready" &&
    view.test.next.kind === "question"
    ? view.test.next.question.id
    : "";
}

async function answerShownQuestion(goalId: string) {
  const questionId = await shownQuestionId(goalId);

  await answerLanguageLevelTest({
    goalId,
    input: { answerIndex: 1, durationMs: 9000, questionId },
  });

  return questionId;
}

async function readRecordId(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return levelTestProgressSchema.parse(readGoalDetails(goal).levelTest).recordId;
}

async function storedQuestionIds(pair: Pair) {
  const row = await prisma.languageLevelTest.findUniqueOrThrow({ where: { languagePair: pair } });
  return levelTestBankSchema.parse(row.content).questions.map((question) => question.id);
}

/**
 * Right at B2 and C1 in both skills, picking the second option on `reading-B1-0`. The listening
 * "I don't know" balances that reading miss, so the skills don't read apart.
 */
const STRONG_PICKS = {
  "listening-B1-1": null,
  "listening-B2-0": 0,
  "listening-C1-0": 0,
  "reading-B1-0": 1,
  "reading-B2-0": 0,
  "reading-C1-0": 0,
};

describe("level test answers kept for checking the bank", () => {
  it("keeps each answer anonymously from the first, with the question as it was asked", async () => {
    const { goalId, pair, questions, runId } = await learnerOfStoredBank();
    const firstId = await answerShownQuestion(goalId);
    const secondId = await answerShownQuestion(goalId);
    const recordId = await readRecordId(goalId);

    await expect(
      prisma.anonymousLevelTest.findUniqueOrThrow({ where: { id: recordId } }),
    ).resolves.toStrictEqual({
      ...pair,
      answers: [firstId, secondId].map((id) => ({ answerIndex: 1, durationMs: 9000, id })),
      bankRunId: runId,
      id: recordId,
      questions: [firstId, secondId].map((id) => questions.find((question) => question.id === id)),
      startScore: expect.any(Number),
    });
  });

  it("keeps an answer sent twice at once only once", async () => {
    const { goalId } = await learnerOfStoredBank();
    const questionId = await shownQuestionId(goalId);
    const input = { answerIndex: 0, questionId };

    await Promise.all([
      answerLanguageLevelTest({ goalId, input }),
      answerLanguageLevelTest({ goalId, input }),
    ]);

    const recordId = await readRecordId(goalId);
    const record = await prisma.anonymousLevelTest.findUniqueOrThrow({ where: { id: recordId } });

    expect(record.answers).toStrictEqual([{ answerIndex: 0, durationMs: 0, id: questionId }]);
  });

  it("keeps the answers of a learner who deletes their account", async () => {
    const { goalId, userId } = await learnerOfStoredBank();
    await answerShownQuestion(goalId);
    const recordId = await readRecordId(goalId);

    await prisma.user.delete({ where: { id: userId } });

    await expect(prisma.anonymousLevelTest.count({ where: { id: recordId } })).resolves.toBe(1);
  });
});

describe(checkLevelTestAnswers, () => {
  it("removes a question learners' answers show to be wrong, reading only the bank's current version", async () => {
    const { pair, runId } = await levelTestBankFixture({ levels: LEVEL_TEST_LEVELS });

    await recordedLevelTestsFixture({ count: 20, pair, picks: STRONG_PICKS, runId, startScore: 4 });

    // An earlier version's answers that would remove `listening-A1-0`.
    await recordedLevelTestsFixture({
      count: 20,
      pair,
      picks: { ...STRONG_PICKS, "listening-A1-0": 1, "reading-B1-0": 0 },
      runId: "earlier-bank",
      startScore: 4,
    });

    const { removed } = await checkLevelTestAnswers();
    const kept = await storedQuestionIds(pair);

    expect(removed).toBeGreaterThanOrEqual(1);
    expect(kept).not.toContain("reading-B1-0");
    expect(kept).toContain("listening-A1-0");
  });

  it("keeps both removals when two runs remove different questions at once", async () => {
    const { pair, questions } = await levelTestBankFixture({ levels: LEVEL_TEST_LEVELS });
    const ids = questions.map((question) => question.id);

    await Promise.all([
      keepCheckedLevelTestQuestions({ keptIds: ids.filter((id) => id !== "reading-A1-0"), pair }),
      keepCheckedLevelTestQuestions({ keptIds: ids.filter((id) => id !== "reading-A2-0"), pair }),
    ]);

    await expect(storedQuestionIds(pair)).resolves.toStrictEqual(
      ids.filter((id) => id !== "reading-A1-0" && id !== "reading-A2-0"),
    );
  });
});
