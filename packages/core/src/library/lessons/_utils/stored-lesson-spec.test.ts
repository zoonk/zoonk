import { describe, expect, it } from "vitest";
import { parseStoredLessonSpec } from "./stored-lesson-spec";

const moment = "Lia runs up the stairs and her legs burn. Where does the energy come from?";

function savedSpec(hook: Record<string, unknown>) {
  return {
    canDo: "Explain where a cell's energy comes from",
    description: "Glycolysis from the class slides.",
    estimatedMinutes: 3,
    screens: [
      { activityTemplate: null, brief: moment, kind: "hook", skills: [], visual: null, ...hook },
      {
        activityTemplate: null,
        brief: "Glucose splits.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description: "Glucose splits in two.",
        example: "2 ATP net",
        hard: false,
        name: "Explain glycolysis",
        topic: "Glycolysis",
        useCase: "A test",
      },
    ],
    title: "Glycolysis",
  };
}

describe(parseStoredLessonSpec, () => {
  it("reads a saved scene's visual as planned, and a plan saved before visual kinds as text only", () => {
    const [legacy, bare, table] = [{}, { visualKind: "none" }, { visualKind: "table" }].map(
      (hook) => parseStoredLessonSpec(savedSpec(hook))?.screens,
    );

    expect([legacy?.[0]?.visualKind, legacy?.[0]?.visual]).toStrictEqual(["none", null]);
    expect([bare?.[0]?.visualKind, bare?.[0]?.visual]).toStrictEqual(["none", null]);
    expect([table?.[0]?.visualKind, table?.[0]?.visual]).toStrictEqual(["table", null]);
    expect(legacy?.[1]?.visualKind).toBe("none");
  });
});
