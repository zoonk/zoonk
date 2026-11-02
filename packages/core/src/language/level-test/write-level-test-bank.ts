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

/** System workflow capability without a learner session; never call from a render or GET. */
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
