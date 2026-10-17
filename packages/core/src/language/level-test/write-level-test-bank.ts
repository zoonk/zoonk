import "server-only";
import {
  type LanguagePair,
  type LevelTestBankAnalytics,
  claimBank,
  findBankRow,
  readBank,
  writeClaimedBank,
} from "./_utils/level-test-bank";

type WriteLevelTestBankResult = { status: "lost" | "ready" | "running" | "written" };

/**
 * Writes a language pair's level test ahead, from a workflow started when a language goal is
 * created, so the pair's first learner finds the questions ready instead of waiting on the test
 * screen. Nothing happens when the bank is written (`ready`) or another run is writing it
 * (`running`); otherwise this run claims it and waits for the writer: `written`, or `lost` when a
 * newer run took the claim over first. A failed writer gives the claim up and throws, so a retry
 * writes it again. System work for a shared pair: it reads no learner's session, and it's never
 * called while rendering a page or answering a GET.
 */
export async function writeLevelTestBank({
  analytics = {},
  pair,
}: {
  analytics?: LevelTestBankAnalytics;
  pair: LanguagePair;
}): Promise<WriteLevelTestBankResult> {
  const row = await findBankRow(pair);

  if (readBank(row)) {
    return { status: "ready" };
  }

  const claim = await claimBank({ pair, row });

  if (!claim) {
    return { status: "running" };
  }

  const written = await writeClaimedBank({ analytics, claimId: claim.claimId, pair });
  return { status: written ? "written" : "lost" };
}
