import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type ResearchPlan,
  type ResearchPlanParams,
  generateResearchPlan,
} from "@zoonk/ai/tasks/v2/research/plan";
import { normalizeString } from "@zoonk/utils/string";
import { TEST_CASES } from "./test-cases";

export type ResearchPlanExpected = {
  /** Words the canonical name must contain, any of the options. */
  nameIncludes: string[];
  country: string;
  /** Other countries that fit as well, such as another English-speaking one for a syllabus. */
  otherCountries?: string[];
  language: string;
  /** At least one of these must be among the official domains; class tests have none. */
  domains: string[];
  roleIncludes?: string;
  /** A teacher's own test: only the class's material describes it. False when left out. */
  classTest?: boolean;
  /**
   * A syllabus for a subject no university course or official curriculum teaches: the plan has no
   * queries, so nothing is searched. Its country and domains aren't checked.
   */
  noQueries?: boolean;
};

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

function parsePlan(output: string): ResearchPlan | null {
  try {
    return JSON.parse(output) as ResearchPlan;
  } catch {
    return null;
  }
}

function listChecks({ expected, plan }: { expected: ResearchPlanExpected; plan: ResearchPlan }) {
  // A teacher's test says nothing about its country beyond the learner's language, and a subject
  // with no syllabus has nowhere to search.
  const searchesNothing = expected.classTest || expected.noQueries;
  const countries = [expected.country, ...(expected.otherCountries ?? [])];

  return [
    {
      label: "name",
      passed: expected.nameIncludes.some((word) =>
        normalizeString(plan.name).includes(normalizeString(word)),
      ),
    },
    { label: "class test", passed: plan.classTest === (expected.classTest ?? false) },
    ...(searchesNothing ? [] : [{ label: "country", passed: countries.includes(plan.country) }]),
    { label: "language", passed: plan.language === expected.language },
    ...(expected.noQueries === undefined
      ? []
      : [
          {
            label: expected.noQueries ? "no queries" : "queries",
            passed: expected.noQueries === (plan.queries.length === 0),
          },
        ]),
    ...(searchesNothing
      ? []
      : [
          {
            label: "official domain",
            passed: plan.officialDomains.some((domain) =>
              expected.domains.some((expectedDomain) => domain.includes(expectedDomain)),
            ),
          },
        ]),
    ...(expected.roleIncludes
      ? [
          {
            label: "role",
            passed: normalizeString(plan.role ?? "").includes(
              normalizeString(expected.roleIncludes),
            ),
          },
        ]
      : []),
  ];
}

/** Code scoring: the identity fields and at least one official domain must be right. */
const scoreResearchPlan: TaskScorer<ResearchPlanExpected> = ({ output, testCase }) => {
  const plan = parsePlan(output);

  if (!plan || !testCase.expected) {
    return createFixedScore({ conclusion: "No plan", score: MIN_SCORE });
  }

  const checks = listChecks({ expected: testCase.expected, plan });
  const passed = checks.filter((check) => check.passed).length;
  const failed = checks.filter((check) => !check.passed).map((check) => check.label);

  return createFixedScore({
    conclusion: failed.length === 0 ? "None" : `Wrong: ${failed.join(", ")}`,
    score: MIN_SCORE + (SCORE_RANGE * passed) / checks.length,
  });
};

export const researchPlanTask: Task<ResearchPlanParams, ResearchPlan, ResearchPlanExpected> = {
  description:
    "Name the canonical exam, law, product or subject, where its organizer publishes, and the queries to find it or its reference syllabi",
  generate: generateResearchPlan,
  id: "research-plan",
  name: "Research Plan",
  score: scoreResearchPlan,
  testCases: TEST_CASES,
};
