import { prisma } from "@zoonk/db";
import { type MemoryExport } from "../memory-contract";
import { getMemoryAccess } from "./memory-access";
import { toMemoryFactView } from "./memory-fact-view";

/**
 * Everything a learner's memory holds: every fact with its status and history (including deleted
 * facts not yet purged) and every insight shown to them. Shared by the memory export and the
 * account-wide export, which call it after deriving the learner from the session.
 */
export async function loadMemoryExport(userId: string): Promise<MemoryExport> {
  const [access, facts, insights] = await Promise.all([
    getMemoryAccess(userId),
    prisma.memoryFact.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { userId },
    }),
    prisma.memoryInsight.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { kind: { not: null }, message: { not: null }, userId },
    }),
  ]);

  return {
    enabled: access.enabled,
    exportedAt: new Date(),
    facts: facts.map((fact) => ({
      ...toMemoryFactView(fact),
      deletedAt: fact.deletedAt,
      lastUsedAt: fact.lastUsedAt,
      status: fact.status,
      supersededById: fact.supersededById,
    })),
    insights: insights.flatMap(({ createdAt, id, kind, message, status }) =>
      kind && message ? [{ createdAt, id, kind, message, status }] : [],
    ),
  };
}
