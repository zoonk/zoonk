import { LEVEL_TEST_BANK_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { createHook, getWorkflowMetadata, sleep } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { repeatUntil } from "../_shared/repeat-until";
import {
  type LanguagePair,
  levelTestBankProgressStep,
  prepareLevelTestBankAudioStep,
  writeLevelTestBankStep,
} from "./steps/level-test-bank-steps";

export type LevelTestBankInput = { analytics?: ContentAnalytics; pair: LanguagePair };

export type LevelTestBankResult = { status: "joined" | "ready" | "unfinished" | "written" };

const CLAIM_POLL = "10s";
const MAX_CLAIM_POLLS = 72;

const DONE = new Set(["ready", "written"]);

export async function levelTestBankWorkflow(
  input: LevelTestBankInput,
): Promise<LevelTestBankResult> {
  "use workflow";

  const { pair } = input;
  const { workflowRunId } = getWorkflowMetadata();
  const hook = createHook({ token: `level-test-bank:${pair.language}:${pair.targetLanguage}` });
  const conflict = await hook.getConflict();

  if (conflict) {
    await levelTestBankProgressStep({
      entityId: conflict.runId,
      status: "started",
      step: "joinLevelTestBank",
    });

    return { status: "joined" };
  }

  await levelTestBankProgressStep({ status: "started", step: "writeLevelTestBank" });

  const write = () => writeLevelTestBankStep({ ...input, workflowRunId });

  const status = await writeQuestionBank(write);

  if (status.status === "unfinished") {
    return status;
  }

  await prepareLevelTestBankAudioStep({ ...input, workflowRunId });
  return status;
}

async function writeQuestionBank(
  write: () => ReturnType<typeof writeLevelTestBankStep>,
): Promise<LevelTestBankResult> {
  try {
    const status = await repeatUntil({
      done: (current) => DONE.has(current),
      run: write,
      times: MAX_CLAIM_POLLS,
      wait: () => sleep(CLAIM_POLL),
    });

    if (!DONE.has(status)) {
      await levelTestBankProgressStep({
        reason: "aiGenerationFailed",
        status: "error",
        step: WORKFLOW_ERROR_STEP,
      });

      return { status: "unfinished" };
    }

    await levelTestBankProgressStep({ status: "completed", step: LEVEL_TEST_BANK_READY_STEP });
    return { status: status === "written" ? "written" : "ready" };
  } catch (error) {
    await levelTestBankProgressStep({
      reason: "aiGenerationFailed",
      status: "error",
      step: WORKFLOW_ERROR_STEP,
    });

    throw error;
  }
}
