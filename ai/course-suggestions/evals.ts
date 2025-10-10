import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateObject } from "ai";
import type { ModelConfig } from "../evals/models";
import { generateScore } from "../evals/score";
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

  console.log(`${evalName} ${suggestions.length} suggestions`);
  console.log(`${evalName} Usage:`, usage);
  console.log(`${evalName} Scoring AI output...`);

  const output = JSON.stringify(suggestions, null, 2);

  const evalScore = await generateScore({
    system,
    prompt: getUserPrompt(testCase),
    expectations: testCase.expectations,
    output,
  });

  console.log(`${evalName} Score:`, evalScore.score.toFixed(2));

  return { ...testCase, index, output, evalScore, usage };
}

export function courseSuggestionsEval(model: ModelConfig) {
  const results = TEST_CASES.map((testCase, index) =>
    runTestCase({ testCase, index, model }),
  );

  return Promise.all(results);
}
