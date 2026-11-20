import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { type SuggestProfileToolsSchema } from "@zoonk/ai/tasks/profile/suggest-tools";
import { normalizeString } from "@zoonk/utils/string";
import { SUGGEST_PROFILE_TOOLS_SCORE_CATEGORIES } from "./score-categories";

/** A tool matches a name it holds whole words of, so "Domínio Sistemas" matches "Domínio". */
export type SuggestProfileToolsExpected = {
  /** Tools this person doesn't use today, such as apps for learning their goal. */
  avoid: string[];
  /** At least one of these, the products their role and country most clearly run on. */
  expectAny: string[];
};

const MIN_TOOLS = 6;
const MAX_TOOLS = 10;

function matches(tool: string, name: string): boolean {
  return ` ${normalizeString(tool)} `.includes(` ${normalizeString(name)} `);
}

export const checkSuggestProfileTools: TaskCodeChecks<SuggestProfileToolsExpected> = ({
  output,
  testCase,
}) => {
  const { tools } = JSON.parse(output) as SuggestProfileToolsSchema;
  const expected = testCase.expected ?? { avoid: [], expectAny: [] };
  const avoided = tools.filter((tool) => expected.avoid.some((name) => matches(tool, name)));

  const problems = [
    tools.length < MIN_TOOLS || tools.length > MAX_TOOLS
      ? `Wrote ${tools.length} tools instead of about 8.`
      : null,
    avoided.length > 0
      ? `Listed tools this person doesn't use today: ${avoided.join(", ")}.`
      : null,
    expected.expectAny.length > 0 &&
    !tools.some((tool) => expected.expectAny.some((name) => matches(tool, name)))
      ? `Named none of ${expected.expectAny.join(", ")}.`
      : null,
  ].filter((problem) => problem !== null);

  const total = expected.expectAny.length > 0 ? 3 : 2;

  return {
    judgedOutput: JSON.stringify({ tools }, null, 2),
    passed: total - problems.length,
    problems,
    total,
  };
};

export const scoreSuggestProfileTools: TaskScorer<SuggestProfileToolsExpected> = ({
  output,
  testCase,
}) =>
  scoreWithCodeChecks({
    check: (value) => checkSuggestProfileTools({ output: value, testCase }),
    output,
    scoreCategories: SUGGEST_PROFILE_TOOLS_SCORE_CATEGORIES,
    testCase,
  });
