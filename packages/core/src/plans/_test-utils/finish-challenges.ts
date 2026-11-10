import { prisma } from "@zoonk/db";

/** Review and practice scenarios have already taken their phase challenges. */
export async function finishChallengesFixture(planId: string) {
  const items = await prisma.planItem.findMany({ where: { planId } });
  const phases = [...new Set(items.map((item) => item.phase))];
  const position = Math.max(-1, ...items.map((item) => item.position)) + 1;

  await prisma.planItem.updateMany({ data: { status: "done" }, where: { kind: "boss", planId } });

  await prisma.planItem.createMany({
    data: phases
      .filter((phase) => !items.some((item) => item.kind === "boss" && item.phase === phase))
      .map((phase, index) => ({
        kind: "boss" as const,
        phase,
        planId,
        position: position + index,
        status: "done" as const,
        titleSnapshot: "Completed challenge",
      })),
  });
}
