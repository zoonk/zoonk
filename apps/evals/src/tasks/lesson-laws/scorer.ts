import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type LessonLaw, toArticleNumber } from "@zoonk/ai/tasks/lesson-laws";
import { normalizeString } from "@zoonk/utils/string";

type ExpectedLaw = {
  nameIncludes: string[];
  country: string;
  language: string;
  domains: string[];
  /** How many of `domains` it should list, where a country has several official publishers. */
  minDomains?: number;
  /** One of them among the law's article hints. */
  articles: string[];
};

/** No `laws` expects none; `forbidden` words (an exam's or a learner's employer's name) appear in no field. */
export type LessonLawsExpected = { laws: ExpectedLaw[]; forbidden?: string[] };

type Check = { label: string; passed: boolean };

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

function parseLaws(output: string): LessonLaw[] | null {
  try {
    return (JSON.parse(output) as { laws: LessonLaw[] }).laws;
  } catch {
    return null;
  }
}

function includesAny({ value, words }: { value: string; words: string[] }): boolean {
  return words.some((word) => normalizeString(value).includes(normalizeString(word)));
}

function normalizeArticle(article: string): string {
  return normalizeString(toArticleNumber(article));
}

function checkLaw({ expected, laws }: { expected: ExpectedLaw; laws: LessonLaw[] }): Check[] {
  const law = laws.find((candidate) =>
    includesAny({ value: candidate.name, words: expected.nameIncludes }),
  );

  const label = expected.nameIncludes[0] ?? "law";

  if (!law) {
    return [{ label: `${label} named`, passed: false }];
  }

  const articles = new Set(law.articles.map((article) => normalizeArticle(article)));

  const officialDomains = law.officialDomains.filter((domain) =>
    includesAny({ value: domain, words: expected.domains }),
  );

  return [
    { label: `${label} named`, passed: true },
    { label: `${label} country`, passed: law.country === expected.country },
    { label: `${label} language`, passed: law.language === expected.language },
    { label: `${label} official domain`, passed: officialDomains.length > 0 },
    ...(expected.minDomains
      ? [
          {
            label: `${label} official domains`,
            passed: new Set(officialDomains).size >= expected.minDomains,
          },
        ]
      : []),
    {
      label: `${label} article`,
      passed: expected.articles.some((article) => articles.has(normalizeArticle(article))),
    },
  ];
}

function listChecks({ expected, laws }: { expected: LessonLawsExpected; laws: LessonLaw[] }) {
  const text = JSON.stringify(laws);
  const forbidden = expected.forbidden ?? [];

  return [
    ...(expected.laws.length === 0 ? [{ label: "no laws", passed: laws.length === 0 }] : []),
    ...expected.laws.flatMap((law) => checkLaw({ expected: law, laws })),
    ...forbidden.map((word) => ({
      label: `no "${word}"`,
      passed: !includesAny({ value: text, words: [word] }),
    })),
  ];
}

export const scoreLessonLaws: TaskScorer<LessonLawsExpected> = ({ output, testCase }) => {
  const laws = parseLaws(output);

  if (!laws || !testCase.expected) {
    return createFixedScore({ conclusion: "No laws", score: MIN_SCORE });
  }

  const checks = listChecks({ expected: testCase.expected, laws });
  const failed = checks.filter((check) => !check.passed).map((check) => check.label);
  const passed = checks.length - failed.length;

  return createFixedScore({
    conclusion: failed.length === 0 ? "None" : `Wrong: ${failed.join(", ")}`,
    score: MIN_SCORE + (SCORE_RANGE * passed) / checks.length,
  });
};
