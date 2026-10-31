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
  it("writes a format only for the skills of the subjects that ask it", () => {
    const citation = { passage: "", sourceId: "notice" };
    const subjects = ["Physics", "Mathematics"];

    const structure: ExamStructure = {
      formats: [
        { citation, description: "Choose one", kind: "multipleChoice", options: 4 },
        {
          citation,
          description: "Type a number",
          kind: "numeric",
          options: null,
          sections: ["Mathematics"],
        },
      ],
      mock: null,
      rules: [],
      subjects: subjects.map((name) => ({
        citation,
        name,
        questions: 6,
        topics: [],
        weight: null,
      })),
    };

    const writes = getMockQuestionsShortfall({
      candidates: [],
      mix: getMockFormatMix(structure),
      option: { questions: 6 },
      plan: {
        day: null,
        formatsWanted: { "choice:4": 3, "numeric:number:": 3 },
        fullLength: true,
        minutes: 6,
        reused: 0,
        sections: [],
        written: [],
      },
      skills: subjects.map((area) => ({ area, id: area })),
      structure,
    });

    expect(writes.map(({ format, skillIds }) => ({ key: format.key, skillIds }))).toStrictEqual([
      { key: "choice:4", skillIds: ["Physics", "Mathematics"] },
      { key: "numeric:number:", skillIds: ["Mathematics"] },
    ]);
  });

  it("writes a paper's format only for the subjects grouped under that paper", () => {
    const citation = { passage: "", sourceId: "notice" };

    const structure: ExamStructure = {
      formats: [
        { citation, description: "Choose one", kind: "multipleChoice", options: 4 },
        {
          citation,
          description: "Type a number",
          kind: "numeric",
          options: null,
          sections: ["Paper 2"],
        },
      ],
      mock: {
        adaptive: false,
        citations: [],
        order: null,
        scoring: { description: "", method: "raw" },
        sections: ["Paper 1", "Paper 2"].map((name) => ({
          day: null,
          kind: "objective" as const,
          minutes: 60,
          name,
          questions: 6,
        })),
        timeLimitMinutes: null,
        totalQuestions: null,
      },
      rules: [],
      subjects: [
        { citation, group: "Paper 1", name: "History", questions: 6, topics: [], weight: null },
        { citation, group: "Paper 2", name: "Mathematics", questions: 6, topics: [], weight: null },
      ],
    };

    const writes = getMockQuestionsShortfall({
      candidates: [],
      mix: getMockFormatMix(structure),
      option: { questions: 12 },
      plan: {
        day: null,
        formatsWanted: { "choice:4": 9, "numeric:number:": 3 },
        fullLength: true,
        minutes: 120,
        reused: 0,
        sections: [],
        written: [],
      },
      skills: ["History", "Mathematics"].map((area) => ({ area, id: area })),
      structure,
    });

    expect(writes.map(({ format, skillIds }) => ({ key: format.key, skillIds }))).toStrictEqual([
      { key: "choice:4", skillIds: ["History", "Mathematics"] },
      { key: "numeric:number:", skillIds: ["Mathematics"] },
    ]);
  });

  it("writes the exam's formats for the skills of a section the notice ties none to", () => {
    const citation = { passage: "", sourceId: "notice" };
    const subjects = ["Verbal", "Quantitative"];

    const structure: ExamStructure = {
      formats: [
        {
          citation,
          description: "Choose one",
          kind: "multipleChoice",
          options: 5,
          sections: ["Verbal"],
        },
      ],
      mock: {
        adaptive: false,
        citations: [],
        order: null,
        scoring: { description: "", method: "raw" },
        sections: subjects.map((name) => ({
          day: null,
          kind: "objective" as const,
          minutes: 6,
          name,
          questions: 6,
        })),
        timeLimitMinutes: null,
        totalQuestions: null,
      },
      rules: [],
      subjects: subjects.map((name) => ({
        citation,
        name,
        questions: 6,
        topics: [],
        weight: null,
      })),
    };

    const writes = getMockQuestionsShortfall({
      candidates: [],
      mix: getMockFormatMix(structure),
      option: { questions: 12 },
      plan: {
        day: null,
        formatsWanted: { "choice:5": 12 },
        fullLength: true,
        minutes: 12,
        reused: 0,
        sections: [],
        written: [],
      },
      skills: subjects.map((area) => ({ area, id: area })),
      structure,
    });

    expect(writes.flatMap((write) => write.skillIds)).toStrictEqual(["Verbal", "Quantitative"]);
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
          subjects: ["Verbal Reasoning", "Quantitative Reasoning"].map((name) => ({
            citation: { passage: "", sourceId: "notice" },
            name,
            questions: 6,
            topics: [],
            weight: null,
          })),
        },
      }).flatMap((write) => write.skillIds);

    expect(shortfall(numbers(["Quantitative Reasoning"]))).toStrictEqual(["ratios"]);
    expect(shortfall(numbers([]))).toStrictEqual([]);
  });
});
