import "server-only";
import { generateLevelTestConfirmations } from "@zoonk/ai/tasks/language/level-test-confirmations";
import { type LanguageLevelTest, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type FollowUp } from "../../follow-ups/follow-up-contract";
import { hasCompleteLevelCheck, listLevelConfirmations } from "./_utils/confirmation-bank";
import { type LevelTestBankAnalytics, findBankRow, readBank } from "./_utils/level-test-bank";
import { type LevelTestConfirmation } from "./level-test-contract";
import { readLevelTestAttempts } from "./read-level-test-summary";

const PREVIOUS_PASSAGES_LIMIT = 16;

export type Replenishment = Extract<FollowUp, { kind: "replenishLevelTestChecks" }>["input"];

/** Run under the shared pair and level token before spending. */
export async function readLevelTestCheckShortage({
  goalId,
  level,
  pair,
  userId,
}: Replenishment & { userId: string }) {
  const [goal, row] = await Promise.all([
    prisma.goal.findFirst({
      select: { details: true },
      where: {
        id: goalId,
        kind: "language",
        language: pair.language,
        targetLanguage: pair.targetLanguage,
        userId,
      },
    }),
    findBankRow(pair),
  ]);

  const bank = readBank(row);

  if (!goal || !bank?.confirmations) {
    return null;
  }

  const used = new Set(readLevelTestAttempts(goal).usedConfirmations);
  const fresh = bank.confirmations.filter(({ id }) => !used.has(id));

  return hasCompleteLevelCheck(
    listLevelConfirmations({ bank: { ...bank, confirmations: fresh }, level }),
  )
    ? null
    : bank.confirmations
        .filter((item) => item.level === level)
        .map(({ passage }) => passage)
        .slice(-PREVIOUS_PASSAGES_LIMIT);
}

export async function writeLevelTestChecks({
  analytics,
  level,
  pair,
  previousPassages,
}: Pick<Replenishment, "level" | "pair"> & {
  analytics: LevelTestBankAnalytics;
  previousPassages: string[];
}) {
  const { data } = await generateLevelTestConfirmations({
    analytics: { ...analytics, contentScope: "shared" },
    learnerLanguage: pair.language,
    level,
    previousPassages,
    targetLanguage: pair.targetLanguage,
  });

  return data.confirmations;
}

function passageKey(passage: string) {
  return passage.trim().replaceAll(/\s+/gu, " ").toLowerCase();
}

export function appendLevelTestChecks({
  confirmations,
  pair,
  batchId,
}: Pick<Replenishment, "pair"> & {
  confirmations: Omit<LevelTestConfirmation, "id">[];
  batchId: string;
}): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<Pick<LanguageLevelTest, "content">[]>`
      SELECT content FROM language_level_tests
      WHERE language = ${pair.language} AND target_language = ${pair.targetLanguage}
      FOR UPDATE`;

    const saved = readBank(row ?? null)?.confirmations;

    if (!row || !isJsonObject(row.content) || !saved) {
      return [];
    }

    const prefix = `confirmation-refill-${batchId}-`;
    const fromThisRun = saved.filter(({ id }) => id.startsWith(prefix));

    if (fromThisRun.length > 0) {
      return fromThisRun.filter(({ skill }) => skill === "listening").map(({ passage }) => passage);
    }

    const seen = new Set(saved.map(({ passage }) => passageKey(passage)));
    const addedAt = new Date().toISOString();

    const fresh = confirmations.flatMap((question, index) => {
      const key = passageKey(question.passage);

      if (seen.has(key)) {
        return [];
      }

      seen.add(key);
      return [{ ...question, addedAt, id: `${prefix}${index}` }];
    });

    if (!hasCompleteLevelCheck(fresh)) {
      throw new Error("The level check writer did not return two new questions in each skill.");
    }

    await tx.languageLevelTest.update({
      data: { content: { ...row.content, confirmations: [...saved, ...fresh] } },
      where: { languagePair: pair },
    });

    return fresh.filter(({ skill }) => skill === "listening").map(({ passage }) => passage);
  });
}
