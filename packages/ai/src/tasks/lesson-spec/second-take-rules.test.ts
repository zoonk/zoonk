import { describe, expect, it } from "vitest";
import { type LessonScreenKind, type LessonSpec } from "./lesson-spec-rules";
import { type SecondTakeInput, getSecondTakeIssues } from "./second-take-rules";

const SECOND_TAKE: SecondTakeInput = {
  firstLessonMap: {
    ideas: [
      {
        label: "Percent of what",
        text: "A percent is always a part of some starting amount. Each discount takes its share of the price it finds.",
      },
      { text: "Short line." },
    ],
    shape: "hub",
  },
  wrongAnswers: [
    {
      answer: "$100",
      question: "A $100 jacket goes up 10%, then down 10%. What does it cost now?",
      reason: "The 10% off is taken from $110, not from $100.",
    },
    {
      answer: "30% off",
      question: "A 10% discount, then 20% more. How much off in all?",
      reason: "The second discount comes off a smaller price.",
    },
  ],
};

function spec({
  briefs = {},
  kinds = [
    "hook",
    "guess",
    "explanation",
    "explanation",
    "check",
    "workedExample",
    "check",
    "application",
  ],
  opensOn = 1,
}: {
  briefs?: Record<number, string>;
  kinds?: LessonScreenKind[];
  opensOn?: number;
}): LessonSpec {
  return {
    canDo: "Work out a price after two changes",
    description: "Two percent changes in a row.",
    estimatedMinutes: 4,
    opensOn,
    screens: kinds.map((kind, index) => ({
      activityTemplate: null,
      brief: briefs[index] ?? `${kind} brief`,
      kind,
      skills: kind === "hook" ? [] : [0],
      visual: null,
      visualKind: "none",
    })),
    skills: [
      {
        description: "Each change is a percent of the amount before it.",
        example: "Up 10% then down 10% leaves 99.",
        hard: true,
        name: "Work out two percent changes in a row",
        topic: "Successive percent changes",
        useCase: "Prices on sale after a rise",
      },
    ],
    title: "Why up 10% and down 10% isn't even",
  };
}

describe(getSecondTakeIssues, () => {
  it("passes a short plan that opens on a given wrong answer in its own words", () => {
    expect(getSecondTakeIssues({ secondTake: SECOND_TAKE, spec: spec({}) })).toStrictEqual([]);
  });

  it("flags a plan too long or too short for a second take", () => {
    const long = spec({
      kinds: ["hook", "guess", ...Array.from({ length: 9 }, () => "check" as const), "application"],
    });

    const short = spec({ kinds: ["hook", "guess", "explanation", "check", "application"] });

    expect(getSecondTakeIssues({ secondTake: SECOND_TAKE, spec: long })).toStrictEqual([
      expect.objectContaining({ code: "screenCount" }),
    ]);

    expect(getSecondTakeIssues({ secondTake: SECOND_TAKE, spec: short })).toStrictEqual([
      expect.objectContaining({ code: "screenCount" }),
    ]);
  });

  it("flags a plan whose guess doesn't follow the scene", () => {
    const late = spec({
      kinds: [
        "hook",
        "explanation",
        "guess",
        "explanation",
        "check",
        "workedExample",
        "check",
        "application",
      ],
    });

    expect(getSecondTakeIssues({ secondTake: SECOND_TAKE, spec: late })).toStrictEqual([
      expect.objectContaining({ code: "opening" }),
    ]);
  });

  it("flags an idea taught after the last check, left for the application alone", () => {
    const late = spec({
      kinds: [
        "hook",
        "guess",
        "explanation",
        "check",
        "workedExample",
        "check",
        "explanation",
        "application",
      ],
    });

    expect(getSecondTakeIssues({ secondTake: SECOND_TAKE, spec: late })).toStrictEqual([
      expect.objectContaining({ code: "uncheckedTeaching" }),
    ]);
  });

  it("flags a plan whose only practice is the application", () => {
    const unchecked = spec({
      kinds: ["hook", "guess", "explanation", "explanation", "workedExample", "application"],
    });

    expect(getSecondTakeIssues({ secondTake: SECOND_TAKE, spec: unchecked })).toStrictEqual([
      expect.objectContaining({ code: "uncheckedTeaching" }),
    ]);
  });

  it.each([0, 3])("flags an opening on wrong answer %i, which wasn't given", (opensOn) => {
    expect(getSecondTakeIssues({ secondTake: SECOND_TAKE, spec: spec({ opensOn }) })).toStrictEqual(
      [expect.objectContaining({ code: "wrongAnswer" })],
    );
  });

  it("asks for no wrong answer when none was given", () => {
    const secondTake = { ...SECOND_TAKE, wrongAnswers: [] };

    expect(getSecondTakeIssues({ secondTake, spec: spec({ opensOn: 0 }) })).toStrictEqual([]);
  });

  it("flags a brief that repeats a sentence of the first lesson's map, whatever its case and punctuation", () => {
    const copied = spec({
      briefs: {
        3: "Say it plainly: each discount takes its share of the PRICE it finds! Then the rule.",
      },
    });

    expect(getSecondTakeIssues({ secondTake: SECOND_TAKE, spec: copied })).toStrictEqual([
      expect.objectContaining({ code: "copiedSentence" }),
    ]);
  });

  it("flags a copied Japanese sentence when its neighboring sentences differ", () => {
    const copied = "値引きのたびに、基準となる金額が変わる。";

    const secondTake = {
      ...SECOND_TAKE,
      firstLessonMap: {
        ...SECOND_TAKE.firstLessonMap,
        ideas: [{ text: `「百分率」は、もとの量を百としたときの割合を表す。${copied}` }],
      },
    };

    expect(
      getSecondTakeIssues({
        language: "ja",
        secondTake,
        spec: spec({ briefs: { 2: `図で考えよう。${copied}では計算してみよう。` } }),
      }),
    ).toStrictEqual([expect.objectContaining({ code: "copiedSentence" })]);
  });

  it("allows a short sentence or part of a sentence both lessons say alike", () => {
    const shared = spec({
      briefs: {
        2: "Short line. A percent is always a part of something, shown on a bar of 100 squares.",
      },
    });

    expect(getSecondTakeIssues({ secondTake: SECOND_TAKE, spec: shared })).toStrictEqual([]);
  });
});
