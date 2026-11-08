import { describe, expect, it } from "vitest";
import {
  getCoveredFallbacks,
  getFactsFit,
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
  "Awarded for finishing a study plan on Zoonk, with at least half its lessons studied.";

const LANGUAGE_FINE_PRINT =
  "At least half its lessons studied. Levels follow the CEFR; not an official exam result.";

const LINK = "zoonk.com/c/7TA1-B1BE-F0RE";

const PREVIEW_LINK = "zoonk-git-certificate-eligibility-clarity-zoonk.vercel.app/c/7TA1-B1BE-F0RE";

const ENGLISH = {
  facts: [
    { label: "Completed", value: "September 28, 2026" },
    { label: "Lessons studied", value: "48" },
    { label: "Passed by test", value: "31" },
    { label: "Study time", value: "about 21 hr" },
  ],
  verifyLabel: "Verify this certificate",
};

const PORTUGUESE = {
  facts: [
    { label: "Concluído em", value: "28 de fevereiro de 2026" },
    { label: "Aulas estudadas", value: "48" },
    { label: "Aulas dispensadas por teste", value: "31" },
    { label: "Carga horária", value: "cerca de 21 h" },
  ],
  verifyLabel: "Verifique este certificado",
};

const ENGLISH_FACTS = getFactsFit({ ...ENGLISH, displayUrl: LINK });

/** A line box in u, as the sheet's name and title draw them. */
const NAME_LINE = 92 * 1.02;
const TITLE_LINE = 40 * 1.14;

function getTopicOverflow(topic: string): number {
  return getSheetOverflow({
    covered: { topics: [topic] },
    facts: ENGLISH_FACTS,
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
          facts: ENGLISH_FACTS,
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
      facts: ENGLISH_FACTS,
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
        facts: ENGLISH_FACTS,
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

  it("counts the fine print's second line when a long link narrows its column", () => {
    const sheet = {
      covered: { topics: TOPICS },
      finePrint: LANGUAGE_FINE_PRINT,
      labelledGraph: true,
      nameHeight: NAME_LINE,
      titleHeight: TITLE_LINE,
    };

    const preview = getFactsFit({ ...ENGLISH, displayUrl: PREVIEW_LINK });

    expect(getSheetOverflow({ ...sheet, facts: preview })).toBeGreaterThan(
      getSheetOverflow({ ...sheet, facts: ENGLISH_FACTS }),
    );
  });
});

describe(getFactsFit, () => {
  it("keeps the design's gaps and sizes when the facts fit beside the verify block", () => {
    const withoutTestOuts = ENGLISH.facts.filter((fact) => fact.label !== "Passed by test");

    expect(getFactsFit({ ...ENGLISH, displayUrl: LINK, facts: withoutTestOuts })).toMatchObject({
      gap: 44,
      scale: 1,
    });
  });

  it("closes the gaps, then shrinks four long facts until they fit beside the verify block", () => {
    const fit = getFactsFit({ ...PORTUGUESE, displayUrl: LINK });

    expect(fit.gap).toBe(28);
    expect(fit.scale).toBeLessThan(1);
    expect(fit.scale).toBeGreaterThan(0.8);
  });

  it("shrinks the facts further beside a longer link", () => {
    const production = getFactsFit({ ...PORTUGUESE, displayUrl: LINK });
    const preview = getFactsFit({ ...PORTUGUESE, displayUrl: PREVIEW_LINK });

    expect(preview.scale).toBeLessThan(production.scale);
  });

  it("keeps the design's sizes for the same labels with fewer facts", () => {
    const fit = getFactsFit({
      ...PORTUGUESE,
      displayUrl: LINK,
      facts: PORTUGUESE.facts.slice(0, 2),
    });

    expect(fit.scale).toBe(1);
  });
});

describe(getLinkOverflow, () => {
  const title = 2 * 42 * 1.12;

  it("fits a two-line name and title, and runs over with a name that needs six lines", () => {
    const plan = { labelledGraph: false, titleHeight: title };

    expect(getLinkOverflow({ ...plan, nameHeight: 2 * 96 })).toBeLessThanOrEqual(0);

    expect(getLinkOverflow({ ...plan, nameHeight: 6 * 60 })).toBeGreaterThan(0);
  });

  it("fits a one-line name and a two-line title under a level's route label", () => {
    expect(
      getLinkOverflow({ labelledGraph: true, nameHeight: 96, titleHeight: title }),
    ).toBeLessThanOrEqual(0);
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
