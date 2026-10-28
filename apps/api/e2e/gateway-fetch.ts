import { getStepMetadata } from "workflow";
// By path: the package name resolves to this file in E2E builds.
import { blockTestGatewayFetch as failGatewayCall } from "../../../packages/ai/src/_utils/block-test-gateway-fetch";

/** What a model call in a run gets: an answer that never comes. */
const NO_ANSWER = Promise.withResolvers<never>().promise;

function isInWorkflowStep(): boolean {
  try {
    getStepMetadata();
    return true;
  } catch {
    return false;
  }
}

/**
 * @public The API's E2E alias replaces the gateway's test kill switch with this one. E2E has no
 * model, and the runs a test's request starts don't need one: a model call inside a workflow step
 * never answers, so its run stays in progress, as while a model writes, instead of failing and
 * retrying in the server log. A call anywhere else (a request, `after()`) still fails at once, as
 * an outage would, so tests can rely on that and an unexpected call shows.
 */
export const blockTestGatewayFetch: typeof failGatewayCall = async (...args) =>
  isInWorkflowStep() ? NO_ANSWER : failGatewayCall(...args);
