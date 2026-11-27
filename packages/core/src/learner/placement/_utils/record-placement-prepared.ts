import "server-only";
import { prisma } from "@zoonk/db";
import { COURSE_QUESTION_LIMIT } from "../course-search";
import { readCourseBank } from "./course-placement-bank";
import { readPlacementAttempt } from "./placement-attempt-record";

/** A previous curriculum's question writer cannot finish waiting for the rebuilt curriculum. */
export async function recordPlacementPrepared({
  goalId,
  planRunId,
}: {
  goalId: string;
  planRunId: string | null;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const marked = await tx.plan.updateMany({
      data: { placementPreparedAt: new Date() },
      where: { goalId, runId: planRunId },
    });

    if (!marked.count) {
      return;
    }

    const goal = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
    const { attempt } = readPlacementAttempt(goal);

    if (!attempt?.search || attempt.search.topics !== null) {
      return;
    }

    const bank = await readCourseBank(goal, tx);

    if (!bank.ready && bank.topics.length === 0) {
      return;
    }

    const search = bank.ready
      ? {
          ...attempt.search,
          questions: Math.min(COURSE_QUESTION_LIMIT, bank.topics.length * 2),
          topics: bank.topics,
        }
      : { ...attempt.search, failed: true };

    await tx.$executeRaw`
      UPDATE goals SET details=jsonb_set(details,'{placementTest,attempt,search}',${JSON.stringify(search)}::jsonb)
      WHERE id=${goalId}::uuid AND details #>> '{placementTest,attempt,id}'=${attempt.id}
      AND details #> '{placementTest,attempt,search,topics}'='null'::jsonb
    `;
  });
}
