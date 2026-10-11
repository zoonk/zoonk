import { type ExtractedMemoryFact } from "@zoonk/ai/tasks/v2/memory/extraction";
import { type SessionPattern } from "@zoonk/ai/tasks/v2/memory/session-patterns";
import { type MemoryCategory, type MemoryOrigin } from "@zoonk/db";
import { MS_PER_DAY, parseLocalDate } from "@zoonk/utils/date";
import { normalizeString } from "@zoonk/utils/string";
import { MAX_MEMORY_STATEMENT_LENGTH } from "../memory-contract";

/** One chat or session rarely says more than a few lasting things; more is usually noise. */
const MAX_CANDIDATES = 5;

/**
 * How sure Zoonk is about a new fact: what the learner said beats what their activity suggests,
 * and both stay below a fact the learner wrote or corrected themselves (1).
 */
const CONFIDENCE_BY_ORIGIN: Record<MemoryOrigin, number> = { noticed: 0.6, said: 0.9 };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export type MemoryCandidate = {
  category: MemoryCategory;
  statement: string;
  origin: MemoryOrigin;
  intent: ExtractedMemoryFact["intent"];
  evidence: string;
  confidence: number;
  expiresAt: Date | null;
};

type ExpiryResult = { expired: true } | { expired: false; expiresAt: Date | null };

/**
 * A fact that ends on a day stays true through that day, so it expires at the next midnight. A
 * date that isn't a real calendar day is ignored rather than guessed, and a day already over means
 * the fact is no longer true.
 */
function readExpiry({ expiresOn, today }: { expiresOn: string | null; today: Date }): ExpiryResult {
  if (!expiresOn || !DATE_PATTERN.test(expiresOn)) {
    return { expired: false, expiresAt: null };
  }

  const day = parseLocalDate(expiresOn);

  if (day.toISOString().slice(0, 10) !== expiresOn) {
    return { expired: false, expiresAt: null };
  }

  if (day < today) {
    return { expired: true };
  }

  return { expired: false, expiresAt: new Date(day.getTime() + MS_PER_DAY) };
}

/**
 * A session's numbers can only show how someone learns, so each pattern is a learning fact the app
 * noticed. When and how long they study is the plan's setting for one goal, not a fact about them.
 */
export function toSessionFacts(patterns: readonly SessionPattern[]): ExtractedMemoryFact[] {
  return patterns.map(({ evidence, statement }) => ({
    category: "learning",
    evidence,
    expiresOn: null,
    intent: "remember",
    origin: "noticed",
    statement,
  }));
}

function toCandidate({
  fact,
  today,
}: {
  fact: ExtractedMemoryFact;
  today: Date;
}): MemoryCandidate | null {
  const statement = fact.statement.replaceAll(/\s+/gu, " ").trim();
  const expiry = readExpiry({ expiresOn: fact.expiresOn, today });

  if (expiry.expired || !statement || statement.length > MAX_MEMORY_STATEMENT_LENGTH) {
    return null;
  }

  return {
    category: fact.category,
    confidence: CONFIDENCE_BY_ORIGIN[fact.origin],
    evidence: fact.evidence.trim(),
    expiresAt: expiry.expiresAt,
    intent: fact.intent,
    origin: fact.origin,
    statement,
  };
}

/**
 * Turns what a model proposed into candidates code can trust: no fact whose end date has passed,
 * one copy of each statement and at most a handful per run.
 */
export function toMemoryCandidates({
  facts,
  today,
}: {
  facts: readonly ExtractedMemoryFact[];
  today: Date;
}): MemoryCandidate[] {
  const candidates = facts.flatMap((fact) => toCandidate({ fact, today }) ?? []);

  const keys = candidates.map(
    (candidate) => `${candidate.intent}:${normalizeString(candidate.statement)}`,
  );

  return candidates
    .filter((_, index) => keys.indexOf(keys[index] ?? "") === index)
    .slice(0, MAX_CANDIDATES);
}

/** Two statements that differ only in case, accents or spacing are the same fact. */
export function isSameStatement(first: string, second: string): boolean {
  return normalizeString(first) === normalizeString(second);
}
