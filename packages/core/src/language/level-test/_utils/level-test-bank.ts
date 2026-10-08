import "server-only";
import {
  type GenerateLevelTestBankParams,
  generateLevelTestBank,
} from "@zoonk/ai/tasks/v2/language/level-test-bank";
import { type LanguageLevelTest, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { toProvenanceData } from "../../../library/_utils/library-rows";
import { type LevelTestBank, levelTestBankSchema } from "../level-test-contract";

/**
 * A bank still empty after this long was lost with its run, so another one may write it. The
 * writer's slowest runs have taken about three minutes, and the workflow step writing it retries
 * a failed attempt at once (a failed writer also gives its claim up), so a live run is never
 * taken over.
 */
const STALE_CLAIM_MS = 660_000;

export type LanguagePair = { language: string; targetLanguage: string };

/** Who the bank's calls ran for; the bank itself is always shared by the pair's learners. */
export type LevelTestBankAnalytics = Omit<
  NonNullable<GenerateLevelTestBankParams["analytics"]>,
  "contentScope"
>;

/** The pair's bank, or when the run writing it started (null when nothing is writing it yet). */
export type LevelTestBankState =
  | { bank: LevelTestBank; status: "ready" }
  | { startedAt: Date | null; status: "preparing" };

export function readBank(row: Pick<LanguageLevelTest, "content"> | null): LevelTestBank | null {
  const bank = levelTestBankSchema.safeParse(row?.content);
  return bank.success && bank.data.questions.length > 0 ? bank.data : null;
}

export function findBankRow(pair: LanguagePair) {
  return prisma.languageLevelTest.findUnique({ where: { languagePair: pair } });
}

/**
 * Writes the bank under the run's claim; false when a newer run took the claim over, so a late
 * run never overwrites it.
 */
async function writeBank({
  analytics,
  claimId,
  pair,
}: {
  analytics: LevelTestBankAnalytics;
  claimId: string;
  pair: LanguagePair;
}): Promise<boolean> {
  const { data, provenance } = await generateLevelTestBank({
    analytics: { ...analytics, contentScope: "shared" },
    learnerLanguage: pair.language,
    targetLanguage: pair.targetLanguage,
  });

  const counts = new Map<string, number>();

  const questions = data.questions.map((question) => {
    const key = `${question.skill}-${question.level}`;
    const index = counts.get(key) ?? 0;
    counts.set(key, index + 1);
    return { ...question, id: `${key}-${index}` };
  });

  const { count } = await prisma.languageLevelTest.updateMany({
    data: { content: { questions, speaking: data.speaking }, ...toProvenanceData(provenance) },
    where: { ...pair, runId: claimId },
  });

  return count > 0;
}

/** A run that failed gives its claim up at once, so the next request writes the bank again. */
async function releaseClaim({ claimId, pair }: { claimId: string; pair: LanguagePair }) {
  await prisma.languageLevelTest.updateMany({
    data: { generatedAt: new Date(0) },
    where: { ...pair, model: "", runId: claimId },
  });
}

/** Writes the bank under the claim, giving the claim up when the writer fails. */
export async function writeClaimedBank({
  analytics,
  claimId,
  pair,
}: {
  analytics: LevelTestBankAnalytics;
  claimId: string;
  pair: LanguagePair;
}): Promise<boolean> {
  try {
    return await writeBank({ analytics, claimId, pair });
  } catch (error) {
    await releaseClaim({ claimId, pair });
    throw error;
  }
}

/**
 * Claims writing the pair's bank: the first run creates the row, and a row whose run went quiet
 * for `STALE_CLAIM_MS` (or gave its claim up) is taken over. Null when another run holds a live
 * claim.
 */
export async function claimBank({
  pair,
  row,
}: {
  pair: LanguagePair;
  row: Pick<LanguageLevelTest, "generatedAt"> | null;
}): Promise<{ claimId: string; startedAt: Date } | null> {
  const claimId = crypto.randomUUID();
  const startedAt = new Date();

  if (row) {
    const { count } = await prisma.languageLevelTest.updateMany({
      data: { generatedAt: startedAt, runId: claimId },
      where: { ...pair, generatedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) }, model: "" },
    });

    return count > 0 ? { claimId, startedAt } : null;
  }

  try {
    await prisma.languageLevelTest.create({
      data: {
        ...pair,
        content: {},
        generatedAt: startedAt,
        model: "",
        promptVersion: "",
        runId: claimId,
      },
    });

    return { claimId, startedAt };
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return null;
    }

    throw error;
  }
}

/**
 * The level test of a language pair, written once and shared, or since when a run has been
 * writing it (`startedAt` null when nothing is: a claim that went quiet or was given up). Only
 * workflows write it (`writeLevelTestBank`), started when a language goal's pair is known or when
 * the learner asks the level test to start it; showing the test never does.
 */
export async function loadLevelTestBank(pair: LanguagePair): Promise<LevelTestBankState> {
  const row = await findBankRow(pair);
  const bank = readBank(row);

  if (bank) {
    return { bank, status: "ready" };
  }

  const running = row && row.generatedAt.getTime() > Date.now() - STALE_CLAIM_MS;
  return { startedAt: running ? row.generatedAt : null, status: "preparing" };
}
