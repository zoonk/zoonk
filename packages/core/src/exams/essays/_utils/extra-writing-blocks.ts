import "server-only";
import { type TransactionClient } from "@zoonk/db";

export function unfinishedExtraWritingWhere({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}) {
  return {
    AND: [
      { payload: { equals: true, path: ["extra"] } },
      { payload: { equals: "answer", path: ["writing", "unit"] } },
    ],
    kind: "produce",
    session: { goalId, userId },
    status: { in: ["active", "pending"] },
  } satisfies NonNullable<
    Parameters<TransactionClient["studySessionBlock"]["findMany"]>[0]
  >["where"];
}
