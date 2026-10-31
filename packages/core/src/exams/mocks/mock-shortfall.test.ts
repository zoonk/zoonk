import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type MockFormat, ONE_PICK_MIX, getMockFormatMix } from "./mock-format-mix";
import { type MockCandidate, type MockPlan } from "./mock-plan";
import { getMockQuestionsShortfall } from "./mock-shortfall";

function numbers(sections: string[]): MockFormat {
  return {
    key: "numeric:fraction:",
    sections,
    share: 1,
    style: "numeric: Type a number",
    writer: {
      answerFormat: {
        entry: { kind: "fraction", places: null },
        format: "numeric",
        options: null,
        select: null,
      },
      kind: "item",
    },
  };
}

describe(getMockQuestionsShortfall, () => {
  it("falls back to all skills only when none resolve for that format", () => {
    const structure = {
      formats: [
        {
          citation: { passage: "", sourceId: "notice" },
          description: "Choose",
          kind: "multipleChoice",
          options: 5,
          sections: ["Verbal"],
        },
        {
          citation: { passage: "", sourceId: "notice" },
          description: "Number",
          kind: "numeric",
          options: null,
          sections: ["Quantitative"],
        },
      ],
      mock: null,
      rules: [],
      subjects: [],
    } as ExamStructure;

    const writes = getMockQuestionsShortfall({
      candidates: [],
      mix: getMockFormatMix(structure),
      option: { questions: 8 },
      plan: {
        day: null,
        formatsWanted: { "choice:5": 4, "numeric:number:": 4 },
        fullLength: true,
        minutes: 8,
        reused: 0,
        sections: [],
        written: [],
      },
      skills: [
        { area: "Quantitative", id: "quant" },
        { area: "Algebra", id: "unresolved" },
        { area: "Verbal", id: "verbal" },
      ],
      structure,
    });

    expect(
      writes.map((write) => ({ key: write.format.key, skills: write.skillIds })),
    ).toStrictEqual([
      { key: "choice:5", skills: ["verbal"] },
      { key: "numeric:number:", skills: ["quant"] },
    ]);
  });

  it("writes a fresh mock when no skill area resolves to a format scope", () => {
    const structure = {
      formats: [
        {
          citation: { passage: "", sourceId: "notice" },
          description: "Choose",
          kind: "multipleChoice",
          options: 5,
          sections: ["Verbal"],
        },
        {
          citation: { passage: "", sourceId: "notice" },
          description: "Number",
          kind: "numeric",
          options: null,
          sections: ["Quantitative"],
        },
      ],
      mock: null,
      rules: [],
      subjects: [],
    } as ExamStructure;

    const writes = getMockQuestionsShortfall({
      candidates: [],
      mix: getMockFormatMix(structure),
      option: { questions: 8 },
      plan: {
        day: null,
        formatsWanted: { "choice:5": 4, "numeric:number:": 4 },
        fullLength: true,
        minutes: 8,
        reused: 0,
        sections: [],
        written: [],
      },
      skills: [
        { area: "Algebra", id: "algebra" },
        { area: "Reading", id: "reading" },
      ],
      structure,
    });

    expect(
      writes.map((write) => ({ key: write.format.key, skills: write.skillIds })),
    ).toStrictEqual([
      { key: "choice:5", skills: ["algebra", "reading"] },
      { key: "numeric:number:", skills: ["algebra", "reading"] },
    ]);
  });

  it("requests enough fresh items for both routes", () => {
    const candidates: MockCandidate[] = Array.from({ length: 4 }, (_, index) => ({
      answered: false,
      area: null,
      difficulty: index,
      itemFormat: "trueFalse" as const,
      itemId: String(index),
      skillId: "skill",
    }));

    const plan: MockPlan = {
      day: null,
      formatsWanted: { choice: 8 },
      fullLength: true,
      minutes: 10,
      reused: 0,
      sections: [
        {
          essays: [],
          itemIds: [],
          minutes: 10,
          name: null,
          questions: 2,
          routing: { easier: ["0", "1"], harder: ["2", "3"] },
        },
      ],
      written: [],
    };

    expect(
      getMockQuestionsShortfall({
        candidates,
        mix: ONE_PICK_MIX,
        option: { questions: 4 },
        plan,
        skills: [{ area: null, id: "skill" }],
        structure: null,
      }),
    ).toStrictEqual([
      { format: ONE_PICK_MIX[0], questionsPerSkill: 4, skillIds: ["skill"], target: 8 },
    ]);
  });

  it("writes numbers for the skills of the parts that ask them, and untied numbers only where some exist", () => {
    const plan: MockPlan = {
      day: null,
      formatsWanted: { "numeric:fraction:": 4 },
      fullLength: true,
      minutes: 10,
      reused: 0,
      sections: [],
      written: [],
    };

    const skills = [
      { area: "Verbal Reasoning", id: "words" },
      { area: "Quantitative Reasoning", id: "ratios" },
      { area: "Quantitative Reasoning", id: "charts", isQuantitative: false },
    ];

    const shortfall = (format: MockFormat) =>
      getMockQuestionsShortfall({
        candidates: [],
        mix: [format],
        option: { questions: 4 },
        plan,
        skills,
        structure: {
          formats: [
            {
              citation: { passage: "", sourceId: "notice" },
              description: "Type a number",
              entry: { kind: "fraction", places: null },
              kind: "numeric",
              options: null,
              sections: format.sections,
            },
            {
              citation: { passage: "", sourceId: "notice" },
              description: "Choose",
              kind: "multipleChoice",
              options: 5,
              sections: ["Verbal Reasoning"],
            },
          ],
          mock: null,
          rules: [],
          subjects: [],
        },
      }).flatMap((write) => write.skillIds);

    expect(shortfall(numbers(["Quantitative Reasoning"]))).toStrictEqual(["ratios"]);
    expect(shortfall(numbers([]))).toStrictEqual([]);
  });
});
