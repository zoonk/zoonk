import "server-only";
import { type Attempt, type StudySessionBlock, prisma, sql } from "@zoonk/db";
import { NOT_LESSON_ANSWER_SQL } from "@zoonk/db/lesson-answer";
import { restoreCheckpointAnswers } from "../../checkpoints/_utils/checkpoint-answer-evidence";
import { writingTaskSchema } from "../../exams/essays/writing-contract";
import { classifyAnswers } from "../answer-material";
import { getBlockItemIds, readBlockPayload } from "../block-payload";
import { type ScoredAnswer } from "../brain-power";

type AnswerRow = Pick<
  Attempt,
  "answeredAt" | "durationMs" | "id" | "isCorrect" | "itemId" | "skillId" | "stepId"
>;

type WritingTask = ReturnType<typeof writingTaskSchema.parse>;

export type SessionAnswer = AnswerRow &
  ScoredAnswer & { isBlockAnswer: boolean; writingTask?: WritingTask | null };

const SAVED_WRITING_ITEM = sql`CASE WHEN jsonb_typeof(answer -> 'writing') = 'object'
  THEN answer ->> 'itemId' END`;

const ANSWER_COLUMNS = sql`id, answered_at AS "answeredAt", duration_ms AS "durationMs",
  is_correct AS "isCorrect", COALESCE(${SAVED_WRITING_ITEM}, item_id::text) AS "itemId",
  skill_id AS "skillId", step_id AS "stepId"`;

type SessionAnswerRow = AnswerRow & {
  isBlockAnswer: boolean;
  writingTask: unknown;
  writingVersion: string | null;
};

/** Capsule and drill questions are due today; they build Hyperdrive like new material. */
export function getDueItemIds(blocks: readonly StudySessionBlock[]): Set<string> {
  return new Set(
    blocks.flatMap((block) => {
      const payload = readBlockPayload(block);

      return [
        ...payload.capsules.flatMap((capsule) => capsule.itemIds),
        ...payload.drills.flatMap((drill) => drill.itemIds),
      ];
    }),
  );
}

/** Includes lesson answers in order, classified as due, new, or previously answered correctly for Brain Power. */
export async function loadSessionAnswers({
  blocks,
  sessionId,
  userId,
}: {
  blocks: readonly StudySessionBlock[];
  sessionId: string;
  userId: string;
}): Promise<SessionAnswer[]> {
  const rows = await prisma.$queryRaw<SessionAnswerRow[]>`
    SELECT ${ANSWER_COLUMNS}, (${NOT_LESSON_ANSWER_SQL}) AS "isBlockAnswer", answer -> 'writingTask' AS "writingTask",
           CASE WHEN ${SAVED_WRITING_ITEM} IS NOT NULL
             THEN answer #>> '{conditions,version}' END AS "writingVersion"
    FROM attempts
    WHERE study_session_id = ${sessionId}::uuid AND user_id = ${userId}::uuid
    ORDER BY answered_at ASC
  `;

  const answers = rows.map(({ writingTask, writingVersion, ...answer }) => ({
    ...answer,
    ...(writingVersion === "firstDraft" && {
      writingTask: writingTaskSchema.safeParse(writingTask).data ?? null,
    }),
  }));

  const itemIds = rows.flatMap((answer) => answer.itemId ?? []);
  const stepIds = rows.flatMap((answer) => answer.stepId ?? []);
  const writingIds = rows.flatMap((answer) => (answer.writingVersion ? (answer.itemId ?? []) : []));

  const history =
    itemIds.length === 0 && stepIds.length === 0
      ? []
      : await prisma.$queryRaw<AnswerRow[]>`
          SELECT ${ANSWER_COLUMNS} FROM attempts
          WHERE user_id = ${userId}::uuid AND is_correct
            AND (item_id = ANY(${itemIds}::uuid[]) OR step_id = ANY(${stepIds}::uuid[])
            ${writingIds.length > 0 ? sql`OR ${SAVED_WRITING_ITEM} = ANY(${writingIds}::text[])` : sql``})
        `;

  return classifyAnswers({ answers, dueItemIds: getDueItemIds(blocks), history });
}

export function getBlockAnswers({
  answers,
  block,
}: {
  answers: readonly SessionAnswer[];
  block: StudySessionBlock;
}): SessionAnswer[] {
  const payload = readBlockPayload(block);
  const itemIds = new Set(getBlockItemIds(payload));

  return restoreCheckpointAnswers({ answers, payload }).filter(
    (answer) => answer.isBlockAnswer && answer.itemId !== null && itemIds.has(answer.itemId),
  );
}
