import { describe, expect, it } from "vitest";
import { getScreenCharacterTarget } from "./screen-length";

describe(getScreenCharacterTarget, () => {
  it("halves the target for languages whose script counts twice", () => {
    expect(getScreenCharacterTarget("pt")).toBe(250);
    expect(getScreenCharacterTarget("tr")).toBe(250);
    expect(getScreenCharacterTarget("ja")).toBe(125);
    expect(getScreenCharacterTarget("ko")).toBe(125);
  });
});
