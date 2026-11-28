import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";

export function readTestOutChange({
  db = prisma,
  goalId,
  receipt,
}: {
  db?: TransactionClient;
  goalId: string;
  receipt: string;
}) {
  return db.planChange.findFirst({
    select: { id: true, payload: true },
    where: {
      kind: "testedOut",
      payload: { equals: receipt, path: ["testReceipt"] },
      plan: { goalId },
      status: "applied",
    },
  });
}
