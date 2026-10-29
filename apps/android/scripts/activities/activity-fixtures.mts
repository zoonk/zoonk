import { getActivityExpected } from "@zoonk/core/library/activities/expected";
import {
  activityContentSchema,
  getActivityTemplate,
} from "@zoonk/core/library/activities/templates";
import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";

export const ACTIVITY_FIXTURES_FILE = new URL(
  "../../app/src/test/resources/activity-fixtures.json",
  import.meta.url,
);

/** Main's activity fixtures, as the API sends them, with core's expected end state and value. */
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

      return [name, { content, expected: getActivityExpected(content), value }];
    }),
  );
}
