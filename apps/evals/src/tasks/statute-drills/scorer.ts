import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  STATUTE_DRILL_OPTION_COUNT,
  type StatuteDrill,
  type StatuteDrillParams,
  type generateStatuteDrills,
} from "@zoonk/ai/tasks/v2/items/statute-drills";
import { checkItem } from "@zoonk/core/library/items/checks";
import { STATUTE_DRILLS_SCORE_CATEGORIES } from "./score-categories";

type StatuteDrillsOutput = Awaited<ReturnType<typeof generateStatuteDrills>>["data"];

type StatuteDrillsCase = Pick<
  StatuteDrillParams,
  "count" | "fillInTheBlank" | "language" | "style"
>;

function getGenericFormats(input: StatuteDrillsCase): StatuteDrill["format"][] {
  return input.fillInTheBlank
    ? ["trueFalse", "typed", "multipleChoice"]
    : ["trueFalse", "multipleChoice"];
}

const SET_CHECKS = 2;

function checkCount(total: number, count: number): string | false {
  return total !== count && `Wrote ${total} drills instead of ${count}.`;
}

function checkMix(drills: StatuteDrill[], input: StatuteDrillsCase): string | false {
  const formats = new Set(drills.map((drill) => drill.format));
  const generic = getGenericFormats(input);
  const missing = generic.filter((format) => !formats.has(format));

  return (
    input.style === "generic" &&
    input.count >= generic.length &&
    missing.length > 0 &&
    `The generic mix has no ${missing.join(" or ")} drill.`
  );
}

function formatProblem(drill: StatuteDrill, problem: string): string {
  return `${drill.reference} (${drill.format}): ${problem}`;
}

function checkStatuteDrillsOutput(output: string, input: StatuteDrillsCase): CodeCheckResult {
  const { drills, dropped } = JSON.parse(output) as StatuteDrillsOutput;

  const checked = drills.map((drill) => ({
    drill,
    problems: checkItem({
      item: drill,
      language: input.language,
      optionCount: STATUTE_DRILL_OPTION_COUNT,
    }),
  }));

  const passing = checked.filter((entry) => entry.problems.length === 0);
  const all = [...dropped, ...checked];

  const setProblems = [
    checkCount(all.length, input.count),
    checkMix([...dropped.map((entry) => entry.drill), ...drills], input),
  ].filter((problem) => typeof problem === "string");

  return {
    judgedOutput: JSON.stringify({ drills: passing.map((entry) => entry.drill) }, null, 2),
    passed: passing.length === 0 ? 0 : passing.length + SET_CHECKS - setProblems.length,
    problems: [
      ...all.flatMap((entry) =>
        entry.problems.map((problem) => formatProblem(entry.drill, problem)),
      ),
      ...setProblems,
    ],
    total: all.length + SET_CHECKS,
  };
}

export const scoreStatuteDrills: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkStatuteDrillsOutput(value, testCase.userInput as StatuteDrillsCase),
    output,
    scoreCategories: STATUTE_DRILLS_SCORE_CATEGORIES,
    testCase,
  });
