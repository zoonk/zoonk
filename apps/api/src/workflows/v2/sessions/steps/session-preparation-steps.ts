import { getLessonGenerationStates } from "@zoonk/core/library/generation/state";
import {
  type SessionPreparation,
  listSessionPreparation,
} from "@zoonk/core/lookahead/session-preparation";
import {
  type PlanGenerationManifest,
  createPlanGenerationManifest,
} from "@zoonk/core/lookahead/speculative-lessons";
import { catchPlanConflict } from "../../_shared/plan-conflict-outcome";
import { type PlanStepOutcome } from "../../_shared/plan-conflict-retry";

export async function listSessionPreparationStep(input: {
  goalId: string;
  timeZone: string;
  userId: string;
}): Promise<SessionPreparation> {
  "use step";

  return listSessionPreparation(input);
}

/**
 * The immutable admitted batch is saved in the parent's durable step log before children start. A
 * plan other runs kept marking while it was read comes back as a conflict, for the run to prepare
 * again after a durable wait (see `retryPlanConflicts`).
 */
export async function createSessionGenerationManifestStep(input: {
  goalId: string;
  lessonIds: string[];
}): Promise<PlanStepOutcome<PlanGenerationManifest | null>> {
  "use step";

  return catchPlanConflict(() => createPlanGenerationManifest(input));
}

/** How many of these lessons are still being written: not written yet, and not given up on. */
export async function countLessonsBeingWrittenStep(lessonIds: string[]): Promise<number> {
  "use step";

  const states = await getLessonGenerationStates(lessonIds);

  return [...states.values()].filter(
    (state) => state.status === "notStarted" || state.status === "generating",
  ).length;
}
