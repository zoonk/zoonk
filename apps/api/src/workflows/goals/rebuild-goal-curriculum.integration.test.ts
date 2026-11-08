import { waitForSleep } from "@workflow/vitest";
import { describe, expect, it } from "vitest";
import { getRun } from "workflow/api";
import { startOnce } from "../_shared/run-token";
import { heldInitialCurriculum } from "../_test-utils/held-initial-curriculum";
import { readStreamToEnd } from "../_test-utils/read-run-stream";
import { getGoalContentToken } from "./goal-content-workflow";
import { rebuildGoalCurriculumWorkflow } from "./rebuild-goal-curriculum-workflow";

describe(rebuildGoalCurriculumWorkflow, () => {
  it("waits for the initial run, then composes the goal run and closes its stream even when the goal was deleted", async () => {
    const goalId = crypto.randomUUID();
    const firstId = await startOnce(heldInitialCurriculum, [], getGoalContentToken({ goalId }));
    const first = getRun(firstId);
    const firstSleep = await waitForSleep(first);

    const rebuildId = await startOnce(
      rebuildGoalCurriculumWorkflow,
      [{ goalId }],
      `rebuild-ask:${goalId}`,
    );

    const rebuild = getRun(rebuildId);
    const waiting = await waitForSleep(rebuild);

    await first.wakeUp({ correlationIds: [firstSleep] });
    await first.returnValue;
    await rebuild.wakeUp({ correlationIds: [waiting] });

    await expect(rebuild.returnValue).resolves.toMatchObject({ goalId, status: "missing" });
    const streamed = await readStreamToEnd(rebuild);
    expect(streamed).toContain('"reason":"notFound"');
  });
});
