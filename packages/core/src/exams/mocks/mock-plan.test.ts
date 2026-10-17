import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import {
  type MockCandidate,
  countPlannedQuestions,
  getPlannedItemIds,
  getWeeklyMockMinutes,
  outlineMock,
  planMock,
} from "./mock-plan";

const citation = { passage: "", sourceId: "notice" };

function structure(mock: Partial<NonNullable<ExamStructure["mock"]>>): ExamStructure {
  return {
    formats: [],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "", method: "itemResponseTheory" },
      sections: [],
      timeLimitMinutes: null,
      totalQuestions: null,
      ...mock,
    },
    rules: [],
    subjects: [{ citation, name: "Math", questions: 45, topics: [], weight: null }],
  };
}

const ENEM = structure({
  sections: [
    { day: 1, minutes: 330, name: "Languages, Humanities and essay", questions: 90 },
    { day: 2, minutes: 300, name: "Natural Sciences and Math", questions: 90 },
  ],
  totalQuestions: 180,
});

function candidates(area: string, count: number, skills = 3): MockCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    answered: false,
    area,
    difficulty: (index % 3) - 1,
    itemId: `${area}-${index}`,
    skillId: `${area}-skill-${index % skills}`,
  }));
}

const BANK = [
  ...candidates("Math", 40),
  ...candidates("Natural Sciences", 40),
  ...candidates("Humanities", 40),
  ...candidates("Languages", 40),
];

