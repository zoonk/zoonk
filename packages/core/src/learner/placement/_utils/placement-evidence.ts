import "server-only";
import { type Attempt, type ItemFormat, type TransactionClient, prisma } from "@zoonk/db";
import { isLessonAnswer } from "@zoonk/db/lesson-answer";
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
  focusTestId: true,
  fromLesson: true,
  id: true,
  isCorrect: true,
  isPlacement: true,
  item: { select: { content: true, format: true } },
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
  focusTestId: string | null;
  fromLesson: Attempt["fromLesson"];
  isCorrect: boolean;
  isPlacement: boolean;
  item: { content: unknown; format: ItemFormat } | null;
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

export function toPlacementEvidence(attempt: AttemptRow): PlacementEvidence | null {
  if (!attempt.skillId) {
    return null;
  }

  return {
    content: attempt.item?.content,
    format: attempt.item?.format ?? "multipleChoice",
    itemId: attempt.itemId,
    localDate: attempt.localDate,
    outcome: getOutcome(attempt),
    skillId: attempt.skillId,
  };
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

export async function loadSeenPlacementItems({
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
    where: { itemId: { in: itemIds }, userId },
  });

  return new Set(answered.map((attempt) => attempt.itemId));
}

export function loadCourseAnswers(attemptId: string, userId: string, tx: TransactionClient) {
  return tx.attempt.findMany({
    orderBy: [{ answeredAt: "asc" }, { id: "asc" }],
    select: ATTEMPT_EVIDENCE_SELECT,
    where: { ...SITTING_ANSWER_FILTER, focusTestId: attemptId, userId },
  });
}

/** Returns evidence oldest first. */
export async function loadEvidence({
  attemptId,
  skillIds,
  sittingId = null,
  tx = prisma,
  userId,
}: {
  attemptId?: string;
  skillIds: string[];
  sittingId?: string | null;
  tx?: TransactionClient;
  userId: string;
}) {
  const [attempts, testSkills, sittingAnswers, testAnswers, courseAnswers] =
    await readDatabaseFacts(
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
          where: { ...COVERAGE_ANSWER_FILTER, skillId: { in: skillIds }, userId },
        }),
      () =>
        attemptId
          ? tx.attempt.findMany({
              select: ATTEMPT_EVIDENCE_SELECT,
              where: { ...SITTING_ANSWER_FILTER, focusTestId: attemptId, userId },
            })
          : [],
    );

  const chronological = [
    ...new Map(
      [...attempts, ...testAnswers, ...courseAnswers].map((row) => [row.id, row]),
    ).values(),
  ].toSorted((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime() || a.id.localeCompare(b.id));

  const evidence: PlacementEvidence[] = [];
  const placementAnswers: PlacementEvidence[] = [];
  const confirmationAnswers: PlacementEvidence[] = [];

  for (const attempt of chronological) {
    const answer = toPlacementEvidence(attempt);

    if (answer) {
      evidence.push(answer);

      const answerData = isJsonObject(attempt.answer) ? attempt.answer : {};

      if (
        attempt.itemId !== null &&
        !isLessonAnswer(attempt) &&
        attempt.mockExamId === null &&
        !("practiceMistakeId" in answerData) &&
        answerData.courseSearch !== true &&
        answerData.placementPending !== true
      ) {
        confirmationAnswers.push(answer);

        if (isPlacementAnswer(attempt)) {
          placementAnswers.push(answer);
        }
      }
    }
  }

  return {
    attempts: chronological,
    confirmationAnswers,
    evidence,
    placementAnswers,
    seenItemIds: new Set(chronological.map((attempt) => attempt.itemId)),
    sittingOutcomes: sittingAnswers.toReversed().map((attempt) => getOutcome(attempt)),
    testSkills,
  };
}
