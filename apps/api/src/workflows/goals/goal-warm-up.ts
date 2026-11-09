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
  const warmUpId = await getDeck({ context, goalId, scope }).catch(() => null);

  // A wait shows the quiz's skeleton while the goal's deck is on its way, so every end reaches it.
  await goalProgressStep(
    warmUpId
      ? { entityId: goalId, status: "completed", step: "warmUpReady", warmUpId }
      : { entityId: goalId, status: "completed", step: "warmUpFailed" },
  );
}

async function getDeck({
  context,
  goalId,
  scope,
}: {
  context: GoalRunContext;
  goalId: string;
  scope: CurriculumScope;
}): Promise<string | null> {
  const claim = await claimWarmUpStep({ goalId, scope, workflowRunId: context.workflowRunId });

  if (claim.status === "none") {
    return null;
  }

  if (claim.status === "ready") {
    return claim.id;
  }

  if (claim.status === "claimed") {
    return writeDeck({ claim, context, goalId, scope });
  }

  const followed = await repeatUntil({
    done: ({ status }) => status !== "writing",
    run: () => readWarmUpStatusStep({ goalId, id: claim.id }),
    times: 30,
    wait: () => sleep("2s"),
  });

  return followed.status === "ready" ? claim.id : null;
}
