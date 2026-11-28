import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type DomainSharesEvalInput,
  type DomainSharesEvalOutput,
  generateDomainShares,
} from "./generate";
import { TEST_CASES } from "./test-cases";

/**
 * Each subject's headings with the weight the documents state (a percentage, or the midpoint of a
 * question range), normalized by the scorer; null for a subject whose shares the documents don't state.
 */
export type DomainSharesExpected = Record<string, Record<string, number> | null>;

const MIN_SCORE = 2;
const SCORE_RANGE = 8;
const SHARE_TOLERANCE = 0.005;

function parseOutput(output: string): DomainSharesEvalOutput | null {
  try {
    return JSON.parse(output) as DomainSharesEvalOutput;
  } catch {
    return null;
  }
}

function describeMiss({
  expected,
  found,
  subject,
}: {
  expected: Record<string, number> | null;
  found: Record<string, number | null> | undefined;
  subject: string;
}): string | null {
  const shares = Object.values(found ?? {});

  if (expected === null) {
    return shares.some((share) => share !== null) ? `${subject}: shares nobody stated` : null;
  }

  const total = Object.values(expected).reduce((sum, weight) => sum + weight, 0);

  const wrong = Object.entries(expected).filter(([heading, weight]) => {
    const share = found?.[heading] ?? null;
    return share === null || Math.abs(share - weight / total) > SHARE_TOLERANCE;
  });

  return wrong.length === 0
    ? null
    : `${subject}: ${wrong.length} of ${Object.keys(expected).length} headings off (${wrong
        .map(([heading]) => `${heading} ${found?.[heading]?.toFixed(3) ?? "none"}`)
        .join(", ")})`;
}

const scoreDomainShares: TaskScorer<DomainSharesExpected> = ({ output, testCase }) => {
  const parsed = parseOutput(output);
  const expected = testCase.expected;

  if (!parsed?.shares || !expected) {
    return createFixedScore({ conclusion: "Invalid output", score: MIN_SCORE });
  }

  const subjects = Object.entries(expected);

  const misses = subjects.flatMap(([subject, weights]) => {
    const miss = describeMiss({ expected: weights, found: parsed.shares[subject], subject });
    return miss ? [miss] : [];
  });

  const right = subjects.length - misses.length;

  return createFixedScore({
    conclusion: [`Subjects ${right}/${subjects.length}`, ...misses].join(". "),
    score: MIN_SCORE + SCORE_RANGE * (subjects.length === 0 ? 1 : right / subjects.length),
  });
};

export const findDomainSharesTask: Task<
  DomainSharesEvalInput,
  DomainSharesEvalOutput,
  DomainSharesExpected
> = {
  description:
    "Read each subject's official split across its headings (domains, knowledge areas) from the exam's documents, quoting the passage, and none the documents don't state",
  generate: generateDomainShares,
  id: "find-domain-shares",
  name: "Find domain shares",
  priorities: {
    distribution: "shared",
    first: "quality",
    reads:
      "The planner splits each subject's lessons and study time across its headings by these shares",
    reason: "A wrong or invented share teaches learners the wrong proportions of the exam",
    waits: "Read with the exam's notice before learners plan",
  },
  score: scoreDomainShares,
  testCases: TEST_CASES,
};
