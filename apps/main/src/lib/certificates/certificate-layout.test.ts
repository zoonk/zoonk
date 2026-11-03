import { describe, expect, it } from "vitest";
import {
  fitRouteLabels,
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

function getTopicOverflow(topic: string): number {
  return getSheetOverflow({
    covered: { kind: "topics", topics: [topic] },
    finePrint: COURSE_FINE_PRINT,
    graph: "labelledRoute",
    nameHeight: NAME_LINE,
    titleHeight: TITLE_LINE,
  });
}

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

  it("reserves more room for wide-script topics than Latin topics of the same length", () => {
    expect(getTopicOverflow("量子物理".repeat(5))).toBeGreaterThan(
      getTopicOverflow("abcd".repeat(5)),
    );
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

/** The print sheet's route: 979 u wide, labels 12.5 u, each at its level's start (the first at the ring). */
const SHEET_ROUTE = { fontSize: 12.5, width: 979 };

describe(fitRouteLabels, () => {
  it("leaves out the label of a level too short for it, keeping the levels after it", () => {
    const labels = [
      { label: "Overview", left: 0 },
      { label: "Beginner", left: 44 },
      { label: "Intermediate", left: 550 },
      { label: "Advanced", left: 887 },
    ];

    expect(fitRouteLabels({ ...SHEET_ROUTE, labels })).toStrictEqual(labels.slice(1));
  });

  it("leaves out a last label that would run past the route's end", () => {
    const labels = [
      { label: "Beginner", left: 0 },
      { label: "Advanced", left: 935 },
    ];

    expect(fitRouteLabels({ ...SHEET_ROUTE, labels })).toStrictEqual(labels.slice(0, 1));
  });
});
