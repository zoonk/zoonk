import { describe, expect, it } from "vitest";
import { type SpeakingCriterion, listRatedCriteria, toSpeakingGrade } from "./speaking-bands";

const DELE_FLUENCY: SpeakingCriterion = {
  halfBands: false,
  key: "fluency",
  levelBand: 2,
  maxBand: 3,
  name: "Fluidez",
  scope: "task",
  sound: true,
  voiceOnly: true,
};

const DELE_LANGUAGE_USE: SpeakingCriterion = {
  ...DELE_FLUENCY,
  key: "languageUse",
  name: "Uso de la lengua",
  voiceOnly: false,
};

const DELE_GRAMMAR: SpeakingCriterion = {
  ...DELE_FLUENCY,
  key: "accuracy",
  name: "Corrección",
  sound: false,
  voiceOnly: false,
};

const CAMBRIDGE_GLOBAL: SpeakingCriterion = {
  halfBands: true,
  key: "global",
  levelBand: 3,
  maxBand: 5,
  name: "Global Achievement",
  scope: "test",
  sound: false,
  voiceOnly: false,
};

const TOEFL_DELIVERY: SpeakingCriterion = {
  halfBands: true,
  key: "delivery",
  levelBand: null,
  maxBand: 6,
  minBand: 1,
  name: "Delivery",
  scope: "task",
  sound: true,
  voiceOnly: true,
};

function normalizeBandRange({
  bandHigh,
  bandLow,
  criterion,
}: {
  bandHigh: number;
  bandLow: number;
  criterion: SpeakingCriterion;
}) {
  const grade = toSpeakingGrade({
    criteria: [criterion],
    minMinutes: 3,
    output: { [criterion.key]: { bandHigh, bandLow, evidence: "", tip: "" }, focus: criterion.key },
    spokenSeconds: 120,
    turns: [],
  });

  const [kept] = grade.criteria;
  return kept ? { bandHigh: kept.bandHigh, bandLow: kept.bandLow } : null;
}

describe("a criterion's range on its official scale", () => {
  it("keeps a valid range, low end first", () => {
    expect(normalizeBandRange({ bandHigh: 1, bandLow: 2, criterion: DELE_GRAMMAR })).toStrictEqual({
      bandHigh: 2,
      bandLow: 1,
    });
  });

  it("keeps DELE's whole bands from 0 to 3", () => {
    expect(
      normalizeBandRange({ bandHigh: 2.4, bandLow: 1.6, criterion: DELE_GRAMMAR }),
    ).toStrictEqual({ bandHigh: 2, bandLow: 2 });

    expect(normalizeBandRange({ bandHigh: 5, bandLow: 3, criterion: DELE_GRAMMAR })).toStrictEqual({
      bandHigh: 3,
      bandLow: 3,
    });
  });

  it("allows Cambridge's half bands", () => {
    expect(
      normalizeBandRange({ bandHigh: 3.6, bandLow: 3.4, criterion: CAMBRIDGE_GLOBAL }),
    ).toStrictEqual({ bandHigh: 3.5, bandLow: 3.5 });
  });

  it("keeps TOEFL's half bands from 1 to 6", () => {
    expect(
      normalizeBandRange({ bandHigh: 4.3, bandLow: 3.8, criterion: TOEFL_DELIVERY }),
    ).toStrictEqual({ bandHigh: 5, bandLow: 4 });

    expect(
      normalizeBandRange({ bandHigh: 1, bandLow: 0, criterion: TOEFL_DELIVERY }),
    ).toStrictEqual({ bandHigh: 2, bandLow: 1 });

    expect(
      normalizeBandRange({ bandHigh: 7, bandLow: 6, criterion: TOEFL_DELIVERY }),
    ).toStrictEqual({ bandHigh: 6, bandLow: 5 });
  });

  it("narrows a range wider than a band around its middle", () => {
    expect(normalizeBandRange({ bandHigh: 3, bandLow: 0, criterion: DELE_GRAMMAR })).toStrictEqual({
      bandHigh: 2,
      bandLow: 1,
    });
  });

  it("widens the criterion about sound to a full band, inside the scale", () => {
    expect(normalizeBandRange({ bandHigh: 2, bandLow: 2, criterion: DELE_FLUENCY })).toStrictEqual({
      bandHigh: 3,
      bandLow: 2,
    });

    expect(normalizeBandRange({ bandHigh: 3, bandLow: 3, criterion: DELE_FLUENCY })).toStrictEqual({
      bandHigh: 3,
      bandLow: 2,
    });

    expect(normalizeBandRange({ bandHigh: 0, bandLow: 0, criterion: DELE_FLUENCY })).toStrictEqual({
      bandHigh: 1,
      bandLow: 0,
    });
  });
});

const OUTPUT = {
  accuracy: { bandHigh: 9, bandLow: 2, evidence: "e2", tip: "t2" },
  fluency: { bandHigh: 2, bandLow: 2, evidence: "e1", tip: "t1" },
  focus: "accuracy",
};

function said(words: number) {
  return [
    { speaker: "character" as const, text: "Puede empezar." },
    { speaker: "learner" as const, text: Array.from({ length: words }, () => "palabra").join(" ") },
  ];
}

function gradeTaskThree({ spokenSeconds, words }: { spokenSeconds: number; words: number }) {
  return toSpeakingGrade({
    criteria: [DELE_GRAMMAR],
    minMinutes: 3,
    output: OUTPUT,
    spokenSeconds,
    turns: said(words),
  });
}

describe(toSpeakingGrade, () => {
  it("keeps one grade per criterion in the given order, on its scale", () => {
    const grade = toSpeakingGrade({
      criteria: [DELE_FLUENCY, DELE_GRAMMAR],
      minMinutes: 6,
      output: OUTPUT,
      spokenSeconds: 200,
      turns: said(400),
    });

    expect(grade).toStrictEqual({
      brief: false,
      criteria: [
        { bandHigh: 3, bandLow: 2, criterion: "fluency", evidence: "e1", tip: "t1" },
        { bandHigh: 3, bandLow: 2, criterion: "accuracy", evidence: "e2", tip: "t2" },
      ],
      focus: "accuracy",
      heard: true,
    });
  });

  it("calls a task brief when the candidate said under 25 words a minute of its shortest time, spoken or typed", () => {
    expect(gradeTaskThree({ spokenSeconds: 110, words: 53 })).toMatchObject({
      brief: true,
      heard: true,
    });

    expect(gradeTaskThree({ spokenSeconds: 110, words: 80 })).toMatchObject({
      brief: false,
      heard: true,
    });

    expect(gradeTaskThree({ spokenSeconds: 0, words: 40 })).toMatchObject({
      brief: true,
      heard: false,
    });
  });
});

describe(listRatedCriteria, () => {
  const criteria = [DELE_FLUENCY, DELE_LANGUAGE_USE, DELE_GRAMMAR];

  it("rates every criterion when the candidate spoke", () => {
    expect(listRatedCriteria({ criteria, spokenSeconds: 40 })).toStrictEqual(criteria);
  });

  it("leaves out the criteria only the voice shows when the candidate typed", () => {
    expect(listRatedCriteria({ criteria, spokenSeconds: 0 })).toStrictEqual([
      DELE_LANGUAGE_USE,
      DELE_GRAMMAR,
    ]);
  });
});
