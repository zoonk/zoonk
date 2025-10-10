#!/usr/bin/env tsx

/**
 * Script to run course suggestions evaluations
 *
 * Usage:
 *   pnpm eval <task> <model>
 *
 * Example:
 *   pnpm eval course-suggestions openai/gpt-4.1
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { courseSuggestionsEval } from "../course-suggestions/evals";
import { getModelById, getModelDisplayName, type ModelConfig } from "./models";
import { calculateAverage, calculateMedian, calculateUsageCost } from "./score";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const RESULTS_DIR = join(process.cwd(), "ai", "evals", "results");

function getFileName(model: ModelConfig, task: string) {
  const modelName = getModelDisplayName(model);

  return `${task.replace(/\s+/g, "-")}-${modelName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/\//g, "-")}.json`;
}

function getResults(model: ModelConfig, task: string) {
  switch (task) {
    case "course-suggestions":
      return courseSuggestionsEval(model);
    default:
      throw new Error(`Unknown task: ${task}`);
  }
}

type TaskResult = Awaited<ReturnType<typeof getResults>>[number];

function storeResults(params: {
  results: TaskResult[];
  task: string;
  model: ModelConfig;
}) {
  const { results, task, model } = params;

  const fileName = getFileName(model, task);
  const filePath = join(RESULTS_DIR, fileName);
  const fileContent = JSON.stringify(results, null, 2);

  console.log(`[Eval] Storing results to ${filePath}`);

  return writeFileSync(filePath, fileContent);
}

async function main() {
  const taskArg = process.argv[2];
  const modelArg = process.argv[3];
  const model = getModelById(modelArg);

  if (!model) {
    console.error("Error: Model argument is required");
    console.log("Usage: pnpm eval:course-suggestions <model>");
    process.exit(1);
  }

  console.log(`[Eval] Starting eval for ${getModelDisplayName(model)}`);

  const results = await getResults(model, taskArg);

  console.log("[Eval] Calculating metrics...");

  const scores = results.map((result) => result.evalScore.score);
  const usages = results.map((result) => result.usage);

  const averageScore = calculateAverage(scores);
  const medianScore = calculateMedian(scores);
  const usageCost = calculateUsageCost(usages, model);

  console.log(`[Eval] Average score: ${averageScore.toFixed(2)}`);
  console.log(`[Eval] Median score: ${medianScore.toFixed(2)}`);
  console.log(`[Eval] Usage cost: $${usageCost.toFixed(2)}`);

  storeResults({ results, task: taskArg, model });

  console.log("[Eval] Eval results stored successfully");
}

void main();
