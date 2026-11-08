import { describe, expect, it } from "vitest";
import { getCoveredFallbacks, getLinkOverflow, getSheetOverflow } from "./certificate-layout";

const TOPICS = [
  "Light and matter",
  "Waves and probability",
  "The Schrödinger equation",
  "Atoms and spin",
  "Tunneling",
  "Entanglement",
];

const COURSE_FINE_PRINT =
  "Awarded for finishing a study plan on Zoonk, with at least half its lessons studied.";

const LANGUAGE_FINE_PRINT =
  "At least half its lessons studied. Levels follow the CEFR; not an official exam result.";

/** A line box in u, as the sheet's name and title draw them. */
const NAME_LINE = 92 * 1.02;
const TITLE_LINE = 40 * 1.14;

function getTopicOverflow(topic: string): number {
  return getSheetOverflow({
    covered: { topics: [topic] },
    finePrint: COURSE_FINE_PRINT,
    labelledGraph: true,
    nameHeight: NAME_LINE,
    titleHeight: TITLE_LINE,
  });
}

describe(getSheetOverflow, () => {
  it.each([COURSE_FINE_PRINT, LANGUAGE_FINE_PRINT])(
    "fits a one-line name and title with every topic, the route and the fine print %#",
    (finePrint) => {
      expect(
        getSheetOverflow({
          covered: { topics: TOPICS },
          finePrint,
          labelledGraph: true,
          nameHeight: NAME_LINE,
          titleHeight: TITLE_LINE,
        }),
      ).toBeLessThanOrEqual(0);
    },
  );

  it("runs over with a three-line title until every topic gives way", () => {
    const longTitle = {
      finePrint: COURSE_FINE_PRINT,
      labelledGraph: true,
      nameHeight: NAME_LINE,
      titleHeight: TITLE_LINE * 3,
    };

    const overflows = getCoveredFallbacks({ topics: TOPICS }).map((covered) =>
      getSheetOverflow({ ...longTitle, covered }),
    );

    expect(overflows.map((overflow) => overflow > 0)).toStrictEqual([true, true, false]);
  });

  it("runs over with a two-line name and a three-line title even without topics", () => {
    expect(
      getSheetOverflow({
        covered: null,
        finePrint: COURSE_FINE_PRINT,
        labelledGraph: true,
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

    expect(getLinkOverflow({ nameHeight: 2 * 96, titleHeight: title })).toBeLessThanOrEqual(0);

    expect(getLinkOverflow({ nameHeight: 6 * 60, titleHeight: title })).toBeGreaterThan(0);
  });
});

describe(getCoveredFallbacks, () => {
  it("gives way from every topic to the first two, then to none", () => {
    expect(getCoveredFallbacks({ topics: TOPICS })).toStrictEqual([
      { topics: TOPICS },
      { topics: ["Light and matter", "Waves and probability"] },
      null,
    ]);
  });
});
