import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type MemorySearchTermsParams,
  type MemorySearchTermsSchema,
  generateMemorySearchTerms,
} from "@zoonk/ai/tasks/v2/memory/search-terms";
import { type SearchTerm, parseSearchTerms } from "@zoonk/core/library/identity/text-search-query";
import { isJsonObject } from "@zoonk/utils/json";
import { removeAccents } from "@zoonk/utils/string";
import { type MemorySearchTermsExpected, TEST_CASES } from "./test-cases";

const PARTIAL_SCORE = 8;
const WORD_PATTERN = /[\p{L}\p{M}\p{N}]+/gu;
const MIN_STEM_LENGTH = 3;

/**
 * A rough stand-in for Postgres stemming on plurals and third-person verbs ("works", "studies",
 * "examples"), so the score isn't lower only because a term is singular. Postgres stems more than
 * this, so results stay a lower bound of what the database finds.
 */
function toStem(word: string): string {
  const plain = removeAccents(word.toLowerCase());

  if (plain.endsWith("ies") && plain.length - 3 >= MIN_STEM_LENGTH) {
    return `${plain.slice(0, -3)}y`;
  }

  if (plain.endsWith("s") && !plain.endsWith("ss") && plain.length - 1 >= MIN_STEM_LENGTH) {
    return plain.slice(0, -1);
  }

  return plain;
}

function matchesNote({ terms, text }: { terms: readonly SearchTerm[]; text: string }): boolean {
  const stems = new Set((text.match(WORD_PATTERN) ?? []).map((word) => toStem(word)));

  return terms.some((term) =>
    term.every((spellings) => spellings.some((spelling) => stems.has(toStem(spelling)))),
  );
}

function getTerms(output: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(output);

    if (!isJsonObject(parsed) || !Array.isArray(parsed.terms)) {
      return null;
    }

    return parsed.terms.filter((term): term is string => typeof term === "string");
  } catch {
    return null;
  }
}

/**
 * Checks which of the learner's facts the terms would find, with the database's rule on whole
 * words and a rough stemmer. Every fact the task needs should be found;
 * finding most of the others only costs relevance checks, so it lowers the score a little.
 */
const scoreMemorySearchTerms: TaskScorer<MemorySearchTermsExpected> = ({ output, testCase }) => {
  const generated = getTerms(output);
  const expected = testCase.expected;

  if (!generated || !expected) {
    return {
      ...createFixedScore({ conclusion: "Output had no terms array.", score: 6 }),
      classification: { expected: "all", predicted: null },
    };
  }

  const terms = parseSearchTerms(generated);
  const found = (text: string) => matchesNote({ terms, text });
  const missed = expected.relevant.filter((text) => !found(text));
  const noise = expected.irrelevant.filter((text) => found(text));
  const predicted = missed.length === 0 ? "all" : "missed";
  const classification = { expected: "all", predicted };

  if (missed.length === expected.relevant.length) {
    const conclusion = `Found none of the needed facts with: ${generated.join(", ")}.`;
    return { ...createFixedScore({ conclusion, score: 6 }), classification };
  }

  if (missed.length > 0) {
    const conclusion = `Missed ${missed.join("; ")} with: ${generated.join(", ")}.`;
    return { ...createFixedScore({ conclusion, score: 7 }), classification };
  }

  if (noise.length * 2 > expected.irrelevant.length) {
    const conclusion = `Found every needed fact, plus ${noise.length} of ${expected.irrelevant.length} others.`;
    return { ...createFixedScore({ conclusion, score: PARTIAL_SCORE }), classification };
  }

  return { ...createFixedScore({ conclusion: "None", score: 10 }), classification };
};

export const memorySearchTermsTask: Task<
  MemorySearchTermsParams,
  MemorySearchTermsSchema,
  MemorySearchTermsExpected
> = {
  description: "Write search terms that find the facts in a learner's memory an AI task needs",
  generate: generateMemorySearchTerms,
  id: "memory-search-terms",
  name: "Memory Search Terms",
  score: scoreMemorySearchTerms,
  testCases: TEST_CASES,
};
