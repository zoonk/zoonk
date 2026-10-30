import { type PlayableLibraryStep } from "@zoonk/core/lesson-player/playable-lesson";
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

/**
 * Apps draw a map activity from the base map the API sends with it, already projected, since the
 * drawings and their projections live only in the web player.
 */
export async function withBaseMaps(steps: readonly PlayableLibraryStep[]) {
  return Promise.all(
    steps.map(async (step) => {
      if (step.kind !== "activity" && step.kind !== "explanation") {
        return step;
      }

      const fields = mapFields(step);
      return { ...step, baseMap: fields ? await getBaseMapView(fields) : null };
    }),
  );
}
