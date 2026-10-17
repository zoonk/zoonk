import { prisma } from "@zoonk/db";
import { readLearningProfile } from "../../learner/facts/learning-profile";
import { getRequestInstant } from "../../learner/facts/request-instant";
import { type MemoryExport } from "../memory-contract";
import { toMemoryFactView } from "./memory-fact-view";

/**
 * Everything a learner's memory holds: every fact with its status and history (including deleted
 * facts not yet purged) and every insight shown to them. Shared by the memory export and the
 * account-wide export, which call it after deriving the learner from the session.
 */
export async function loadMemoryExport(userId: string): Promise<MemoryExport> {
  const [profile, facts, insights, now] = await Promise.all([
    readLearningProfile(userId),
    prisma.memoryFact.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { userId },
    }),
    prisma.memoryInsight.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { kind: { not: null }, message: { not: null }, userId },
    }),
    getRequestInstant(),
  ]);

  return {
    enabled: profile?.memoryEnabled ?? true,
    exportedAt: now,
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
