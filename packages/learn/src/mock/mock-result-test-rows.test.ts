import { describe, expect, it } from "vitest";
import { type MockPoints, toTestRows } from "./mock-result-test-rows";

const tally = {
  asked: 100,
  earned: 65,
  max: 100,
  met: null,
  minimum: null,
  projected: null,
  short: null,
} satisfies Partial<MockPoints>;

function pointsWith(general: Partial<MockPoints["parts"][number]>): MockPoints {
  return {
    ...tally,
    parts: [
      { ...tally, asked: 40, earned: 15, max: 40, name: "General", qualifying: false, ...general },
      { ...tally, asked: 60, earned: 50, max: 60, name: "Specific", qualifying: false },
    ],
    unjudged: [],
  };
}

function shown(points: MockPoints) {
  return toTestRows(points).map(({ asked, earned, name }) => ({ asked, earned, name }));
}

describe(toTestRows, () => {
  it("keeps the total when a test's missed minimum takes the headline", () => {
    const points = pointsWith({ met: false, minimum: { unit: "points", value: 20 }, short: 5 });

    expect(shown(points)).toStrictEqual([
      { asked: 40, earned: 15, name: "General" },
      { asked: 60, earned: 50, name: "Specific" },
      { asked: 100, earned: 65, name: null },
    ]);
  });

  it("leaves the total to the headline when every minimum is reached", () => {
    const points = pointsWith({ met: true, minimum: { unit: "points", value: 10 }, short: 0 });

    expect(shown(points).map((row) => row.name)).toStrictEqual(["General", "Specific"]);
  });
});
