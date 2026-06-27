import { describe, expect, it } from "vitest";
import { getNumberKeyShortcut } from "./player-shortcuts";

describe(getNumberKeyShortcut, () => {
  it("returns single-digit shortcuts for supported option indexes", () => {
    expect(getNumberKeyShortcut(0)).toBe("1");
    expect(getNumberKeyShortcut(8)).toBe("9");
  });

  it("does not create double-digit shortcuts", () => {
    expect(getNumberKeyShortcut(9)).toBeNull();
  });
});
