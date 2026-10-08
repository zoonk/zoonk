import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { planOptionMock } from "./mock-option-plan";
import { listMockOptions } from "./mock-options";
import { type MockCandidate, countPlannedQuestions } from "./mock-plan";
import { getMockQuestionsShortfall } from "./mock-shortfall";

const CITATION = { passage: "From the notice.", sourceId: "source" };

function subject(name: string, questions: number | null, shortName: string | null = null) {
  return { citation: CITATION, name, questions, shortName, topics: [], weight: null };
}

/** ENEM's shape: two days of 90 questions, the first with the redação as a written part. */
const TWO_DAYS: ExamStructure = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "", method: "itemResponseTheory" },
    sections: [
      { day: 1, minutes: 330, name: "Linguagens, Ciências Humanas e redação", questions: 90 },
      { day: 1, kind: "written", minutes: null, name: "Redação", questions: null },
      { day: 2, minutes: 300, name: "Ciências da Natureza e Matemática", questions: 90 },
    ],
    timeLimitMinutes: null,
    totalQuestions: 180,
  },
  rules: [],
  subjects: [
    subject("Linguagens, Códigos e suas Tecnologias", 45, "Linguagens"),
    subject("Ciências Humanas e suas Tecnologias", 45, "Ciências Humanas"),
    subject("Ciências da Natureza e suas Tecnologias", 45, "Ciências da Natureza"),
    subject("Matemática e suas Tecnologias", 45, "Matemática"),
    subject("Redação", null),
  ],
};

const GOAL_AREAS = ["Linguagens", "Ciências Humanas", "Ciências da Natureza", "Matemática"];

function candidates(area: string, count: number): MockCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    area,
    difficulty: null,
    itemId: `${area}-${index}`,
    skillId: `${area}-skill-${index % 3}`,
  }));
}

describe(listMockOptions, () => {
  it("offers each exam day in full, half of the day in turn and each objective subject", () => {
    const options = listMockOptions({ dayInTurn: 2, goalAreas: GOAL_AREAS, structure: TWO_DAYS });

    expect(
      options.map(({ area, day, kind, minutes, questions }) => ({
        area,
        day,
        kind,
        minutes,
        questions,
      })),
    ).toStrictEqual([
      { area: null, day: 1, kind: "full", minutes: 330, questions: 90 },
      { area: null, day: 2, kind: "full", minutes: 300, questions: 90 },
      { area: null, day: 2, kind: "half", minutes: 150, questions: 45 },
      {
        area: "Linguagens, Códigos e suas Tecnologias",
        day: null,
        kind: "area",
        minutes: 165,
        questions: 45,
      },
      {
        area: "Ciências Humanas e suas Tecnologias",
        day: null,
        kind: "area",
        minutes: 165,
        questions: 45,
      },
      {
        area: "Ciências da Natureza e suas Tecnologias",
        day: null,
        kind: "area",
        minutes: 150,
        questions: 45,
      },
      {
        area: "Matemática e suas Tecnologias",
        day: null,
        kind: "area",
        minutes: 150,
        questions: 45,
      },
    ]);
  });

  it("names each day's subjects and says when it leaves the written part out", () => {
    const [first, second] = listMockOptions({
      dayInTurn: 1,
      goalAreas: GOAL_AREAS,
      structure: TWO_DAYS,
    });

    expect(first).toMatchObject({ areas: ["Linguagens", "Ciências Humanas"], objectiveOnly: true });

    expect(second).toMatchObject({
      areas: ["Ciências da Natureza", "Matemática"],
      objectiveOnly: false,
    });
  });

  it("knows the written part a day's section names, when the notice lists it only as a subject", () => {
    const sections = (TWO_DAYS.mock?.sections ?? []).filter(
      (section) => section.kind !== "written",
    );

    const mock = TWO_DAYS.mock && { ...TWO_DAYS.mock, sections };

    const [first, second] = listMockOptions({
      dayInTurn: 1,
      goalAreas: GOAL_AREAS,
      structure: { ...TWO_DAYS, mock },
    });

    expect(first?.objectiveOnly).toBe(true);
    expect(second?.objectiveOnly).toBe(false);
  });

  it("leaves out subjects the plan has no questions for, and subjects of too few questions", () => {
    const options = listMockOptions({
      dayInTurn: null,
      goalAreas: ["Matemática", "Linguagens"],
      structure: { ...TWO_DAYS, subjects: [...TWO_DAYS.subjects, subject("Linguagens extra", 3)] },
    });

    expect(
      options.filter((option) => option.kind === "area").map((option) => option.areas),
    ).toStrictEqual([["Linguagens"], ["Matemática"]]);
  });

  it("sizes a class test's mocks to the short test it copies", () => {
    const classTest: ExamStructure = {
      formats: [],
      mock: {
        adaptive: false,
        citations: [],
        order: null,
        scoring: { description: "", method: "raw" },
        sections: [],
        timeLimitMinutes: 30,
        totalQuestions: 10,
      },
      rules: [],
      subjects: [subject("Cell membrane", null)],
    };

    const options = listMockOptions({
      dayInTurn: null,
      goalAreas: ["Cell membrane"],
      structure: classTest,
    });

    expect(
      options.map(({ kind, minutes, questions }) => ({ kind, minutes, questions })),
    ).toStrictEqual([
      { kind: "full", minutes: 30, questions: 10 },
      { kind: "half", minutes: 15, questions: 5 },
    ]);
  });
});

