import { type ExtractedMemoryFact } from "@zoonk/ai/tasks/v2/memory/extraction";
import { type SessionPattern } from "@zoonk/ai/tasks/v2/memory/session-patterns";
import { type MemoryCategory, type MemoryOrigin } from "@zoonk/db";
import { MS_PER_DAY, parseLocalDate } from "@zoonk/utils/date";
import { normalizeString } from "@zoonk/utils/string";
import { MAX_MEMORY_STATEMENT_LENGTH } from "../memory-limits";

const MAX_CANDIDATES = 5;

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

/** A fact that ends on a day stays true through it, so it expires at the next midnight. */
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

export function isSameStatement(first: string, second: string): boolean {
  return normalizeString(first) === normalizeString(second);
}
