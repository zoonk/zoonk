import { describe, expect, it } from "vitest";
import { getSectionPlace } from "./mock-place";

const question = { format: "multipleChoice" as const };
const essay = { format: "essay" as const };

describe(getSectionPlace, () => {
  it("counts the question's place among its section's questions", () => {
    const questions = [question, question, question];

    expect(getSectionPlace({ position: 0, questions })).toStrictEqual({ number: 1, total: 3 });
    expect(getSectionPlace({ position: 2, questions })).toStrictEqual({ number: 3, total: 3 });
  });

  it("leaves a written part's essay out of the count, and names it instead", () => {
    const questions = [question, question, essay];

    expect(getSectionPlace({ position: 1, questions })).toStrictEqual({ number: 2, total: 2 });
    expect(getSectionPlace({ position: 2, questions })).toBeNull();
  });

  it("says nothing past the section's questions", () => {
    expect(getSectionPlace({ position: 1, questions: [question] })).toBeNull();
  });
});
