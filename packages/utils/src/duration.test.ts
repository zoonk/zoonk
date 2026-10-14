import { describe, expect, it } from "vitest";
import { formatDuration } from "./duration";

describe(formatDuration, () => {
  it.each([
    { expected: "0\u00A0min", totalSeconds: 0 },
    { expected: "1\u00A0sec", totalSeconds: 1 },
    { expected: "59\u00A0sec", totalSeconds: 59 },
    { expected: "1\u00A0min", totalSeconds: 59.5 },
    { expected: "1\u00A0min", totalSeconds: 60 },
    { expected: "1\u00A0min", totalSeconds: 89 },
    { expected: "2\u00A0min", totalSeconds: 90 },
    { expected: "1\u00A0hr", totalSeconds: 3570 },
    { expected: "1\u00A0hr", totalSeconds: 3600 },
    { expected: "1\u00A0hr 30\u00A0min", totalSeconds: 5400 },
    { expected: "26\u00A0hr", totalSeconds: 93_600 },
    { expected: "26\u00A0hr 1\u00A0min", totalSeconds: 93_660 },
    { expected: "1000\u00A0hr", totalSeconds: 3_600_000 },
    { expected: "0\u00A0min", totalSeconds: 0.49 },
    { expected: "1\u00A0sec", totalSeconds: 0.5 },
    { expected: "12\u00A0sec", totalSeconds: 12.4 },
    { expected: "13\u00A0sec", totalSeconds: 12.5 },
    { expected: "2\u00A0min", totalSeconds: 89.5 },
  ])("formats $totalSeconds seconds as $expected", ({ totalSeconds, expected }) => {
    expect(formatDuration({ locale: "en", totalSeconds })).toBe(expected);
  });

  it.each([
    { expected: "2\u00A0hr 30\u00A0min", locale: "en" },
    { expected: "2\u00A0h 30\u00A0min", locale: "pt" },
    { expected: "2\u00A0h 30\u00A0min", locale: "pt-BR" },
    { expected: "2\u00A0h 30\u00A0min", locale: "es" },
    { expected: "2\u202Fh 30\u00A0min", locale: "fr" },
    { expected: "2\u00A0Std. 30\u00A0Min.", locale: "de" },
  ])("uses compact units and native spacing for $locale", ({ locale, expected }) => {
    expect(formatDuration({ locale, totalSeconds: 9000 })).toBe(expected);
  });

  it.each(["en", "pt", "de"])(
    "keeps each number with its unit, breaking only between units in %s",
    (locale) => {
      const [hours, minutes, ...rest] = formatDuration({ locale, totalSeconds: 5400 }).split(" ");

      expect(rest).toStrictEqual([]);
      expect(hours).toMatch(/^1\u00A0\S+$/u);
      expect(minutes).toMatch(/^30\u00A0\S+$/u);
    },
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "shows zero minutes for an invalid duration of %s",
    (totalSeconds) => {
      expect(formatDuration({ locale: "en", totalSeconds })).toBe("0\u00A0min");
    },
  );
});
