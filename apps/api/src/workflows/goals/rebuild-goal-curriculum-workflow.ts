import { sleep } from "workflow";
import { repeatUntil } from "../_shared/repeat-until";
import { claimRunToken, waitForRunToken } from "../_shared/run-token";
import { getGoalContentToken, goalContentWorkflow } from "./goal-content-workflow";
import { readGoalGraphStateStep } from "./steps/goal-build-outcome-steps";

const GRAPH_POLLS = 100;

export async function rebuildGoalCurriculumWorkflow({ goalId }: { goalId: string }) {
  "use workflow";

  if (!(await waitForRunToken(getGoalContentToken({ goalId, rebuild: true })))) {
    throw new Error(`The curriculum is still being rebuilt for ${goalId}`);
  }

  const graph = await repeatUntil({
    done: (current) => current.ready,
    run: async () => {
      const state = await readGoalGraphStateStep(goalId);

      if (state !== "building") {
        return { ready: true, state };
      }

      const claim = await claimRunToken(getGoalContentToken({ goalId }));

      return claim.conflict
        ? { ready: false, state }
        : { ready: true, state: await readGoalGraphStateStep(goalId) };
    },
    times: GRAPH_POLLS,
    wait: () => sleep("3s"),
  });

  if (!graph.ready) {
    throw new Error(`The initial curriculum has not saved its graph for ${goalId}`);
  }

  return goalContentWorkflow({ goalId, rebuild: graph.state === "saved" });
}
