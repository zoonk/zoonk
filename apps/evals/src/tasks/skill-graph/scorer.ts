import { type CodeCheckResult, scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { findUncoveredTopics } from "@zoonk/ai/tasks/curriculum/exam-outline";
import { type generateSkillGraph } from "@zoonk/ai/tasks/curriculum/skill-graph";
import {
  type SkillGraphProblem,
  findSkillGraphProblems,
} from "@zoonk/ai/tasks/curriculum/skill-graph-checks";
import { findMissingLanguageBands } from "@zoonk/core/language/aims/bands";
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
  "pastCourseLevel",
  "repeatedPhaseName",
  "uncoveredTopic",
  "writing",
];

const CHECK_CRITERIA: Record<GraphCheck, string> = {
  cycle: "orderAndPrerequisites",
  deepChain: "orderAndPrerequisites",
  nearDuplicate: "noFiller",
  offNoticeFirst: "goalFit",
  pastCourseLevel: "goalFit",
  repeatedPhaseName: "noFiller",
  textbookChain: "orderAndPrerequisites",
  uncoveredTopic: "coverage",
  writing: "goalFit",
};

function toCheck(code: SkillGraphProblem["code"]): GraphCheck {
  return code === "emDash" || code === "markdown" || code === "placeholder" ? "writing" : code;
}

type ExpectedCheck = { criterion: string; problem: string | null };

function checkCoursePlacement({
  accepted,
  area,
  graph,
}: {
  accepted: string[];
  area: string;
  graph: SkillGraphOutput;
}): ExpectedCheck {
  const titles = new Set(accepted.map((title) => normalizeString(title)));

  const keys = new Set(
    graph.courses
      .filter((course) => titles.has(normalizeString(course.title)))
      .map((course) => course.key),
  );

  const skills = graph.skills.filter((skill) => skill.area === area);

  return {
    criterion: "coverage",
    problem:
      skills.length > 0 && skills.every((skill) => keys.has(skill.course))
        ? null
        : `Skills in "${area}" must be taught in ${accepted.map((title) => `"${title}"`).join(" or ")}.`,
  };
}

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
      ? [
          {
            criterion: "noFiller",
            problem: missed.length > 0 ? `Library skills not reused: ${missed.join(", ")}.` : null,
          },
        ]
      : []),
    ...(expected.noReuse
      ? [
          {
            criterion: "goalFit",
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
      criterion: "coverage",
      problem: accepted.some((title) => titles.has(normalizeString(title)))
        ? null
        : `No course titled ${accepted.map((title) => `"${title}"`).join(" or ")}.`,
    })),
    ...(expected.noCourses ?? []).map((title) => ({
      criterion: "goalFit",
      problem: titles.has(normalizeString(title)) ? `Unexpected course titled "${title}".` : null,
    })),
    ...Object.entries(expected.coursesByArea ?? {}).map(([area, accepted]) =>
      checkCoursePlacement({ accepted, area, graph }),
    ),
  ];
}

/** The learner's first lesson already teaches the first skill, so the graph starts with it as given. */
function checkFirstSkill({
  graph,
  input,
}: {
  graph: SkillGraphOutput;
  input: SkillGraphCase;
}): ExpectedCheck[] {
  const given = input.firstSkill;

  if (!given) {
    return [];
  }

  const [first] = graph.skills;

  const kept =
    first?.key === given.key &&
    first.name === given.name &&
    first.level === given.level &&
    first.prerequisites.length === 0;

  return [
    {
      criterion: "orderAndPrerequisites",
      problem: kept ? null : `The graph doesn't start with FIRST_SKILL as given.`,
    },
  ];
}

function checkLanguageBands({
  graph,
  input,
}: {
  graph: SkillGraphOutput;
  input: SkillGraphCase;
}): ExpectedCheck[] {
  if (input.goalKind !== "language") {
    return [];
  }

  const missing = findMissingLanguageBands(graph.skills);

  return [
    {
      criterion: "coverage",
      problem: missing.length > 0 ? `No situation in the ${missing.join(", ")} band.` : null,
    },
  ];
}

function checkExpected({
  expected,
  graph,
  input,
}: {
  expected?: SkillGraphExpected;
  graph: SkillGraphOutput;
  input: SkillGraphCase;
}) {
  const checks = [
    ...(expected ? [...checkReuse({ expected, graph }), ...checkCourses({ expected, graph })] : []),
    ...checkFirstSkill({ graph, input }),
    ...checkLanguageBands({ graph, input }),
  ];

  return { failures: checks.filter(({ problem }) => problem !== null), total: checks.length };
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
      courseLevel: input.goalKind === "learn" ? input.courseLevel : undefined,
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

  const cases = checkExpected({ expected, graph, input });

  return {
    criteria: [
      ...new Set([
        ...[...failing].map((check) => CHECK_CRITERIA[check]),
        ...cases.failures.map((check) => check.criterion),
      ]),
    ],
    judgedOutput: output,
    passed: CHECKS.length + cases.total - failing.size - cases.failures.length,
    problems: [
      ...problems.map((problem) => problem.problem),
      ...uncovered,
      ...cases.failures.flatMap((check) => check.problem ?? []),
    ],
    total: CHECKS.length + cases.total,
  };
}

export const checkSkillGraphOutput: TaskCodeChecks = ({ output, testCase }) =>
  checkGraph({
    expected: testCase.expected as SkillGraphExpected | undefined,
    input: testCase.userInput as SkillGraphCase,
    output,
  });

export const scoreSkillGraph: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkSkillGraphOutput({ output: value, testCase }),
    output,
    scoreCategories: SKILL_GRAPH_SCORE_CATEGORIES,
    testCase,
  });
