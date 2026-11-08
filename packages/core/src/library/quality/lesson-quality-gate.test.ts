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
    reuse: "bounded",
    review: false,
    writerModel: "anthropic/claude-opus-5.5",
  });
}

describe(runLessonQualityGate, () => {
  it("keeps length advisory on the first draft", async () => {
    const result = await gate(
      `A rise ${"always moves the mark up the thermometer ".repeat(25)}even below zero.`,
    );

    expect(result.blocking).toStrictEqual([]);
    expect(result.minor).toContainEqual(expect.objectContaining({ screen: 4 }));
  });

  it("blocks raw math left after repair", async () => {
    const result = await gate("Then x^2 grows.");

    expect(result.blocking).toContainEqual(
      expect.objectContaining({ problem: expect.stringContaining("raw text"), screen: 4 }),
    );
  });
});
