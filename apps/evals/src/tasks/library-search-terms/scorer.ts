import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type LibraryIdentitySubject } from "@zoonk/ai/tasks/v2/identity/subject";
import {
  matchesSearchTerms,
  parseSearchTerms,
} from "@zoonk/core/library/identity/text-search-query";
import { isJsonObject } from "@zoonk/utils/json";

export type LibrarySearchItem = { id: string; text: string };

type LibrarySearchExpectation = { library: LibrarySearchItem[]; targetId: string };

export type LibrarySearchTermsExpected = { items: LibrarySearchExpectation[] };

const MISSED_SCORE = 6;
const NOISY_SCORE = 8;
const FOUND_SCORE = 10;

type ItemScore = { conclusion: string | null; found: boolean; score: number };

function getBaseTerms(subject: LibraryIdentitySubject): string[] {
  if (subject.kind === "image") {
    return [];
  }

  return [subject.item.title, ...(subject.item.skills ?? [])];
}

function toTerms(value: unknown): string[] {
  const terms = isJsonObject(value) && Array.isArray(value.terms) ? value.terms : [];
  return terms.filter((term): term is string => typeof term === "string");
}

function getGeneratedTerms(output: string): string[][] | null {
  try {
    const parsed: unknown = JSON.parse(output);

    if (!isJsonObject(parsed) || !Array.isArray(parsed.subjects)) {
      return null;
    }

    return parsed.subjects.map((entry) => toTerms(entry));
  } catch {
    return null;
  }
}

function scoreItem({
  expected,
  generated,
  number,
  subject,
}: {
  expected: LibrarySearchExpectation;
  generated: readonly string[];
  number: number;
  subject: LibraryIdentitySubject;
}): ItemScore {
  const terms = parseSearchTerms([...getBaseTerms(subject), ...generated]);
  const matches = expected.library.filter((item) => matchesSearchTerms({ terms, text: item.text }));
  const found = matches.some((item) => item.id === expected.targetId);
  const nearMisses = matches.filter((item) => item.id !== expected.targetId).length;
  const nearMissTotal = expected.library.length - 1;
  const label = `Item ${number} (${subject.item.title})`;

  if (!found) {
    const conclusion = `${label}: target ${expected.targetId} not found with terms: ${generated.join(", ")}.`;
    return { conclusion, found, score: MISSED_SCORE };
  }

  if (nearMisses * 2 > nearMissTotal) {
    const conclusion = `${label}: found the target, plus ${nearMisses} of ${nearMissTotal} near misses.`;
    return { conclusion, found, score: NOISY_SCORE };
  }

  return { conclusion: null, found, score: FOUND_SCORE };
}

export const scoreLibrarySearchTerms: TaskScorer<LibrarySearchTermsExpected> = ({
  output,
  testCase,
}) => {
  const generated = getGeneratedTerms(output);
  const expected = testCase.expected;
  const { subjects } = testCase.userInput as { subjects: LibraryIdentitySubject[] };

  if (!generated || !expected) {
    return {
      ...createFixedScore({ conclusion: "Output had no subjects list.", score: MISSED_SCORE }),
      classification: { expected: "found", predicted: null },
    };
  }

  const scores = subjects.map((subject, index) =>
    scoreItem({
      expected: expected.items[index] ?? { library: [], targetId: "" },
      generated: generated[index] ?? [],
      number: index + 1,
      subject,
    }),
  );

  const found = scores.every((item) => item.found);
  const score = Math.min(...scores.map((item) => item.score));
  const conclusions = scores.flatMap((item) => item.conclusion ?? []);
  const classification = { expected: "found", predicted: found ? "found" : "missed" };

  return {
    ...createFixedScore({ conclusion: conclusions.join(" ") || "None", score }),
    classification,
  };
};
