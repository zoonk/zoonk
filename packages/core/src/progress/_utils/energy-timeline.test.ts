import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it } from "vitest";
import { projectEnergyTimeline } from "./energy-timeline";

/** Creates a UTC-midnight date label that matches DailyProgress storage. */
const date = (value: string) => new Date(`${value}T00:00:00Z`);

describe(projectEnergyTimeline, () => {
  it("projects inactive days while keeping later completion rows authoritative", () => {
    const result = projectEnergyTimeline({
      cursors: [
        { date: date("2026-01-01"), energyAtEnd: 50 },
        { date: date("2026-01-04"), energyAtEnd: 80 },
      ],
      targetDate: date("2026-01-07"),
      visibleStartDate: date("2026-01-01"),
    });

    expect(result).toStrictEqual({
      averageEnergy: 64,
      visibleDays: [
        { date: date("2026-01-01"), energyAtEnd: 50 },
        { date: date("2026-01-02"), energyAtEnd: 49 },
        { date: date("2026-01-03"), energyAtEnd: 48 },
        { date: date("2026-01-04"), energyAtEnd: 80 },
        { date: date("2026-01-05"), energyAtEnd: 79 },
        { date: date("2026-01-06"), energyAtEnd: 78 },
      ],
    });
  });

  it("limits expanded days to the visible range without changing the lifetime average", () => {
    const result = projectEnergyTimeline({
      cursors: [
        { date: date("2026-01-01"), energyAtEnd: 50 },
        { date: date("2026-01-04"), energyAtEnd: 80 },
      ],
      targetDate: date("2026-01-07"),
      visibleStartDate: date("2026-01-03"),
    });

    expect(result).toStrictEqual({
      averageEnergy: 64,
      visibleDays: [
        { date: date("2026-01-03"), energyAtEnd: 48 },
        { date: date("2026-01-04"), energyAtEnd: 80 },
        { date: date("2026-01-05"), energyAtEnd: 79 },
        { date: date("2026-01-06"), energyAtEnd: 78 },
      ],
    });
  });

  it("does not render future or synthetic current days", () => {
    const result = projectEnergyTimeline({
      cursors: [
        { date: date("2026-01-10"), energyAtEnd: 50 },
        { date: date("2026-01-12"), energyAtEnd: 70 },
      ],
      targetDate: date("2026-01-11"),
      visibleStartDate: date("2026-01-10"),
    });

    expect(result.visibleDays).toStrictEqual([{ date: date("2026-01-10"), energyAtEnd: 50 }]);
  });

  it("clamps long inactive periods at zero without expanding the lifetime into days", () => {
    const firstDate = date("2020-01-01");
    const targetDate = date("2030-01-01");
    const lifetimeDayCount = (targetDate.getTime() - firstDate.getTime()) / MS_PER_DAY;

    const result = projectEnergyTimeline({
      cursors: [{ date: firstDate, energyAtEnd: 1 }],
      targetDate,
    });

    expect(result).toStrictEqual({ averageEnergy: 1 / lifetimeDayCount, visibleDays: [] });
  });

  it("returns an empty projection when no Energy cursor exists", () => {
    expect(
      projectEnergyTimeline({
        cursors: [],
        targetDate: date("2026-01-07"),
        visibleStartDate: date("2026-01-01"),
      }),
    ).toStrictEqual({ averageEnergy: null, visibleDays: [] });
  });
});
