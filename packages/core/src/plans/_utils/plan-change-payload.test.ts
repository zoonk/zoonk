import { describe, expect, it } from "vitest";
import { planChangeInputSchema } from "../plan-contract";
import { parsePlanChangePayload, toPlanChangePayload } from "./plan-change-payload";

function acceptsPartName(name: string): boolean {
  return planChangeInputSchema.safeParse({
    operations: [
      {
        areas: ["Natural sciences"],
        kind: "focusAreas",
        parts: [{ area: "Natural sciences", name, skillIds: ["skill-1"] }],
      },
    ],
    timeZone: "America/Sao_Paulo",
  }).success;
}

describe(parsePlanChangePayload, () => {
  it("saves and reads a focus change whose joined part name runs long", () => {
    const operation = {
      areas: ["Natural sciences"],
      kind: "focusAreas" as const,
      parts: [
        {
          area: "Natural sciences",
          name: "Cell biology, molecular genetics, heredity and biotechnology. ".repeat(6).trim(),
          skillIds: ["skill-1"],
        },
      ],
    };

    const saved = toPlanChangePayload({ operations: [operation], source: "tutor" });

    expect(parsePlanChangePayload(saved).operations).toStrictEqual([operation]);
  });

  it("caps a part's name only in what a client sends", () => {
    expect(acceptsPartName("x".repeat(80))).toBe(true);
    expect(acceptsPartName("x".repeat(81))).toBe(false);
  });

  it("reads a falling-behind change saved with the time and date a search found, keeping its facts", () => {
    const saved = {
      behind: {
        canFocus: true,
        coveredAfter: 0.8,
        coveredBefore: 0.9,
        currentMinutes: 25,
        dailyMinutes: 45,
        fittingDate: "2026-12-01",
        fullDepth: true,
        maximumShare: null,
        measure: "goal",
      },
      days: 3,
      source: "system",
    };

    expect(parsePlanChangePayload(saved).behind).toStrictEqual({
      canFocus: true,
      coveredAfter: 0.8,
      coveredBefore: 0.9,
      currentMinutes: 25,
      measure: "goal",
    });
  });
});
