import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import {
  STATUTE_DRILL_OPTION_COUNT,
  type StatuteDrill,
  type StatuteDrillParams,
  type generateStatuteDrills,
} from "@zoonk/ai/tasks/items/statute-drills";
import { toCheckedItem } from "@zoonk/core/library/items/create";
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

export const checkStatuteDrillsOutput: TaskCodeChecks = ({ output, testCase }) => {
  const input = testCase.userInput as StatuteDrillsCase;
  const { drills, dropped } = JSON.parse(output) as StatuteDrillsOutput;

  const checked = drills.map((drill, index) => {
    const { item, problems } = toCheckedItem({
      answerFormat: {},
      format: drill.format,
      index,
      item: drill,
      language: input.language,
      optionCount: drill.format === "multipleChoice" ? STATUTE_DRILL_OPTION_COUNT : null,
    });

    return { drill: item, itemLocator: `drills[${index}] (${drill.reference})`, problems };
  });

  const passing = checked.filter((entry) => entry.problems.length === 0);
  const all = [...dropped, ...checked];

  const setProblems = [
    checkCount(all.length, input.count),
    checkMix([...dropped.map((entry) => entry.drill), ...drills], input),
  ].filter((problem) => typeof problem === "string");

  return {
    blockingProblems: passing.length === 0 ? ["No statute drill passed the save checks."] : [],
    judgedOutput: JSON.stringify(
      { drills: passing.map(({ drill, itemLocator }) => ({ ...drill, itemLocator })) },
      null,
      2,
    ),
    keyFlawLocators: passing.map((entry) => entry.itemLocator),
    passed: passing.length === 0 ? 0 : passing.length + SET_CHECKS - setProblems.length,
    problems: [
      ...all.flatMap((entry) =>
        entry.problems.map((problem) => formatProblem(entry.drill, problem)),
      ),
      ...setProblems,
    ],
    total: all.length + SET_CHECKS,
  };
};

export const scoreStatuteDrills: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkStatuteDrillsOutput({ output: value, testCase }),
    output,
    scoreCategories: STATUTE_DRILLS_SCORE_CATEGORIES,
    testCase,
  });
