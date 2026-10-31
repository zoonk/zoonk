import { describe, expect, it } from "vitest";
import { getMinimumAge, isAdult, isBelowMinimumAge, isValidBirthYear } from "./age";

const NOW = new Date("2026-10-31T12:00:00Z");

describe(getMinimumAge, () => {
  it("is 14 in Italy and Korea and 13 elsewhere", () => {
    expect(getMinimumAge("IT")).toBe(14);
    expect(getMinimumAge("kr")).toBe(14);
    expect(getMinimumAge("BR")).toBe(13);
    expect(getMinimumAge("US")).toBe(13);
  });
});

describe(isBelowMinimumAge, () => {
  it("lets in a learner who is 13 even before this year's birthday", () => {
    expect(isBelowMinimumAge({ birthYear: 2012, country: "BR", now: NOW })).toBe(false);
  });

  it("stops a learner who may still be 12", () => {
    expect(isBelowMinimumAge({ birthYear: 2013, country: "BR", now: NOW })).toBe(true);
  });

  it("asks one more year in Italy and Korea", () => {
    expect(isBelowMinimumAge({ birthYear: 2012, country: "KR", now: NOW })).toBe(true);
    expect(isBelowMinimumAge({ birthYear: 2012, country: "IT", now: NOW })).toBe(true);
    expect(isBelowMinimumAge({ birthYear: 2011, country: "KR", now: NOW })).toBe(false);
  });

  it("counts years in UTC, so New Year's Eve and Day differ by one year", () => {
    const newYearsEve = new Date("2026-12-31T23:59:59Z");
    const newYearsDay = new Date("2027-01-01T00:00:00Z");

    expect(isBelowMinimumAge({ birthYear: 2013, country: "BR", now: newYearsEve })).toBe(true);
    expect(isBelowMinimumAge({ birthYear: 2013, country: "BR", now: newYearsDay })).toBe(false);
  });
});

describe(isAdult, () => {
  it("treats a learner who may still be 17 as a minor", () => {
    expect(isAdult({ birthYear: 2008, country: "BR", now: NOW })).toBe(false);
    expect(isAdult({ birthYear: 2007, country: "BR", now: NOW })).toBe(true);
  });

  it("waits until 19 in Korea", () => {
    expect(isAdult({ birthYear: 2007, country: "KR", now: NOW })).toBe(false);
    expect(isAdult({ birthYear: 2006, country: "KR", now: NOW })).toBe(true);
  });

  it("uses Korea's age when the country is unknown", () => {
    expect(isAdult({ birthYear: 2007, country: null, now: NOW })).toBe(false);
    expect(isAdult({ birthYear: 2006, country: null, now: NOW })).toBe(true);
  });

  it("never treats an unknown age as an adult's", () => {
    expect(isAdult({ birthYear: null, country: "US", now: NOW })).toBe(false);
  });
});

describe(isValidBirthYear, () => {
  it("accepts whole years from 120 years ago to this year", () => {
    expect(isValidBirthYear({ birthYear: 2026, now: NOW })).toBe(true);
    expect(isValidBirthYear({ birthYear: 1906, now: NOW })).toBe(true);
  });

  it("rejects future years, years older than anyone alive, and fractions", () => {
    expect(isValidBirthYear({ birthYear: 2027, now: NOW })).toBe(false);
    expect(isValidBirthYear({ birthYear: 1905, now: NOW })).toBe(false);
    expect(isValidBirthYear({ birthYear: 1990.5, now: NOW })).toBe(false);
  });
});
