import { describe, expect, it } from "vitest";
import { linkSavedProduct, toGoalProductLink } from "./goal-release";

const NOW = new Date("2026-11-06T00:00:00Z");

type Release = {
  id: string;
  releasedAt: Date | null;
  releasedMonthOnly: boolean;
  version: string | null;
};

function dated(
  id: string,
  releasedAt: string | null,
  releasedMonthOnly = false,
  version: string | null = null,
): Release {
  return {
    id,
    releasedAt: releasedAt ? new Date(`${releasedAt}T00:00:00Z`) : null,
    releasedMonthOnly,
    version,
  };
}

const OLD = dated("old", "2024-03-01");
const CURRENT = dated("current", "2026-10-01");
const ANNOUNCED = dated("announced", "2027-01-01");

function pinned(named: Release | null, releases: Release[] = [CURRENT]) {
  return toGoalProductLink({ named, now: NOW, productId: "p", releases }).productReleaseId;
}

describe(toGoalProductLink, () => {
  it("pins a named release older than the current one", () => {
    expect(pinned(OLD)).toBe("old");
  });

  it("pins a named release with no stated date, as a model page giving only years", () => {
    expect(pinned(dated("undated", null))).toBe("undated");
  });

  it("with none current, follows the main course for the newest release by version, and pins any other", () => {
    const older = dated("older", null, false, "12.1.2310");
    const newest = dated("newest", null, false, "12.1.2410");
    const unversioned = dated("unversioned", null);

    expect([
      pinned(newest, [older, newest]),
      pinned(older, [older, newest]),
      pinned(older, [older, newest, unversioned]),
      pinned(older, [older, { ...CURRENT, version: "12.1.2510" }]),
    ]).toStrictEqual([null, "older", "older", "older"]);
  });

  it("pins a release dated by its month only once that month has ended", () => {
    expect([
      pinned(dated("november", "2026-11-01", true)),
      pinned(dated("september", "2026-09-01", true)),
    ]).toStrictEqual([null, "september"]);
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
