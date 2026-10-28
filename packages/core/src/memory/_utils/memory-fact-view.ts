import { type MemoryFact } from "@zoonk/db";
import { type MemoryFactView, type MemorySource, memorySourceSchema } from "../memory-contract";

function readMemorySource(value: unknown): MemorySource | null {
  const source = memorySourceSchema.safeParse(value);
  return source.success ? source.data : null;
}

export function toMemoryFactView(fact: MemoryFact): MemoryFactView {
  return {
    category: fact.category,
    confidence: fact.confidence,
    createdAt: fact.createdAt,
    expiresAt: fact.expiresAt,
    id: fact.id,
    origin: fact.origin,
    sensitive: fact.sensitive,
    source: readMemorySource(fact.sourceRef),
    statement: fact.statement,
    updatedAt: fact.updatedAt,
  };
}

export function currentFactsWhere({ now, userId }: { now: Date; userId: string }) {
  return {
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    status: "active" as const,
    userId,
  };
}
