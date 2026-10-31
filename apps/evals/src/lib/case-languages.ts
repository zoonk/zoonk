import { getBaseLanguage } from "@zoonk/utils/languages";
import { summarizeClassification } from "./classification-metrics";
import { formatPercent } from "./format";
import { average } from "./math";
import { calculateScore } from "./score-calculation";
import { getBaseTestCaseId } from "./test-case-runs";
import { type EvalResult, type TestCase } from "./types";

export const REQUIRED_LANGUAGES = ["en", "pt"] as const;

export const UNKNOWN_LANGUAGE = "unknown";

const ID_LANGUAGE_PATTERN = /^(?<language>[a-z]{2})-/u;

const languageNames = new Intl.DisplayNames(["en"], { fallback: "none", type: "language" });

function toBaseLanguage(value: string): string {
  return getBaseLanguage(value);
}

function getInputLanguage(input: unknown): string | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const fields = input as Record<string, unknown>;
  const value = [fields.learnerLanguage, fields.language].find((item) => typeof item === "string");

  return typeof value === "string" ? toBaseLanguage(value) : null;
}

function getIdLanguage(id: string): string | null {
  const prefix = ID_LANGUAGE_PATTERN.exec(id)?.groups?.language;
  return prefix && languageNames.of(prefix) ? prefix : null;
}

/** Returns null when neither the explicit language, learner input nor case ID identifies a language. */
export function getTestCaseLanguage(
  testCase: Pick<TestCase, "id" | "language" | "userInput">,
): string | null {
  return testCase.language ?? getInputLanguage(testCase.userInput) ?? getIdLanguage(testCase.id);
}

export type LanguageSummary = {
  language: string;
  cases: number;
  score: number;
  accuracy: number | null;
};

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
