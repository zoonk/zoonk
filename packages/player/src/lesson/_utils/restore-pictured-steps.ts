import { type LessonPicture } from "@zoonk/core/lesson-player/contract";
import { type LessonPlayerState } from "../lesson-player-state";

/**
 * Questions left out while their picture was missing, playable again with it: for a server that
 * still asks for one (its picture came within its wait, but this screen never got it).
 */
export function restorePicturedSteps(
  state: LessonPlayerState,
  pictures: readonly LessonPicture[],
): LessonPlayerState {
  const drawn = new Map(
    pictures
      .filter((picture) => !picture.optionId)
      .map((picture) => [picture.stepId, picture.image]),
  );

  const restored = state.unavailableStepIds.filter((id) => drawn.has(id));

  if (restored.length === 0) {
    return state;
  }

  const steps = Object.fromEntries(
    Object.entries(state.steps).map(([id, step]) => {
      const image = drawn.get(id);
      return [id, image && "image" in step ? { ...step, image, imagePending: false } : step];
    }),
  );

  return {
    ...state,
    steps,
    unavailableStepIds: state.unavailableStepIds.filter((id) => !restored.includes(id)),
  };
}
