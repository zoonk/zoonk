import "server-only";
import { type MemoryReconcileAction } from "@zoonk/ai/tasks/memory/decisions";
import { gateMemoryFact } from "@zoonk/ai/tasks/memory/gate";
import { reconcileMemoryFact } from "@zoonk/ai/tasks/memory/reconcile";
import { type MemoryFact } from "@zoonk/db";
import { type MemoryCandidate, isSameStatement } from "./_utils/memory-candidates";
import { toMemoryFactView } from "./_utils/memory-fact-view";
import {
  type NewMemoryFact,
  addMemoryFact,
  removeMemoryFact,
  replaceMemoryFact,
} from "./_utils/memory-writes";
import { findRelatedMemoryFacts } from "./_utils/related-memory-facts";
import { type MemoryChange, type MemorySource } from "./memory-contract";

export type CandidateContext = {
  language: string;
  now: Date;
  provenance: NewMemoryFact["provenance"];
  source: MemorySource;
  userId: string;
};

export type MemoryGate = { sensitive: boolean };

/** Null when the candidate isn't worth keeping; a model failure throws. */
export async function gateMemoryCandidate(candidate: MemoryCandidate): Promise<MemoryGate | null> {
  if (candidate.intent === "forget") {
    return { sensitive: false };
  }

  const verdict = await gateMemoryFact({ candidate });
  return verdict.decision === "keep" ? { sensitive: verdict.sensitive } : null;
}

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

/** Decides against the facts it relates to and saves; a model failure throws before anything is saved. */
export async function saveMemoryCandidate({
  candidate,
  context,
  gate,
}: {
  candidate: MemoryCandidate;
  context: CandidateContext;
  gate: MemoryGate;
}): Promise<MemoryChange | null> {
  const { language, now, provenance, source, userId } = context;
  const related = await findRelatedMemoryFacts({ candidate, language, now, userId });
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

export async function rememberCandidate({
  candidate,
  context,
}: {
  candidate: MemoryCandidate;
  context: CandidateContext;
}): Promise<MemoryChange | null> {
  const gate = await gateMemoryCandidate(candidate);
  return gate ? saveMemoryCandidate({ candidate, context, gate }) : null;
}
