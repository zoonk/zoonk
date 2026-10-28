import { getWorkflowMetadata } from "workflow";
import { parseWorkflowName } from "workflow/observability";
// By path: the package name resolves to this file in E2E builds.
import { blockTestGatewayFetch as failGatewayCall } from "../../../packages/ai/src/_utils/block-test-gateway-fetch";

/** What a model call in a run gets: an answer that never comes. */
const NO_ANSWER = Promise.withResolvers<never>().promise;

/**
 * Runs a request waits for, whose calls fail as the request's own would: a call's completion
 * waits for its review.
 */
const RUNS_A_REQUEST_WAITS_FOR = new Set(["conversationReviewWorkflow"]);

/** The workflow whose step makes the call, or null outside a run. */
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
 * @public The API's E2E alias replaces the gateway's test kill switch with this one. E2E has no
 * model, and the runs a test's request starts don't need one: a model call inside a workflow run
 * never answers, so the run stays in progress, as it does while a model writes, instead of failing
 * and retrying in the server log. A call anywhere else (a request, `after()`, a run a request waits
 * for) still fails at once, as an outage would, so tests can rely on that and an unexpected one
 * shows.
 */
export const blockTestGatewayFetch: typeof failGatewayCall = async (...args) =>
  isHeld() ? NO_ANSWER : failGatewayCall(...args);
