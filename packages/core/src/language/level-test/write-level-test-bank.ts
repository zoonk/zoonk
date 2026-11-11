import "server-only";
import { generateLevelTestBankLevel } from "@zoonk/ai/tasks/language/level-test-bank";
import { type TestLevel } from "@zoonk/ai/tasks/language/level-test-levels";
import {
  type LanguagePair,
  type LevelTestBankAnalytics,
  type LevelTestBankLevel,
  claimBank,
  findBankRow,
  readBank,
  releaseClaim,
  storeBank,
} from "./_utils/level-test-bank";

export type { LevelTestBankLevel } from "./_utils/level-test-bank";

export type LevelTestBankClaim =
  | { status: "ready" | "running" }
  | { claimId: string; status: "claimed" };

/**
 * System workflow capability without a learner session; never call from a render or GET. Only a
 * `claimed` run writes the pair's bank, and it ends with `storeLevelTestBank` or
 * `releaseLevelTestBankClaim`.
 */
export async function claimLevelTestBank(pair: LanguagePair): Promise<LevelTestBankClaim> {
  const row = await findBankRow(pair);

  if (readBank(row)) {
    return { status: "ready" };
  }

  const claim = await claimBank({ pair, row });
  return claim ? { claimId: claim.claimId, status: "claimed" } : { status: "running" };
}

/** System workflow capability: one level's questions as written, before their check. */
export async function writeLevelTestBankLevel({
  analytics = {},
  level,
  pair,
}: {
  analytics?: LevelTestBankAnalytics;
  level: TestLevel;
  pair: LanguagePair;
}): Promise<LevelTestBankLevel> {
  const { data, provenance } = await generateLevelTestBankLevel({
    analytics: { ...analytics, contentScope: "shared" },
    learnerLanguage: pair.language,
    level,
    targetLanguage: pair.targetLanguage,
  });

  return { provenance, questions: data.questions, speaking: data.speaking };
}

/** System workflow capability: `lost` when a newer run took the claim over, so its bank stays. */
export async function storeLevelTestBank(input: {
  claimId: string;
  levels: readonly LevelTestBankLevel[];
  pair: LanguagePair;
}): Promise<"lost" | "written"> {
  return (await storeBank(input)) ? "written" : "lost";
}

/** System workflow capability: a run that couldn't write the bank lets the next one claim it. */
export async function releaseLevelTestBankClaim(input: {
  claimId: string;
  pair: LanguagePair;
}): Promise<void> {
  await releaseClaim(input);
}
