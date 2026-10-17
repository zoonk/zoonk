import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type LibraryIdentitySubject } from "@zoonk/ai/tasks/v2/identity/subject";
import {
  matchesSearchTerms,
  parseSearchTerms,
} from "@zoonk/core/library/identity/text-search-query";
import { isJsonObject } from "@zoonk/utils/json";

/** One row the database would search: its id and the text the search reads. */
export type LibrarySearchItem = { id: string; text: string };

/** What the library holds for one item of a case: the row to find and near misses. */
type LibrarySearchExpectation = { library: LibrarySearchItem[]; targetId: string };

/** One expectation per subject of the case, in the same order. */
export type LibrarySearchTermsExpected = { items: LibrarySearchExpectation[] };

const MISSED_SCORE = 6;
const NOISY_SCORE = 8;
const FOUND_SCORE = 10;

type ItemScore = { conclusion: string | null; found: boolean; score: number };

/**
 * Production searches the item's own title and skills together with the
 * model's terms, so the eval does too. Cases are written so those words alone
 * miss the target, which leaves finding it to the model.
 */
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

/** Each subject's terms, in the order of the case's subjects; null when the output has no list. */
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

/**
 * Checks whether the right item appears in the results, using the same query
 * rules as the database on whole words. Postgres also stems words, so this is
 * a lower bound of real recall. Matching more than half of the near misses
 * costs points, because each one is a decision call and a chance of a wrong reuse.
 */
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

/**
 * Scores every subject against its own library, as production searches each item on its own. A
 * case scores as its worst item, since one missed item is one duplicate made.
 */
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
