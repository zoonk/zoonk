import { getBaseLanguage } from "@zoonk/utils/languages";
import { summarizeClassification } from "./classification-metrics";
import { formatPercent } from "./format";
import { average } from "./math";
import { calculateScore } from "./score-calculation";
import { getBaseTestCaseId } from "./test-case-runs";
import { type EvalResult, type TestCase } from "./types";

/** Most learners use these two, so every eval covers both and reports each one apart. */
export const REQUIRED_LANGUAGES = ["en", "pt"] as const;

export const UNKNOWN_LANGUAGE = "unknown";

/** Case ids like "pt-enem-math" start with their language. */
const ID_LANGUAGE_PATTERN = /^(?<language>[a-z]{2})-/u;

const languageNames = new Intl.DisplayNames(["en"], { fallback: "none", type: "language" });

function toBaseLanguage(value: string): string {
  return getBaseLanguage(value);
}

/** Language tasks name the learner's own language apart from the one they study. */
function getInputLanguage(input: unknown): string | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const fields = input as Record<string, unknown>;
  const value = [fields.learnerLanguage, fields.language].find((item) => typeof item === "string");

  return typeof value === "string" ? toBaseLanguage(value) : null;
}

/** "go-concurrent" isn't Go in a language called "go": only real language codes count. */
function getIdLanguage(id: string): string | null {
  const prefix = ID_LANGUAGE_PATTERN.exec(id)?.groups?.language;
  return prefix && languageNames.of(prefix) ? prefix : null;
}

/**
 * The language a case is written in: the case's own `language`, then the
 * learner's language in its input, then the id's prefix. Null means the case
 * doesn't say, which the language coverage check reports.
 */
export function getTestCaseLanguage(
  testCase: Pick<TestCase, "id" | "language" | "userInput">,
): string | null {
  return testCase.language ?? getInputLanguage(testCase.userInput) ?? getIdLanguage(testCase.id);
}

export type LanguageSummary = {
  language: string;
  cases: number;
  score: number;
  /** Share of cases with the expected label, for classifiers only. */
  accuracy: number | null;
};

/**
 * Scores per language, so a task that reads well in English but not in
 * Portuguese shows it. Saved results are matched to the task's current cases,
 * so a language set after the run still counts.
 */
export function summarizeByLanguage({
  results,
  testCases,
}: {
  results: EvalResult[];
  testCases: TestCase[];
}): LanguageSummary[] {
  const casesById = new Map(testCases.map((testCase) => [testCase.id, testCase]));

  const groups = Map.groupBy(results, (result) => {
    const testCase = casesById.get(getBaseTestCaseId(result.testCase.id)) ?? result.testCase;
    return getTestCaseLanguage(testCase) ?? UNKNOWN_LANGUAGE;
  });

  return [...groups]
    .map(([language, items]) => ({
      accuracy:
        summarizeClassification(
          items.flatMap((item) => (item.classification ? [item.classification] : [])),
        )?.accuracy ?? null,
      cases: items.length,
      language,
      score: average(
        items.map((item) =>
          calculateScore({ categoryScores: item.categoryScores, steps: item.steps }),
        ),
      ),
    }))
    .toSorted((left, right) => left.language.localeCompare(right.language));
}

/** One cell per required language: accuracy for classifiers, the average score otherwise, and the case count. */
export function formatLanguageResults(
  languages: LanguageSummary[],
): { language: string; text: string }[] {
  return REQUIRED_LANGUAGES.map((language) => {
    const summary = languages.find((item) => item.language === language);

    if (!summary) {
      return { language, text: "—" };
    }

    const value =
      summary.accuracy === null ? summary.score.toFixed(2) : formatPercent(summary.accuracy);

    return { language, text: `${value} (${summary.cases})` };
  });
}
