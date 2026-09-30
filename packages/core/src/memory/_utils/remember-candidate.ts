import "server-only";
import { type MemoryReconcileAction } from "@zoonk/ai/tasks/v2/memory/decisions";
import { gateMemoryFact } from "@zoonk/ai/tasks/v2/memory/gate";
import { reconcileMemoryFact } from "@zoonk/ai/tasks/v2/memory/reconcile";
import { type MemoryFact } from "@zoonk/db";
import { type MemoryChange, type MemorySource } from "../memory-contract";
import { type MemoryAccess } from "./memory-access";
import { type MemoryCandidate, isSameStatement } from "./memory-candidates";
import { toMemoryFactView } from "./memory-fact-view";
import {
  type NewMemoryFact,
  addMemoryFact,
  removeMemoryFact,
  replaceMemoryFact,
} from "./memory-writes";
import { findRelatedMemoryFacts } from "./related-memory-facts";

export type CandidateContext = {
  access: MemoryAccess;
  language: string;
  now: Date;
  provenance: NewMemoryFact["provenance"];
  source: MemorySource;
  userId: string;
};

/**
 * A fact to remember must pass the gate: lasting, and not sensitive unless an adult explicitly
 * asked. A fact to forget stores nothing, so it skips the gate. Returns null when the fact stays
 * out, or whether a kept fact is sensitive.
 */
async function passGate({
  access,
  candidate,
}: {
  access: MemoryAccess;
  candidate: MemoryCandidate;
}): Promise<{ sensitive: boolean } | null> {
  if (candidate.intent === "forget") {
    return { sensitive: false };
  }

  const verdict = await gateMemoryFact({ allowSensitive: access.allowSensitive, candidate });
  return verdict.decision === "keep" ? { sensitive: verdict.sensitive } : null;
}

/**
 * Code catches exact repeats before a model looks; with nothing related there's nothing to
 * compare, so the fact is added (or, to forget, ignored).
 */
async function decide({
  candidate,
  related,
}: {
  candidate: MemoryCandidate;
  related: MemoryFact[];
}): Promise<MemoryReconcileAction> {
  const repeat = related.findIndex((fact) => isSameStatement(fact.statement, candidate.statement));

  if (repeat !== -1) {
    return candidate.intent === "forget"
      ? { action: "remove", index: repeat }
      : { action: "ignore" };
  }

  const run = await reconcileMemoryFact({ existing: related, fact: candidate });

  if (run) {
    return run.decision;
  }

  return candidate.intent === "forget" ? { action: "ignore" } : { action: "add" };
}

async function applyDecision({
  action,
  fact,
  related,
  userId,
}: {
  action: MemoryReconcileAction;
  fact: NewMemoryFact;
  related: MemoryFact[];
  userId: string;
}): Promise<MemoryChange | null> {
  if (action.action === "add") {
    const added = await addMemoryFact({ fact, userId });
    return { action: "added", fact: toMemoryFactView(added), previous: null };
  }

  const target = action.action === "ignore" ? undefined : related[action.index];

  if (!target) {
    return null;
  }

  if (action.action === "remove") {
    const removed = await removeMemoryFact({ factId: target.id, userId });
    return removed ? { action: "removed", fact: null, previous: toMemoryFactView(removed) } : null;
  }

  const replaced = await replaceMemoryFact({ fact, previousId: target.id, userId });

  return replaced
    ? {
        action: "replaced",
        fact: toMemoryFactView(replaced.fact),
        previous: toMemoryFactView(replaced.previous),
      }
    : null;
}

/**
 * Takes one candidate through the gate, compares it with related facts and applies the decision:
 * "I switched to Law" replaces "Wants Medicine" instead of sitting next to it. Returns what
 * changed, or null when memory stays the same.
 */
export async function rememberCandidate({
  candidate,
  context,
}: {
  candidate: MemoryCandidate;
  context: CandidateContext;
}): Promise<MemoryChange | null> {
  const { access, language, now, provenance, source, userId } = context;
  const gate = await passGate({ access, candidate });

  if (!gate) {
    return null;
  }

  const related = await findRelatedMemoryFacts({
    candidate,
    categories: access.categories,
    language,
    now,
    userId,
  });

  const action = await decide({ candidate, related });

  const fact: NewMemoryFact = {
    category: candidate.category,
    confidence: candidate.confidence,
    expiresAt: candidate.expiresAt,
    origin: candidate.origin,
    provenance,
    sensitive: gate.sensitive,
    source,
    statement: candidate.statement,
  };

  return applyDecision({ action, fact, related, userId });
}
