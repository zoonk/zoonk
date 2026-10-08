import { describe, expect, it } from "vitest";
import { getAgeGroup, isSameOrYoungerBirth, isValidBirthMonthYear } from "./age";

const now = new Date("2026-09-26T12:00:00Z");

describe(isValidBirthMonthYear, () => {
  it("accepts a past month and the current month", () => {
    expect(isValidBirthMonthYear({ birthMonth: 3, birthYear: 2008, now })).toBe(true);
    expect(isValidBirthMonthYear({ birthMonth: 9, birthYear: 2026, now })).toBe(true);
  });

  it("rejects future months, impossible months and implausible years", () => {
    expect(isValidBirthMonthYear({ birthMonth: 10, birthYear: 2026, now })).toBe(false);
    expect(isValidBirthMonthYear({ birthMonth: 1, birthYear: 2027, now })).toBe(false);
    expect(isValidBirthMonthYear({ birthMonth: 0, birthYear: 2000, now })).toBe(false);
    expect(isValidBirthMonthYear({ birthMonth: 13, birthYear: 2000, now })).toBe(false);
    expect(isValidBirthMonthYear({ birthMonth: 5, birthYear: 1890, now })).toBe(false);
    expect(isValidBirthMonthYear({ birthMonth: 5.5, birthYear: 2000, now })).toBe(false);
  });
});

describe(getAgeGroup, () => {
  it("stays unknown until both month and year are known", () => {
    expect(getAgeGroup({ birthMonth: null, birthYear: 2000, now })).toBe("unknown");
    expect(getAgeGroup({ birthMonth: 4, birthYear: null, now })).toBe("unknown");
  });

  it("treats someone in their 13th birth month as 12, since the birthday may still be ahead", () => {
    expect(getAgeGroup({ birthMonth: 9, birthYear: 2013, now })).toBe("child");
    expect(getAgeGroup({ birthMonth: 8, birthYear: 2013, now })).toBe("teen");
  });

  it("keeps learners under 18 as teens and moves them to adults after their 18th birth month", () => {
    expect(getAgeGroup({ birthMonth: 9, birthYear: 2008, now })).toBe("teen");
    expect(getAgeGroup({ birthMonth: 8, birthYear: 2008, now })).toBe("adult");
    expect(getAgeGroup({ birthMonth: 1, birthYear: 1980, now })).toBe("adult");
  });
});

describe(isSameOrYoungerBirth, () => {
  const saved = { birthMonth: 6, birthYear: 2010 };

  it("accepts the same answer and any later month, which make the learner the same age or younger", () => {
    expect(isSameOrYoungerBirth({ next: saved, saved })).toBe(true);
    expect(isSameOrYoungerBirth({ next: { birthMonth: 7, birthYear: 2010 }, saved })).toBe(true);
    expect(isSameOrYoungerBirth({ next: { birthMonth: 1, birthYear: 2011 }, saved })).toBe(true);
  });

  it("refuses any earlier month, which makes the learner older", () => {
    expect(isSameOrYoungerBirth({ next: { birthMonth: 5, birthYear: 2010 }, saved })).toBe(false);
    expect(isSameOrYoungerBirth({ next: { birthMonth: 12, birthYear: 2009 }, saved })).toBe(false);
    expect(isSameOrYoungerBirth({ next: { birthMonth: 6, birthYear: 1990 }, saved })).toBe(false);
  });
});
