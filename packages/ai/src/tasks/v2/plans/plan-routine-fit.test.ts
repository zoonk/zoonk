import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { fitPlanToRoutineFacts } from "./plan-routine-fit";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./plan-routine-fit.prompt.md", () => ({ default: "Fit the week to the routine." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const input = {
  dailyMinutes: 20,
  language: "en",
  memory: ["Never studies on Sundays: it's family day"],
  today: "2026-09-28",
  weekdayMinutes: [20, 20, 20, 20, 20, 20, 20],
};

describe(fitPlanToRoutineFacts, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads only the week and the routine, with the routine prompt alone", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        changes: [{ date: null, kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] }],
        reason: "Sundays are off, since that's family day.",
      }),
    );

    const { data, systemPrompt, userPrompt } = await fitPlanToRoutineFacts(input);

    expect(data).toStrictEqual({
      operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] }],
      reason: "Sundays are off, since that's family day.",
    });

    expect(systemPrompt).toBe("Fit the week to the routine.");
    expect(userPrompt).toContain("WEEK: Sunday: 20, Monday: 20");
    expect(userPrompt).toContain("- Never studies on Sundays: it's family day");
    expect(userPrompt).not.toMatch(/AREAS|REQUEST|PURPOSE|GOAL_KIND/u);
  });

  it("keeps real weekdays, minutes in range and light weeks from today", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        changes: [
          { date: null, kind: "setWeekdayMinutes", minutes: 0, weekdays: [0, 0, 9] },
          { date: null, kind: "setWeekdayMinutes", minutes: 999, weekdays: [3] },
          { date: "2026-10-12", kind: "addLightWeek", minutes: null, weekdays: null },
          { date: "2026-09-01", kind: "addLightWeek", minutes: null, weekdays: null },
          { date: null, kind: "setWeekdayMinutes", minutes: 10, weekdays: [] },
        ],
        reason: " Sundays are off, and the week of your trip is lighter. ",
      }),
    );

    const { data } = await fitPlanToRoutineFacts(input);

    expect(data).toStrictEqual({
      operations: [
        { kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] },
        { kind: "setWeekdayMinutes", minutes: 240, weekdays: [3] },
        { kind: "addLightWeek", startDate: "2026-10-12" },
      ],
      reason: "Sundays are off, and the week of your trip is lighter.",
    });
  });

  it("returns nothing to fit when no change is left", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        changes: [{ date: "2026-09-01", kind: "addLightWeek", minutes: null, weekdays: null }],
        reason: "A lighter week for your trip.",
      }),
    );

    const { data } = await fitPlanToRoutineFacts(input);

    expect(data).toStrictEqual({ operations: [], reason: "" });
  });
});
