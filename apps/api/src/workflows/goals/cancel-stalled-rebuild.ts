import { finishGoalRebuild } from "@zoonk/core/goals/rebuild-follow-up";
import { parseStepName } from "workflow/observability";
import { getWorld } from "workflow/runtime";
import { readGoalRebuildAsk } from "./goal-rebuild-ask";

/* oxlint-disable no-await-in-loop -- A long graph wait can put its admission on a later page. */
async function readAdmissionStart(
  world: Awaited<ReturnType<typeof getWorld>>,
  runId: string,
): Promise<Date | null> {
  let cursor: string | undefined;

  do {
    const page = await world.steps.list({
      pagination: { cursor, sortOrder: "asc" },
      resolveData: "none",
      runId,
    });

    const admission = page.data.find(
      (step) => parseStepName(step.stepName)?.shortName === "isGoalRebuildOwedStep",
    );

    if (admission) {
      return admission.createdAt;
    }

    cursor = page.hasMore ? (page.cursor ?? undefined) : undefined;
  } while (cursor);

  return null;
}
/* oxlint-enable no-await-in-loop */

/** The ask token carries its row revision; hard cancellation will not execute the run's finally. */
export async function finishStalledGoalRebuild(generationId: string): Promise<void> {
  const world = await getWorld();

  const { data: hooks } = await world.hooks.list({
    pagination: { sortOrder: "asc" },
    runId: generationId,
  });

  const ask = hooks.map((hook) => readGoalRebuildAsk(hook.token)).find((input) => input !== null);

  if (ask) {
    await finishGoalRebuild({
      ...ask,
      failed: true,
      generationId,
      startedAt: await readAdmissionStart(world, generationId),
    });
  }
}
