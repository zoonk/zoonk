import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type FindSubjectQuestionsParams,
  type SubjectQuestionsFinding,
  findSubjectQuestions,
} from "@zoonk/ai/tasks/v2/research/find-subject-questions";
import { TEST_CASES } from "./test-cases";

export type FindSubjectQuestionsExpected = {
  /**
   * Counts every recent edition kept, by subject number (1-based): a found answer must give
   * these. Empty when only "unknown" or a self-consistent answer is acceptable.
   */
  counts: Record<number, number>;
  /** `any` when a source may or may not exist: only counts that miss the total are wrong. */
  status: "any" | "found";
};

function parseOutput(output: string): SubjectQuestionsFinding | null {
  try {
    return JSON.parse(output) as SubjectQuestionsFinding;
  } catch {
    return null;
  }
}

/** Subjects whose count isn't the one every recent edition kept. */
function findWrongCounts({
  expected,
  questions,
}: {
  expected: FindSubjectQuestionsExpected;
  questions: readonly number[];
}): string[] {
  return Object.entries(expected.counts).flatMap(([subject, count]) => {
    const found = questions[Number(subject) - 1];
    return found === count ? [] : [`subject ${subject}: ${found ?? "none"} instead of ${count}`];
  });
}

/**
 * 10 for the counts the latest editions kept, with their source (or "unknown" where none is
 * expected); 8 for a missed distribution, which only leaves the plan weighing subjects evenly; 6
 * for wrong counts, which would weigh the plan wrong.
 */
const scoreSubjectQuestions: TaskScorer<FindSubjectQuestionsExpected> = ({ output, testCase }) => {
  const found = parseOutput(output);
  const expected = testCase.expected;

  if (!found || !expected) {
    return createFixedScore({ conclusion: "No output", score: 6 });
  }

  if (found.status !== "found") {
    return expected.status === "found"
      ? createFixedScore({ conclusion: "Missed the published distribution", score: 8 })
      : createFixedScore({ conclusion: "None", score: 10 });
  }

  const wrong = findWrongCounts({ expected, questions: found.questions });

  return wrong.length === 0
    ? createFixedScore({ conclusion: "None", score: 10 })
    : createFixedScore({ conclusion: wrong.join("; "), score: 6 });
};

export const findSubjectQuestionsTask: Task<
  FindSubjectQuestionsParams,
  SubjectQuestionsFinding,
  FindSubjectQuestionsExpected
> = {
  description:
    "Look up how many questions each of an exam's subjects got in its latest edition, with the page that gives them, or say it isn't known",
  generate: findSubjectQuestions,
  id: "find-subject-questions",
  latencyBudget: { p50: 25, p95: 40 },
  name: "Find Subject Questions",
  score: scoreSubjectQuestions,
  testCases: TEST_CASES,
};
