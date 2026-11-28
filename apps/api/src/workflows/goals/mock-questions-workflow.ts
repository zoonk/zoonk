import { type MockQuestionWrites } from "@zoonk/core/exams/mocks/prep";
import { safeAsync } from "@zoonk/utils/error";
import { getWorkflowMetadata } from "workflow";
import { startOnce, waitForRunToken } from "../_shared/run-token";
import { endFollowUpStep } from "../follow-ups/steps/follow-up-steps";
import { writeMockWritingPrompts } from "../sessions/writing-prompt-workflow";
import { openMockPaperProgress } from "./mock-paper-progress";
import { prepareMockRecordings, writeMockQuestions } from "./mock-question-writes";
import { pickMockSetTargetsStep, prepareItemSet } from "./steps/item-set-step";
import {
  checkMockSupplyStep,
  listExamSupplyGoalsStep,
  listMockPrepWritesStep,
  reportMockSupplyFailureStep,
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
  const sets = await pickMockSetTargetsStep({
    goalId,
    quickFormat: supply.quickFormat,
    writes: supply.writes,
  });

  const stored = await Promise.allSettled(
    sets.map((target) =>
      prepareItemSet({ goalId, target, wait: supply.later ? "later" : "learner", workflowRunId }),
    ),
  );

  await Promise.all(
    stored.flatMap((result) =>
      result.status === "rejected"
        ? [reportMockSupplyFailureStep({ error: result.reason, workflowRunId })]
        : [],
    ),
  );

  return stored.some((result) => result.status === "fulfilled" && result.value);
}

type PaperProgress = Awaited<ReturnType<typeof openMockPaperProgress>>;
type SupplyPlan = { goalId: string; priority?: string };

async function preparePaperSets({
  progress,
  supply,
  goalId,
  workflowRunId,
}: {
  progress: PaperProgress;
  supply: MockQuestionWrites;
  goalId: string;
  workflowRunId: string;
}) {
  if (!supply.allowStimulusSets) {
    return false;
  }

  try {
    return await progress.step("writeMockTexts", () =>
      prepareSets({ goalId, supply, workflowRunId }),
    );
  } catch (error) {
    await reportMockSupplyFailureStep({ error, workflowRunId });
    return false;
  }
}

async function writePaperQuestions({
  goalId,
  progress,
  supply,
  workflowRunId,
}: {
  goalId: string;
  progress: PaperProgress;
  supply: MockQuestionWrites;
  workflowRunId: string;
}) {
  const [questions] = await progress.step("writeMockQuestions", () =>
    Promise.all([
      writeMockQuestions({ ...supply, goalId, workflowRunId }),
      writeMockWritingPrompts(supply.writing),
    ]),
  );

  const { recordings } = supply;

  if (recordings) {
    await progress.step("recordMockListening", () =>
      prepareMockRecordings({ goalId, later: supply.later, recordings, workflowRunId }),
    );
  }

  return questions;
}

function countQuestions({ writes }: MockQuestionWrites) {
  return writes.reduce((sum, write) => sum + write.questionsPerSkill * write.skillIds.length, 0);
}

async function writePaper({
  input,
  progress,
  supply,
  workflowRunId,
}: {
  input: SupplyPlan;
  progress: PaperProgress;
  supply: MockQuestionWrites;
  workflowRunId: string;
}) {
  const questions = await safeAsync(() =>
    writePaperQuestions({ goalId: input.goalId, progress, supply, workflowRunId }),
  );

  if (questions.error) {
    await reportMockSupplyFailureStep({ error: questions.error, workflowRunId });
  }

  const { data, error } = await safeAsync(() =>
    listMockPrepWritesStep({ ...input, only: supply.key }),
  );

  if (error) {
    await reportMockSupplyFailureStep({ error, workflowRunId });
  }

  const [left] = data?.papers ?? [];
  const asked = countQuestions(supply);

  // Writing that doesn't shorten a paper would be paid for again on every later pass. A paper a
  // learner waits on is written before the scheduled papers the planner reserves first, which can
  // take what was just written for it, so only papers written ahead are measured this way.
  if (
    supply.later &&
    questions.data?.written &&
    left &&
    asked > 0 &&
    countQuestions(left) >= asked
  ) {
    await reportMockSupplyFailureStep({
      error: new Error(`Mock paper ${supply.key} is as short after its questions were written`),
      workflowRunId,
    });
  }

  await progress.end(data?.papers.length === 0 ? "written" : "short");
}

function reservedPapers(papers: MockQuestionWrites[]) {
  return papers.filter(({ alternative }) => !alternative);
}

async function prepareAlternative({
  input,
  key,
  open,
  workflowRunId,
}: {
  input: SupplyPlan;
  key: string;
  open: (paper: string) => Promise<PaperProgress>;
  workflowRunId: string;
}) {
  const next = { ...input, only: key };
  const { papers: short } = await listMockPrepWritesStep(next);
  const [supply] = short;

  if (!supply) {
    return;
  }

  const progress = await open(key);

  const addedSets = await preparePaperSets({
    goalId: input.goalId,
    progress,
    supply,
    workflowRunId,
  });

  const recounted = addedSets ? await listMockPrepWritesStep(next) : { papers: short };
  const [remaining] = recounted.papers;

  if (remaining) {
    await writePaper({ input, progress, supply: remaining, workflowRunId });
  } else {
    await progress.end("written");
  }
}

async function preparePapers({
  input,
  workflowRunId,
}: {
  input: SupplyPlan;
  workflowRunId: string;
}) {
  const { goalId, priority } = input;
  const progressByPaper = new Map<string, PaperProgress>();

  async function open(paper: string) {
    const progress = progressByPaper.get(paper) ?? (await openMockPaperProgress({ goalId, paper }));
    progressByPaper.set(paper, progress);
    return progress;
  }

  try {
    const waited = priority ? await open(priority) : null;
    const planned = await listMockPrepWritesStep(input);
    const first = reservedPapers(planned.papers);

    if (!first.some(({ key }) => key === priority)) {
      await waited?.end("written");
    }

    const sets = await Promise.all(
      first.map(async (supply) =>
        preparePaperSets({ goalId, progress: await open(supply.key), supply, workflowRunId }),
      ),
    );

    const { papers } = sets.some(Boolean) ? await listMockPrepWritesStep(input) : planned;

    const reserved = reservedPapers(papers).toSorted((a, b) => Number(a.later) - Number(b.later));

    /* oxlint-disable no-await-in-loop -- Each chooser alternative can use the last paper's writes. */
    for (const { key } of first) {
      if (!reserved.some((supply) => supply.key === key)) {
        const progress = await open(key);
        await progress.end("written");
      }
    }

    for (const supply of reserved) {
      await writePaper({ input, progress: await open(supply.key), supply, workflowRunId });
    }

    if (priority) {
      return;
    }

    const current = reserved.length > 0 ? await listMockPrepWritesStep(input) : { papers };

    for (const alternative of current.papers.filter((supply) => supply.alternative)) {
      await prepareAlternative({ input, key: alternative.key, open, workflowRunId });
    }
    /* oxlint-enable no-await-in-loop */
  } finally {
    await Promise.all([...progressByPaper.values()].map((progress) => progress.end("short")));
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
    await preparePapers({ input: { goalId, priority: paper }, workflowRunId });
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
