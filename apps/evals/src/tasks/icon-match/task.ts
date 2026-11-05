import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { type IconMatchParams, matchLessonIcons } from "@zoonk/ai/tasks/icons/match";
import { type IconMatchExpected, TEST_CASES } from "./test-cases";

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

const scoreIconMatch: TaskScorer<IconMatchExpected> = ({ output, testCase }) => {
  const reuse = JSON.parse(output) as (string | null)[];
  const expected = testCase.expected?.reuse ?? [];
  const wrong = expected.flatMap((answer, index) => (reuse[index] === answer ? [] : [index + 1]));
  const share = expected.length === 0 ? 1 : (expected.length - wrong.length) / expected.length;

  return createFixedScore({
    conclusion:
      wrong.length === 0
        ? "Every need reuses the right icon or draws a new one."
        : `Wrong decision for need ${wrong.join(", ")}: expected ${JSON.stringify(expected)}, got ${output}.`,
    score: MIN_SCORE + SCORE_RANGE * share,
  });
};

export const iconMatchTask: Task<
  Pick<IconMatchParams, "needs">,
  (string | null)[],
  IconMatchExpected
> = {
  description:
    "Decide, for each icon a lesson needs, whether a library icon the text search found shows the same thing or a new one should be drawn",
  generate: matchLessonIcons,
  id: "icon-match",
  name: "Icon Match",
  score: scoreIconMatch,
  testCases: TEST_CASES,
};
