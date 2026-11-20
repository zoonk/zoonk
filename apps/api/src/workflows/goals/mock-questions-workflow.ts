import { getWorkflowMetadata } from "workflow";
import { startOnce } from "../_shared/run-token";
import { writeMockQuestions, prepareMockRecordings } from "./mock-question-writes";
import {
  listMockPrepWritesStep,
  checkMockSupplyStep,
  listExamSupplyGoalsStep,
} from "./steps/mock-question-steps";

type SupplyRequest = { goalId: string; examBlueprintId: string | null; later: boolean };

export function startMockSupply(input: SupplyRequest) {
  return startOnce(
    mockSupplyWorkflow,
    [input],
    `mock-supply:${input.examBlueprintId ?? input.goalId}`,
  );
}

export async function mockSupplyWorkflow(input: SupplyRequest) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();
  const goals = await listExamSupplyGoalsStep(input);
  for (const goalId of goals) {
    const writes = await listMockPrepWritesStep(goalId);
    await writeMockQuestions({
      ...writes,
      goalId,
      later: input.later || goalId !== input.goalId,
      workflowRunId,
    });
    if (writes.listening) await prepareMockRecordings({ goalId, workflowRunId });
    await checkMockSupplyStep(goalId);
  }
}
