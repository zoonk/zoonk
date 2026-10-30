import { type PlayableLibraryStep } from "@zoonk/core/lesson-player/playable-lesson";
import { getScreenPicture } from "@zoonk/core/lesson-player/picture-policy";
import { getBaseMapView } from "@zoonk/player/base-map-view";

function mapFields(step: PlayableLibraryStep) {
  if (step.kind === "activity" && step.content.template === "mapExplorer") {
    return step.content.fields;
  }

  if (step.kind === "explanation" && step.content.explore?.template === "mapExplorer") {
    return step.content.explore.fields;
  }

  return null;
}

async function withBaseMap(step: PlayableLibraryStep) {
  if (step.kind !== "activity" && step.kind !== "explanation") {
    return step;
  }

  const fields = mapFields(step);
  return { ...step, baseMap: fields ? await getBaseMapView(fields) : null };
}

/**
 * Apps read from each step what the web player works out from core's rules and its own map
 * drawings, so they keep no copy of either.
 */
export async function toAppSteps(steps: readonly PlayableLibraryStep[]) {
  return Promise.all(
    steps.map(async (step) => {
      const withMap = await withBaseMap(step);

      return "content" in withMap ? { ...withMap, picture: getScreenPicture(withMap) } : withMap;
    }),
  );
}
