import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { oweFollowUps } from "../follow-ups/owe-follow-ups";

export async function owePlusMocks(db: TransactionClient, userId: string) {
  const goals = await db.goal.findMany({
    select: { examBlueprintId: true, id: true },
    where: { kind: "exam", status: "active", userId },
  });

  await oweFollowUps({
    db,
    followUps: goals.map(({ examBlueprintId, id }) => ({
      input: { examBlueprintId, goalId: id, later: true },
      kind: "prepareMockSupply",
    })),
    userId,
  });
}
