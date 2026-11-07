import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type ResearchSearchPlan } from "@zoonk/ai/tasks/research/plan";
import { type ProductHints } from "@zoonk/ai/tasks/research/source-plan";
import { normalizeString } from "@zoonk/utils/string";

export type ResearchPlanExpected = {
  nameIncludes: string[];
  country: string;
  otherCountries?: string[];
  language: string;
  domains: string[];
  roleIncludes?: string;
  classTest?: boolean;
  noQueries?: boolean;
  /** Each hint must include one of its words; `release: null` expects no release, and `null` no product. */
  product?: { brand: string[]; name: string[]; release: string[] | null } | null;
};

type ScoredPlan = ResearchSearchPlan & {
  classTest?: boolean;
  product?: ProductHints | null;
  role?: string | null;
};

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

function parsePlan(output: string): ScoredPlan | null {
  try {
    return JSON.parse(output) as ScoredPlan;
  } catch {
    return null;
  }
}

function includesAny({ value, words }: { value: string | null; words: string[] }): boolean {
  return words.some((word) => normalizeString(value ?? "").includes(normalizeString(word)));
}

function listProductChecks({
  expected,
  product,
}: {
  expected: ResearchPlanExpected["product"];
  product: ProductHints | null | undefined;
}) {
  if (expected === undefined) {
    return [];
  }

  if (!expected || !product) {
    return [{ label: "product", passed: !expected && !product }];
  }

  return [
    { label: "brand", passed: includesAny({ value: product.brand, words: expected.brand }) },
    { label: "product name", passed: includesAny({ value: product.name, words: expected.name }) },
    {
      label: "release",
      passed: expected.release
        ? includesAny({ value: product.release, words: expected.release })
        : product.release === null,
    },
  ];
}

function listChecks({ expected, plan }: { expected: ResearchPlanExpected; plan: ScoredPlan }) {
  const searchesNothing = expected.classTest || expected.noQueries;
  const countries = [expected.country, ...(expected.otherCountries ?? [])];

  return [
    {
      label: "name",
      passed: expected.nameIncludes.some((word) =>
        normalizeString(plan.name).includes(normalizeString(word)),
      ),
    },
    ...(plan.classTest === undefined
      ? []
      : [{ label: "class test", passed: plan.classTest === (expected.classTest ?? false) }]),
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
    ...listProductChecks({ expected: expected.product, product: plan.product }),
  ];
}

export const scoreResearchPlan: TaskScorer<ResearchPlanExpected> = ({ output, testCase }) => {
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
