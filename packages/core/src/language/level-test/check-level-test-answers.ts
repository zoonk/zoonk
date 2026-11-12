import "server-only";
import { prisma } from "@zoonk/db";
import { logInfo } from "@zoonk/utils/logger";
import { z } from "zod";
import {
  type LanguagePair,
  findBankRow,
  keepBankQuestions,
  readBank,
} from "./_utils/level-test-bank";
import {
  MIN_GROUP,
  type RecordedLevelTest,
  findWrongLevelTestQuestions,
} from "./level-test-answer-checks";
import { levelTestAnswerSchema } from "./level-test-contract";

const recordedAnswersSchema = z.array(levelTestAnswerSchema);

async function readRecordedTests({
  bankRunId,
  pair,
}: {
  bankRunId: string;
  pair: LanguagePair;
}): Promise<RecordedLevelTest[]> {
  const rows = await prisma.anonymousLevelTest.findMany({
    select: { answers: true, startScore: true },
    where: { ...pair, bankRunId },
  });

  return rows.map((row) => ({
    answers: recordedAnswersSchema.parse(row.answers),
    startScore: row.startScore,
  }));
}

async function checkBank({ bankRunId, pair }: { bankRunId: string; pair: LanguagePair }) {
  const row = await findBankRow(pair);
  const bank = readBank(row);

  if (!bank || row?.runId !== bankRunId) {
    return 0;
  }

  const tests = await readRecordedTests({ bankRunId, pair });
  const { skillGap, verdicts } = findWrongLevelTestQuestions({ bank, tests });
  const wrong = new Set(verdicts.map((verdict) => verdict.id));

  const { removed } =
    wrong.size === 0
      ? { removed: 0 }
      : await keepBankQuestions({ keep: (question) => !wrong.has(question.id), pair });

  logInfo("[level-test] Checked a bank against learners' answers", {
    ...pair,
    removed,
    skillGap,
    tests: tests.length,
    verdicts,
  });

  return removed;
}

/**
 * System workflow capability for the daily sweep: removes the placement questions learners'
 * answers show to be wrong, in every bank with enough tests. It makes no model call.
 */
export async function checkLevelTestAnswers(): Promise<{ removed: number }> {
  const banks = await prisma.anonymousLevelTest.groupBy({
    by: ["language", "targetLanguage", "bankRunId"],
    having: { id: { _count: { gte: MIN_GROUP } } },
  });

  let removed = 0;

  for (const { bankRunId, language, targetLanguage } of banks) {
    // oxlint-disable-next-line no-await-in-loop -- One bank's tests in memory at a time.
    removed += await checkBank({ bankRunId, pair: { language, targetLanguage } });
  }

  return { removed };
}
