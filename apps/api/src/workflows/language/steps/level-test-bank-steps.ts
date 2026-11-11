import { progressStep } from "@/workflows/_shared/stream-status";
import { type CallWait } from "@zoonk/ai/provider-options";
import { type TestLevel } from "@zoonk/ai/tasks/language/level-test-levels";
import {
  checkLevelTestBankQuestions,
  claimLevelTestBankCheck,
  keepCheckedLevelTestQuestions,
} from "@zoonk/core/language/level-test/check-bank";
import { type LevelTestQuestion } from "@zoonk/core/language/level-test/contract";
import {
  listLevelTestPassagesToVoice,
  voiceLevelTestPassage,
} from "@zoonk/core/language/level-test/prepare-audio";
import {
  type LevelTestBankClaim,
  type LevelTestBankLevel,
  claimLevelTestBank,
  releaseLevelTestBankClaim,
  storeLevelTestBank,
  writeLevelTestBankLevel,
} from "@zoonk/core/language/level-test/write-bank";
import { type LevelTestBankStepName } from "@zoonk/core/library/generation/steps";
import { type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { type ContentAnalytics } from "../../_shared/content-analytics";

export type LevelTestBankStreamStep = LevelTestBankStepName | typeof WORKFLOW_ERROR_STEP;

export type LanguagePair = { language: string; targetLanguage: string };

type BankAnalytics = { analytics?: ContentAnalytics; workflowRunId: string };

export const levelTestBankProgressStep = progressStep<LevelTestBankStreamStep>;

function toBankAnalytics({ analytics, workflowRunId }: BankAnalytics) {
  return { distinctId: analytics?.distinctId, goalId: analytics?.goalId, traceId: workflowRunId };
}

export async function claimLevelTestBankStep(pair: LanguagePair): Promise<LevelTestBankClaim> {
  "use step";

  return claimLevelTestBank(pair);
}

export async function writeLevelTestBankLevelStep({
  level,
  pair,
  ...analytics
}: BankAnalytics & { level: TestLevel; pair: LanguagePair }): Promise<LevelTestBankLevel> {
  "use step";

  return writeLevelTestBankLevel({ analytics: toBankAnalytics(analytics), level, pair });
}

export async function checkLevelTestBankQuestionsStep<
  Question extends Pick<
    LevelTestQuestion,
    "answerIndex" | "level" | "options" | "passage" | "question"
  >,
>({
  pair,
  questions,
  wait,
  ...analytics
}: BankAnalytics & { pair: LanguagePair; questions: Question[]; wait: CallWait }): Promise<
  Question[]
> {
  "use step";

  return checkLevelTestBankQuestions({
    analytics: toBankAnalytics(analytics),
    pair,
    questions,
    wait,
  });
}

export async function storeLevelTestBankStep(input: {
  claimId: string;
  levels: LevelTestBankLevel[];
  pair: LanguagePair;
}): Promise<"lost" | "written"> {
  "use step";

  return storeLevelTestBank(input);
}

export async function releaseLevelTestBankClaimStep(input: {
  claimId: string;
  pair: LanguagePair;
}): Promise<void> {
  "use step";

  await releaseLevelTestBankClaim(input);
}

export async function claimLevelTestBankCheckStep(
  pair: LanguagePair,
): Promise<LevelTestQuestion[] | null> {
  "use step";

  return claimLevelTestBankCheck(pair);
}

export async function keepCheckedLevelTestQuestionsStep(input: {
  keptIds: string[];
  pair: LanguagePair;
}): Promise<{ removed: number }> {
  "use step";

  return keepCheckedLevelTestQuestions(input);
}

export async function listLevelTestPassagesStep(pair: LanguagePair): Promise<string[]> {
  "use step";

  return listLevelTestPassagesToVoice(pair);
}

/** One clip per step, so a failed clip retries alone and never fails the test. */
export async function voiceLevelTestPassageStep({
  analytics,
  language,
  text,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  language: string;
  text: string;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await voiceLevelTestPassage({
    analytics: toBankAnalytics({ analytics, workflowRunId }),
    language,
    text,
  });
}
