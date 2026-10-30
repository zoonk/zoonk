import { getActivityExpected, getExploreExpected } from "@zoonk/core/library/activities/expected";
import {
  activityContentSchema,
  exploreActivitySchema,
  getActivityTemplate,
  isExploreTemplate,
} from "@zoonk/core/library/activities/templates";
import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";

export const ACTIVITY_FIXTURES_FILE = new URL(
  "../../app/src/test/resources/activity-fixtures.json",
  import.meta.url,
);

/** Main's activity fixtures, as the API sends them, with core's expected end state and value, and, for a template an explanation can explore, the end state its explore shows. */
export function activityFixtures() {
  const modes = Object.entries(engineModeFixtures).flatMap(([template, byMode]) =>
    Object.entries(byMode).map(([mode, fixture]) => [`${template}.${mode}`, fixture] as const),
  );

  return Object.fromEntries(
    [...Object.entries(activityContentFixtures), ...modes].map(([name, fixture]) => {
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

      return [
        name,
        {
          content,
          expected: getActivityExpected(content),
          explore: explore && { content: explore, expected: getExploreExpected(explore) },
          value,
        },
      ];
    }),
  );
}
