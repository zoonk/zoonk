import { claimLibraryGeneration } from "@zoonk/core/library/claims/generation";
import {
  getLessonGenerationState,
  releaseStaleLessonClaims,
} from "@zoonk/core/library/generation/state";
import {
  type PlanGenerationManifest,
  admitPlanLessons,
} from "@zoonk/core/lookahead/speculative-lessons";
import { isRunActive } from "../../_shared/run-activity";

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

export async function admitLessonContentStep(input: {
  goalId?: string;
  lessonId: string;
  manifest?: PlanGenerationManifest | null;
}): Promise<boolean> {
  "use step";

  if (!input.goalId) {
    return true;
  }

  const admitted = await admitPlanLessons({
    goalId: input.goalId,
    lessonIds: [input.lessonId],
    manifest: input.manifest ?? null,
  });

  return admitted.includes(input.lessonId);
}
