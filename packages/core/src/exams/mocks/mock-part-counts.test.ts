import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { planOptionMock } from "./mock-option-plan";
import { listMockOptions } from "./mock-options";
import { type MockCandidate } from "./mock-plan";
import { getMockSizeSource } from "./mock-size-source";

const citation = { passage: "From the notice.", sourceId: "notice" };

const TESTS = {
  P1: ["Língua Portuguesa", "Ética", "Raciocínio Lógico", "Legislação"],
  P2: ["Auditoria", "Controle Interno", "Contabilidade", "Finanças", "Economia"],
  P3: ["Direito Administrativo", "Direito Constitucional", "Correição", "Ouvidoria", "TI"],
} as const;

type Scoring = NonNullable<ExamStructure["mock"]>["scoring"];

function part(name: string, questions: number) {
  return { citation, maxPoints: null, minimum: null, name, qualifying: false, questions };
}

function structureWith({
  questions = () => null,
  scoring,
}: {
  questions?: (name: string) => number | null;
  scoring: Partial<Scoring>;
}): ExamStructure {
  return {
    formats: [],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "", method: "wrongCancelsRight", ...scoring },
      sections: [
        { day: null, kind: "objective", minutes: 480, name: "Provas objetivas", questions: 170 },
      ],
      timeLimitMinutes: 480,
      totalQuestions: 170,
    },
    rules: [],
    subjects: Object.entries(TESTS)
      .flatMap(([group, names]) =>
        names.map((name) => ({ citation, group, name, questions: questions(name), topics: [] })),
      )
      .map((subject) => ({ ...subject, weight: null })),
  };
}

const BY_PARTS = structureWith({
  scoring: { parts: [part("P1", 40), part("P2", 40), part("P3", 90)] },
});

const BANK: MockCandidate[] = Object.values(TESTS).flatMap((names) =>
  names.flatMap((name) =>
    Array.from({ length: 30 }, (_, index) => ({
      answered: false,
      area: name,
      difficulty: null,
      itemFormat: "trueFalse" as const,
      itemId: `${name}#${index}`,
      skillId: `${name}-skill-${index % 3}`,
    })),
  ),
);

function planFullMock(structure: ExamStructure): string[] {
  const subjects = Object.values(TESTS).flat();
  const [full] = listMockOptions({ dayInTurn: null, goalAreas: subjects, structure });
  const plan = full ? planOptionMock({ candidates: BANK, option: full, structure }) : null;
  return (plan?.sections ?? []).flatMap((section) => section.itemIds);
}

function countByTest(structure: ExamStructure) {
  const asked = planFullMock(structure);

  return Object.fromEntries(
    Object.entries(TESTS).map(([group, names]) => [
      group,
      asked.filter((id) => names.some((name) => id.startsWith(`${name}#`))).length,
    ]),
  );
}

describe("a notice that counts its tests' questions, not its subjects'", () => {
  it("gives each test its stated count, split among its subjects", () => {
    expect(countByTest(BY_PARTS)).toStrictEqual({ P1: 40, P2: 40, P3: 90 });
  });

  it("reads a test's count from its points rows too", () => {
    const byRows = structureWith({
      scoring: {
        marking: [
          { citation, format: null, part: "P1", points: 1, questions: 40, wrongPenalty: null },
          { citation, format: null, part: "P2", points: 1, questions: 40, wrongPenalty: null },
          { citation, format: null, part: "P3", points: 2, questions: 90, wrongPenalty: null },
        ],
      },
    });

    expect(countByTest(byRows)).toStrictEqual({ P1: 40, P2: 40, P3: 90 });
  });

  it("keeps a subject's own count and splits the rest of its test among the others", () => {
    const counted = structureWith({
      questions: (name) => (name === "Língua Portuguesa" ? 16 : null),
      scoring: { parts: [part("P1", 40), part("P2", 40), part("P3", 90)] },
    });

    const asked = planFullMock(counted);

    expect(asked.filter((id) => id.startsWith("Língua Portuguesa#"))).toHaveLength(16);
    expect(asked.filter((id) => id.startsWith("Ética#"))).toHaveLength(8);
  });

  it("tells the learner the counts come from the notice", () => {
    expect(
      getMockSizeSource({ noticeQuestions: 170, ownerId: null, structure: BY_PARTS }).subjects,
    ).toBe("notice");

    expect(
      getMockSizeSource({
        noticeQuestions: 170,
        ownerId: null,
        structure: structureWith({ scoring: {} }),
      }).subjects,
    ).toBe("even");
  });
});
