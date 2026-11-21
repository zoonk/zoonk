import { type MockQuestionWrites } from "@zoonk/core/exams/mocks/prep";
import { getWorkflowMetadata } from "workflow";
import { claimRunToken, startOnce, waitForRunToken } from "../_shared/run-token";
import { endFollowUpStep } from "../follow-ups/steps/follow-up-steps";
import { createMockPaperProgress, getMockPaperToken } from "./mock-paper-progress";
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

type PaperProgress = ReturnType<typeof createMockPaperProgress>;

async function isPaperWritten({ goalId, paper }: { goalId: string; paper: string }) {
  const { papers } = await listMockPrepWritesStep({ goalId, only: paper, priority: paper });
  return papers.length === 0 ? "written" : "short";
}

async function writeSupply({
  goalId,
  progress,
  workflowRunId,
  supply,
}: {
  goalId: string;
  progress: PaperProgress;
  workflowRunId: string;
  supply: MockQuestionWrites;
}) {
  await progress.step(supply.key, "writeMockQuestions", () =>
    writeMockQuestions({ ...supply, goalId, workflowRunId }),
  );

  const { recordings } = supply;

  if (recordings) {
    await progress.step(supply.key, "recordMockListening", () =>
      prepareMockRecordings({ goalId, later: supply.later, recordings, workflowRunId }),
    );
  }

  if (progress.follows(supply.key)) {
    await progress.end(await isPaperWritten({ goalId, paper: supply.key }));
  }
}

/** The texts the papers written first share, planned again when it wrote any. */
async function prepareFirstSets({
  input,
  progress,
  workflowRunId,
}: {
  input: { goalId: string; priority?: string };
  progress: PaperProgress;
  workflowRunId: string;
}) {
  const planned = await listMockPrepWritesStep(input);
  const first = planned.papers.filter((supply) => !supply.alternative);
  const followed = first.find((supply) => progress.follows(supply.key));

  if (!followed) {
    await progress.end("written");
  }

  const writeSets = () =>
    Promise.all(
      first.map((supply) => prepareSets({ goalId: input.goalId, supply, workflowRunId })),
    );

  const stored = followed?.allowStimulusSets
    ? await progress.step(followed.key, "writeMockTexts", writeSets)
    : await writeSets();

  return stored.some(Boolean) ? listMockPrepWritesStep(input) : planned;
}

async function prepareGoalSupply({
  ask,
  goalId,
  paper,
  progress,
  workflowRunId,
}: {
  ask?: SupplyAsk;
  goalId: string;
  paper?: string;
  progress: PaperProgress;
  workflowRunId: string;
}) {
  try {
    const input = { goalId, priority: paper };
    const { papers } = await prepareFirstSets({ input, progress, workflowRunId });

    const reserved = papers
      .filter((entry) => !entry.alternative)
      .toSorted((a, b) => Number(a.later) - Number(b.later));

    if (!reserved.some((supply) => progress.follows(supply.key))) {
      await progress.end("written");
    }

    /* oxlint-disable no-await-in-loop -- Each chooser alternative can use the last paper's writes. */
    for (const supply of reserved) {
      await writeSupply({ goalId, progress, supply, workflowRunId });
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
          await writeSupply({ goalId, progress, supply: remaining, workflowRunId });
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
  const paper = input.ask && !input.later ? input.paper : undefined;

  // Held from before its turn, so the learner waiting for the paper finds this run and follows it.
  using writer = paper
    ? await claimRunToken(getMockPaperToken({ goalId: input.goalId, paper }))
    : null;

  const progress = createMockPaperProgress(writer?.conflict === null ? paper : undefined);

  try {
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
        progress,
        workflowRunId,
      });
    }
  } finally {
    await progress.end("short");
  }
}
