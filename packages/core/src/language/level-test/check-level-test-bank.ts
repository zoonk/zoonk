import "server-only";
import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type LevelTestQuestionToCheck,
  checkLevelTestQuestions,
  findLevelTestQuestionProblem,
} from "@zoonk/ai/tasks/language/check-level-test-questions";
import { prisma } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { logInfo } from "@zoonk/utils/logger";
import {
  type LanguagePair,
  type LevelTestBankAnalytics,
  findBankRow,
  readBank,
} from "./_utils/level-test-bank";
import { type LevelTestQuestion } from "./level-test-contract";

const OWED_BANKS_PER_SWEEP = 100;

type CheckableQuestion = LevelTestQuestionToCheck & { answerIndex: number; level: CefrLevel };

/**
 * System workflow capability: the questions that pass their check, in order. One level's questions
 * go in one call; a provider error throws, so the step retries it.
 */
export async function checkLevelTestBankQuestions<Question extends CheckableQuestion>({
  analytics = {},
  pair,
  questions,
  wait,
}: {
  analytics?: LevelTestBankAnalytics;
  pair: LanguagePair;
  questions: readonly Question[];
  wait: CallWait;
}): Promise<Question[]> {
  const { data } = await checkLevelTestQuestions({
    analytics: { ...analytics, contentScope: "shared" },
    learnerLanguage: pair.language,
    questions,
    serviceTier: chooseServiceTier({ wait }),
    targetLanguage: pair.targetLanguage,
  });

  const problems = questions.map((question, index) =>
    findLevelTestQuestionProblem({ check: data.checks[index] ?? null, question }),
  );

  for (const [index, problem] of problems.entries()) {
    if (problem) {
      logInfo("[level-test] Question dropped by its check", {
        ...pair,
        level: questions[index]?.level,
        problem,
      });
    }
  }

  return questions.filter((_, index) => !problems[index]);
}

const owesCheck = { checkedAt: null, model: { not: "" } };

/** Internal workflow bridge for the daily sweep: banks stored before their questions were checked. */
export async function listOwedLevelTestBankChecks(): Promise<LanguagePair[]> {
  return prisma.languageLevelTest.findMany({
    orderBy: { generatedAt: "asc" },
    select: { language: true, targetLanguage: true },
    take: OWED_BANKS_PER_SWEEP,
    where: owesCheck,
  });
}

/**
 * System workflow capability: claims a stored bank's one check and returns its questions, or null
 * when it owes none. A check that fails after its retries isn't run again.
 */
export async function claimLevelTestBankCheck(
  pair: LanguagePair,
): Promise<LevelTestQuestion[] | null> {
  const row = await prisma.languageLevelTest.findFirst({ where: { ...owesCheck, ...pair } });
  const bank = readBank(row);

  if (!row || !bank) {
    return null;
  }

  const { count } = await prisma.languageLevelTest.updateMany({
    data: { checkedAt: new Date() },
    where: { checkedAt: null, id: row.id, runId: row.runId },
  });

  return count > 0 ? bank.questions : null;
}

/**
 * System workflow capability: leaves the bank only the questions that passed. A learner's answer
 * to a removed question stops counting, and the test asks another in its place. A bank with none
 * left is given up, so the pair's next level test writes a new one.
 */
export async function keepCheckedLevelTestQuestions({
  keptIds,
  pair,
}: {
  keptIds: readonly string[];
  pair: LanguagePair;
}): Promise<{ removed: number }> {
  const bank = readBank(await findBankRow(pair));
  const kept = new Set(keptIds);
  const questions = bank?.questions.filter((question) => kept.has(question.id)) ?? [];

  if (!bank || questions.length === bank.questions.length) {
    return { removed: 0 };
  }

  await prisma.languageLevelTest.update({
    data:
      questions.length > 0
        ? { content: { ...bank, questions } }
        : { checkedAt: null, content: {}, generatedAt: new Date(0), model: "" },
    where: { languagePair: pair },
  });

  return { removed: bank.questions.length - questions.length };
}
