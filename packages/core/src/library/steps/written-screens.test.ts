import { describe, expect, it } from "vitest";
import { writtenTemperatureLesson } from "../quality/_test-utils/written-lessons";
import { toStepContent } from "./written-screens";

const screens = writtenTemperatureLesson().screens;

function screenAt(index: number) {
  const screen = screens[index];

  if (!screen) {
    throw new Error(`No screen ${index}`);
  }

  return screen;
}

describe(toStepContent, () => {
  it("turns a calculation into a check whose options code computed, in increasing order", () => {
    const converted = toStepContent(screenAt(3), { allowImage: false, language: "en" });

    expect(converted).toMatchObject({
      content: {
        options: [
          {
            id: "a",
            isCorrect: false,
            reason: "A rise moves up the thermometer, not down.",
            text: "-11\u00A0°C",
          },
          {
            id: "b",
            isCorrect: true,
            reason: "You start at -4 °C and move 7 degrees up.",
            text: "3\u00A0°C",
          },
          { id: "c", isCorrect: false, text: "11\u00A0°C" },
        ],
        question:
          "At 6 am it was -4 °C. By noon it warmed up 7 degrees. What's the temperature now?",
      },
      kind: "check",
      mathItem: { question: expect.stringContaining("{start}") },
      ok: true,
    });
  });

  it("formats computed answers in the lesson's language", () => {
    const screen = screenAt(3);

    if (screen.kind !== "mathCheck") {
      throw new Error("Screen 4 is a calculation.");
    }

    const money = {
      ...screen,
      math: { ...screen.math, answer: 4.5, solution: "(start + rise) / 2 + 3", unit: "R$" },
    };

    const converted = toStepContent(money, { allowImage: false, language: "pt" });

    expect(converted.ok && JSON.stringify(converted.content)).toContain("R$\u00A04,50");
  });

  it("keeps a picture and the example-line slot only where they belong", () => {
    const planned = toStepContent(screenAt(1), { allowImage: true, language: "en" });
    const unplanned = toStepContent(screenAt(1), { allowImage: false, language: "en" });

    expect(planned).toMatchObject({
      content: {
        exampleLineSlot: { idea: "A cold morning where the learner lives." },
        image: { alt: "A thermometer with an arrow going up past zero." },
      },
    });

    expect(unplanned.ok && "image" in unplanned.content).toBe(false);
  });

  it("keeps each option's picture on a question whose options are pictures, never on a version", () => {
    const doorways = {
      basis: null,
      context: null,
      image: null,
      kind: "check" as const,
      options: [
        {
          isCorrect: true,
          picture: {
            alt: " A tall doorway with a pointed arch ",
            prompt: "A stone church doorway with a pointed arch, alone",
          },
          reason: "The pointed arch is Gothic.",
          text: "Gothic",
        },
        {
          isCorrect: false,
          picture: {
            alt: "A low doorway with a round arch",
            prompt: "A stone church doorway with a round arch, alone",
          },
          reason: "A round arch is Romanesque.",
          text: "Romanesque",
        },
      ],
      question: "Which doorway is Gothic?",
      visual: null,
    };

    const shared = toStepContent(doorways, { allowImage: true, language: "en" });
    const version = toStepContent(doorways, { allowImage: false, language: "en" });

    const pictures = (converted: typeof shared) =>
      converted.ok && "options" in converted.content
        ? (converted.content.options as { picture?: { alt: string } }[]).map(
            (option) => option.picture?.alt ?? null,
          )
        : null;

    expect(pictures(shared)?.toSorted()).toStrictEqual([
      "A low doorway with a round arch",
      "A tall doorway with a pointed arch",
    ]);

    expect(pictures(version)).toStrictEqual([null, null]);
  });

  it("keeps a valid template to explore on an explanation and leaves out one that isn't", () => {
    const explanation = screenAt(1);

    if (explanation.kind !== "explanation") {
      throw new Error("Screen 2 is an explanation");
    }

    const fields = {
      label: "Temperature",
      max: 7,
      min: -5,
      moves: [{ by: 3 }, { by: 5 }],
      start: -3,
      step: 1,
      unit: "°C",
    };

    const withExplore = (content: object) => ({
      ...explanation,
      explore: { content: JSON.stringify(content), template: "numberLine" },
    });

    // A prompt or check written out of habit is left out; the fields are what's explored.
    const valid = toStepContent(withExplore({ check: { kind: "numeric" }, fields }), {
      allowImage: false,
      language: "en",
    });

    const invalid = toStepContent(withExplore({ fields: { ...fields, moves: [] } }), {
      allowImage: false,
      language: "en",
    });

    expect(valid).toMatchObject({
      content: { explore: { fields, template: "numberLine" } },
      kind: "explanation",
      ok: true,
    });

    expect(invalid.ok && "explore" in invalid.content).toBe(false);
    expect(invalid.ok).toBe(true);
  });

  it("stores typed answers without empty accepted answers and activities with their template", () => {
    expect(toStepContent(screenAt(6), { allowImage: false, language: "en" })).toMatchObject({
      content: { keyPoints: expect.any(Array), sampleAnswer: expect.any(String) },
      kind: "typedAnswer",
    });

    expect(
      JSON.stringify(toStepContent(screenAt(6), { allowImage: false, language: "en" })),
    ).not.toContain("acceptedAnswers");

    expect(toStepContent(screenAt(5), { allowImage: false, language: "en" })).toMatchObject({
      content: { template: "numberLine" },
      kind: "activity",
    });
  });

  it("keeps short accepted answers and leaves out a sentence-long one", () => {
    const screen = screenAt(6);

    if (screen.kind !== "typedAnswer") {
      throw new Error("Screen 7 is a typed answer.");
    }

    const converted = toStepContent(
      { ...screen, acceptedAnswers: ["3 °C", `It goes up ${"one degree at a time ".repeat(10)}`] },
      { allowImage: false, language: "en" },
    );

    expect(converted).toMatchObject({ content: { acceptedAnswers: ["3 °C"] }, ok: true });
  });
});
