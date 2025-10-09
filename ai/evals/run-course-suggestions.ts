import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { generateObject } from "ai";
import { z } from "zod";
import { repairAIText } from "@/lib/utils";
import { COURSE_SUGGESTIONS_TEST_CASES } from "./course-suggestions-cases";
import type { ModelId } from "./models";
import { calculateAverageCostPer100Calls } from "./models";
import {
  calculateAverage,
  calculateMedian,
  getFinalScore,
  scoreResponse,
} from "./score";

const RESULTS_DIR = join(process.cwd(), "ai", "evals", "results");
const LEADERBOARD_FILE = join(
  process.cwd(),
  "ai",
  "course-suggestions-evals.md",
);
const SYSTEM_PROMPT_FILE = join(process.cwd(), "ai", "course-suggestions.md");
const COST_DECIMALS = 4;
const MODEL_PREFIX_REGEX = /^[^/]+\//;
const SCORE_DECIMALS = 2;

const courseSuggestionsSchema = z.object({
  courses: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
    }),
  ),
});

interface TestResult {
  testId: string;
  locale: string;
  prompt: string;
  expectations: string;
  output: Array<{ title: string; description: string }>;
  userPrompt: string;
  scoreSteps: Array<{
    kind: string;
    conclusion: string;
    score: number;
  }>;
  finalScore: number;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

interface ModelResults {
  model: ModelId;
  timestamp: string;
  results: TestResult[];
  averageScore: number;
  medianScore: number;
  averageCostPer100Calls: number;
}

/**
 * Save results to a JSON file
 */
function saveResults(results: ModelResults): void {
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const filename = `course-suggestions-${results.model.replace(/\//g, "-")}.json`;
  const filepath = join(RESULTS_DIR, filename);

  writeFileSync(filepath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${filepath}`);
}

/**
 * Load all results from the results directory
 */
function loadAllResults(): ModelResults[] {
  if (!existsSync(RESULTS_DIR)) {
    return [];
  }

  const files = readdirSync(RESULTS_DIR).filter(
    (f: string) => f.startsWith("course-suggestions-") && f.endsWith(".json"),
  );

  return files.map((file: string) => {
    const content = readFileSync(join(RESULTS_DIR, file), "utf-8");
    return JSON.parse(content) as ModelResults;
  });
}

/**
 * Update the leaderboard markdown file
 */
function updateLeaderboard(): void {
  const allResults = loadAllResults();

  if (allResults.length === 0) {
    console.log("No results to update leaderboard");
    return;
  }

  const sorted = allResults.sort((a, b) => b.averageScore - a.averageScore);

  const rows = sorted.map((result) => {
    const modelName = result.model.replace(MODEL_PREFIX_REGEX, "");
    const avg = result.averageScore.toFixed(SCORE_DECIMALS);
    const median = result.medianScore.toFixed(SCORE_DECIMALS);
    const cost = result.averageCostPer100Calls.toFixed(COST_DECIMALS);
    return `| ${modelName} | ${avg} | ${median} | $${cost} |`;
  });

  const table = [
    "| Model | Average | Median | Avg. Cost |",
    "|-------|---------|--------|-----------|",
    ...rows,
  ].join("\n");

  const markdown = `# Suggest Courses Evals

## Notes

- Average and Median values go from 0 to 10, where 10 is the best.
- Avg. Cost is the average cost per 100 calls in USD.

## Leaderboard

${table}
`;

  writeFileSync(LEADERBOARD_FILE, markdown);
  console.log(`Leaderboard updated: ${LEADERBOARD_FILE}`);
}

/**
 * Generate course suggestions for evaluation
 * This is a standalone version that reads the markdown file directly
 */
async function generateCourseSuggestionsForEval({
  model,
  locale,
  prompt,
  systemPrompt,
}: {
  model: ModelId;
  locale: string;
  prompt: string;
  systemPrompt: string;
}) {
  const userPrompt = `
    APP_LANGUAGE: ${locale}
    USER_INPUT: ${prompt}
  `;

  const { object, usage } = await generateObject({
    model,
    schema: courseSuggestionsSchema,
    prompt: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    experimental_repairText: async ({ text, error }) =>
      repairAIText({
        text,
        error,
        context: `[courseSuggestion] [${locale}] "${prompt}"`,
      }),
  });

  return { courses: object.courses, usage };
}

/**
 * Run evaluations for a specific model
 */
export async function runEvaluations(model: ModelId): Promise<ModelResults> {
  console.log(`Running evaluations for model: ${model}`);

  // Load system prompt from file
  const systemPrompt = readFileSync(SYSTEM_PROMPT_FILE, "utf-8");

  const results: TestResult[] = [];

  for (const testCase of COURSE_SUGGESTIONS_TEST_CASES) {
    console.log(`  Running test case: ${testCase.id}`);

    const userPrompt = `
    APP_LANGUAGE: ${testCase.locale}
    USER_INPUT: ${testCase.prompt}
  `.trim();

    // biome-ignore lint/performance/noAwaitInLoops: Sequential execution is intentional for evaluations
    const { courses, usage } = await generateCourseSuggestionsForEval({
      model,
      locale: testCase.locale,
      prompt: testCase.prompt,
      systemPrompt,
    });

    const aiOutput = JSON.stringify(courses, null, 2);

    console.log(`  Scoring response for: ${testCase.id}`);
    const scoreResult = await scoreResponse({
      userPrompt,
      systemPrompt,
      expectations: testCase.expectations,
      aiOutput,
    });

    const finalScore = getFinalScore(scoreResult);

    const usageData = usage as unknown as {
      promptTokens: number;
      completionTokens: number;
    };

    results.push({
      testId: testCase.id,
      locale: testCase.locale,
      prompt: testCase.prompt,
      expectations: testCase.expectations,
      output: courses,
      userPrompt,
      scoreSteps: scoreResult.steps,
      finalScore,
      usage: {
        promptTokens: usageData.promptTokens ?? 0,
        completionTokens: usageData.completionTokens ?? 0,
      },
    });

    console.log(`  Score: ${finalScore.toFixed(SCORE_DECIMALS)}`);
  }

  const scores = results.map((r) => r.finalScore);
  const usages = results.map((r) => r.usage);

  const modelResults: ModelResults = {
    model,
    timestamp: new Date().toISOString(),
    results,
    averageScore: calculateAverage(scores),
    medianScore: calculateMedian(scores),
    averageCostPer100Calls: calculateAverageCostPer100Calls(model, usages),
  };

  saveResults(modelResults);
  updateLeaderboard();

  return modelResults;
}
