import { describe, expect, it } from "vitest";
import { getRowTimeRoom } from "./row-time-room";

describe(getRowTimeRoom, () => {
  it("fits the list's longest time, so a short time's mark sits where a long one's does", () => {
    expect(getRowTimeRoom(["4 Min.", "2 Std. 45 Min.", "12 Min."])).toBe(14);
  });

  it("counts a Japanese or Korean character as two figures", () => {
    expect(getRowTimeRoom(["4分", "12分"])).toBe(4);
    expect(getRowTimeRoom(["2시간 45분"])).toBe(10);
  });

  it("needs no room for a list with no times", () => {
    expect(getRowTimeRoom([])).toBe(0);
  });
});
