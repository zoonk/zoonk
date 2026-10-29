import "server-only";
import {
  type GenerateLevelTestBankParams,
  generateLevelTestBank,
} from "@zoonk/ai/tasks/v2/language/level-test-bank";
import { type LanguageLevelTest, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { toProvenanceData } from "../../../library/_utils/library-rows";
import { type LevelTestBank, levelTestBankSchema } from "../level-test-contract";
import { hasLevelTestAudio, prepareLevelTestAudio } from "./level-test-audio";

const STALE_CLAIM_MS = 660_000;

export type LanguagePair = { language: string; targetLanguage: string };

export type LevelTestBankAnalytics = Omit<
  NonNullable<GenerateLevelTestBankParams["analytics"]>,
  "contentScope"
>;

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

  const bank = { audioStartedAt: new Date().toISOString(), questions, speaking: data.speaking };

  const { count } = await prisma.languageLevelTest.updateMany({
    data: { content: bank, ...toProvenanceData(provenance) },
    where: { ...pair, runId: claimId },
  });

  if (count > 0) {
    await prepareLevelTestAudio({ analytics, bank, pair });
  }

  return count > 0;
}

async function releaseClaim({ claimId, pair }: { claimId: string; pair: LanguagePair }) {
  await prisma.languageLevelTest.updateMany({
    data: { generatedAt: new Date(0) },
    where: { ...pair, model: "", runId: claimId },
  });
}

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

/** A null claim means another run owns the bank; do not start a second writer. */
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

export async function loadLevelTestBank(pair: LanguagePair): Promise<LevelTestBankState> {
  const row = await findBankRow(pair);
  const bank = readBank(row);

  if (bank && (await hasLevelTestAudio({ bank, pair }))) {
    return { bank, status: "ready" };
  }

  const audioStartedAt = bank?.audioStartedAt ? new Date(bank.audioStartedAt) : null;
  const startedAt = bank ? audioStartedAt : row?.generatedAt;
  const running = startedAt && startedAt.getTime() > Date.now() - STALE_CLAIM_MS;
  return { startedAt: running ? startedAt : null, status: "preparing" };
}
