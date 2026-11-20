import { describe, expect, it } from "vitest";
import { tickLabels } from "./plot-ticks";

const THOUSAND = 1000;

function dollars(value: number, isShort: boolean): string {
  return isShort ? `$${value / THOUSAND}K` : `$${value.toLocaleString("en-US")}`;
}

describe(tickLabels, () => {
  it("leaves a dot at the axis start clear of the longest tick", () => {
    const { room } = tickLabels({ format: dollars, ticks: [0, 5000, 10_000] });
    const dotReach = 6 + 2.5 / 2;
    const clearance = 3;

    expect(room - "$10,000".length * 7).toBeGreaterThanOrEqual(dotReach + clearance);
  });

  it("writes ticks the way the readout beside them does, and makes room for the longest", () => {
    const ticks = [0, 5000, 10_000];
    const { format, room } = tickLabels({ format: dollars, ticks });

    expect(ticks.map((tick) => format(tick))).toStrictEqual(["$0", "$5,000", "$10,000"]);
    expect(room).toBeGreaterThan(44);
  });

  it("shortens every tick together when one is too long for the axis", () => {
    const ticks = [0, 500_000, 1_000_000];
    const { format, room } = tickLabels({ format: dollars, ticks });

    expect(ticks.map((tick) => format(tick))).toStrictEqual(["$0K", "$500K", "$1000K"]);
    expect(room).toBe(44);
  });

  it("keeps the usual room for short ticks", () => {
    const { room } = tickLabels({ format: dollars, ticks: [0, 50, 100] });
    expect(room).toBe(44);
  });
});
