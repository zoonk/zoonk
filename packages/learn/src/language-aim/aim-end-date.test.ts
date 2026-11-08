import { describe, expect, it } from "vitest";
import { getAimEndDate } from "./aim-end-date";

describe(getAimEndDate, () => {
  const plan = { current: 360, endDate: "2033-09-20", today: "2026-11-08" };

  it("moves the plan's finish by another aim's share of the hours", () => {
    expect(getAimEndDate({ ...plan, hours: 180 })).toBe("2030-04-15");
  });

  it("gives no date a plan couldn't lay out, ten years at most", () => {
    expect(getAimEndDate({ ...plan, hours: 560 })).toBeNull();
  });

  it("gives no date while the plan's own finish isn't known", () => {
    expect(getAimEndDate({ ...plan, endDate: null, hours: 180 })).toBeNull();
  });
});
