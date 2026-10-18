/**
 * Lists every task's cases per language and how many came from production
 * samples, and fails when a task lacks English or Portuguese cases or has a
 * case whose language can't be told. No model is called.
 *
 *   pnpm eval:languages
 */
import { REQUIRED_LANGUAGES, UNKNOWN_LANGUAGE, getTestCaseLanguage } from "@/lib/case-languages";
import { type RegisteredTask } from "@/lib/types";
import { TASKS } from "@/tasks";

/** Enough ids to find the cases without flooding the table. */
const MAX_LISTED_IDS = 5;

type TaskCoverage = {
  counts: Map<string, number>;
  problems: string[];
  production: number;
  taskId: string;
};

function formatIds(ids: string[]): string {
  const listed = ids.slice(0, MAX_LISTED_IDS).join(", ");
  return ids.length > MAX_LISTED_IDS ? `${listed} and ${ids.length - MAX_LISTED_IDS} more` : listed;
}

function getTaskCoverage(task: RegisteredTask): TaskCoverage {
  const languages = task.testCases.map(
    (testCase) => getTestCaseLanguage(testCase) ?? UNKNOWN_LANGUAGE,
  );

  const counts = new Map(
    [...new Set(languages)].map((language) => [
      language,
      languages.filter((item) => item === language).length,
    ]),
  );

  const unknownIds = task.testCases
    .filter((testCase) => !getTestCaseLanguage(testCase))
    .map((testCase) => testCase.id);

  const problems = [
    ...REQUIRED_LANGUAGES.filter((language) => !counts.has(language)).map(
      (language) => `no ${language} cases`,
    ),
    ...(unknownIds.length > 0 ? [`no language on ${formatIds(unknownIds)}`] : []),
  ];

  return {
    counts,
    problems,
    production: task.testCases.filter((testCase) => testCase.origin === "production").length,
    taskId: task.id,
  };
}

function formatOtherLanguages(counts: Map<string, number>): string {
  return [...counts]
    .filter(([language]) => !(REQUIRED_LANGUAGES as readonly string[]).includes(language))
    .map(([language, count]) => `${language} ${count}`)
    .join(", ");
}

function formatRow(coverage: TaskCoverage): string {
  return [
    coverage.taskId,
    ...REQUIRED_LANGUAGES.map((language) => String(coverage.counts.get(language) ?? 0)),
    formatOtherLanguages(coverage.counts) || "—",
    String(coverage.production),
    coverage.problems.join("; ") || "ok",
  ].join(" | ");
}

const coverages = TASKS.map((task) => getTaskCoverage(task));
const failing = coverages.filter((coverage) => coverage.problems.length > 0);

const output = [
  `| Task | ${REQUIRED_LANGUAGES.map((language) => language.toUpperCase()).join(" | ")} | Other | From production | Status |`,
  `| --- | ${REQUIRED_LANGUAGES.map(() => "---").join(" | ")} | --- | --- | --- |`,
  ...coverages.map((coverage) => `| ${formatRow(coverage)} |`),
  "",
  failing.length === 0
    ? `All ${coverages.length} tasks have English and Portuguese cases.`
    : `${failing.length} of ${coverages.length} tasks need cases: ${failing.map((coverage) => coverage.taskId).join(", ")}.`,
].join("\n");

process.stdout.write(`${output}\n`);
process.exitCode = failing.length === 0 ? 0 : 1;
