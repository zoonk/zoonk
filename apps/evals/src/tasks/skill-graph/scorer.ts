import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { findUncoveredTopics } from "@zoonk/ai/tasks/curriculum/exam-outline";
import {
  type SkillGraphParams,
  type generateSkillGraph,
} from "@zoonk/ai/tasks/curriculum/skill-graph";
import {
  type SkillGraphProblem,
  findSkillGraphProblems,
} from "@zoonk/ai/tasks/curriculum/skill-graph-checks";
import { SKILL_GRAPH_SCORE_CATEGORIES } from "./score-categories";

type SkillGraphResult = Awaited<ReturnType<typeof generateSkillGraph>>;

export type SkillGraphOutput = SkillGraphResult["data"] &
  Partial<Pick<SkillGraphResult, "repaired">>;

type GraphCheck =
  | Exclude<SkillGraphProblem["code"], "emDash" | "markdown" | "placeholder">
  | "uncoveredTopic"
  | "writing";

const CHECKS: readonly GraphCheck[] = [
  "cycle",
  "deepChain",
  "textbookChain",
  "offNoticeFirst",
  "nearDuplicate",
  "repeatedPhaseName",
  "uncoveredTopic",
  "writing",
];

function toCheck(code: SkillGraphProblem["code"]): GraphCheck {
  return code === "emDash" || code === "markdown" || code === "placeholder" ? "writing" : code;
}

function checkGraph(output: string, input: SkillGraphParams): CodeCheckResult {
  const graph = JSON.parse(output) as SkillGraphOutput;

  const problems = [
    ...findSkillGraphProblems({
      exam: input.goalKind === "exam",
      phases: graph.phases,
      skills: graph.skills,
    }),
    ...(graph.repaired ?? []),
  ];

  const uncovered = input.examBlueprint
    ? findUncoveredTopics({ outline: input.examBlueprint, skills: graph.skills }).map(
        ({ subject, topic }) => `No skill teaches "${topic}" of ${subject}.`,
      )
    : [];

  const failing = new Set([
    ...problems.map((problem) => toCheck(problem.code)),
    ...(uncovered.length > 0 ? ["uncoveredTopic" as const] : []),
  ]);

  return {
    judgedOutput: output,
    passed: CHECKS.length - failing.size,
    problems: [...problems.map((problem) => problem.problem), ...uncovered],
    total: CHECKS.length,
  };
}

export const scoreSkillGraph: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkGraph(value, testCase.userInput as SkillGraphParams),
    output,
    scoreCategories: SKILL_GRAPH_SCORE_CATEGORIES,
    testCase,
  });
