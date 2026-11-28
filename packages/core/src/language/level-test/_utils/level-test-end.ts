import { LANGUAGE_LEVEL_TEST_OFFER, type LevelTestResult } from "../level-test-contract";
import {
  getLevelTestAssessment,
  getLevelTestConfirmation,
  getNextLevelTestStep,
} from "../level-test-rules";

export function getLevelTestEnd(
  input: Parameters<typeof getNextLevelTestStep>[0],
): NonNullable<LevelTestResult["end"]> {
  if (input.progress.answers.some((answer) => answer.audioDeferred)) {
    return "audio_deferred";
  }

  const { through } = getLevelTestConfirmation(input);

  if (through) {
    return "check_passed";
  }

  const checks = new Set(input.bank.confirmations?.map(({ id }) => id));

  if (input.progress.answers.some((answer) => checks.has(answer.id) && answer.correct !== true)) {
    return "check_missed";
  }

  if (getNextLevelTestStep(input).kind !== "done") {
    return "stopped";
  }

  if (input.progress.answers.length >= LANGUAGE_LEVEL_TEST_OFFER.total) {
    return "question_cap";
  }

  return getLevelTestAssessment(input).some((skill) => skill.unknownStreak)
    ? "unknown_streak"
    : "nothing_to_check";
}
