import "server-only";
import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import { generateLevelTestBankPart } from "@zoonk/ai/tasks/language/level-test-bank";
import { type LevelTestBankPart } from "@zoonk/ai/tasks/language/level-test-bank-parts";
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
import { levelTestConfirmationsInputSchema } from "./level-test-contract";

export type { LevelTestBankLevel } from "./_utils/level-test-bank";

export type LevelTestBankClaim =
  | { status: "ready" | "running" }
  | { claimId: string; status: "claimed" };

/**
 * System workflow capability without a learner session; never call from a render or GET. Only a
 * `claimed` run writes the pair's bank, and it ends with `storeLevelTestBank` or
 * `releaseLevelTestBankClaim`.
 */
export async function claimLevelTestBank(
  pair: LanguagePair,
  upgrade = false,
): Promise<LevelTestBankClaim> {
  const row = await findBankRow(pair);

  const bank = readBank(row);

  if (bank && (!upgrade || bank.confirmations !== undefined)) {
    return { status: "ready" };
  }

  const claim = await claimBank({ pair, row, upgrade: Boolean(bank) });
  return claim ? { claimId: claim.claimId, status: "claimed" } : { status: "running" };
}

/** System workflow capability: one model call from the level's bank. */
export async function writeLevelTestBankPart({
  analytics = {},
  level,
  pair,
  part,
  wait,
}: {
  analytics?: LevelTestBankAnalytics;
  level: TestLevel;
  pair: LanguagePair;
  part: LevelTestBankPart;
  wait: CallWait;
}) {
  const { data, provenance } = await generateLevelTestBankPart({
    analytics: { ...analytics, contentScope: "shared" },
    learnerLanguage: pair.language,
    level,
    part,
    serviceTier: chooseServiceTier({ wait }),
    targetLanguage: pair.targetLanguage,
  });

  return {
    confirmations: levelTestConfirmationsInputSchema.parse(data.confirmations),
    provenance,
    questions: data.questions,
  };
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
