import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LanguageModelV2Usage } from "@ai-sdk/provider";
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
  onProgress?: (message: string) => void,
): Promise<TestCaseResult> {
  const caseNum = testCaseIndex + 1;
  const totalCases = COURSE_SUGGESTIONS_TEST_CASES.length;

  onProgress?.(
    `[${caseNum}/${totalCases}] Generating courses for: "${testCase.prompt}"`,
  );
  console.log(
    `[Eval ${caseNum}/${totalCases}] Processing: "${testCase.prompt}"`,
  );

  // Generate course suggestions using the model
  const { courses, usage } = await generateCourseSuggestions({
    locale: testCase.locale,
    prompt: testCase.prompt,
    modelOverride: model.reasoningEffort
      ? `${model.id}:reasoning-effort=${model.reasoningEffort}`
      : model.id,
  });

  console.log(
    `[Eval ${caseNum}/${totalCases}] Generated ${courses.length} courses`,
  );
  console.log(`[Eval ${caseNum}/${totalCases}] Usage:`, usage);

  const aiOutput = JSON.stringify(courses, null, TWO);
  const userPrompt = `
    APP_LANGUAGE: ${testCase.locale}
    USER_INPUT: ${testCase.prompt}
  `.trim();

  onProgress?.(`[${caseNum}/${totalCases}] Scoring output...`);
  console.log(`[Eval ${caseNum}/${totalCases}] Scoring output...`);

  // Score the output
  const evalScore = await scoreOutput({
    userPrompt,
    systemPrompt,
    expectations: testCase.expectations,
    aiOutput,
  });

  console.log(
    `[Eval ${caseNum}/${totalCases}] Final score: ${evalScore.finalScore.toFixed(2)}`,
  );

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
  onProgress?: (message: string) => void,
): Promise<TestCaseResult[]> {
  return COURSE_SUGGESTIONS_TEST_CASES.reduce(
    async (accPromise, testCase, index) => {
      const acc = await accPromise;
      const result = await processTestCase(testCase, index, model, onProgress);
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
  usage: LanguageModelV2Usage;
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
  onProgress?: (message: string) => void,
): Promise<ModelEvalResult> {
  console.log(
    `[Eval] Starting evaluation for model: ${getModelDisplayName(model)}`,
  );
  onProgress?.(`Starting evaluation for ${getModelDisplayName(model)}...`);

  const results = await processAllTestCases(model, onProgress);

  console.log("[Eval] Calculating metrics...");
  onProgress?.("Calculating metrics...");

  const scores = results.map((result) => result.evalScore.finalScore);
  const usages = results.map((result) => result.usage);

  const averageScore = calculateAverage(scores);
  const medianScore = calculateMedian(scores);
  const avgCostPer100 = calculateCostPer100Calls(usages, model);

  console.log(`[Eval] Average score: ${averageScore.toFixed(2)}`);
  console.log(`[Eval] Median score: ${medianScore.toFixed(2)}`);
  console.log(`[Eval] Avg cost per 100 calls: $${avgCostPer100.toFixed(2)}`);

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
