import { getLessonGenerationStates } from "@zoonk/core/library/generation/state";
import {
  type SessionPreparation,
  listSessionPreparation,
} from "@zoonk/core/lookahead/session-preparation";
import { createPlanGenerationManifest } from "@zoonk/core/lookahead/speculative-lessons";

export async function listSessionPreparationStep(input: {
  goalId: string;
  timeZone: string;
  userId: string;
}): Promise<SessionPreparation> {
  "use step";

  return listSessionPreparation(input);
}

/** The immutable admitted batch is saved in the parent's durable step log before children start. */
export async function createSessionGenerationManifestStep(input: {
  goalId: string;
  lessonIds: string[];
}) {
  "use step";

  return createPlanGenerationManifest(input);
}

/** How many of these lessons are still being written: not written yet, and not given up on. */
export async function countLessonsBeingWrittenStep(lessonIds: string[]): Promise<number> {
  "use step";

  const states = await getLessonGenerationStates(lessonIds);

  return [...states.values()].filter(
    (state) => state.status === "notStarted" || state.status === "generating",
  ).length;
}
