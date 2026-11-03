import { describe, expect, it } from "vitest";
import {
  formatCertificateDate,
  formatStudyTime,
  getLadderFill,
  getShownStudyCounts,
  getShownTopics,
  getStudyTimeStat,
} from "./certificate-format";

describe(formatCertificateDate, () => {
  it("writes the learner's day in the certificate's language, whatever the server's time zone", () => {
    const dates = ["en", "es", "de", "ja", "pt"].map((locale) =>
      formatCertificateDate({ isoDate: "2026-11-03", locale }),
    );

    expect(dates).toStrictEqual([
      "November 3, 2026",
      "3 de noviembre de 2026",
      "3. November 2026",
      "2026年11月3日",
      "3 de novembro de 2026",
    ]);
  });
});

describe(formatStudyTime, () => {
  it("rounds to whole hours past one and keeps minutes under one", () => {
    expect(formatStudyTime({ locale: "en", minutes: 2460 })).toBe("41\u00A0hr");
    expect(formatStudyTime({ locale: "en", minutes: 2475 })).toBe("41\u00A0hr");
    expect(formatStudyTime({ locale: "en", minutes: 45 })).toBe("45\u00A0min");
    expect(formatStudyTime({ locale: "pt", minutes: 2460 })).toBe("41 h");
  });
});

describe(getStudyTimeStat, () => {
  it("splits the approximate hours into a number and a small unit", () => {
    expect(getStudyTimeStat({ locale: "en", minutes: 2460 })).toStrictEqual({
      unit: "h",
      value: "~41",
    });

    expect(getStudyTimeStat({ locale: "en", minutes: 45 })).toStrictEqual({
      unit: "m",
      value: "~45",
    });
  });
});

describe(getLadderFill, () => {
  it("fills a level through its whole band", () => {
    expect(getLadderFill({ kind: "languageLevel", level: "A1", measuredLevel: null })).toBe(2);
    expect(getLadderFill({ kind: "languageLevel", level: "B1", measuredLevel: null })).toBe(6);
    expect(getLadderFill({ kind: "languageLevel", level: "C1", measuredLevel: null })).toBe(10);
  });

  it("fills a placement to the half step it measured", () => {
    expect(getLadderFill({ kind: "placement", level: "A2", measuredLevel: "A2+" })).toBe(4);
    expect(getLadderFill({ kind: "placement", level: "B1", measuredLevel: "B1" })).toBe(5);
  });
});

describe(getShownTopics, () => {
  it("shows the first six topics", () => {
    const topics = ["a", "b", "c", "d", "e", "f", "g", "h"];

    expect(getShownTopics(topics)).toStrictEqual(["a", "b", "c", "d", "e", "f"]);
    expect(getShownTopics(["a"])).toStrictEqual(["a"]);
  });
});

describe(getShownStudyCounts, () => {
  it("leaves out a count or study time of 0, as it does an unknown one", () => {
    expect(
      getShownStudyCounts({ lessonsStudied: 0, lessonsTestedOut: 0, minutes: 0 }),
    ).toStrictEqual({ lessonsStudied: null, lessonsTestedOut: null, minutes: null });

    expect(
      getShownStudyCounts({ lessonsStudied: null, lessonsTestedOut: null, minutes: null }),
    ).toStrictEqual({ lessonsStudied: null, lessonsTestedOut: null, minutes: null });
  });

  it("keeps every count above 0", () => {
    expect(
      getShownStudyCounts({ lessonsStudied: 1, lessonsTestedOut: 3, minutes: 45 }),
    ).toStrictEqual({ lessonsStudied: 1, lessonsTestedOut: 3, minutes: 45 });
  });
});
