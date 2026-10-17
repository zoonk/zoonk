import { describe, expect, it } from "vitest";
import {
  type ExamSpeakingCriterion,
  listRatedCriteria,
  toExamSpeakingGrade,
} from "./exam-speaking-bands";

const DELE_FLUENCY: ExamSpeakingCriterion = {
  halfBands: false,
  key: "fluency",
  levelBand: 2,
  maxBand: 3,
  name: "Fluidez",
  scope: "task",
  sound: true,
  voiceOnly: true,
};

/** A1 and A2's "Uso de la lengua": language and how easily it's understood, so text shows part. */
const DELE_LANGUAGE_USE: ExamSpeakingCriterion = {
  ...DELE_FLUENCY,
  key: "languageUse",
  name: "Uso de la lengua",
  voiceOnly: false,
};

const DELE_GRAMMAR: ExamSpeakingCriterion = {
  ...DELE_FLUENCY,
  key: "accuracy",
  name: "Corrección",
  sound: false,
  voiceOnly: false,
};

const CAMBRIDGE_GLOBAL: ExamSpeakingCriterion = {
  halfBands: true,
  key: "global",
  levelBand: 3,
  maxBand: 5,
  name: "Global Achievement",
  scope: "test",
  sound: false,
  voiceOnly: false,
};

/** The range one criterion keeps from what the model wrote. */
function normalizeExamBandRange({
  bandHigh,
  bandLow,
  criterion,
}: {
  bandHigh: number;
  bandLow: number;
  criterion: ExamSpeakingCriterion;
}) {
  const grade = toExamSpeakingGrade({
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
    expect(
      normalizeExamBandRange({ bandHigh: 1, bandLow: 2, criterion: DELE_GRAMMAR }),
    ).toStrictEqual({ bandHigh: 2, bandLow: 1 });
  });

  it("keeps DELE's whole bands from 0 to 3", () => {
    expect(
      normalizeExamBandRange({ bandHigh: 2.4, bandLow: 1.6, criterion: DELE_GRAMMAR }),
    ).toStrictEqual({ bandHigh: 2, bandLow: 2 });

    expect(
      normalizeExamBandRange({ bandHigh: 5, bandLow: 3, criterion: DELE_GRAMMAR }),
    ).toStrictEqual({ bandHigh: 3, bandLow: 3 });
  });

  it("allows Cambridge's half bands", () => {
    expect(
      normalizeExamBandRange({ bandHigh: 3.6, bandLow: 3.4, criterion: CAMBRIDGE_GLOBAL }),
    ).toStrictEqual({ bandHigh: 3.5, bandLow: 3.5 });
  });

  it("narrows a range wider than a band around its middle", () => {
    expect(
      normalizeExamBandRange({ bandHigh: 3, bandLow: 0, criterion: DELE_GRAMMAR }),
    ).toStrictEqual({ bandHigh: 2, bandLow: 1 });
  });

  it("widens the criterion about sound to a full band, inside the scale", () => {
    expect(
      normalizeExamBandRange({ bandHigh: 2, bandLow: 2, criterion: DELE_FLUENCY }),
    ).toStrictEqual({ bandHigh: 3, bandLow: 2 });

    expect(
      normalizeExamBandRange({ bandHigh: 3, bandLow: 3, criterion: DELE_FLUENCY }),
    ).toStrictEqual({ bandHigh: 3, bandLow: 2 });

    expect(
      normalizeExamBandRange({ bandHigh: 0, bandLow: 0, criterion: DELE_FLUENCY }),
    ).toStrictEqual({ bandHigh: 1, bandLow: 0 });
  });
});

const OUTPUT = {
  accuracy: { bandHigh: 9, bandLow: 2, evidence: "e2", tip: "t2" },
  fluency: { bandHigh: 2, bandLow: 2, evidence: "e1", tip: "t1" },
  focus: "accuracy",
};

/** The candidate's turns with this many words in all. */
function said(words: number) {
  return [
    { speaker: "character" as const, text: "Puede empezar." },
    { speaker: "learner" as const, text: Array.from({ length: words }, () => "palabra").join(" ") },
  ];
}

/** DELE B2 Task 3's grade (3 minutes at least) after this many seconds and words. */
function gradeTaskThree({ spokenSeconds, words }: { spokenSeconds: number; words: number }) {
  return toExamSpeakingGrade({
    criteria: [DELE_GRAMMAR],
    minMinutes: 3,
    output: OUTPUT,
    spokenSeconds,
    turns: said(words),
  });
}

describe(toExamSpeakingGrade, () => {
  it("keeps one grade per criterion in the given order, on its scale", () => {
    const grade = toExamSpeakingGrade({
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
