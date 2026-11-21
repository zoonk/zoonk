import "server-only";
import { combineTaskProvenance } from "@zoonk/ai/combine-task-provenance";
import { type TaskProvenance } from "@zoonk/ai/task-provenance";
import {
  type GenerateLevelTestBankParams,
  type GenerateLevelTestBankSchema,
} from "@zoonk/ai/tasks/language/level-test-bank";
import {
  type LanguageLevelTest,
  type TransactionClient,
  isPrismaUniqueConstraintError,
  prisma,
} from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { logError } from "@zoonk/utils/logger";
import { toProvenanceData } from "../../../library/_utils/library-rows";
import {
  type LevelTestBank,
  type LevelTestConfirmation,
  type LevelTestQuestion,
  levelTestBankSchema,
} from "../level-test-contract";

const STALE_CLAIM_MS = 660_000;

export type LanguagePair = { language: string; targetLanguage: string };

export type LevelTestBankAnalytics = Omit<
  NonNullable<GenerateLevelTestBankParams["analytics"]>,
  "contentScope"
>;

export type LevelTestBankState =
  | { bank: LevelTestBank; id: string; runId: string; status: "ready"; writtenAt: Date }
  | { startedAt: Date | null; status: "preparing" };

export function readBank(row: Pick<LanguageLevelTest, "content"> | null): LevelTestBank | null {
  const bank = levelTestBankSchema.safeParse(row?.content);
  return bank.success && bank.data.questions.length > 0 ? bank.data : null;
}

export function findBankRow(pair: LanguagePair, db: TransactionClient = prisma) {
  return db.languageLevelTest.findUnique({ where: { languagePair: pair } });
}

/**
 * Keeps the stored bank's questions that `keep` accepts. Removals from different runs each see
 * the other's result, so neither brings back a question the other took out. A bank is never
 * emptied, since nothing writes a stored bank again.
 */
export async function keepBankQuestions({
  keep,
  pair,
}: {
  keep: (question: LevelTestQuestion) => boolean;
  pair: LanguagePair;
}): Promise<{ removed: number }> {
  return prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<Pick<LanguageLevelTest, "content">[]>`
      SELECT content FROM language_level_tests
      WHERE language = ${pair.language} AND target_language = ${pair.targetLanguage}
      FOR UPDATE`;

    const bank = readBank(row ?? null);
    const questions = bank?.questions.filter((question) => keep(question)) ?? [];

    if (!bank || questions.length === bank.questions.length) {
      return { removed: 0 };
    }

    if (questions.length === 0) {
      logError("[level-test] Removing these questions would leave a stored bank empty", pair);
      return { removed: 0 };
    }

    await tx.languageLevelTest.update({
      data: { content: { ...(isJsonObject(row?.content) && row.content), questions } },
      where: { languagePair: pair },
    });

    return { removed: bank.questions.length - questions.length };
  });
}

export type LevelTestBankLevel = {
  provenance: TaskProvenance;
  questions: GenerateLevelTestBankSchema["questions"];
  confirmations?: Omit<LevelTestConfirmation, "id">[];
  speaking?: LevelTestBank["speaking"][number];
};

function withQuestionIds<T extends Pick<LevelTestQuestion, "level" | "skill">>({
  questions,
  prefix,
}: {
  questions: T[];
  prefix: string;
}) {
  const counts = new Map<string, number>();

  return questions.map((question) => {
    const key = `${prefix}${question.skill}-${question.level}`;
    const index = counts.get(key) ?? 0;
    counts.set(key, index + 1);
    return { ...question, id: `${key}-${index}` };
  });
}

async function lockClaimedBank({
  claimId,
  db,
  pair,
}: {
  claimId: string;
  db: TransactionClient;
  pair: LanguagePair;
}) {
  const [row] = await db.$queryRaw<Pick<LanguageLevelTest, "content">[]>`
    SELECT content FROM language_level_tests
    WHERE language = ${pair.language} AND target_language = ${pair.targetLanguage} AND run_id = ${claimId}
    FOR UPDATE`;

  return row ?? null;
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
  return prisma.$transaction(async (db) => {
    const row = await lockClaimedBank({ claimId, db, pair });

    if (!row) {
      return false;
    }

    const current = readBank(row);

    const questions = withQuestionIds({
      prefix: current ? "v2-" : "",
      questions: levels.flatMap((level) => level.questions),
    });

    if (questions.length === 0) {
      throw new Error("No placement question passed its check");
    }

    const confirmations = withQuestionIds({
      prefix: "confirmation-",
      questions: levels.flatMap((level) => level.confirmations ?? []),
    });

    const speaking =
      current?.speaking ?? levels.flatMap(({ speaking: sentence }) => sentence ?? []);

    const provenance = combineTaskProvenance(levels.map((level) => level.provenance));

    const { count } = await db.languageLevelTest.updateMany({
      data: {
        checkedAt: new Date(),
        content: {
          ...(levels.some((level) => level.confirmations !== undefined) && { confirmations }),
          questions: [...(current?.questions ?? []), ...questions],
          speaking,
        },
        ...toProvenanceData(provenance),
      },
      where: { ...pair, runId: claimId },
    });

    return count > 0;
  });
}

export async function releaseClaim({ claimId, pair }: { claimId: string; pair: LanguagePair }) {
  await prisma.languageLevelTest.updateMany({
    data: { generatedAt: new Date(0) },
    where: { ...pair, runId: claimId },
  });
}

function isUpgrading(content: unknown): boolean {
  return isJsonObject(content) && content.upgrading === true;
}

/** A null claim means another run owns the bank; do not start a second writer. */
export async function claimBank({
  pair,
  row,
  upgrade,
}: {
  pair: LanguagePair;
  row: Pick<LanguageLevelTest, "content" | "generatedAt" | "runId"> | null;
  upgrade: boolean;
}): Promise<{ claimId: string; startedAt: Date } | null> {
  const claimId = crypto.randomUUID();
  const startedAt = new Date();

  if (row) {
    const canClaim = upgrade && !isUpgrading(row.content);
    const stale = new Date(startedAt.getTime() - STALE_CLAIM_MS);

    const count = await prisma.$executeRaw`
      UPDATE language_level_tests
      SET run_id = ${claimId}, generated_at = ${startedAt},
          content = CASE WHEN ${upgrade} THEN content || '{"upgrading":true}'::jsonb ELSE content END
      WHERE language = ${pair.language} AND target_language = ${pair.targetLanguage}
        AND run_id = ${row.runId} AND (${canClaim} OR generated_at < ${stale})`;

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

export async function loadLevelTestBank(
  pair: LanguagePair,
  requireConfirmations = false,
): Promise<LevelTestBankState> {
  const row = await findBankRow(pair);
  const bank = readBank(row);

  if (bank && row && (!requireConfirmations || bank.confirmations !== undefined)) {
    return { bank, id: row.id, runId: row.runId, status: "ready", writtenAt: row.generatedAt };
  }

  const running =
    row &&
    (!bank || isUpgrading(row.content)) &&
    row.generatedAt.getTime() > Date.now() - STALE_CLAIM_MS;

  return { startedAt: running ? row.generatedAt : null, status: "preparing" };
}
