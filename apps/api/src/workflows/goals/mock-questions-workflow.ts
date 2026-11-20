import { getWorkflowMetadata } from "workflow";
import { startOnce, waitForRunToken } from "../_shared/run-token";
import { endFollowUpStep } from "../follow-ups/steps/follow-up-steps";
import { prepareMockRecordings, writeMockQuestions } from "./mock-question-writes";
import { pickMockSetTargetsStep, prepareItemSet } from "./steps/item-set-step";
import {
  checkMockSupplyStep,
  listExamSupplyGoalsStep,
  listMockPrepWritesStep,
} from "./steps/mock-question-steps";

type SupplyRequest = { goalId: string; examBlueprintId: string | null; later: boolean };
type SupplyAsk = { id: string; revision: number };

function supplyKey(input: SupplyRequest) {
  return `mock-supply:${input.examBlueprintId ?? input.goalId}`;
}

export function startMockSupply(input: SupplyRequest, ask?: SupplyAsk) {
  const request = ask ? `${ask.id}:${ask.revision}` : "ahead";

  return startOnce(
    mockSupplyWorkflow,
    [{ ...input, ask }],
    `${supplyKey(input)}:${request}`,
  );
}

async function prepareGoalSupply({
  goalId,
  background,
  workflowRunId,
}: {
  goalId: string;
  background: boolean;
  workflowRunId: string;
}) {
  try {
    let supply = await listMockPrepWritesStep(goalId);
    const later = background && !supply.learnerWaiting;

    if (supply.allowStimulusSets) {
      const sets = await pickMockSetTargetsStep({
        goalId,
        quickFormat: supply.quickFormat,
        writes: supply.writes,
      });

      const stored = await Promise.all(
        sets.map((target) =>
          prepareItemSet({ goalId, target, wait: later ? "later" : "learner", workflowRunId }),
        ),
      );

      if (stored.some(Boolean)) {
        supply = await listMockPrepWritesStep(goalId);
      }
    }

    await writeMockQuestions({ ...supply, goalId, later, workflowRunId });

    if (supply.recordings) {
      await prepareMockRecordings({ goalId, later, recordings: supply.recordings, workflowRunId });
    }
  } finally {
    await checkMockSupplyStep(goalId);
  }
}

async function mockSupplyWorkflow(input: SupplyRequest & { ask?: SupplyAsk }) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();

  if (!(await waitForRunToken(supplyKey(input)))) {
    throw new Error("The previous mock supply run is still writing.");
  }

  const goals = input.ask ? [input.goalId] : await listExamSupplyGoalsStep(input);

  for (const goalId of goals) {
    // oxlint-disable-next-line no-await-in-loop -- Recount after each goal so peers draw on the questions just written.
    await prepareGoalSupply({
      background: input.later || goalId !== input.goalId,
      goalId,
      workflowRunId,
    });
  }

  if (input.ask) {
    await endFollowUpStep(input.ask);
  }
}
