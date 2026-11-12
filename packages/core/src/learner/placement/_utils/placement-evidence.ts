import "server-only";
import { type ItemFormat, type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { readDatabaseFacts } from "../../../_utils/read-database-facts";
import { MAX_PACED_ANSWER_MS, UNKNOWN_STREAK } from "../focus-test-rules";
import { type PlacementEvidence } from "../placement-beliefs";
import {
  COVERAGE_ANSWER_FILTER,
  COVERAGE_ANSWER_SQL,
  SITTING_ANSWER_FILTER,
  SITTING_ANSWER_SQL,
  isPlacementAnswer,
} from "./placement-answers";

const MAX_EVIDENCE = 1000;

const ATTEMPT_EVIDENCE_SELECT = {
  answer: true,
  answeredAt: true,
  durationMs: true,
  id: true,
  isCorrect: true,
  isPlacement: true,
  item: { select: { format: true } },
  itemId: true,
  localDate: true,
  mockExamId: true,
  skillId: true,
  stepId: true,
  studySessionId: true,
} as const;

type AttemptRow = {
  answer: unknown;
  id: string;
  answeredAt: Date;
  durationMs: number;
  isCorrect: boolean;
  isPlacement: boolean;
  item: { format: ItemFormat } | null;
  itemId: string | null;
  localDate: Date;
  mockExamId: string | null;
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
  paceAnswers: number;
  paceDurationMs: number;
  right: number;
  sittingAnswers: number;
  skillId: string;
};

async function loadTestSkills({
  sittingId,
  skillIds,
  tx,
  userId,
}: {
  sittingId: string | null;
  skillIds: string[];
  tx: TransactionClient;
  userId: string;
}): Promise<TestSkillAnswers[]> {
  return tx.$queryRaw<TestSkillAnswers[]>`
    SELECT skill_id AS "skillId", COUNT(*)::int AS answered,
      COUNT(*) FILTER (WHERE is_correct)::int AS right,
      COUNT(*) FILTER (WHERE NOT (answer @> '{"dontKnow":true}'::jsonb))::int AS "paceAnswers",
      COALESCE(SUM(LEAST(duration_ms, ${MAX_PACED_ANSWER_MS}))
        FILTER (WHERE NOT (answer @> '{"dontKnow":true}'::jsonb)), 0)::float8 AS "paceDurationMs",
      COUNT(*) FILTER (WHERE ${SITTING_ANSWER_SQL} AND focus_test_id = ${sittingId}::uuid)::int AS "sittingAnswers"
    FROM attempts
    WHERE user_id = ${userId}::uuid AND skill_id = ANY(${skillIds}::uuid[])
      AND ${COVERAGE_ANSWER_SQL}
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
    where: { ...COVERAGE_ANSWER_FILTER, itemId: { in: itemIds }, userId },
  });

  return new Set(answered.map((attempt) => attempt.itemId));
}

/** Returns evidence oldest first. */
export async function loadEvidence({
  skillIds,
  sittingId = null,
  tx = prisma,
  userId,
}: {
  skillIds: string[];
  sittingId?: string | null;
  tx?: TransactionClient;
  userId: string;
}) {
  const [attempts, testSkills, sittingAnswers, testAnswers] = await readDatabaseFacts(
    tx,
    () =>
      tx.attempt.findMany({
        orderBy: { answeredAt: "desc" },
        select: ATTEMPT_EVIDENCE_SELECT,
        take: MAX_EVIDENCE,
        where: { skillId: { in: skillIds }, userId },
      }),
    () => loadTestSkills({ sittingId, skillIds, tx, userId }),
    () =>
      sittingId
        ? tx.attempt.findMany({
            orderBy: [{ answeredAt: "desc" }, { id: "desc" }],
            select: { answer: true, isCorrect: true },
            take: UNKNOWN_STREAK,
            where: {
              focusTestId: sittingId,
              ...SITTING_ANSWER_FILTER,
              skillId: { in: skillIds },
              userId,
            },
          })
        : [],
    () =>
      tx.attempt.findMany({
        select: ATTEMPT_EVIDENCE_SELECT,
        where: { focusTestId: { not: null }, skillId: { in: skillIds }, userId },
      }),
  );

  const recentIds = new Set(attempts.map((attempt) => attempt.id));

  const chronological = [
    ...attempts,
    ...testAnswers.filter((attempt) => !recentIds.has(attempt.id)),
  ].toSorted((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime() || a.id.localeCompare(b.id));

  return {
    attempts: chronological,
    evidence: toEvidenceList(chronological),
    placementAnswers: toEvidenceList(chronological.filter((attempt) => isPlacementAnswer(attempt))),
    seenItemIds: new Set(chronological.map((attempt) => attempt.itemId)),
    sittingOutcomes: sittingAnswers.toReversed().map((attempt) => getOutcome(attempt)),
    testSkills,
  };
}
