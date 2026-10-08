import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type MemoryExtractionParams,
  type MemoryExtractionSchema,
  extractMemoryFacts,
} from "@zoonk/ai/tasks/v2/memory/extraction";
import { normalizeString } from "@zoonk/utils/string";
import { z } from "zod";
import { type ExpectedFact, type MemoryExtractionExpected, TEST_CASES } from "./test-cases";

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

const outputSchema = z.object({
  facts: z.array(
    z.object({
      category: z.string(),
      evidence: z.string(),
      expiresOn: z.string().nullable(),
      intent: z.string(),
      statement: z.string(),
    }),
  ),
});

type OutputFact = z.infer<typeof outputSchema>["facts"][number];

function getFacts(output: string): OutputFact[] | null {
  try {
    const parsed = outputSchema.safeParse(JSON.parse(output));
    return parsed.success ? parsed.data.facts : null;
  } catch {
    return null;
  }
}

function containsAny(text: string, keywords: readonly string[]): boolean {
  const normalized = normalizeString(text);
  return keywords.some((keyword) => normalized.includes(normalizeString(keyword)));
}

function matchesExpected(fact: OutputFact, expected: ExpectedFact): boolean {
  return (
    expected.categories.some((category) => category === fact.category) &&
    containsAny(fact.statement, expected.keywords) &&
    fact.intent === (expected.intent ?? "remember") &&
    (!expected.expiresOn || expected.expiresOn.includes(fact.expiresOn ?? "")) &&
    (!expected.evidence || containsAny(fact.evidence, expected.evidence))
  );
}

function describeExpected(expected: ExpectedFact): string {
  return `${expected.intent ?? "remember"} ${expected.categories.join("/")} fact with ${expected.keywords.join("/")}`;
}

/** Each expected fact, the ban on forbidden words and the fact count are one check each. */
function checkFacts({
  expected,
  facts,
}: {
  expected: MemoryExtractionExpected;
  facts: OutputFact[];
}): { passed: number; problems: string[]; total: number } {
  const missing = expected.facts.filter(
    (fact) => !facts.some((item) => matchesExpected(item, fact)),
  );

  // A fact to forget names what to forget, so only facts to remember can break the ban.
  const forbidden = facts.filter(
    (fact) => fact.intent === "remember" && containsAny(fact.statement, expected.forbidden ?? []),
  );

  const tooMany = facts.length > expected.maxFacts;

  const problems = [
    ...missing.map((fact) => `Missing a ${describeExpected(fact)}.`),
    ...forbidden.map((fact) => `Kept "${fact.statement}", which shouldn't be a fact.`),
    tooMany && `Returned ${facts.length} facts; at most ${expected.maxFacts} fit.`,
  ].filter((problem): problem is string => Boolean(problem));

  const total = expected.facts.length + 2;
  const passed = total - missing.length - (forbidden.length > 0 ? 1 : 0) - (tooMany ? 1 : 0);

  return { passed, problems, total };
}

/**
 * Code-checked: every lasting fact the input shows must come out in the right category, with the
 * right intent and end date, and passing states, other categories and injected instructions must
 * not. Wording is free as long as the key words are there.
 */
const scoreMemoryExtraction: TaskScorer<MemoryExtractionExpected> = ({ output, testCase }) => {
  const facts = getFacts(output);
  const expected = testCase.expected;

  if (!facts || !expected) {
    return createFixedScore({ conclusion: "Output had no facts array.", score: MIN_SCORE });
  }

  const { passed, problems, total } = checkFacts({ expected, facts });
  const score = MIN_SCORE + (SCORE_RANGE * passed) / total;

  return createFixedScore({ conclusion: problems.join(" ") || "None", score });
};

export const memoryExtractionTask: Task<
  MemoryExtractionParams,
  MemoryExtractionSchema,
  MemoryExtractionExpected
> = {
  description:
    "Pick out lasting facts about a learner from onboarding answers, a chat or session numbers",
  generate: extractMemoryFacts,
  id: "memory-extraction",
  name: "Memory Extraction",
  score: scoreMemoryExtraction,
  testCases: TEST_CASES,
};
