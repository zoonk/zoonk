import { EMPTY_OUTCOME, getAnswersEnergyDelta, getOutcomeBonus } from "../sessions/brain-power";
import { type LessonRunTally } from "./lesson-run";

export type LibraryLessonScore = { brainPower: number; energyDelta: number };

export function scoreLibraryLesson({
  answerPoints,
  correctCount,
  incorrectCount,
  isFirstCompletion,
}: Pick<LessonRunTally, "correctCount" | "incorrectCount"> & {
  answerPoints: number;
  isFirstCompletion: boolean;
}): LibraryLessonScore {
  const energyDelta = getAnswersEnergyDelta({ correct: correctCount, incorrect: incorrectCount });
  const bonus = getOutcomeBonus({ ...EMPTY_OUTCOME, firstLessonCompletion: isFirstCompletion });

  return { brainPower: answerPoints + bonus, energyDelta };
}
