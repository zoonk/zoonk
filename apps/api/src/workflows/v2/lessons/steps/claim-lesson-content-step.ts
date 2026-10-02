import { claimLibraryGeneration } from "@zoonk/core/library/claims/generation";
import {
  getLessonGenerationState,
  releaseStaleLessonClaims,
} from "@zoonk/core/library/generation/state";
import { isRunActive } from "../../_shared/run-activity";

/** `setAside`: every draft the lesson gets was held back, so nothing writes it again. */
export type LessonContentClaim =
  | { status: "claimed" | "completed" | "missing" | "setAside" }
  | { runId: string; status: "running" };

async function claim({ lessonId, workflowRunId }: { lessonId: string; workflowRunId: string }) {
  return claimLibraryGeneration({ id: lessonId, target: "lessonContent", workflowRunId });
}

async function readOwner(lessonId: string): Promise<string | null> {
  const state = await getLessonGenerationState(lessonId);
  return state?.status === "generating" ? state.runId : null;
}

/**
 * Claims a lesson's content for this run before any AI work starts. A claim held by a run that is
 * no longer running is released and taken over, so a crashed run never blocks a lesson; a live
 * owner is reported so this run can follow it. A lesson set aside is never claimed again.
 */
export async function claimLessonContentStep(input: {
  lessonId: string;
  workflowRunId: string;
}): Promise<LessonContentClaim> {
  "use step";

  const state = await getLessonGenerationState(input.lessonId);

  if (!state) {
    return { status: "missing" };
  }

  if (state.status === "failed" && state.setAside) {
    return { status: "setAside" };
  }

  const first = await claim(input);

  if (first !== "running") {
    return { status: first };
  }

  const ownerId = await readOwner(input.lessonId);

  if (ownerId && (await isRunActive(ownerId))) {
    return { runId: ownerId, status: "running" };
  }

  if (ownerId) {
    await releaseStaleLessonClaims({ lessonId: input.lessonId, staleRunId: ownerId });
  }

  const second = await claim(input);

  if (second !== "running") {
    return { status: second };
  }

  // Another run claimed it between the release and this claim: follow that one.
  return { runId: (await readOwner(input.lessonId)) ?? "", status: "running" };
}
