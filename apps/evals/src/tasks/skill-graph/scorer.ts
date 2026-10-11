import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import {
  type SkillGraphParams,
  type generateSkillGraph,
} from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import {
  type SkillGraphProblem,
  findSkillGraphProblems,
} from "@zoonk/ai/tasks/v2/curriculum/skill-graph-checks";
import { SKILL_GRAPH_SCORE_CATEGORIES } from "./score-categories";

type SkillGraphResult = Awaited<ReturnType<typeof generateSkillGraph>>;

/**
 * The graph production keeps, with what code repaired in what the model wrote (outputs saved
 * before the report have none).
 */
export type SkillGraphOutput = SkillGraphResult["data"] &
  Partial<Pick<SkillGraphResult, "repaired">>;

/** Each check is one part; the writing ones (em dashes, Markdown, placeholders) count as one. */
type GraphCheck =
  | Exclude<SkillGraphProblem["code"], "emDash" | "markdown" | "placeholder">
  | "writing";

const CHECKS: readonly GraphCheck[] = [
  "cycle",
  "deepChain",
  "textbookChain",
  "offNoticeFirst",
  "nearDuplicate",
  "writing",
];

function toCheck(code: SkillGraphProblem["code"]): GraphCheck {
  return code === "emDash" || code === "markdown" || code === "placeholder" ? "writing" : code;
}

/**
 * The checks production runs on every graph it writes (a graph with problems is written once more
 * and the better one kept): no prerequisite loops, no chain too deep or in a textbook's order, no
 * exam subject opening beyond its notice, no skill written twice and no em dash, Markdown or
 * placeholder in what learners read. What production repaired in code (a loop broken, a skill
 * written twice merged, em dashes and Markdown taken out) still counts against the model. The
 * judge sees the whole graph.
 */
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

  const failing = new Set(problems.map((problem) => toCheck(problem.code)));

  return {
    judgedOutput: output,
    passed: CHECKS.length - failing.size,
    problems: problems.map((problem) => problem.problem),
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
