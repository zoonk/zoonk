import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type SessionPatternsParams,
  type SessionPatternsSchema,
  findSessionPatterns,
} from "@zoonk/ai/tasks/v2/memory/session-patterns";
import { normalizeString } from "@zoonk/utils/string";
import { z } from "zod";
import { type SessionPatternsExpected, TEST_CASES } from "./test-cases";

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

const outputSchema = z.object({
  patterns: z.array(z.object({ evidence: z.string(), statement: z.string() })),
});

type OutputPattern = z.infer<typeof outputSchema>["patterns"][number];

function getPatterns(output: string): OutputPattern[] | null {
  try {
    const parsed = outputSchema.safeParse(JSON.parse(output));
    return parsed.success ? parsed.data.patterns : null;
  } catch {
    return null;
  }
}

function containsAny(text: string, keywords: readonly string[]): boolean {
  const normalized = normalizeString(text);
  return keywords.some((keyword) => normalized.includes(normalizeString(keyword)));
}

/**
 * Code-checked like memory extraction: each expected pattern must come out with one of its key
 * words, no statement may hold a forbidden word (study time, a single slip), and the count stays
 * within what the numbers show. Each is one check.
 */
const scoreSessionPatterns: TaskScorer<SessionPatternsExpected> = ({ output, testCase }) => {
  const patterns = getPatterns(output);
  const expected = testCase.expected;

  if (!patterns || !expected) {
    return createFixedScore({ conclusion: "Output had no patterns array.", score: MIN_SCORE });
  }

  const missing = expected.patterns.filter(
    (pattern) => !patterns.some((item) => containsAny(item.statement, pattern.keywords)),
  );

  const forbidden = patterns.filter((item) =>
    containsAny(item.statement, expected.forbidden ?? []),
  );

  const tooMany = patterns.length > expected.maxPatterns;

  const problems = [
    ...missing.map((pattern) => `Missing a pattern with ${pattern.keywords.join("/")}.`),
    ...forbidden.map((item) => `Kept "${item.statement}", which shouldn't be a pattern.`),
    tooMany && `Returned ${patterns.length} patterns; at most ${expected.maxPatterns} fit.`,
  ].filter((problem): problem is string => Boolean(problem));

  const total = expected.patterns.length + 2;
  const passed = total - missing.length - (forbidden.length > 0 ? 1 : 0) - (tooMany ? 1 : 0);

  return createFixedScore({
    conclusion: problems.join(" ") || "None",
    score: MIN_SCORE + (SCORE_RANGE * passed) / total,
  });
};

export const memorySessionPatternsTask: Task<
  SessionPatternsParams,
  SessionPatternsSchema,
  SessionPatternsExpected
> = {
  description: "Notice lasting patterns in how a learner learns from their sessions' numbers",
  generate: findSessionPatterns,
  id: "memory-session-patterns",
  name: "Memory Session Patterns",
  score: scoreSessionPatterns,
  testCases: TEST_CASES,
};
