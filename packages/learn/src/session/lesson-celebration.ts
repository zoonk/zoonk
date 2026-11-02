import { type LibraryLessonCompletion } from "@zoonk/core/lesson-player/contract";
import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { type ProgressCelebration } from "@zoonk/core/sessions/progress-celebration";
import { getOwnBrainPower } from "./block-brain-power";

export type LessonCelebration = ProgressCelebration & {
  /** Without the day's bonus, which its missions show. */
  brainPower: number;
  missionMoment: MissionMomentView | null;
};

export function getLessonCelebration(result: LibraryLessonCompletion): LessonCelebration {
  const block = result.studyBlock;

  if (!block) {
    return {
      brainPower: result.brainPower,
      ceremony: result.ceremony,
      missionMoment: null,
      reached: result.reached,
    };
  }

  return {
    brainPower: getOwnBrainPower(block),
    ceremony: block.ceremony,
    missionMoment: {
      completed: block.completedMissions,
      fullMeal: block.fullMeal,
      missions: block.missions,
    },
    reached: block.reached,
  };
}