describe(planMock, () => {
  it("sits half of one exam day at the real pace, with only that day's areas", () => {
    const plan = planMock({
      adaptive: false,
      candidates: BANK,
      fullLength: false,
      mockNumber: 1,
      structure: ENEM,
    });

    expect(plan.day).toBe(2);
    expect(plan.sections).toHaveLength(1);
    expect(plan.sections[0]).toMatchObject({ minutes: 150, questions: 45 });

    const ids = plan.sections[0]?.itemIds ?? [];

    expect(ids.every((id) => id.startsWith("Math") || id.startsWith("Natural Sciences"))).toBe(
      true,
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never fills a section with another area's questions, or with questions of no known area", () => {
    const unsorted = Array.from({ length: 30 }, (_, index) => ({
      answered: false,
      area: null,
      difficulty: 0,
      itemId: `unsorted-${index}`,
      skillId: `unsorted-skill-${index % 3}`,
    }));

    const plan = planMock({
      adaptive: false,
      candidates: [...candidates("Languages", 30), ...unsorted, ...candidates("Math", 6)],
      fullLength: false,
      mockNumber: 1,
      structure: ENEM,
    });

    expect(plan.day).toBe(2);
    expect(plan.sections[0]?.name).toBe("Natural Sciences and Math");
    expect(plan.sections[0]?.itemIds).toHaveLength(6);
    expect(plan.sections[0]?.itemIds.every((id) => id.startsWith("Math"))).toBe(true);
  });

  it("sits one exam day's subjects when its section names part of each one's official name", () => {
    const enem = structure({
      sections: [
        { day: 1, minutes: 330, name: "Linguagens, Ciências Humanas e redação", questions: 90 },
        { day: 2, minutes: 300, name: "Ciências da Natureza e Matemática", questions: 90 },
      ],
      totalQuestions: 180,
    });

    const bank = [
      "Linguagens, Códigos e suas Tecnologias",
      "Ciências Humanas e suas Tecnologias",
      "Ciências da Natureza e suas Tecnologias",
      "Matemática e suas Tecnologias",
    ].flatMap((area) => candidates(area, 40));

    const [day1, day2] = [0, 1].map((mockNumber) =>
      planMock({
        adaptive: false,
        candidates: bank,
        fullLength: false,
        mockNumber,
        structure: enem,
      }),
    );

    expect(day1?.sections[0]?.name).toBe("Linguagens, Ciências Humanas e redação");
    expect(day2?.sections[0]?.name).toBe("Ciências da Natureza e Matemática");

    expect(
      day1?.sections[0]?.itemIds.every(
        (id) => id.startsWith("Linguagens") || id.includes("Humanas"),
      ),
    ).toBe(true);

    expect(
      day2?.sections[0]?.itemIds.every(
        (id) => id.includes("Natureza") || id.startsWith("Matemática"),
      ),
    ).toBe(true);
  });

  it("leaves an exam's sections unnamed when no question's area matches any of them", () => {
    const plan = planMock({
      adaptive: false,
      candidates: candidates("Reading", 20),
      fullLength: false,
      mockNumber: 1,
      structure: ENEM,
    });

    expect(plan.sections[0]).toMatchObject({ name: null, questions: 20 });
  });

  it("takes turns between exam days and sits the full day in the final stretch", () => {
    const plan = planMock({
      adaptive: false,
      candidates: BANK,
      fullLength: true,
      mockNumber: 2,
      structure: ENEM,
    });

    expect(plan.day).toBe(1);
    expect(plan.sections[0]?.questions).toBe(80);
    expect(plan.sections[0]?.minutes).toBe(Math.round((330 * 80) / 90));
  });

  it("asks questions the learner never answered first, and answered ones only for the rest, in their order", () => {
    const fresh = candidates("Math", 10);

    const answered = Array.from({ length: 50 }, (_, index) => ({
      answered: true,
      area: "Math",
      difficulty: 0,
      itemId: `answered-${index}`,
      skillId: `Math-skill-${index % 3}`,
    }));

    const plan = planMock({
      adaptive: false,
      candidates: [...answered, ...fresh],
      fullLength: false,
      mockNumber: 1,
      structure: ENEM,
    });

    expect(new Set(plan.sections[0]?.itemIds)).toStrictEqual(
      new Set([...fresh, ...answered.slice(0, 35)].map((candidate) => candidate.itemId)),
    );
  });

  it("shrinks to the questions the bank has, keeping the pace", () => {
    const plan = planMock({
      adaptive: false,
      candidates: candidates("Math", 12),
      fullLength: false,
      mockNumber: 0,
      structure: structure({ timeLimitMinutes: 60, totalQuestions: 20 }),
    });

    expect(plan).toMatchObject({ day: null, minutes: 30 });
    expect(countPlannedQuestions(plan)).toBe(10);
  });

  it("never asks a question twice when one subject's name sits inside another's", () => {
    const plan = planMock({
      adaptive: false,
      candidates: [
        ...candidates("Direito Civil", 10),
        ...candidates("Direito Processual Civil", 10),
      ],
      fullLength: true,
      mockNumber: 0,
      structure: structure({ timeLimitMinutes: 60, totalQuestions: 16 }),
      subjectShares: [
        { name: "Direito Civil", questions: 8 },
        { name: "Direito Processual Civil", questions: 8 },
      ],
    });

    const asked = plan.sections.flatMap((section) => section.itemIds);

    expect(asked).toHaveLength(16);
    expect(new Set(asked).size).toBe(16);
  });

  it("holds an adaptive exam's second module until the first is done", () => {
    const plan = planMock({
      adaptive: true,
      candidates: candidates("Math", 30),
      fullLength: true,
      mockNumber: 0,
      structure: structure({
        adaptive: true,
        sections: [
          { day: null, minutes: 35, name: "Math, module 1", questions: 10 },
          { day: null, minutes: 35, name: "Math, module 2", questions: 10 },
        ],
      }),
    });

    const [first, second] = plan.sections;

    expect(first?.itemIds).toHaveLength(10);
    expect(second?.itemIds).toStrictEqual([]);
    expect(second?.routing?.easier).toHaveLength(10);
    expect(second?.routing?.harder).toHaveLength(10);
    expect(countPlannedQuestions(plan)).toBe(20);

    const reserved = getPlannedItemIds(plan);

    expect(
      reserved.some((id) => first?.itemIds.includes(id) && second?.routing?.easier.includes(id)),
    ).toBe(false);
  });
});

describe("a mock of an exam with tools and breaks", () => {
  it("carries each section's tools and the break after it, as the notice states them", () => {
    const sat = structure({
      sections: [
        {
          breakAfterMinutes: 10,
          day: null,
          minutes: 64,
          name: "Reading and Writing",
          questions: 54,
          tools: "No calculator.",
        },
        {
          day: null,
          minutes: 70,
          name: "Math",
          questions: 44,
          tools: "Calculator allowed. Reference sheet provided.",
        },
      ],
    });

    const plan = planMock({
      adaptive: false,
      candidates: [...candidates("Reading and Writing", 60), ...candidates("Math", 50)],
      fullLength: true,
      mockNumber: 0,
      structure: sat,
    });

    expect(
      plan.sections.map(({ breakAfterMinutes, name, tools }) => ({
        breakAfterMinutes,
        name,
        tools,
      })),
    ).toStrictEqual([
      { breakAfterMinutes: 10, name: "Reading and Writing", tools: "No calculator." },
      {
        breakAfterMinutes: null,
        name: "Math",
        tools: "Calculator allowed. Reference sheet provided.",
      },
    ]);
  });
});

describe(getWeeklyMockMinutes, () => {
  it("reserves half of the first exam day on regular weeks and all of it in the final stretch", () => {
    expect(getWeeklyMockMinutes({ fullLength: false, structure: ENEM })).toBe(165);
    expect(getWeeklyMockMinutes({ fullLength: true, structure: ENEM })).toBe(330);
    expect(getWeeklyMockMinutes({ fullLength: false, structure: null })).toBe(69);
  });
});

describe(outlineMock, () => {
  it("outlines the exam day the planned mock copies", () => {
    expect(outlineMock({ day: 2, fullLength: true, structure: ENEM })).toMatchObject({
      day: 2,
      sections: [{ name: "Natural Sciences and Math", questions: 90 }],
    });
  });

  it("outlines the first exam day by default", () => {
    expect(outlineMock({ fullLength: true, structure: ENEM }).day).toBe(1);
  });
});

describe("a mock of an exam with a written test", () => {
  const essay = {
    citation,
    description:
      "Duas questões discursivas de até 20 linhas cada e uma peça técnica de até 50 linhas.",
    kind: "essay" as const,
    options: null,
  };

  const camara: ExamStructure = {
    ...structure({
      scoring: { description: "", method: "wrongCancelsRight" },
      sections: [
        { day: null, minutes: 300, name: "Provas objetivas (P1 e P2)", questions: 180 },
        {
          day: null,
          kind: "written",
          minutes: 180,
          name: "Prova discursiva (P3)",
          questions: null,
          tasks: [
            { count: 2, description: "questões discursivas de até 20 linhas" },
            { count: 1, description: "peça técnica de até 50 linhas" },
          ],
        },
      ],
    }),
    formats: [essay],
  };

  it("reserves the whole exam day for a full mock, a written test with its own time included", () => {
    expect(getWeeklyMockMinutes({ fullLength: true, structure: camara })).toBe(480);
    expect(getWeeklyMockMinutes({ fullLength: false, structure: camara })).toBe(150);
  });

  it("never fills the written test with objective questions: it lists what the notice asks", () => {
    const outline = outlineMock({ fullLength: true, structure: camara });

    // The objective tests keep the notice's one time for both: 5 hours, not a pace per question.
    expect(
      outline.sections.map((section) => [section.name, section.questions, section.minutes]),
    ).toStrictEqual([["Provas objetivas (P1 e P2)", 180, 300]]);

    expect(outline.written).toStrictEqual([
      {
        asked: false,
        minutes: 180,
        name: "Prova discursiva (P3)",
        tasks: [
          { count: 2, description: "questões discursivas de até 20 linhas" },
          { count: 1, description: "peça técnica de até 50 linhas" },
        ],
      },
    ]);

    const planned = planMock({
      adaptive: false,
      candidates: candidates("Língua Portuguesa", 200, 10),
      fullLength: false,
      mockNumber: 0,
      structure: camara,
    });

    expect(countPlannedQuestions(planned)).toBe(90);
    expect(planned.written).toStrictEqual([]);
  });

  it("sits the written test with the exam's essays, on its own clock, in a full mock", () => {
    const essays = ["e1", "e2", "e3", "e4"].map((itemId) => ({ area: "Prova Discursiva", itemId }));

    const full = planMock({
      adaptive: false,
      candidates: candidates("Língua Portuguesa", 200, 10),
      essays,
      fullLength: true,
      mockNumber: 0,
      structure: camara,
    });

    // Two discursive questions and a legal brief: three essays, in the afternoon's 180 minutes.
    expect(
      full.sections.map((section) => [
        section.name,
        section.questions,
        section.minutes,
        section.essays,
      ]),
    ).toStrictEqual([
      ["Provas objetivas (P1 e P2)", 180, 300, []],
      ["Prova discursiva (P3)", 0, 180, ["e1", "e2", "e3"]],
    ]);

    expect(full.minutes).toBe(480);

    expect(full.written.map(({ asked, name }) => ({ asked, name }))).toStrictEqual([
      { asked: true, name: "Prova discursiva (P3)" },
    ]);

    const half = planMock({
      adaptive: false,
      candidates: candidates("Língua Portuguesa", 200, 10),
      essays,
      fullLength: false,
      mockNumber: 0,
      structure: camara,
    });

    expect(half.sections.flatMap((section) => section.essays)).toStrictEqual([]);
  });

  it("asks an essay the day's section names on that section's clock, its essay first", () => {
    const enem: ExamStructure = {
      ...ENEM,
      formats: [{ ...essay, description: "Redação dissertativo-argumentativa" }],
      mock: ENEM.mock && {
        ...ENEM.mock,
        sections: [
          { day: 1, minutes: 330, name: "Linguagens, Ciências Humanas e redação", questions: 90 },
          { day: 2, minutes: 300, name: "Ciências da Natureza e Matemática", questions: 90 },
        ],
      },
      subjects: [
        ...ENEM.subjects,
        { citation, name: "Redação", questions: null, topics: [], weight: null },
      ],
    };

    const day1 = planMock({
      adaptive: false,
      candidates: candidates("Languages", 120),
      essays: [
        { area: "Interpretação de texto", itemId: "other" },
        { area: "Redação", itemId: "redacao" },
      ],
      fullLength: true,
      mockNumber: 0,
      structure: enem,
    });

    expect(day1.sections).toHaveLength(1);
    expect(day1.sections[0]).toMatchObject({ essays: ["redacao"], minutes: 330, questions: 90 });

    expect(day1.written.map(({ asked, name }) => ({ asked, name }))).toStrictEqual([
      { asked: true, name: "Redação" },
    ]);

    // Without an essay for it, the essay part is left out and listed, and the clock stays the day's.
    const without = planMock({
      adaptive: false,
      candidates: candidates("Languages", 120),
      fullLength: true,
      mockNumber: 0,
      structure: enem,
    });

    expect(without.sections[0]).toMatchObject({ essays: [], minutes: 330 });

    expect(without.written.map(({ asked, name }) => ({ asked, name }))).toStrictEqual([
      { asked: false, name: "Redação" },
    ]);
  });

  it("reads a written test in an older reading by its name and the notice's essay format", () => {
    const older: ExamStructure = {
      ...camara,
      mock: camara.mock && {
        ...camara.mock,
        sections: camara.mock.sections.map(({ kind: _kind, tasks: _tasks, ...section }) => section),
      },
    };

    const outline = outlineMock({ fullLength: true, structure: older });

    expect(countPlannedQuestions(outline)).toBe(180);

    expect(outline.written.map((part) => part.tasks)).toStrictEqual([
      [{ count: null, description: essay.description }],
    ]);
  });
});
