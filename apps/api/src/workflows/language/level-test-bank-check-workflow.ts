import { getWorkflowMetadata } from "workflow";
import {
  type LanguagePair,
  checkLevelTestBankQuestionsStep,
  claimLevelTestBankCheckStep,
  keepCheckedLevelTestQuestionsStep,
} from "./steps/level-test-bank-steps";

export function getLevelTestBankCheckToken({ language, targetLanguage }: LanguagePair): string {
  return `level-test-bank-check:${language}:${targetLanguage}`;
}

/**
 * Checks a bank stored before questions were checked, one level per call, and removes the
 * questions that fail.
 */
export async function levelTestBankCheckWorkflow({
  pair,
}: {
  pair: LanguagePair;
}): Promise<{ removed: number }> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const questions = await claimLevelTestBankCheckStep(pair);

  if (!questions) {
    return { removed: 0 };
  }

  const levels = [...new Set(questions.map((question) => question.level))];

  const kept = await Promise.all(
    levels.map((level) =>
      checkLevelTestBankQuestionsStep({
        pair,
        questions: questions.filter((question) => question.level === level),
        wait: "later",
        workflowRunId,
      }),
    ),
  );

  return keepCheckedLevelTestQuestionsStep({
    keptIds: kept.flat().map((question) => question.id),
    pair,
  });
}
