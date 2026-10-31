import { getWorkflowMetadata } from "workflow";
import { parseWorkflowName } from "workflow/observability";
// By path: the package name resolves to this file in E2E builds.
import { blockTestGatewayFetch as failGatewayCall } from "../../../packages/ai/src/_utils/block-test-gateway-fetch";

const NO_ANSWER = Promise.withResolvers<never>().promise;

/** A call's completion request waits for its review, so the review's model calls fail at once. */
const RUNS_A_REQUEST_WAITS_FOR = new Set(["conversationReviewWorkflow"]);

function readRunName(): string | null {
  try {
    const { workflowName } = getWorkflowMetadata();
    return parseWorkflowName(workflowName)?.shortName ?? workflowName;
  } catch {
    return null;
  }
}

function isHeld(): boolean {
  const runName = readRunName();
  return runName !== null && !RUNS_A_REQUEST_WAITS_FOR.has(runName);
}

/**
 * @public The API's E2E alias replaces the gateway's test kill switch with this one. A model call
 * inside a workflow run never answers, so the run stays in progress instead of failing and retrying
 * in the server log; a call anywhere else fails at once, as an outage would.
 */
export const blockTestGatewayFetch: typeof failGatewayCall = async (...args) =>
  isHeld() ? NO_ANSWER : failGatewayCall(...args);
