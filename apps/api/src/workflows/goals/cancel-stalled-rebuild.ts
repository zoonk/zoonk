import { finishGoalRebuild } from "@zoonk/core/goals/rebuild-follow-up";
import { getWorld } from "workflow/runtime";
import { readGoalRebuildAsk } from "./goal-rebuild-ask";

/** The ask token carries its row revision; hard cancellation will not execute the run's finally. */
export async function finishStalledGoalRebuild(generationId: string): Promise<void> {
  const world = await getWorld();

  const { data: hooks } = await world.hooks.list({
    pagination: { sortOrder: "asc" },
    runId: generationId,
  });

  const ask = hooks.map((hook) => readGoalRebuildAsk(hook.token)).find((input) => input !== null);

  if (ask) {
    await finishGoalRebuild({ ...ask, failed: true, generationId });
  }
}
