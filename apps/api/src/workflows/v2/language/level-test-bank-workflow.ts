import { LEVEL_TEST_BANK_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { createHook, getWorkflowMetadata, sleep } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { repeatUntil } from "../_shared/repeat-until";
import {
  type LanguagePair,
  levelTestBankProgressStep,
  writeLevelTestBankStep,
} from "./steps/level-test-bank-steps";

export type LevelTestBankInput = {
  /** The learner whose goal or request started it, for analytics; the bank is shared. */
  analytics?: ContentAnalytics;
  pair: LanguagePair;
};

export type LevelTestBankResult = { status: "joined" | "ready" | "unfinished" | "written" };

/**
 * Another run holds the pair's claim (a run of this workflow that started before this one's hook,
 * or one that went quiet): asking again every few seconds sees the bank land, or takes the claim
 * over once it's stale (eleven minutes, `STALE_CLAIM_MS` in core), so this wait outlasts it.
 */
const CLAIM_POLL = "10s";
const MAX_CLAIM_POLLS = 72;

const DONE = new Set(["ready", "written"]);

/**
 * Writes a language pair's three-minute level test ahead, so its learners find the questions
 * ready: started as soon as a language goal's pair is known (when onboarding understands the
 * goal, when the goal's curriculum starts, or when the level test asks for it because nothing is
 * writing it). One run per pair: a second start joins it. The bank is shared by the pair's
 * learners and written once, so a run that finds it written ends at once.
 */
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
