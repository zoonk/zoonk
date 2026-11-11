import "server-only";
import { combineTaskProvenance } from "@zoonk/ai/combine-task-provenance";
import { type TaskProvenance } from "@zoonk/ai/task-provenance";
import {
  type GenerateLevelTestBankParams,
  type GenerateLevelTestBankSchema,
} from "@zoonk/ai/tasks/language/level-test-bank";
import { type LanguageLevelTest, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { toProvenanceData } from "../../../library/_utils/library-rows";
import { type LevelTestBank, levelTestBankSchema } from "../level-test-contract";

const STALE_CLAIM_MS = 660_000;

export type LanguagePair = { language: string; targetLanguage: string };

export type LevelTestBankAnalytics = Omit<
  NonNullable<GenerateLevelTestBankParams["analytics"]>,
  "contentScope"
>;

export type LevelTestBankState =
  | { bank: LevelTestBank; status: "ready"; writtenAt: Date }
  | { startedAt: Date | null; status: "preparing" };

export function readBank(row: Pick<LanguageLevelTest, "content"> | null): LevelTestBank | null {
  const bank = levelTestBankSchema.safeParse(row?.content);
  return bank.success && bank.data.questions.length > 0 ? bank.data : null;
}

export function findBankRow(pair: LanguagePair) {
  return prisma.languageLevelTest.findUnique({ where: { languagePair: pair } });
}

export type LevelTestBankLevel = {
  provenance: TaskProvenance;
  questions: GenerateLevelTestBankSchema["questions"];
  speaking: GenerateLevelTestBankSchema["speaking"][number];
};

function toStoredQuestions(questions: LevelTestBankLevel["questions"]) {
  const counts = new Map<string, number>();

  return questions.map((question) => {
    const key = `${question.skill}-${question.level}`;
    const index = counts.get(key) ?? 0;
    counts.set(key, index + 1);
    return { ...question, id: `${key}-${index}` };
  });
}

/** False when a newer run took the claim over, so its bank stays. */
export async function storeBank({
  claimId,
  levels,
  pair,
}: {
  claimId: string;
  levels: readonly LevelTestBankLevel[];
  pair: LanguagePair;
}): Promise<boolean> {
  const questions = toStoredQuestions(levels.flatMap((level) => level.questions));

  if (questions.length === 0) {
    throw new Error("No placement question passed its check");
  }

  const speaking = levels.map((level) => level.speaking);
  const provenance = combineTaskProvenance(levels.map((level) => level.provenance));

  const { count } = await prisma.languageLevelTest.updateMany({
    data: {
      checkedAt: new Date(),
      content: { questions, speaking },
      ...toProvenanceData(provenance),
    },
    where: { ...pair, runId: claimId },
  });

  return count > 0;
}

export async function releaseClaim({ claimId, pair }: { claimId: string; pair: LanguagePair }) {
  await prisma.languageLevelTest.updateMany({
    data: { generatedAt: new Date(0) },
    where: { ...pair, model: "", runId: claimId },
  });
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

  if (bank && row) {
    return { bank, status: "ready", writtenAt: row.generatedAt };
  }

  const running = row && row.generatedAt.getTime() > Date.now() - STALE_CLAIM_MS;
  return { startedAt: running ? row.generatedAt : null, status: "preparing" };
}
