import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateObject } from "ai";
import { getModelDisplayName, type ModelConfig } from "../evals/models";
import {
  calculateAverage,
  calculateMedian,
  calculateUsageCost,
  generateScore,
} from "../evals/score";
import { courseSuggestionsSchema, getUserPrompt } from "./generate";
import { TEST_CASES, type TestCase } from "./test-cases";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROMPT_FILE = join(__dirname, "prompt.md");
const system = readFileSync(PROMPT_FILE, "utf-8");

async function generateOutput(params: {
  model: ModelConfig;
  testCase: TestCase;
}) {
  const { model, testCase } = params;

  const { object, usage } = await generateObject({
    model: model.id,
    schema: courseSuggestionsSchema,
    system,
    prompt: getUserPrompt(testCase),
  });

  return { suggestions: object.courses, usage };
}

async function runTestCase(params: {
  testCase: TestCase;
  index: number;
  model: ModelConfig;
}) {
  const { testCase, index, model } = params;
  const caseNumber = index + 1;
  const totalCases = TEST_CASES.length;
  const evalName = `[Eval ${caseNumber}/${totalCases}]`;

  console.log(`${evalName} Processing: "${testCase.prompt}"`);

  const { suggestions, usage } = await generateOutput({
    model,
    testCase,
  });

  console.log(`\n${evalName} ${suggestions.length} suggestions`);
  console.log(`\n${evalName} Usage:`, usage);

  console.log(`\n${evalName} Scoring AI output...`);

  const output = JSON.stringify(suggestions, null, 2);

  const evalScore = await generateScore({
    system,
    prompt: getUserPrompt(testCase),
    expectations: testCase.expectations,
    output,
  });

  console.log(`\n${evalName} Score:`, evalScore.score.toFixed(2));

  return { ...testCase, index, output, evalScore, usage };
}

function runAllTestCases(model: ModelConfig) {
  const results = TEST_CASES.map((testCase, index) =>
    runTestCase({ testCase, index, model }),
  );

  return Promise.all(results);
}

export async function runEvals(model: ModelConfig) {
  console.log(`[Eval] Starting eval for ${getModelDisplayName(model)}`);

  const results = await runAllTestCases(model);

  console.log("[Eval] Calculating metrics...");

  const scores = results.map((result) => result.evalScore.score);
  const usages = results.map((result) => result.usage);

  const averageScore = calculateAverage(scores);
  const medianScore = calculateMedian(scores);
  const usageCost = calculateUsageCost(usages, model);

  console.log(`[Eval] Average score: ${averageScore.toFixed(2)}`);
  console.log(`[Eval] Median score: ${medianScore.toFixed(2)}`);
  console.log(`[Eval] Usage cost: $${usageCost.toFixed(2)}`);

  return { results, averageScore, medianScore, usageCost };
}
