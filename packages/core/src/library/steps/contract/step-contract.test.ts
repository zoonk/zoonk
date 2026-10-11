import { challengeCaseFixture } from "@zoonk/testing/fixtures/challenge-contents";
import { numberedCheckContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import {
  type StepContentByKind,
  parseStepContent,
  safeParseStepContent,
  stepContentSchemas,
} from "./step-contract";

const options = [
  { id: "a", isCorrect: true, reason: "It adds 25% of 60.", text: "$45" },
  { id: "b", isCorrect: false, reason: "That's the discount, not the price.", text: "$15" },
];

const contents: StepContentByKind = {
  activity: {
    check: { explanation: "Each jump is drawn.", kind: "interaction" },
    fields: {
      steps: [
        { id: "a", text: "Light is absorbed" },
        { id: "b", text: "Water is split", why: "Light powers it." },
        { id: "c", text: "Sugar is built", why: "It needs that energy." },
      ],
    },
    prompt: "Put the steps in order.",
    template: "processOrder",
  },
  alphabet: {
    audioText: "a",
    audioUrl: null,
    forms: [{ label: "Isolated", symbol: "ا" }],
    pronunciation: "alif",
    readingAid: "a",
    symbol: "ا",
  },
  challenge: challengeCaseFixture(),
  check: { context: "A $60 jacket is 25% off.", options, question: "What do you pay?" },
  explanation: {
    exampleLineSlot: { idea: "A discount on something the learner buys." },
    image: { alt: "A price tag with 25% crossed out", prompt: "A price tag, 25% off" },
    text: "A **discount** takes a share off the price: 25% of $60 is $15.",
    title: "Discounts",
  },
  fillBlank: {
    answers: ["hablo"],
    distractors: ["habla"],
    feedback: "First person.",
    template: "Yo [BLANK] español.",
  },
  hook: {
    options: [
      { id: "a", isCorrect: false, text: "About a month" },
      { id: "b", isCorrect: true, text: "About 12 days" },
    ],
    question: "How long is a million seconds?",
    reveal: "About 11.6 days.",
    variant: "guess",
  },
  listening: {},
  matchColumns: { pairs: [{ left: "perro", right: "dog" }] },
  multipleChoice: { options: [{ feedback: "Right.", id: "a", isCorrect: true, text: "dog" }] },
  reading: {},
  spokenAnswer: {
    language: "es",
    prompt: "Say it out loud.",
    targetText: "Buenos días",
    translation: "Good morning",
  },
  summary: { ideas: [{ text: "A discount takes a share off the price." }] },
  translation: {},
  typedAnswer: {
    acceptedAnswers: ["45", "$45"],
    keyPoints: ["Takes 25% of 60", "Subtracts it from 60"],
    question: "Explain how you got the price.",
    sampleAnswer: "25% of 60 is 15, so 60 − 15 = 45.",
  },
  vocabulary: {},
  workedExample: {
    problem: "Solve $3x + 2 = 11$.",
    result: "x is 3.",
    steps: [
      { math: "3x = 9", text: "Take 2 off both sides." },
      { math: "x = 3", text: "Split 9 into 3 equal groups." },
    ],
  },
};

describe("step contract", () => {
  it("has a schema for every step kind", () => {
    expect(Object.keys(stepContentSchemas).toSorted()).toStrictEqual(
      Object.keys(contents).toSorted(),
    );
  });

  it.each(Object.keys(contents))("round-trips %s content unchanged", (kind) => {
    const key = kind as keyof StepContentByKind;
    const stored = structuredClone(contents[key]);

    expect(parseStepContent(key, stored)).toStrictEqual(contents[key]);
  });

  it("repairs malformed LaTeX escapes and removes NULs", () => {
    const malformed = JSON.parse(String.raw`"Pay \u00005c(45\\%\\) less\u0000."`) as string;

    expect(parseStepContent("explanation", { text: malformed })).toStrictEqual({
      text: String.raw`Pay \(45\%\) less.`,
    });
  });

  it("reads em dashes as the app writes them: commas", () => {
    expect(
      parseStepContent("explanation", { text: "Na contestação — a defesa escrita — o réu fala." }),
    ).toStrictEqual({ text: "Na contestação, a defesa escrita, o réu fala." });
  });

  it("narrows activity content by template", () => {
    const content = parseStepContent("activity", contents.activity);

    expect(
      content.template === "processOrder" && content.fields.steps.map((step) => step.id),
    ).toStrictEqual(["a", "b", "c"]);
  });

  it("keeps a question whose options are pictures, every one of them, with no other picture", () => {
    const doorways = {
      options: [
        {
          id: "a",
          isCorrect: true,
          picture: {
            alt: "A tall doorway with a pointed arch and thin columns",
            prompt: "A stone church doorway with a pointed arch, alone on a plain background",
          },
          reason: "The pointed arch is Gothic.",
          text: "Gothic",
        },
        {
          id: "b",
          isCorrect: false,
          picture: {
            alt: "A low doorway with a round arch and thick walls",
            prompt: "A stone church doorway with a round arch, alone on a plain background",
          },
          reason: "A round arch is Romanesque.",
          text: "Romanesque",
        },
      ],
      question: "Which doorway is Gothic?",
    };

    const [gothic, romanesque] = doorways.options;

    expect(safeParseStepContent("check", doorways).success).toBe(true);

    const oneMissing = { ...doorways, options: [gothic, { ...romanesque, picture: undefined }] };

    const withScreenPicture = {
      ...doorways,
      image: { alt: "Two doorways", prompt: "Two church doorways side by side" },
    };

    const namedInAlt = {
      ...doorways,
      options: [
        { ...gothic, picture: { ...gothic?.picture, alt: "A Gothic doorway with a pointed arch" } },
        romanesque,
      ],
    };

    expect(safeParseStepContent("check", oneMissing).success).toBe(false);
    expect(safeParseStepContent("check", withScreenPicture).success).toBe(false);
    expect(safeParseStepContent("check", namedInAlt).success).toBe(false);
  });

  it("asks which number marks a part only with numbers the picture draws", () => {
    const [right, ...wrong] = numberedCheckContent.options;

    const pastTheLast = { ...numberedCheckContent, options: [right, { ...wrong[0], text: "4" }] };

    expect(safeParseStepContent("check", numberedCheckContent).success).toBe(true);
    expect(safeParseStepContent("check", pastTheLast).success).toBe(false);
  });

  it("rejects content that doesn't match its kind", () => {
    expect(
      safeParseStepContent("check", {
        ...contents.check,
        options: [{ ...options[0], reason: "" }, options[1]],
      }).success,
    ).toBe(false);

    expect(
      safeParseStepContent("check", {
        ...contents.check,
        options: options.map((option) => ({ ...option, isCorrect: true })),
      }).success,
    ).toBe(false);

    expect(
      safeParseStepContent("check", {
        ...contents.check,
        options: [...options, { ...options[1], text: "$30" }],
      }).success,
    ).toBe(false);

    expect(safeParseStepContent("explanation", { text: "Hi", unknownField: true }).success).toBe(
      false,
    );

    expect(safeParseStepContent("summary", { ideas: [] }).success).toBe(false);

    expect(
      safeParseStepContent("spokenAnswer", { ...contents.spokenAnswer, language: "Spanish" })
        .success,
    ).toBe(false);

    expect(
      safeParseStepContent("activity", { ...contents.activity, template: "confetti" }).success,
    ).toBe(false);

    expect(() => parseStepContent("hook", { variant: "text" })).toThrow();
  });
});
