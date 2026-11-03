import { describe, expect, it } from "vitest";
import {
  estimateLines,
  getCoveredFallbacks,
  getLinkOverflow,
  getSheetOverflow,
} from "./certificate-layout";

const TOPICS = [
  "Light and matter",
  "Waves and probability",
  "The Schrödinger equation",
  "Atoms and spin",
  "Tunneling",
  "Entanglement",
];

const COURSE_FINE_PRINT =
  "Awarded for finishing every lesson and challenge of this course on Zoonk.";

/** A line box in u, as the sheet's name and title draw them. */
const NAME_LINE = 92 * 1.02;
const TITLE_LINE = 40 * 1.14;

describe(getSheetOverflow, () => {
  it("fits a one-line name and title with every topic and the route", () => {
    expect(
      getSheetOverflow({
        covered: { kind: "topics", topics: TOPICS },
        finePrint: COURSE_FINE_PRINT,
        graph: "labelledRoute",
        nameHeight: NAME_LINE,
        titleHeight: TITLE_LINE,
      }),
    ).toBeLessThanOrEqual(0);
  });

  it("runs over with a three-line title until every topic gives way", () => {
    const longTitle = {
      finePrint: COURSE_FINE_PRINT,
      graph: "labelledRoute" as const,
      nameHeight: NAME_LINE,
      titleHeight: TITLE_LINE * 3,
    };

    const overflows = getCoveredFallbacks({ kind: "topics", topics: TOPICS }).map((covered) =>
      getSheetOverflow({ ...longTitle, covered }),
    );

    expect(overflows.map((overflow) => overflow > 0)).toStrictEqual([true, true, false]);
  });

  it("runs over with a two-line name and a three-line title even without topics", () => {
    expect(
      getSheetOverflow({
        covered: null,
        finePrint: COURSE_FINE_PRINT,
        graph: "labelledRoute",
        nameHeight: NAME_LINE * 2,
        titleHeight: TITLE_LINE * 3,
      }),
    ).toBeGreaterThan(0);
  });
});

describe(getLinkOverflow, () => {
  it("fits a two-line name and title, and runs over with a name that needs six lines", () => {
    const title = 2 * 42 * 1.12;

    expect(
      getLinkOverflow({ graph: "route", nameHeight: 2 * 96, titleHeight: title }),
    ).toBeLessThanOrEqual(0);

    expect(
      getLinkOverflow({ graph: "route", nameHeight: 6 * 60, titleHeight: title }),
    ).toBeGreaterThan(0);
  });
});

describe(getCoveredFallbacks, () => {
  it("gives way from every topic to the first two, then to none", () => {
    expect(getCoveredFallbacks({ kind: "topics", topics: TOPICS })).toStrictEqual([
      { kind: "topics", topics: TOPICS },
      { kind: "topics", topics: ["Light and matter", "Waves and probability"] },
      null,
    ]);

    expect(getCoveredFallbacks({ kind: "readouts" })).toStrictEqual([{ kind: "readouts" }, null]);
  });
});

describe(estimateLines, () => {
  it("counts wide scripts as a full em", () => {
    expect(estimateLines({ fontSize: 10, text: "abcd", width: 40 })).toBe(1);
    expect(estimateLines({ fontSize: 10, text: "量子物理", width: 40 })).toBe(1);
    expect(estimateLines({ fontSize: 10, text: "量子物理学", width: 40 })).toBe(2);
  });
});
