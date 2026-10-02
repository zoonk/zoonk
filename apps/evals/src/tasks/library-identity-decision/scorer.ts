import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import {
  type LibraryIdentityItem,
  type LibraryIdentitySubject,
} from "@zoonk/ai/tasks/v2/identity/subject";
import { isJsonObject } from "@zoonk/utils/json";

/** One labeled pair: the item a plan needs and one existing item the search found. */
export type LibraryIdentityDecisionInput = {
  subject: LibraryIdentitySubject;
  candidate: LibraryIdentityItem;
};

export type LibraryIdentityDecisionOutput = { reuse: boolean };
export type LibraryIdentityDecisionExpected = { reuse: boolean };

function toLabel(reuse: boolean): string {
  return reuse ? "reuse" : "generate";
}

function getGeneratedReuse(output: string): boolean | null {
  try {
    const parsed: unknown = JSON.parse(output);
    return isJsonObject(parsed) && typeof parsed.reuse === "boolean" ? parsed.reuse : null;
  } catch {
    return null;
  }
}

/**
 * Scores one labeled pair. Reusing the wrong item and generating a duplicate
 * both score 6 here; per-label accuracy shows which mistake a model makes.
 */
export const scoreLibraryIdentityDecision: TaskScorer<LibraryIdentityDecisionExpected> = ({
  output,
  testCase,
}) => {
  const reuse = getGeneratedReuse(output);
  const expected = testCase.expected?.reuse ?? false;

  const classification = {
    expected: toLabel(expected),
    predicted: reuse === null ? null : toLabel(reuse),
  };

  if (reuse === expected) {
    return { ...createFixedScore({ conclusion: "None", score: 10 }), classification };
  }

  const conclusion = `Expected ${toLabel(expected)}, got ${reuse === null ? "no verdict" : toLabel(reuse)}.`;

  return { ...createFixedScore({ conclusion, score: 6 }), classification };
};
