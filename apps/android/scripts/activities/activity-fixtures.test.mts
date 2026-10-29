import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACTIVITY_FIXTURES_FILE, activityFixtures } from "./activity-fixtures.mts";

describe(activityFixtures, () => {
  it("matches the committed fixtures; run `pnpm --filter android fixtures:activities` after main's fixtures change", () => {
    expect(JSON.parse(readFileSync(ACTIVITY_FIXTURES_FILE, "utf8"))).toStrictEqual(
      JSON.parse(JSON.stringify(activityFixtures())),
    );
  });
});
