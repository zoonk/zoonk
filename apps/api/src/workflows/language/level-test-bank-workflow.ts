import { LEVEL_TEST_LEVELS, type TestLevel } from "@zoonk/ai/tasks/language/level-test-levels";
import { type LevelTestBankLevel } from "@zoonk/core/language/level-test/write-bank";
import { LEVEL_TEST_BANK_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { getWorkflowMetadata, sleep } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { repeatUntil } from "../_shared/repeat-until";
import {
  type LanguagePair,
  checkLevelTestBankQuestionsStep,
  claimLevelTestBankStep,
  levelTestBankProgressStep,
  listLevelTestPassagesStep,
  releaseLevelTestBankClaimStep,
  storeLevelTestBankStep,
  voiceLevelTestPassageStep,
  writeLevelTestBankLevelStep,
} from "./steps/level-test-bank-steps";

export type LevelTestBankInput = { analytics?: ContentAnalytics; pair: LanguagePair };

export type LevelTestBankResult = { status: "ready" | "unfinished" | "written" };

type WriteRun = LevelTestBankInput & { workflowRunId: string };

type WriteStatus = "lost" | "ready" | "running" | "written";

const CLAIM_POLL = "10s";
const MAX_CLAIM_POLLS = 72;

const DONE = new Set<WriteStatus>(["ready", "written"]);

export function getLevelTestBankToken({ language, targetLanguage }: LanguagePair): string {
  return `level-test-bank:${language}:${targetLanguage}`;
}

export async function levelTestBankWorkflow(
  input: LevelTestBankInput,
): Promise<LevelTestBankResult> {
  "use workflow";

  const { pair } = input;
  const { workflowRunId } = getWorkflowMetadata();

  await levelTestBankProgressStep({ status: "started", step: "writeLevelTestBank" });

  const status = await writeQuestionBank({ ...input, workflowRunId });

  if (status.status === "unfinished") {
    return status;
  }

  const passages = await listLevelTestPassagesStep(pair);

  await Promise.allSettled(
    passages.map((text) =>
      voiceLevelTestPassageStep({
        analytics: input.analytics,
        language: pair.targetLanguage,
        text,
        workflowRunId,
      }),
    ),
  );

  return status;
}

/** The learner may be waiting on the bank, so its check runs as soon as its level is written. */
async function writeLevel(run: WriteRun & { level: TestLevel }): Promise<LevelTestBankLevel> {
  const written = await writeLevelTestBankLevelStep(run);

  const questions = await checkLevelTestBankQuestionsStep({
    ...run,
    questions: written.questions,
    wait: "soon",
  });

  return { ...written, questions };
}

async function claimAndWrite(run: WriteRun): Promise<WriteStatus> {
  const claim = await claimLevelTestBankStep(run.pair);

  if (claim.status !== "claimed") {
    return claim.status;
  }

  const { claimId } = claim;

  try {
    const levels = await Promise.all(
      LEVEL_TEST_LEVELS.map((level) => writeLevel({ ...run, level })),
    );

    return await storeLevelTestBankStep({ claimId, levels, pair: run.pair });
  } catch (error) {
    await releaseLevelTestBankClaimStep({ claimId, pair: run.pair });
    throw error;
  }
}

async function writeQuestionBank(run: WriteRun): Promise<LevelTestBankResult> {
  try {
    const status = await repeatUntil({
      done: (current) => DONE.has(current),
      run: () => claimAndWrite(run),
      times: MAX_CLAIM_POLLS,
      wait: () => sleep(CLAIM_POLL),
    });

    if (!DONE.has(status)) {
      await levelTestBankProgressStep(
        { reason: "aiGenerationFailed", status: "error", step: WORKFLOW_ERROR_STEP },
        { last: true },
      );

      return { status: "unfinished" };
    }

    await levelTestBankProgressStep(
      { status: "completed", step: LEVEL_TEST_BANK_READY_STEP },
      { last: true },
    );

    return { status: status === "written" ? "written" : "ready" };
  } catch (error) {
    await levelTestBankProgressStep(
      { reason: "aiGenerationFailed", status: "error", step: WORKFLOW_ERROR_STEP },
      { last: true },
    );

    throw error;
  }
}
