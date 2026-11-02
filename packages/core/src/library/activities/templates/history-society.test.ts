import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { validateActivity } from "../validate-activity";

function issues(content: unknown) {
  const result = validateActivity(content);
  return result.ok ? [] : result.issues;
}

describe("map explorer rules", () => {
  it("rejects a base map the player can't draw", () => {
    const content = structuredClone(activityContentFixtures.mapExplorer);
    content.fields.baseMapId = "paris-1789";

    expect(issues(content)).toStrictEqual([
      expect.objectContaining({ code: "unknownAsset", path: "fields.baseMapId" }),
    ]);
  });

  it("rejects a place outside its base map", () => {
    const content = structuredClone(activityContentFixtures.mapExplorer);

    content.fields.places = content.fields.places.map((place, index) =>
      index === 1 ? { ...place, latitude: 48.86, longitude: 2.35 } : place,
    );

    expect(issues(content)).toStrictEqual([
      expect.objectContaining({ code: "inconsistentFields", path: "fields.places.1" }),
    ]);
  });
});

describe("source comparison rules", () => {
  it("rejects passages that share words", () => {
    const content = structuredClone(activityContentFixtures.sourceComparison);
    const [first, second] = content.fields.sources;

    if (!first || !second) {
      throw new Error("The fixture has two sources");
    }

    content.fields.sources = [
      {
        ...first,
        passages: [
          { id: "p1", isTarget: true, text: "The regulars fired on us" },
          { id: "p3", isTarget: false, text: "fired on us without" },
        ],
      },
      second,
    ];

    expect(issues(content)).toStrictEqual([
      expect.objectContaining({ code: "inconsistentFields", path: "fields.sources" }),
    ]);
  });
});
