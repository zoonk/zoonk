import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";

export type GoalSpecificityExpected = {
  privateCourse: boolean;
  /** One of these must name the shareable subject (unused for private courses). */
  generalKeywords: string[];
  /** Each must be kept as a personal detail and never reach the shared goal. */
  personalKeywords: string[];
};

type GeneratedSpecificity = {
  privateCourse: boolean | null;
  /** Absent when an evaluation model answered only the private-course question. */
  split: { generalGoal: string | null; personalDetails: string[] } | null;
};

function getSplit(parsed: Record<string, unknown>): GeneratedSpecificity["split"] {
  if (!Array.isArray(parsed.personalDetails)) {
    return null;
  }

  return {
    generalGoal: typeof parsed.generalGoal === "string" ? parsed.generalGoal : null,
    personalDetails: parsed.personalDetails.filter(
      (item): item is string => typeof item === "string",
    ),
  };
}

function getGenerated(output: string): GeneratedSpecificity {
  try {
    const parsed: unknown = JSON.parse(output);

    if (!isJsonObject(parsed)) {
      return { privateCourse: null, split: null };
    }

    const privateCourse = typeof parsed.privateCourse === "boolean" ? parsed.privateCourse : null;
    return { privateCourse, split: getSplit(parsed) };
  } catch {
    return { privateCourse: null, split: null };
  }
}

function includesText(haystack: string | null, needle: string): boolean {
  return normalizeString(haystack ?? "").includes(normalizeString(needle));
}

/**
 * Lists what the split got wrong: a shared goal that is missing or leaks a
 * personal detail, or a personal detail that wasn't kept.
 */
function getSplitProblems({
  expected,
  split,
}: {
  expected: GoalSpecificityExpected;
  split: NonNullable<GeneratedSpecificity["split"]>;
}): string[] {
  const details = split.personalDetails.join(" | ");

  const missingGeneral =
    !expected.privateCourse &&
    !expected.generalKeywords.some((keyword) => includesText(split.generalGoal, keyword));

  return [
    missingGeneral && `generalGoal "${split.generalGoal}" doesn't name the shared subject.`,
    expected.privateCourse && split.generalGoal !== null && "A private goal kept a generalGoal.",
    ...expected.personalKeywords.flatMap((keyword) => [
      !includesText(details, keyword) && `"${keyword}" is missing from personalDetails.`,
      includesText(split.generalGoal, keyword) && `"${keyword}" leaked into generalGoal.`,
    ]),
  ].filter((problem): problem is string => typeof problem === "string");
}

/**
 * The private-course decision is the classification; the split earns full
 * marks only when the shared goal is clean and every personal detail was kept.
 */
export const scoreGoalSpecificity: TaskScorer<GoalSpecificityExpected> = ({ output, testCase }) => {
  const generated = getGenerated(output);
  const expected = testCase.expected;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs expected values.`);
  }

  const classification = {
    expected: String(expected.privateCourse),
    predicted: generated.privateCourse === null ? null : String(generated.privateCourse),
  };

  if (generated.privateCourse !== expected.privateCourse) {
    const conclusion = `Expected privateCourse ${String(expected.privateCourse)}.`;
    return { ...createFixedScore({ conclusion, score: 6 }), classification };
  }

  const problems = generated.split ? getSplitProblems({ expected, split: generated.split }) : [];

  if (problems.length > 0) {
    return { ...createFixedScore({ conclusion: problems.join(" "), score: 8 }), classification };
  }

  return { ...createFixedScore({ conclusion: "None", score: 10 }), classification };
};
