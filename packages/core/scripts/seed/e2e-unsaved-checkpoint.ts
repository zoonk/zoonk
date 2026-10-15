/**
 * For Main's E2E of a Plan challenge the plan selected but hasn't saved yet: builds the goal's plan
 * from its skill graph (`--graph`, JSON), then deletes the plan's challenge rows in a marked
 * transaction, as a plan saved before its challenge was selected looks. The Plan shows that
 * challenge from its read, and the day's next open saves it. For processes that can't load core's
 * server code (Playwright), run as `tsx --conditions=react-server --import=./scripts/seed/node-runtime.mjs scripts/seed/e2e-unsaved-checkpoint.ts`. No model is called.
 */
import { parseArgs } from "node:util";
import { prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { markPlansChanged } from "../../src/learner/_utils/mark-learner-changed";
import { createGoalPlan } from "../../src/plans/create-goal-plan";
import { parsePlanGraph } from "../../src/plans/planner/plan-state";

async function main() {
  const { values } = parseArgs({
    options: { goal: { type: "string" }, graph: { type: "string" }, plan: { type: "string" } },
  });

  const { goal, graph, plan } = values;

  if (!goal || !graph || !plan) {
    throw new Error("Usage: e2e-unsaved-checkpoint.ts --goal <id> --plan <id> --graph <json>");
  }

  await createGoalPlan({ goalId: goal, graph: parsePlanGraph(JSON.parse(graph)), platform: null });

  await prisma.$transaction(async (tx) => {
    await markPlansChanged(tx, { planIds: [plan] });
    await tx.planItem.deleteMany({ where: { kind: "boss", planId: plan } });
  });
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
