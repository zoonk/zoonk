import "server-only";
import { prisma } from "@zoonk/db";

export function readTestOutChange({ goalId, receipt }: { goalId: string; receipt: string }) {
  return prisma.planChange.findFirst({
    select: { id: true },
    where: {
      kind: "testedOut",
      payload: { equals: receipt, path: ["testReceipt"] },
      plan: { goalId },
      status: "applied",
    },
  });
}