describe(planOptionMock, () => {
  const bank = [
    ...candidates("Linguagens", 30),
    ...candidates("Ciências Humanas", 30),
    ...candidates("Matemática", 50),
    ...candidates("Ciências da Natureza", 50),
  ];

  it("asks a subject's mock only that subject's questions", () => {
    const options = listMockOptions({
      dayInTurn: null,
      goalAreas: GOAL_AREAS,
      structure: TWO_DAYS,
    });

    const math = options.find((option) => option.areas[0] === "Matemática");

    if (!math) {
      throw new Error("Expected a math option");
    }

    const plan = planOptionMock({ candidates: bank, option: math, structure: TWO_DAYS });

    expect(plan.sections).toHaveLength(1);
    expect(plan.sections[0]?.name).toBe("Matemática");
    expect(plan.sections[0]?.itemIds).toHaveLength(45);
    expect(plan.sections[0]?.itemIds.every((id) => id.startsWith("Matemática"))).toBe(true);
  });

  it("asks each of a day's subjects its share, by the plan's full area names, never the redação", () => {
    const [, dayTwo] = listMockOptions({
      dayInTurn: null,
      goalAreas: GOAL_AREAS,
      structure: TWO_DAYS,
    });

    if (!dayTwo) {
      throw new Error("Expected day two");
    }

    const fullNames = [
      ...candidates("Ciências da Natureza e suas Tecnologias", 80),
      ...candidates("Matemática e suas Tecnologias", 60),
      ...candidates("Redação", 10),
    ];

    const plan = planOptionMock({ candidates: fullNames, option: dayTwo, structure: TWO_DAYS });
    const asked = plan.sections.flatMap((section) => section.itemIds);
    const count = (prefix: string) => asked.filter((id) => id.startsWith(prefix)).length;

    expect(plan.sections[0]?.name).toBe("Ciências da Natureza e Matemática");
    expect(count("Ciências da Natureza")).toBe(45);
    expect(count("Matemática")).toBe(45);
    expect(count("Redação")).toBe(0);
  });

  it("asks the day an exam day's mock copies", () => {
    const [, dayTwo] = listMockOptions({
      dayInTurn: null,
      goalAreas: GOAL_AREAS,
      structure: TWO_DAYS,
    });

    if (!dayTwo) {
      throw new Error("Expected day two");
    }

    const plan = planOptionMock({ candidates: bank, option: dayTwo, structure: TWO_DAYS });

    expect(plan.day).toBe(2);
    expect(countPlannedQuestions(plan)).toBe(90);
  });
});

describe(getMockQuestionsShortfall, () => {
  const [, dayTwo] = listMockOptions({
    dayInTurn: null,
    goalAreas: GOAL_AREAS,
    structure: TWO_DAYS,
  });

  const skillIds = ["Matemática-skill-0", "Matemática-skill-1", "Matemática-skill-2"];

  function shortfall(bank: MockCandidate[]) {
    if (!dayTwo) {
      throw new Error("Expected day two");
    }

    return getMockQuestionsShortfall({
      candidates: bank,
      option: dayTwo,
      planned: countPlannedQuestions(
        planOptionMock({ candidates: bank, option: dayTwo, structure: TWO_DAYS }),
      ),
      skillIds,
    });
  }

  it("asks for each skill's share when the bank is short of the mock's questions", () => {
    expect(shortfall(candidates("Matemática", 9))).toStrictEqual({
      questionsPerSkill: 15,
      skillIds,
    });
  });

  it("asks for nothing when the bank holds the mock's questions", () => {
    expect(
      shortfall([...candidates("Matemática", 45), ...candidates("Ciências da Natureza", 45)]),
    ).toBeNull();
  });
});
