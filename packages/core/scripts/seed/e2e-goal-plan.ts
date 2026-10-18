/**
 * For Main's E2E fixtures that save a goal's skill graph: builds and saves the goal's plan from
 * that graph with core's planner (`createGoalPlan`), as the goal workflow does before the learner
 * sees it. Pages only read a plan; no GET saves one. For processes that can't load core's server
 * code (Playwright), run as `tsx --conditions=react-server --import=./scripts/seed/node-runtime.mjs scripts/seed/e2e-goal-plan.ts --goal <id>`. No model is called.
 */
import { parseArgs } from "node:util";
import { prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { createGoalPlan } from "../../src/plans/create-goal-plan";
import { parsePlanGraph } from "../../src/plans/planner/plan-state";

async function main() {
  const { values } = parseArgs({ options: { goal: { type: "string" } } });
  const { goal } = values;

  if (!goal) {
    throw new Error("Usage: e2e-goal-plan.ts --goal <id>");
  }

  const plan = await prisma.plan.findUniqueOrThrow({
    select: { graph: true },
    where: { goalId: goal },
  });

  await createGoalPlan({ goalId: goal, graph: parsePlanGraph(plan.graph), platform: null });
}

// The database pool keeps idle connections open for a while: exit as soon as the plan is written.
main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    logError(error);
    await prisma.$disconnect();
    process.exit(1);
  });
