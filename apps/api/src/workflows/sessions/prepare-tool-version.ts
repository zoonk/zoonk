import { getToolVersionToken } from "@zoonk/core/library/variants/tool-token";
import { type ToolVersionTarget } from "@zoonk/core/library/variants/version-targets";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { claimRunToken } from "../_shared/run-token";
import { prepareToolVersionStep } from "./steps/personal-versions-steps";

export async function prepareToolVersion(input: {
  analytics?: ContentAnalytics;
  target: ToolVersionTarget;
  workflowRunId: string;
}): Promise<string> {
  using claim = await claimRunToken(getToolVersionToken(input.target));

  if (claim.conflict) {
    return "busy";
  }

  return await prepareToolVersionStep(input);
}
