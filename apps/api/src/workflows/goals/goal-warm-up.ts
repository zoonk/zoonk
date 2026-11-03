import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { type WarmUpClaim } from "@zoonk/core/library/warm-ups/claim";
import { sleep } from "workflow";
import { toContentAnalytics } from "../_shared/content-analytics";
import { repeatUntil } from "../_shared/repeat-until";
import { type GoalRunContext } from "./goal-run-context";
import { goalProgressStep } from "./steps/goal-progress-step";
import {
  checkWarmUpStep,
  claimWarmUpStep,
  failWarmUpStep,
  readWarmUpStatusStep,
  saveWarmUpStep,
  writeWarmUpStep,
} from "./steps/goal-warm-up-steps";

async function writeDeck({
  claim,
  context,
  goalId,
  scope,
}: {
  claim: Extract<WarmUpClaim, { status: "claimed" }>;
  context: GoalRunContext;
  goalId: string;
  scope: CurriculumScope;
}): Promise<string | null> {
  const { id, input } = claim;
  const { workflowRunId } = context;
  const analytics = toContentAnalytics({ ...context, scope });

  try {
    const written = await writeWarmUpStep({ analytics, id, input, workflowRunId });

    if (!written) {
      return null;
    }

    const checked = await checkWarmUpStep({ analytics, id, input, workflowRunId, written });

    return checked ? await saveWarmUpStep({ checked, goalId, id, workflowRunId, written }) : null;
  } catch {
    await failWarmUpStep({ id, workflowRunId });
    return null;
  }
}

export async function prepareWarmUp({
  context,
  goalId,
  scope,
}: {
  context: GoalRunContext;
  goalId: string;
  scope: CurriculumScope;
}): Promise<void> {
  const claim = await claimWarmUpStep({ goalId, scope, workflowRunId: context.workflowRunId });

  if (claim.status === "none") {
    return;
  }

  if (claim.status === "following") {
    const result = await repeatUntil({
      done: ({ status }) => status !== "writing",
      run: () => readWarmUpStatusStep({ goalId, id: claim.id }),
      times: 30,
      wait: () => sleep("2s"),
    });

    if (result.status === "ready") {
      await goalProgressStep({
        entityId: goalId,
        status: "completed",
        step: "warmUpReady",
        warmUpId: claim.id,
      });
    }

    return;
  }

  const warmUpId =
    claim.status === "ready" ? claim.id : await writeDeck({ claim, context, goalId, scope });

  if (warmUpId) {
    await goalProgressStep({
      entityId: goalId,
      status: "completed",
      step: "warmUpReady",
      warmUpId,
    });
  }
}
