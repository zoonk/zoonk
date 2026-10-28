import "server-only";
import { prisma } from "@zoonk/db";
import { mockAnswersSql } from "@zoonk/db/anonymous-records";

const MIN_ANSWER_MS = 10_000;
const MAX_ANSWER_MS = 900_000;

const MIN_ANSWERS = 100;
const MIN_LEARNERS = 5;

const RECENT_MOCKS = 500;

const MS_PER_MINUTE = 60_000;

type PaceRow = { answers: number; learners: number; ms: number | null };

export async function loadMockPace(examBlueprintId: string | null): Promise<number | null> {
  "use cache";

  if (!examBlueprintId) {
    return null;
  }

  const [row] = await prisma.$queryRaw<PaceRow[]>`
    SELECT count(*)::int AS answers, count(DISTINCT learner)::int AS learners,
      avg(duration_ms)::float AS ms
    FROM ${mockAnswersSql({ examBlueprintId, mocks: RECENT_MOCKS })} a
    WHERE duration_ms BETWEEN ${MIN_ANSWER_MS} AND ${MAX_ANSWER_MS}`;

  if (!row || row.ms === null || row.answers < MIN_ANSWERS || row.learners < MIN_LEARNERS) {
    return null;
  }

  return row.ms / MS_PER_MINUTE;
}
