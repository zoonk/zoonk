import { prisma } from "@zoonk/db";

export function listOwed(userId: string) {
  return prisma.followUp.findMany({
    orderBy: [{ kind: "asc" }, { key: "asc" }],
    select: { input: true, key: true, kind: true },
    where: { userId },
  });
}
