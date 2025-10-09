import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LanguageModelUsage } from "ai";
import type { CourseSuggestion } from "@/ai/course-suggestions";
import { generateCourseSuggestions } from "@/ai/course-suggestions";
import systemPrompt from "@/ai/course-suggestions.md";
import type { EvalScore } from "./eval-system";
import {
  calculateAverage,
  calculateCostPer100Calls,
  calculateMedian,
  scoreOutput,
} from "./eval-system";
import type { ModelConfig } from "./models";
import { getModelDisplayName } from "./models";
import { COURSE_SUGGESTIONS_TEST_CASES } from "./test-cases";

const RESULTS_DIR = join(process.cwd(), "ai", "evals", "results");
const TASK_NAME = "course-suggestions";
const TWO = 2;

/**
 * Process a single test case.
 */
async function processTestCase(
  testCase: { locale: string; prompt: string; expectations: string },
  testCaseIndex: number,
  model: ModelConfig,
): Promise<TestCaseResult> {
  // Generate course suggestions using the model
  const { courses, usage } = await generateCourseSuggestions({
    locale: testCase.locale,
    prompt: testCase.prompt,
    modelOverride: model.reasoningEffort
      ? `${model.id}:reasoning-effort=${model.reasoningEffort}`
      : model.id,
  });

  const aiOutput = JSON.stringify(courses, null, TWO);
  const userPrompt = `
    APP_LANGUAGE: ${testCase.locale}
    USER_INPUT: ${testCase.prompt}
  `.trim();

  // Score the output
  const evalScore = await scoreOutput({
    userPrompt,
    systemPrompt,
    expectations: testCase.expectations,
    aiOutput,
  });

  return {
    testCaseIndex,
    locale: testCase.locale,
    prompt: testCase.prompt,
    expectations: testCase.expectations,
    aiOutput: courses,
    evalScore,
    usage,
  };
}

/**
 * Process all test cases sequentially.
 */
async function processAllTestCases(
  model: ModelConfig,
): Promise<TestCaseResult[]> {
  return COURSE_SUGGESTIONS_TEST_CASES.reduce(
    async (accPromise, testCase, index) => {
      const acc = await accPromise;
      const result = await processTestCase(testCase, index, model);
      return [...acc, result];
    },
    Promise.resolve<TestCaseResult[]>([]),
  );
}

export interface TestCaseResult {
  testCaseIndex: number;
  locale: string;
  prompt: string;
  expectations: string;
  aiOutput: CourseSuggestion[];
  evalScore: EvalScore;
  usage: LanguageModelUsage;
}

export interface ModelEvalResult {
  model: ModelConfig;
  testResults: TestCaseResult[];
  averageScore: number;
  medianScore: number;
  avgCostPer100: number;
}

/**
 * Run evaluation for course suggestions with a specific model.
 */
export async function runCourseSuggestionsEval(
  model: ModelConfig,
): Promise<ModelEvalResult> {
  const results = await processAllTestCases(model);

  const scores = results.map((result) => result.evalScore.finalScore);
  const usages = results.map((result) => result.usage);

  const averageScore = calculateAverage(scores);
  const medianScore = calculateMedian(scores);
  const avgCostPer100 = calculateCostPer100Calls(usages, model);

  return {
    model,
    testResults: results,
    averageScore,
    medianScore,
    avgCostPer100,
  };
}

/**
 * Save eval results to a JSON file.
 */
export async function saveEvalResults(result: ModelEvalResult): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });

  const modelName = getModelDisplayName(result.model).replace(/\s+/g, "-");
  const filename = `${TASK_NAME}-${modelName}.json`;
  const filepath = join(RESULTS_DIR, filename);

  await writeFile(filepath, JSON.stringify(result, null, TWO));
}
