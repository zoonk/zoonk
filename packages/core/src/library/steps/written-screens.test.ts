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
