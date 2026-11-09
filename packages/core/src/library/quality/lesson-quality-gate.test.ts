import { describe, expect, it } from "vitest";
import { temperatureSpec, writtenTemperatureLesson } from "./_test-utils/written-lessons";
import { runLessonQualityGate } from "./lesson-quality-gate";

function gate(text: string) {
  const lesson = writtenTemperatureLesson();

  return runLessonQualityGate({
    context: {
      activityTemplates: [],
      chapterTitle: "Temperature",
      courseTitle: "Weather",
      language: "en",
      level: "beginner",
      spec: temperatureSpec(),
    },
    lesson: {
      ...lesson,
      screens: lesson.screens.map((screen, index) =>
        index === 4 && screen.kind === "explanation" ? { ...screen, text } : screen,
      ),
    },
    review: false,
    writerModel: "anthropic/claude-opus-5.5",
  });
}

describe(runLessonQualityGate, () => {
  it("never holds back or flags a screen for running past its length target", async () => {
    const result = await gate(
      "A rise moves the mark up the thermometer. It works the same below zero. From −3 °C, a rise of 5 degrees takes you to 2 °C. First you climb 3 degrees to reach zero. Then 2 more degrees take you above it. So a rise always adds to the temperature, whatever the sign it starts from.",
    );

    expect(result.blocking).toStrictEqual([]);
    expect(result.minor).toStrictEqual([]);
  });

  it("blocks raw math left after repair", async () => {
    const result = await gate("Then x^2 grows.");

    expect(result.blocking).toContainEqual(
      expect.objectContaining({ problem: expect.stringContaining("raw text"), screen: 4 }),
    );
  });
});
