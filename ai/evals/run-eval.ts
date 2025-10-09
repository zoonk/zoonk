#!/usr/bin/env tsx

/**
 * Script to run course suggestions evaluations
 *
 * Usage:
 *   pnpm eval:course-suggestions <model>
 *
 * Example:
 *   pnpm eval:course-suggestions openai/gpt-4.1
 */

import { config } from "dotenv";
import type { ModelId } from "./models";
import { MODEL_COSTS } from "./models";
import { runEvaluations } from "./run-course-suggestions";

// Load environment variables from .env file
config({ quiet: true });

const COST_DECIMALS = 4;
const SCORE_DECIMALS = 2;
const SEPARATOR_LENGTH = 60;

async function main() {
  const modelArg = process.argv[2];

  if (!modelArg) {
    console.error("Error: Model argument is required");
    console.log("\nUsage: pnpm eval:course-suggestions <model>");
    console.log("\nAvailable models:");
    for (const model of Object.keys(MODEL_COSTS)) {
      console.log(`  - ${model}`);
    }
    process.exit(1);
  }

  if (!(modelArg in MODEL_COSTS)) {
    console.error(`Error: Unknown model "${modelArg}"`);
    console.log("\nAvailable models:");
    for (const model of Object.keys(MODEL_COSTS)) {
      console.log(`  - ${model}`);
    }
    process.exit(1);
  }

  const model = modelArg as ModelId;

  console.log("=".repeat(SEPARATOR_LENGTH));
  console.log("Course Suggestions Evaluation");
  console.log("=".repeat(SEPARATOR_LENGTH));
  console.log();

  try {
    const results = await runEvaluations(model);

    console.log(`\n${"=".repeat(SEPARATOR_LENGTH)}`);
    console.log("Evaluation Complete");
    console.log("=".repeat(SEPARATOR_LENGTH));
    console.log(`Model: ${model}`);
    console.log(
      `Average Score: ${results.averageScore.toFixed(SCORE_DECIMALS)}`,
    );
    console.log(`Median Score: ${results.medianScore.toFixed(SCORE_DECIMALS)}`);
    console.log(
      `Average Cost per 100 calls: $${results.averageCostPer100Calls.toFixed(COST_DECIMALS)}`,
    );
    console.log("=".repeat(SEPARATOR_LENGTH));
  } catch (error) {
    console.error("\nError running evaluations:", error);
    process.exit(1);
  }
}

void main();
