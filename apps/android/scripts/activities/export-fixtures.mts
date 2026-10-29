import { writeFile } from "node:fs/promises";
import { getActivityExpected } from "@zoonk/core/library/activities/expected";
import {
  activityContentSchema,
  getActivityTemplate,
} from "@zoonk/core/library/activities/templates";
import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";

const output = new URL("../../app/src/test/resources/activity-fixtures.json", import.meta.url);

const modes = Object.entries(engineModeFixtures).flatMap(([template, byMode]) =>
  Object.entries(byMode).map(([mode, fixture]) => [`${template}.${mode}`, fixture] as const),
);

const fixtures = Object.fromEntries(
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

await writeFile(output, `${JSON.stringify(fixtures, null, 2)}\n`);
