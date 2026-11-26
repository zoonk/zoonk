import { describe, expect, it } from "vitest";
import { SHORTCUTS, SHORTCUT_GROUPS, pickKey } from "./shortcuts";

describe("shortcut groups", () => {
  it("lists every key of the registry once, so the shortcuts panel shows them all", () => {
    const listed = Object.values(SHORTCUT_GROUPS).flat();

    expect(listed.toSorted()).toStrictEqual(Object.keys(SHORTCUTS).toSorted());
  });
});

describe(pickKey, () => {
  it("gives the tenth option 0, the key after 9 on a number row, and the eleventh none", () => {
    expect([0, 8, 9, 10].map((index) => pickKey(index))).toStrictEqual(["1", "9", "0", null]);
  });
});
