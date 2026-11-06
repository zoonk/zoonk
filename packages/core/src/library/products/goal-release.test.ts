import { describe, expect, it } from "vitest";
import { linkSavedProduct, toGoalProductLink } from "./goal-release";

const NOW = new Date("2026-11-06T00:00:00Z");
const OLD = { id: "old", releasedAt: new Date("2024-03-01T00:00:00Z") };
const CURRENT = { id: "current", releasedAt: new Date("2026-10-01T00:00:00Z") };
const ANNOUNCED = { id: "announced", releasedAt: new Date("2027-01-01T00:00:00Z") };

describe(toGoalProductLink, () => {
  function pinned(named: { id: string; releasedAt: Date | null } | null, current = CURRENT) {
    return toGoalProductLink({ current, named, now: NOW, productId: "p" }).productReleaseId;
  }

  it("pins a named release older than the current one", () => {
    expect(pinned(OLD)).toBe("old");
  });

  it("pins a named release with no stated date, as a model page giving only years", () => {
    expect(pinned({ id: "undated", releasedAt: null })).toBe("undated");
    expect(pinned({ id: "undated", releasedAt: null }, null)).toBe("undated");
  });

  it("follows the main course for the current release, an announced one or none named", () => {
    expect([pinned(CURRENT), pinned(ANNOUNCED), pinned(null)]).toStrictEqual([null, null, null]);
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
