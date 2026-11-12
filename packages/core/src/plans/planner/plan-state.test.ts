import { logError } from "@zoonk/utils/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePlanPhases, parsePlanSettings } from "./plan-state";

vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn(), logInfo: vi.fn() }));

const FUNDED = {
  contributions: [{ date: "2026-01-10", minutes: 30 }],
  date: "2026-01-11",
  day: 1,
  fullLength: false,
  minutes: 60,
};

const EMPTY_MOCK = { contributions: [], date: "2026-01-18", day: 2, fullLength: false, minutes: 0 };

describe(parsePlanSettings, () => {
  beforeEach(() => vi.mocked(logError).mockClear());

  it("drops only the invalid entries and fields, and reports them", () => {
    const settings = parsePlanSettings({
      focusAreas: ["Math"],
      mockFunding: [FUNDED, EMPTY_MOCK],
      practiceBias: "morePractice",
      weekdayMinutes: [0, 30, 30, 30, 30, 30, -5],
    });

    expect(settings).toMatchObject({
      focusAreas: ["Math"],
      mockFunding: [FUNDED],
      practiceBias: "morePractice",
      weekdayMinutes: null,
    });

    expect(logError).toHaveBeenCalledOnce();
  });

  it("reads a missing plan as the defaults without reporting it", () => {
    expect(parsePlanSettings(null)).toStrictEqual(parsePlanSettings({}));
    expect(logError).not.toHaveBeenCalled();
  });
});

describe(parsePlanPhases, () => {
  it("keeps the valid phases when one is invalid", () => {
    const phases = parsePlanPhases([{ name: "Study" }, { minutes: -1, name: "Broken" }]);

    expect(phases.map((phase) => phase.name)).toStrictEqual(["Study"]);
  });
});
