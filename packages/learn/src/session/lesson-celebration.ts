import { type LibraryLessonCompletion } from "@zoonk/core/lesson-player/contract";
import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { type ProgressCelebration } from "@zoonk/core/sessions/progress-celebration";
import { getOwnBrainPower } from "./block-brain-power";
import { pickDayMoment } from "./pick-day-moment";

export type LessonCelebration = ProgressCelebration & {
  /** Without the day's bonus when its missions' moment shows it. */
  brainPower: number;
  missionMoment: MissionMomentView | null;
};

export function getLessonCelebration(result: LibraryLessonCompletion): LessonCelebration {
  const block = result.studyBlock;

  if (!block) {
    return {
      brainPower: result.brainPower,
      ceremony: result.ceremony,
      certificates: result.certificates,
      missionMoment: null,
      reached: result.reached,
    };
  }

  const missionMoment = {
    completed: block.completedMissions,
    fullMeal: block.fullMeal,
    missions: block.missions,
  };

  const shown = pickDayMoment({
    ceremony: block.ceremony,
    finishedChapter: result.finishedChapter,
    missionMoment,
    reached: block.reached,
  });

  return {
    brainPower: shown === "missions" ? getOwnBrainPower(block) : block.brainPower,
    ceremony: block.ceremony,
    certificates: block.certificates,
    missionMoment,
    reached: block.reached,
  };
}
