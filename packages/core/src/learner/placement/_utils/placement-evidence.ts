import "server-only";
import { type ItemFormat, type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { readDatabaseFacts } from "../../../_utils/read-database-facts";
import { MAX_PACED_ANSWER_MS, UNKNOWN_STREAK } from "../focus-test-rules";
import { type PlacementEvidence } from "../placement-beliefs";
import { isPlacementAnswer } from "./placement-answers";

const MAX_EVIDENCE = 1000;

type AttemptRow = {
  answer: unknown;
  answeredAt: Date;
  durationMs: number;
  isCorrect: boolean;
  isPlacement: boolean;
  item: { format: ItemFormat } | null;
  itemId: string | null;
  localDate: Date;
  skillId: string | null;
  stepId: string | null;
  studySessionId: string | null;
};

function getOutcome(
  attempt: Pick<AttemptRow, "answer" | "isCorrect">,
): PlacementEvidence["outcome"] {
  if (attempt.isCorrect) {
    return "correct";
  }

  return isJsonObject(attempt.answer) && attempt.answer.dontKnow === true ? "dontKnow" : "wrong";
}

function toEvidence(attempt: AttemptRow): PlacementEvidence | null {
  if (!attempt.skillId) {
    return null;
  }

  return {
    format: attempt.item?.format ?? "multipleChoice",
    outcome: getOutcome(attempt),
    skillId: attempt.skillId,
  };
}

function toEvidenceList(attempts: readonly AttemptRow[]): PlacementEvidence[] {
  return attempts.map((attempt) => toEvidence(attempt)).filter((item) => item !== null);
}

export type TestSkillAnswers = {
  answered: number;
  durationMs: number;
  right: number;
  sittingAnswers: number;
  skillId: string;
};

async function loadTestSkills({
  sittingStartedAt,
  skillIds,
  tx,
  userId,
}: {
  sittingStartedAt: Date | null;
  skillIds: string[];
  tx: TransactionClient;
  userId: string;
}): Promise<TestSkillAnswers[]> {
  return tx.$queryRaw<TestSkillAnswers[]>`
    SELECT skill_id AS "skillId", COUNT(*)::int AS answered,
      COUNT(*) FILTER (WHERE is_correct)::int AS right,
      COALESCE(SUM(LEAST(duration_ms, ${MAX_PACED_ANSWER_MS})), 0)::float8 AS "durationMs",
      COUNT(*) FILTER (WHERE study_session_id IS NULL AND step_id IS NULL
        AND item_id IS NOT NULL AND answered_at >= ${sittingStartedAt}::timestamp)::int AS "sittingAnswers"
    FROM attempts
    WHERE user_id = ${userId}::uuid AND skill_id = ANY(${skillIds}::uuid[])
      AND (is_placement OR (item_id IS NOT NULL AND step_id IS NULL AND study_session_id IS NULL))
    GROUP BY skill_id
  `;
}

export async function loadAnsweredTestItems({
  itemIds,
  tx = prisma,
  userId,
}: {
  itemIds: string[];
  tx?: TransactionClient;
  userId: string;
}): Promise<Set<string | null>> {
  const answered = await tx.attempt.groupBy({
    by: ["itemId"],
    where: {
      OR: [{ isPlacement: true }, { stepId: null, studySessionId: null }],
      itemId: { in: itemIds },
      userId,
    },
  });

  return new Set(answered.map((attempt) => attempt.itemId));
}

/** Returns evidence oldest first. */
export async function loadEvidence({
  skillIds,
  sittingStartedAt = null,
  tx = prisma,
  userId,
}: {
  skillIds: string[];
  sittingStartedAt?: Date | null;
  tx?: TransactionClient;
  userId: string;
}) {
  const [attempts, testSkills, sittingAnswers] = await readDatabaseFacts(
    tx,
    () =>
      tx.attempt.findMany({
        orderBy: { answeredAt: "desc" },
        select: {
          answer: true,
          answeredAt: true,
          durationMs: true,
          isCorrect: true,
          isPlacement: true,
          item: { select: { format: true } },
          itemId: true,
          localDate: true,
          skillId: true,
          stepId: true,
          studySessionId: true,
        },
        take: MAX_EVIDENCE,
        where: { skillId: { in: skillIds }, userId },
      }),
    () => loadTestSkills({ sittingStartedAt, skillIds, tx, userId }),
    () =>
      sittingStartedAt
        ? tx.attempt.findMany({
            orderBy: [{ answeredAt: "desc" }, { id: "desc" }],
            select: { answer: true, isCorrect: true },
            take: UNKNOWN_STREAK,
            where: {
              answeredAt: { gte: sittingStartedAt },
              itemId: { not: null },
              skillId: { in: skillIds },
              stepId: null,
              studySessionId: null,
              userId,
            },
          })
        : [],
  );

  const chronological = attempts.toReversed();

  return {
    attempts: chronological,
    evidence: toEvidenceList(chronological),
    placementAnswers: toEvidenceList(chronological.filter((attempt) => isPlacementAnswer(attempt))),
    seenItemIds: new Set(chronological.map((attempt) => attempt.itemId)),
    sittingOutcomes: sittingAnswers.toReversed().map((attempt) => getOutcome(attempt)),
    testSkills,
  };
}
