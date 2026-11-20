import { describe, expect, it } from "vitest";
import { estimateMockMinutes } from "./mock-estimate";

const ENEM_DAY = { minutes: 330, pace: 2, questions: 90, sections: [{ questions: 90 }] };
const ESSAY = { asked: false, minutes: null, name: "Redação", tasks: [] };

describe(estimateMockMinutes, () => {
  it("estimates a full mock that leaves its essay out by learners' pace", () => {
    expect(estimateMockMinutes({ ...ENEM_DAY, written: [ESSAY] })).toBe(180);
  });

  it("gives the time limit when the mock asks a written part", () => {
    expect(estimateMockMinutes({ ...ENEM_DAY, written: [{ ...ESSAY, asked: true }] })).toBe(330);
  });

  it("gives the time limit when a section asks no questions, as a speaking task", () => {
    const sections = [{ questions: 90 }, { questions: 0 }];
    expect(estimateMockMinutes({ ...ENEM_DAY, sections, written: [] })).toBe(330);
  });

  it("gives the time limit until there's a pace", () => {
    expect(estimateMockMinutes({ ...ENEM_DAY, pace: null, written: [] })).toBe(330);
  });
});
