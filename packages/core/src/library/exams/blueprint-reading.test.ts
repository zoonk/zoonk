import { describe, expect, it } from "vitest";
import { isCurrentEdition } from "./blueprint-reading";

const NOW = new Date("2026-10-06T12:00:00.000Z");

describe(isCurrentEdition, () => {
  it("keeps an edition current through its exam day, and leaves a passed one to the search for the next notice", () => {
    const ahead = new Date("2027-01-17T00:00:00.000Z");
    const today = new Date("2026-10-06T00:00:00.000Z");
    const yesterday = new Date("2026-10-05T00:00:00.000Z");

    expect(isCurrentEdition({ blueprint: { examDate: ahead }, now: NOW })).toBe(true);
    expect(isCurrentEdition({ blueprint: { examDate: today }, now: NOW })).toBe(true);
    expect(isCurrentEdition({ blueprint: { examDate: yesterday }, now: NOW })).toBe(false);
  });

  it("keeps an edition without an exam date current", () => {
    expect(isCurrentEdition({ blueprint: { examDate: null }, now: NOW })).toBe(true);
  });
});
