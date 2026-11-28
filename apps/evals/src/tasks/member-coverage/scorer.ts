import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { isJsonObject } from "@zoonk/utils/json";

/** A goal that names no complete list, or one with this many members and these uncovered. */
export type MemberCoverageExpected = { size: number; uncovered: number[] } | { set: null };

type Generated = { set: boolean; size: number; uncovered: number[] };

function toNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) =>
    isJsonObject(item) && typeof item.number === "number" ? [item.number] : [],
  );
}

function getGenerated(output: string): Generated | null {
  try {
    const parsed: unknown = JSON.parse(output);

    if (!isJsonObject(parsed)) {
      return null;
    }

    return {
      set: typeof parsed.set === "string",
      size: Array.isArray(parsed.members) ? parsed.members.length : 0,
      uncovered: toNumbers(parsed.uncovered).toSorted((a, b) => a - b),
    };
  } catch {
    return null;
  }
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function scoreNoSet(generated: Generated) {
  if (!generated.set) {
    return createFixedScore({ conclusion: "None", score: 10 });
  }

  // Members it names would become skills the learner never asked for.
  return generated.uncovered.length > 0
    ? createFixedScore({
        conclusion: `Named a list for a goal that isn't one and added members ${generated.uncovered.join(", ")}.`,
        score: 6,
      })
    : createFixedScore({ conclusion: "Named a list for a goal that isn't one.", score: 8 });
}

export const scoreMemberCoverage: TaskScorer<MemberCoverageExpected> = ({ output, testCase }) => {
  const expected = testCase.expected;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs expected values.`);
  }

  const generated = getGenerated(output);

  if (!generated) {
    return createFixedScore({ conclusion: "The output isn't a member check.", score: 6 });
  }

  if ("set" in expected) {
    return scoreNoSet(generated);
  }

  const wanted = expected.uncovered.toSorted((a, b) => a - b);

  if (!generated.set) {
    return createFixedScore({ conclusion: "Didn't recognize the complete list.", score: 6 });
  }

  // A missed member stays out of the plan, and a wrong one adds a skill the graph already teaches.
  if (!sameNumbers(generated.uncovered, wanted)) {
    return createFixedScore({
      conclusion: `Uncovered members ${generated.uncovered.join(", ") || "none"}; expected ${wanted.join(", ") || "none"}.`,
      score: 6,
    });
  }

  if (generated.size !== expected.size) {
    return createFixedScore({
      conclusion: `Listed ${generated.size} members; the list has ${expected.size}.`,
      score: 8,
    });
  }

  return createFixedScore({ conclusion: "None", score: 10 });
};
