import { type GenerationStatus as DatabaseGenerationStatus } from "@zoonk/db";
import { type GenerationStatus as WorkflowGenerationStatus } from "./generation-store";

/**
 * Generation pages double as a stable waiting room when a workflow finishes
 * while the user is navigating. In that moment the destination page can still
 * be served from the router cache with stale child counts, so a server redirect
 * from `/generate/...` back to the destination can bounce the user forever.
 *
 * This helper keeps the page in a client-rendered "completed" state only when
 * the destination is actually ready. The client can then perform a hard
 * navigation, which avoids the stale router payload that caused the loop.
 */
export function getInitialGenerationPageStatus(params: {
  generationStatus: DatabaseGenerationStatus;
  isReadyForRedirect?: boolean;
}): WorkflowGenerationStatus {
  if (params.generationStatus === "running") {
    return "streaming";
  }

  if (params.generationStatus === "completed" && params.isReadyForRedirect !== false) {
    return "completed";
  }

  return "idle";
}
