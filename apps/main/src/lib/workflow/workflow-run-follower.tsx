"use client";

import { type FollowedRunProps } from "@zoonk/learn/generation/follower";
import { useWorkflowRun } from "./use-workflow-run";

export function WorkflowRunFollower({ children, ...options }: FollowedRunProps) {
  return children(useWorkflowRun(options));
}
