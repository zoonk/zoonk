import { describe, expect, it } from "vitest";
import { linkSavedProduct, toGoalProductLink } from "./goal-release";

const NOW = new Date("2026-11-06T00:00:00Z");
const OLD = { id: "old", releasedAt: new Date("2024-03-01T00:00:00Z") };
const CURRENT = { id: "current", releasedAt: new Date("2026-10-01T00:00:00Z") };
const ANNOUNCED = { id: "announced", releasedAt: new Date("2027-01-01T00:00:00Z") };

describe(toGoalProductLink, () => {
  it("keeps a named release older than the current one", () => {
    expect(toGoalProductLink({ current: CURRENT, named: OLD, productId: "p" })).toStrictEqual({
      productId: "p",
      productReleaseId: "old",
    });
  });

  it("follows the main course for the current, an announced or an undated release", () => {
    const named = [CURRENT, ANNOUNCED, { id: "undated", releasedAt: null }, null];

    expect(
      named.map(
        (release) =>
          toGoalProductLink({ current: CURRENT, named: release, productId: "p" }).productReleaseId,
      ),
    ).toStrictEqual([null, null, null, null]);
  });

  it("follows the main course when no release is current", () => {
    expect(
      toGoalProductLink({ current: null, named: OLD, productId: "p" }).productReleaseId,
    ).toBeNull();
  });
});

describe(linkSavedProduct, () => {
  const releases = [
    { ...OLD, normalizedName: "orbit4" },
    { ...CURRENT, normalizedName: "orbit5" },
    { ...ANNOUNCED, normalizedName: "orbit6" },
  ];

  it("finds the learner's release by its name key and picks the current one by date", () => {
    expect(
      linkSavedProduct({ learnerRelease: "Orbit 4", now: NOW, productId: "p", releases }),
    ).toStrictEqual({ productId: "p", productReleaseId: "old" });

    expect(
      linkSavedProduct({ learnerRelease: null, now: NOW, productId: "p", releases }),
    ).toStrictEqual({ productId: "p", productReleaseId: null });
  });
});
