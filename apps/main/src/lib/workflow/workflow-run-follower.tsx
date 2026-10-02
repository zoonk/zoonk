"use client";

import { type FollowedRunProps } from "@zoonk/learn/generation/follower";
import { useWorkflowRun } from "./use-workflow-run";

/** Main's follower for `GenerationFollowerProvider`: the run streamed live from the API. */
export function WorkflowRunFollower({ children, ...options }: FollowedRunProps) {
  return children(useWorkflowRun(options));
}
