import { type MockQuestionWrites } from "@zoonk/core/exams/mocks/prep";
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

type SupplyRequest = {
  goalId: string;
  examBlueprintId: string | null;
  later: boolean;
  paper?: string;
};

type SupplyAsk = { id: string; revision: number };

function supplyKey(input: SupplyRequest) {
  return `mock-supply:${input.examBlueprintId ?? input.goalId}`;
}

export function startMockSupply(input: SupplyRequest, ask?: SupplyAsk) {
  const request = ask ? `${ask.id}:${ask.revision}` : "ahead";

  return startOnce(mockSupplyWorkflow, [{ ...input, ask }], `${supplyKey(input)}:${request}`);
}

async function prepareSets({
  goalId,
  workflowRunId,
  supply,
}: {
  goalId: string;
  workflowRunId: string;
  supply: MockQuestionWrites;
}) {
  if (!supply.allowStimulusSets) {
    return false;
  }

  const sets = await pickMockSetTargetsStep({
    goalId,
    quickFormat: supply.quickFormat,
    writes: supply.writes,
  });

  const stored = await Promise.all(
    sets.map((target) =>
      prepareItemSet({ goalId, target, wait: supply.later ? "later" : "learner", workflowRunId }),
    ),
  );

  return stored.some(Boolean);
}

async function writeSupply({
  goalId,
  workflowRunId,
  supply,
}: {
  goalId: string;
  workflowRunId: string;
  supply: MockQuestionWrites;
}) {
  await writeMockQuestions({ ...supply, goalId, workflowRunId });

  if (supply.recordings) {
    await prepareMockRecordings({
      goalId,
      later: supply.later,
      recordings: supply.recordings,
      workflowRunId,
    });
  }
}

async function prepareGoalSupply({
  ask,
  goalId,
  paper,
  workflowRunId,
}: {
  ask?: SupplyAsk;
  goalId: string;
  paper?: string;
  workflowRunId: string;
}) {
  try {
    const input = { goalId, priority: paper };
    const planned = await listMockPrepWritesStep(input);

    const first = planned.papers.filter((supply) => !supply.alternative);

    const stored = await Promise.all(
      first.map((supply) => prepareSets({ goalId, supply, workflowRunId })),
    );

    const { papers } = stored.some(Boolean) ? await listMockPrepWritesStep(input) : planned;

    const reserved = papers
      .filter((entry) => !entry.alternative)
      .toSorted((a, b) => Number(a.later) - Number(b.later));

    /* oxlint-disable no-await-in-loop -- Each chooser alternative can use the last paper's writes. */
    for (const supply of reserved) {
      await writeSupply({ goalId, supply, workflowRunId });
    }

    if (paper) {
      return;
    }

    const current = reserved.length > 0 ? await listMockPrepWritesStep(input) : { papers };

    for (const alternative of current.papers.filter((supply) => supply.alternative)) {
      const next = { ...input, only: alternative.key };
      const { papers: short } = await listMockPrepWritesStep(next);
      const [supply] = short;

      if (supply) {
        const addedSets = await prepareSets({ goalId, supply, workflowRunId });
        const recounted = addedSets ? await listMockPrepWritesStep(next) : { papers: short };
        const [remaining] = recounted.papers;

        if (remaining) {
          await writeSupply({ goalId, supply: remaining, workflowRunId });
        }
      }
    }
    /* oxlint-enable no-await-in-loop */
  } finally {
    await checkMockSupplyStep(goalId, { priority: paper });

    // A writer that can't fill the shortage would spend again on every later pass, so a run that
    // reached its recount answers the ask; the recount's alert and the daily supply take it from here.
    if (ask) {
      await endFollowUpStep(ask);
    }
  }
}

/** Started through `startMockSupply`; tests run it directly. @internal */
export async function mockSupplyWorkflow(input: SupplyRequest & { ask?: SupplyAsk }) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();

  if (!(await waitForRunToken(supplyKey(input)))) {
    throw new Error("The previous mock supply run is still writing.");
  }

  const goals = input.ask ? [input.goalId] : await listExamSupplyGoalsStep(input);

  for (const goalId of goals) {
    // oxlint-disable-next-line no-await-in-loop -- Recount after each goal so peers draw on the questions just written.
    await prepareGoalSupply({
      ask: input.ask,
      goalId,
      paper: !input.later && goalId === input.goalId ? input.paper : undefined,
      workflowRunId,
    });
  }
}
