import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type LessonQualityIssue } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import { type LessonQualityCheckExpected } from "./test-cases";

function parseIssues(output: string): LessonQualityIssue[] | null {
  try {
    const parsed = JSON.parse(output) as { issues?: LessonQualityIssue[] };
    return Array.isArray(parsed.issues) ? parsed.issues : null;
  } catch {
    return null;
  }
}

function describe(issues: readonly LessonQualityIssue[]): string {
  return issues.length === 0
    ? "No blocking issues."
    : issues
        .map(
          (issue) =>
            `[screen ${issue.screen === null ? "-" : issue.screen + 1}, ${issue.kind}] ${issue.problem}`,
        )
        .join(" ");
}

function scoreClean(blocking: readonly LessonQualityIssue[]): number {
  if (blocking.length === 0) {
    return 10;
  }

  return blocking.some((issue) => issue.kind === "incorrect") ? 6 : 7;
}

function scorePlanted({
  blocking,
  expected,
}: {
  blocking: readonly LessonQualityIssue[];
  expected: Extract<LessonQualityCheckExpected, { verdict: "fail" }>;
}): number {
  const plantedScreen = expected.screen === null ? null : expected.screen - 1;
  const onScreen = blocking.filter((issue) => issue.screen === plantedScreen);

  if (onScreen.some((issue) => expected.kinds.includes(issue.kind))) {
    return 10;
  }

  if (onScreen.length > 0) {
    return 9;
  }

  return blocking.length > 0 ? 7 : 6;
}

/**
 * A reviewer earns full marks when it blocks a planted defect on its screen
 * with a fitting kind and passes clean lessons. Blocking a clean lesson for a
 * made-up error costs the most, since it holds back good lessons.
 */
export const scoreLessonQualityCheck: TaskScorer<LessonQualityCheckExpected> = ({
  output,
  testCase,
}) => {
  const { expected } = testCase;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs expected values.`);
  }

  const issues = parseIssues(output);
  const blocking = (issues ?? []).filter((issue) => issue.severity === "blocking");
  const verdict = blocking.length > 0 ? "fail" : "pass";
  const predicted = issues === null ? null : verdict;
  const classification = { expected: expected.verdict, predicted };

  const score =
    expected.verdict === "pass" ? scoreClean(blocking) : scorePlanted({ blocking, expected });

  return { ...createFixedScore({ conclusion: describe(blocking), score }), classification };
};
