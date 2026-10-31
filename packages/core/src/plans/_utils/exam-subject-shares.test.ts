import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type PlanGraph } from "../planner/plan-state";
import { getAreaShares, getExamSubjectShares } from "./exam-subject-shares";

const citation = { passage: "passage", sourceId: "source" };

function subject(name: string, questions: number | null): ExamStructure["subjects"][number] {
  return { citation, name, questions, topics: [], weight: null };
}

function graphOf(areas: string[]): PlanGraph {
  return {
    phases: [{ milestone: null, name: "Everything" }],
    skills: areas.map((area, index) => ({
      area,
      lessons: 4,
      name: `Skill ${index}`,
      phase: 0,
      skillId: `skill-${index}`,
      weight: 3,
    })),
  };
}

const enem: ExamStructure = {
  formats: [],
  mock: null,
  rules: [],
  subjects: [
    subject("Linguagens", 45),
    subject("Ciências Humanas", 45),
    subject("Ciências da Natureza", 45),
    subject("Matemática", 45),
    subject("Redação", null),
  ],
};

describe(getExamSubjectShares, () => {
  it("gives a subject without a count (the essay) an average subject's share", () => {
    const shares = getExamSubjectShares({
      graph: graphOf([
        "Linguagens",
        "Ciências Humanas",
        "Ciências da Natureza",
        "Matemática",
        "Redação",
        "Estratégia de prova",
      ]),
      structure: enem,
    });

    expect(shares).toStrictEqual([
      { areas: ["Linguagens"], share: 0.25 },
      { areas: ["Ciências Humanas"], share: 0.25 },
      { areas: ["Ciências da Natureza"], share: 0.25 },
      { areas: ["Matemática"], share: 0.25 },
      { areas: ["Redação"], share: 0.25 },
    ]);
  });

  it("leaves subjects the plan doesn't teach out, and plans that don't follow the notice", () => {
    expect(
      getExamSubjectShares({ graph: graphOf(["Matemática", "Linguagens"]), structure: enem }),
    ).toStrictEqual([
      { areas: ["Linguagens"], share: 0.25 },
      { areas: ["Matemática"], share: 0.25 },
    ]);

    expect(
      getExamSubjectShares({
        graph: graphOf(["Ecologia", "Eletricidade", "Funções", "Matemática"]),
        structure: enem,
      }),
    ).toBeNull();
  });
});

describe(getAreaShares, () => {
  it("gives each area its subject's share when the notice states most of them", () => {
    const shares = getAreaShares({
      graph: graphOf(["Linguagens", "Ciências da Natureza", "Redação", "Estratégia de prova"]),
      structure: enem,
    });

    expect(shares).toStrictEqual(
      new Map([
        ["Linguagens", 0.25],
        ["Ciências da Natureza", 0.25],
        ["Redação", 0.25],
      ]),
    );
  });

  it("gives an area named by a subject's short name that subject's share", () => {
    const oab: ExamStructure = {
      formats: [],
      mock: null,
      rules: [],
      subjects: [
        {
          ...subject("Estatuto da Advocacia e da OAB e Código de Ética e Disciplina da OAB", 8),
          shortName: "Ética Profissional",
        },
        subject("Filosofia do Direito", 2),
      ],
    };

    expect(
      getAreaShares({
        graph: graphOf(["Ética Profissional", "Filosofia do Direito"]),
        structure: oab,
      }),
    ).toStrictEqual(
      new Map([
        ["Ética Profissional", 0.8],
        ["Filosofia do Direito", 0.2],
      ]),
    );
  });

  it("gives a written test the latest edition counts no questions for an average share", () => {
    const counted: ExamStructure = {
      ...enem,
      pastQuestions: {
        checkedAt: "2026-10-06T23:33:30.244Z",
        edition: "2025",
        source: null,
        subjects: [
          { name: "Linguagens", questions: 45 },
          { name: "Ciências Humanas", questions: 45 },
          { name: "Ciências da Natureza", questions: 45 },
          { name: "Matemática", questions: 45 },
          { name: "Redação", questions: 0 },
        ],
      },
      subjects: enem.subjects.map((item) => ({ ...item, questions: null })),
    };

    const shares = getAreaShares({
      graph: graphOf(["Linguagens", "Matemática", "Redação"]),
      structure: counted,
    });

    expect(shares?.get("Redação")).toBe(shares?.get("Matemática"));
  });

  it("says nothing when the notice states few subjects' shares", () => {
    const unstated: ExamStructure = {
      ...enem,
      subjects: enem.subjects.map((item, index) => ({
        ...item,
        questions: index === 0 ? 45 : null,
      })),
    };

    expect(
      getAreaShares({
        graph: graphOf(["Linguagens", "Ciências Humanas", "Ciências da Natureza"]),
        structure: unstated,
      }),
    ).toBeNull();
  });
});

describe("a qualifying test in the plan", () => {
  const prelims: ExamStructure = {
    formats: [],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: {
        description: "",
        marking: [
          {
            citation,
            format: null,
            part: "General Studies",
            points: 2,
            questions: 100,
            wrongPoints: null,
          },
          { citation, format: null, part: "CSAT", points: 2.5, questions: 80, wrongPoints: null },
        ],
        method: "wrongCancelsRight",
        parts: [
          {
            citation,
            maxPoints: 200,
            minimum: null,
            name: "General Studies",
            qualifying: false,
            questions: 100,
          },
          {
            citation,
            maxPoints: 200,
            minimum: { unit: "percent", value: 33 },
            name: "CSAT",
            qualifying: true,
            questions: 80,
          },
        ],
      },
      sections: [],
      timeLimitMinutes: null,
      totalQuestions: null,
    },
    rules: [],
    subjects: [subject("General Studies", 100), subject("CSAT", 80)],
  };

  const graph = graphOf(["General Studies", "CSAT"]);

  it("gives the area what passing takes, 33% of the half its points would have", () => {
    const shares = getAreaShares({ graph, structure: prelims });

    expect(shares?.get("CSAT")).toBeCloseTo(0.165);
    expect(shares?.get("General Studies")).toBeCloseTo(0.835);
  });

  it("counts it in the share of the exam the plan covers", () => {
    const shares = getExamSubjectShares({ graph, structure: prelims });

    expect(shares?.map((item) => item.areas)).toStrictEqual([["General Studies"], ["CSAT"]]);
    expect(shares?.[1]?.share).toBeCloseTo(0.165);
  });
});
