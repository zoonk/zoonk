import { describe, expect, it } from "vitest";
import { SHORTCUTS, SHORTCUT_GROUPS } from "./shortcuts";

describe("shortcut groups", () => {
  it("lists every key of the registry once, so the shortcuts panel shows them all", () => {
    const listed = Object.values(SHORTCUT_GROUPS).flat();

    expect(listed.toSorted()).toStrictEqual(Object.keys(SHORTCUTS).toSorted());
  });
});
