import { prisma } from "@zoonk/db";
import { decidePlanChange } from "../../decide-plan-change";
import { toRulePlan } from "./sim-context";
import { keepPlannedKnown } from "./sim-db-known";
import { type DbRunner, recordDb } from "./sim-db-runner";
import { type SimPlan } from "./sim-world";

/**
 * The learner undoes, right away, what the step before did (an edit, or placement's test-outs), as
 * Today's Undo does (`decidePlanChange`). `restores` is the plan it started from: the checks
 * compare what comes back with it (R38).
 */
export async function undoDb(
  runner: DbRunner,
  { kind, restores, step }: { kind: "edited" | "testedOut"; restores: SimPlan; step: number },
) {
  const change = await prisma.planChange.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: { kind, planId: runner.plan.id, status: "applied" },
  });

  const decided = change
    ? await decidePlanChange({
        changeId: change.id,
        goalId: runner.goal.id,
        input: { status: "undone", timeZone: "UTC" },
      })
    : null;

  if (decided?.status !== "updated") {
    return;
  }

  // The edit the step before recorded last is no longer a change the learner made.
  if (kind === "edited") {
    runner.learnerChanges.pop();
  }

  const goalKind = runner.library.fixture.goal.kind;
  keepPlannedKnown({ goalId: runner.goal.id, knownSkillIds: restores.knownSkillIds ?? [] });

  await recordDb(runner, {
    event: {
      change: kind,
      kind: "undo",
      restores: toRulePlan({ inputs: runner.ruleInputs, kind: goalKind, plan: restores }),
    },
    label: "undo",
    step,
  });
}
