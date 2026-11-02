import { describe, expect, it } from "vitest";
import { formatClock } from "./clock";

describe(formatClock, () => {
  it("reads like an exam room's clock", () => {
    expect(formatClock(5_076_000)).toBe("1:24:36");
    expect(formatClock(725_000)).toBe("12:05");
    expect(formatClock(72_000)).toBe("1:12");
    expect(formatClock(400)).toBe("0:01");
    expect(formatClock(0)).toBe("0:00");
  });
});
