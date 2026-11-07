import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { findUncoveredTopics } from "@zoonk/ai/tasks/curriculum/exam-outline";
import { type generateSkillGraph } from "@zoonk/ai/tasks/curriculum/skill-graph";
import {
  type SkillGraphProblem,
  findSkillGraphProblems,
} from "@zoonk/ai/tasks/curriculum/skill-graph-checks";
import { type SkillGraphCase, type SkillGraphExpected } from "./library-cases";
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

function checkReuse({
  expected,
  graph,
}: {
  expected?: SkillGraphExpected;
  graph: SkillGraphOutput;
}): { problems: string[]; total: number } {
  if (!expected) {
    return { problems: [], total: 0 };
  }

  const reused = new Set(graph.skills.flatMap((skill) => skill.libraryId ?? []));
  const missed = expected.reuse.filter((id) => !reused.has(id));
  const wrong = expected.noReuse.filter((id) => reused.has(id));

  return {
    problems: [
      ...(missed.length > 0 ? [`Library skills not reused: ${missed.join(", ")}.`] : []),
      ...(wrong.length > 0 ? [`Library skills reused for another law: ${wrong.join(", ")}.`] : []),
    ],
    total: 2,
  };
}

function checkGraph({
  expected,
  input,
  output,
}: {
  expected?: SkillGraphExpected;
  input: SkillGraphCase;
  output: string;
}): CodeCheckResult {
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

  const reuse = checkReuse({ expected, graph });

  return {
    judgedOutput: output,
    passed: CHECKS.length + reuse.total - failing.size - reuse.problems.length,
    problems: [...problems.map((problem) => problem.problem), ...uncovered, ...reuse.problems],
    total: CHECKS.length + reuse.total,
  };
}

export const scoreSkillGraph: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) =>
      checkGraph({
        expected: testCase.expected as SkillGraphExpected | undefined,
        input: testCase.userInput as SkillGraphCase,
        output: value,
      }),
    output,
    scoreCategories: SKILL_GRAPH_SCORE_CATEGORIES,
    testCase,
  });
