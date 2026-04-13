import { workflowWriteMock } from "../../../mocks/workflow";

/**
 * Returns the shared stream writer mock used by workflow tests.
 * Keeping this behind a helper means individual test files do not need to
 * own local `writeMock` variables just to inspect emitted stream events.
 */
export function getWorkflowWriteMock() {
  return workflowWriteMock;
}
