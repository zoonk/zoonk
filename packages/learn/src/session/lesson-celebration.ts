import { type LibraryLessonCompletion } from "@zoonk/core/lesson-player/contract";
import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { type ProgressCelebration } from "@zoonk/core/sessions/progress-celebration";
import { getOwnBrainPower } from "./block-brain-power";

/** What a finished lesson's own screen shows it earned and reached. */
export type LessonCelebration = ProgressCelebration & {
  /** Its Brain Power, without the day's bonus its missions show. */
  brainPower: number;
  missionMoment: MissionMomentView | null;
};

/**
 * What a finished lesson celebrates where the lesson player ends it: the block's moment when the
 * lesson was one of a day's blocks (a quick explanation's is its own goal's day), with the missions
 * it completed and what it reached, the day's bonus included; otherwise the lesson's own.
 */
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
