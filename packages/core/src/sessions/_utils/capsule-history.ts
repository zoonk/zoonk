import "server-only";
import { type Attempt, sql } from "@zoonk/db";
import { loadAnswerPerItem } from "../../learner/_utils/answer-per-item";

type EarlierAnswer = Pick<Attempt, "answer" | "answeredAt" | "isCorrect"> & { itemId: string };

export function loadCapsuleHistory({
  itemIds,
  sessionId,
  userId,
}: {
  itemIds: readonly string[];
  sessionId: string;
  userId: string;
}) {
  return loadAnswerPerItem<EarlierAnswer>({
    columns: sql`answer, answered_at AS "answeredAt", is_correct AS "isCorrect", item_id AS "itemId"`,
    order: "last",
    userId,
    where: sql`item_id = ANY(${[...itemIds]}::uuid[])
      AND (study_session_id IS NULL OR study_session_id <> ${sessionId}::uuid)`,
  });
}
