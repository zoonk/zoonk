import { getScreenPicture } from "@zoonk/core/lesson-player/picture-policy";
import { getActivityExpected, getExploreExpected } from "@zoonk/core/library/activities/expected";
import {
  activityContentSchema,
  exploreActivitySchema,
  getActivityTemplate,
  isExploreTemplate,
} from "@zoonk/core/library/activities/templates";
import { getBaseMapView } from "@zoonk/player/base-map-view";
import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";

export const ACTIVITY_FIXTURES_FILE = new URL(
  "../../app/src/test/resources/activity-fixtures.json",
  import.meta.url,
);

/** Main's activity fixtures, as the API sends them: with core's expected end state, value and screen picture, a map activity's base map, and, for a template an explanation can explore, its explore's end state and picture. */
export async function activityFixtures() {
  const modes = Object.entries(engineModeFixtures).flatMap(([template, byMode]) =>
    Object.entries(byMode).map(([mode, fixture]) => [`${template}.${mode}`, fixture] as const),
  );

  const entries = await Promise.all(
    [...Object.entries(activityContentFixtures), ...modes].map(async ([name, fixture]) => {
      const content = activityContentSchema.parse(fixture);

      const value =
        getActivityTemplate(content.template)?.computeValue(content.fields, {
          inputs: {},
          output: null,
        }) ?? null;

      const explore = isExploreTemplate(content.template)
        ? exploreActivitySchema.parse({
            data: content.data,
            fields: content.fields,
            template: content.template,
          })
        : null;

      const baseMap =
        content.template === "mapExplorer" ? await getBaseMapView(content.fields) : null;

      return [
        name,
        {
          baseMap,
          content,
          expected: getActivityExpected(content),
          explore: explore && {
            content: explore,
            expected: getExploreExpected(explore),
            picture: getScreenPicture({ content: { explore, text: name }, kind: "explanation" }),
          },
          picture: getScreenPicture({ content, kind: "activity" }),
          value,
        },
      ] as const;
    }),
  );

  return Object.fromEntries(entries);
}
