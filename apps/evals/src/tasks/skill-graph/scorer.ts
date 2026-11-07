import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskScorer } from "@/lib/types";
import { findUncoveredTopics } from "@zoonk/ai/tasks/curriculum/exam-outline";
import { type generateSkillGraph } from "@zoonk/ai/tasks/curriculum/skill-graph";
import {
  type SkillGraphProblem,
  findSkillGraphProblems,
} from "@zoonk/ai/tasks/curriculum/skill-graph-checks";
import { normalizeString } from "@zoonk/utils/string";
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

type ExpectedCheck = { problem: string | null };

function checkReuse({
  expected,
  graph,
}: {
  expected: SkillGraphExpected;
  graph: SkillGraphOutput;
}): ExpectedCheck[] {
  const reused = new Set(graph.skills.flatMap((skill) => skill.libraryId ?? []));
  const missed = (expected.reuse ?? []).filter((id) => !reused.has(id));
  const wrong = (expected.noReuse ?? []).filter((id) => reused.has(id));

  return [
    ...(expected.reuse
      ? [{ problem: missed.length > 0 ? `Library skills not reused: ${missed.join(", ")}.` : null }]
      : []),
    ...(expected.noReuse
      ? [
          {
            problem:
              wrong.length > 0
                ? `Library skills reused for another law: ${wrong.join(", ")}.`
                : null,
          },
        ]
      : []),
  ];
}

/** Each discipline a notice subject combines has its own course, under one of its catalog titles. */
function checkCourses({
  expected,
  graph,
}: {
  expected: SkillGraphExpected;
  graph: SkillGraphOutput;
}): ExpectedCheck[] {
  const titles = new Set(graph.courses.map((course) => normalizeString(course.title)));

  return [
    ...(expected.courses ?? []).map((accepted) => ({
      problem: accepted.some((title) => titles.has(normalizeString(title)))
        ? null
        : `No course titled ${accepted.map((title) => `"${title}"`).join(" or ")}.`,
    })),
    ...(expected.noCourses ?? []).map((title) => ({
      problem: titles.has(normalizeString(title)) ? `Unexpected course titled "${title}".` : null,
    })),
  ];
}

function checkExpected({
  expected,
  graph,
}: {
  expected?: SkillGraphExpected;
  graph: SkillGraphOutput;
}): { problems: string[]; total: number } {
  const checks = expected
    ? [...checkReuse({ expected, graph }), ...checkCourses({ expected, graph })]
    : [];

  return { problems: checks.flatMap((check) => check.problem ?? []), total: checks.length };
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

  const cases = checkExpected({ expected, graph });

  return {
    judgedOutput: output,
    passed: CHECKS.length + cases.total - failing.size - cases.problems.length,
    problems: [...problems.map((problem) => problem.problem), ...uncovered, ...cases.problems],
    total: CHECKS.length + cases.total,
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
