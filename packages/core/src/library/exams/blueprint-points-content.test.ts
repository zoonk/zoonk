import { describe, expect, it } from "vitest";
import { blueprintExtraction } from "./_test-utils/blueprint-extraction";
import { toBlueprintContent } from "./blueprint-content";
import { listBlueprintFacts } from "./blueprint-facts";

const P1 = "Conhecimentos básicos (P1)";
const P2 = "Conhecimentos específicos (P2)";
const P3 = "Prova discursiva (P3)";

const LINES = {
  minimums:
    "8.2 Será eliminado o candidato que obtiver nota inferior a 10,00 pontos na P1 ou inferior a 30,00 pontos na P2.",
  p1: "8.1 A prova objetiva P1 terá 40 itens, valendo 1,00 ponto cada.",
  p1Subject: "P1 Conhecimentos básicos: Língua Portuguesa.",
  p2: "8.1 A prova objetiva P2 terá 60 itens, valendo 1,50 ponto cada.",
  p2Subject: "P2 Conhecimentos específicos: Auditoria.",
  p3: "8.3 A prova discursiva P3 valerá 40,00 pontos, e será eliminado o candidato que obtiver nota inferior a 20,00 pontos.",
  p3Subject: "P3 Prova discursiva.",
  penalty: "8.4 Cada item marcado em desacordo com o gabarito anula um item marcado corretamente.",
  syllabus: "CONHECIMENTOS BÁSICOS: LÍNGUA PORTUGUESA: 1 Compreensão de textos.",
  table: "| Prova objetiva (P1) | Conhecimentos básicos | 40 itens |",
  total:
    "8.5 Será eliminado o candidato que obtiver menos de 50,00 pontos no conjunto das provas objetivas.",
};

const DOCUMENTS = [{ sourceId: "notice", text: Object.values(LINES).join("\n") }];

const cite = (...passages: string[]) => passages.map((passage) => ({ document: 1, passage }));

function subject(name: string, group: string, passage: string) {
  return {
    choiceGroup: null,
    group,
    matrix: [],
    name,
    partOf: null,
    passages: cite(passage),
    questions: null,
    shortName: name,
    topicHeadings: [],
    topics: [],
    weight: null,
  };
}

type Scoring = NonNullable<ReturnType<typeof blueprintExtraction>["mock"]>["scoring"];

function extractionWith(scoring: Partial<Scoring>) {
  const base = blueprintExtraction();

  return {
    ...base,
    mock: base.mock && {
      ...base.mock,
      passages: cite(LINES.penalty),
      scoring: { ...base.mock.scoring, method: "wrongCancelsRight" as const, ...scoring },
    },
    subjects: [
      subject("Língua Portuguesa", P1, LINES.p1Subject),
      subject("Auditoria", P2, LINES.p2Subject),
      subject("Prova discursiva", P3, LINES.p3Subject),
    ],
  };
}

function readScoring({
  keep = () => true,
  scoring,
}: {
  keep?: (id: string) => boolean;
  scoring: Partial<Scoring>;
}) {
  const extraction = extractionWith(scoring);
  const facts = listBlueprintFacts({ documents: DOCUMENTS, extraction });

  return toBlueprintContent({
    documents: DOCUMENTS,
    extraction,
    facts,
    noticeUrl: null,
    sourceHash: "hash",
    supportedIds: facts.map((fact) => fact.id).filter((id) => keep(id)),
  }).structure.mock?.scoring;
}

type Row = Scoring["marking"][number];
type Part = Scoring["parts"][number];

const ROW_P1: Row = {
  format: "trueFalse",
  part: P1,
  passages: cite(LINES.p1, LINES.penalty),
  points: 1,
  questions: 40,
  wrongPenalty: 1,
};

const ROW_P2: Row = {
  format: null,
  part: "conhecimentos específicos (p2)",
  passages: cite(LINES.p2, LINES.penalty),
  points: 1.5,
  questions: 60,
  wrongPenalty: 1,
};

const ROWS = [ROW_P1, ROW_P2];

const PART_P1: Part = {
  maxPoints: null,
  minimum: { unit: "points", value: 10 },
  name: P1,
  passages: cite(LINES.minimums),
  qualifying: false,
  questions: null,
};

const PART_P2: Part = {
  maxPoints: 90,
  minimum: { unit: "points", value: 30 },
  name: P2,
  passages: cite(LINES.p2, LINES.minimums),
  qualifying: false,
  questions: 60,
};

const PART_P3: Part = {
  maxPoints: 40,
  minimum: { unit: "points", value: 20 },
  name: P3,
  passages: cite(LINES.p3),
  qualifying: false,
  questions: null,
};

const PARTS = [PART_P1, PART_P2, PART_P3];

const TOTAL = { passages: cite(LINES.total), unit: "points" as const, value: 50 };

describe("the points a notice gives", () => {
  it("keeps each row, test and minimum its passages state, by the subjects' own names", () => {
    const scoring = readScoring({ scoring: { marking: ROWS, parts: PARTS, totalMinimum: TOTAL } });

    expect(scoring?.marking).toMatchObject([
      { format: "trueFalse", part: P1, points: 1, questions: 40, wrongPenalty: 1 },
      { format: null, part: P2, points: 1.5, questions: 60, wrongPenalty: 1 },
    ]);

    expect(scoring?.parts).toMatchObject([
      { maxPoints: null, minimum: { unit: "points", value: 10 }, name: P1, qualifying: false },
      { maxPoints: 90, minimum: { unit: "points", value: 30 }, name: P2, questions: 60 },
      { maxPoints: 40, minimum: { unit: "points", value: 20 }, name: P3 },
    ]);

    expect(scoring?.totalMinimum).toMatchObject({ unit: "points", value: 50 });
  });

  it("keeps a row without the count or penalty its passages don't support", () => {
    const scoring = readScoring({
      keep: (id) => !id.endsWith(".questions") && !id.endsWith(".wrongPenalty"),
      scoring: { marking: ROWS },
    });

    expect(scoring?.marking).toMatchObject([
      { points: 1, questions: null, wrongPenalty: null },
      { points: 1.5, questions: null, wrongPenalty: null },
    ]);
  });

  it("drops a row or test whose name is no kept group or subject", () => {
    const scoring = readScoring({
      scoring: {
        marking: [{ ...ROW_P1, part: "P9" }, ROW_P2],
        parts: [{ ...PART_P1, name: "P9" }, PART_P2, PART_P3],
      },
    });

    expect(scoring?.marking?.map((row) => row.part)).toStrictEqual([P2]);
    expect(scoring?.parts?.map((part) => part.name)).toStrictEqual([P2, P3]);
  });

  it("drops a minimum above its test's maximum or over 100%, and a test with nothing left", () => {
    const scoring = readScoring({
      scoring: {
        marking: ROWS,
        parts: [
          { ...PART_P1, minimum: { unit: "points", value: 41 } },
          { ...PART_P2, minimum: { unit: "percent", value: 120 } },
          { ...PART_P3, maxPoints: null, minimum: null },
        ],
      },
    });

    expect(scoring?.parts).toMatchObject([
      { maxPoints: 90, minimum: null, name: P2, questions: 60 },
    ]);

    expect(scoring?.parts).toHaveLength(1);
  });

  it("drops a test, a row or a minimum whose passage the check didn't support", () => {
    const scoring = readScoring({
      keep: (id) => id !== "mock.scoring.parts.1.minimum" && id !== "mock.scoring.marking.0",
      scoring: { marking: ROWS, parts: PARTS, totalMinimum: TOTAL },
    });

    expect(scoring?.marking?.map((row) => row.part)).toStrictEqual([P2]);
    expect(scoring?.parts?.[1]).toMatchObject({ maxPoints: 90, minimum: null, name: P2 });
  });

  it("drops a total minimum over 100%", () => {
    const scoring = readScoring({
      scoring: { totalMinimum: { ...TOTAL, unit: "percent", value: 150 } },
    });

    expect(scoring?.totalMinimum).toBeUndefined();
  });

  it("keeps the scoring method its points rows state when the mock's own passages don't", () => {
    const unstated = extractionWith({});
    const stated = extractionWith({ marking: ROWS });

    const methodOf = (extraction: ReturnType<typeof extractionWith>) => {
      const mock = extraction.mock && { ...extraction.mock, passages: [] };

      const facts = listBlueprintFacts({
        documents: DOCUMENTS,
        extraction: { ...extraction, mock },
      });

      return toBlueprintContent({
        documents: DOCUMENTS,
        extraction: { ...extraction, mock },
        facts,
        noticeUrl: null,
        sourceHash: "hash",
        supportedIds: facts.map((fact) => fact.id),
      }).structure.mock?.scoring.method;
    };

    expect(methodOf(unstated)).not.toBe("wrongCancelsRight");
    expect(methodOf(stated)).toBe("wrongCancelsRight");
  });

  it("checks a test's count against the passages that name the test, not only its own", () => {
    const extraction = extractionWith({ parts: [{ ...PART_P2, passages: cite(LINES.minimums) }] });
    const facts = listBlueprintFacts({ documents: DOCUMENTS, extraction });
    const count = facts.find((fact) => fact.id === "mock.scoring.parts.0.questions");

    expect(count?.citations.map((citation) => citation.passage)).toContain(LINES.p2Subject);
  });

  it("checks a subject's part against the line that labels the part, not only its syllabus heading", () => {
    const base = extractionWith({ parts: [{ ...PART_P1, passages: cite(LINES.table) }] });
    const [first, ...rest] = base.subjects;
    const subjects = first ? [{ ...first, passages: cite(LINES.syllabus) }, ...rest] : rest;
    const facts = listBlueprintFacts({ documents: DOCUMENTS, extraction: { ...base, subjects } });
    const group = facts.find((fact) => fact.id === "subjects.0.group");

    expect(group?.citations.map((citation) => citation.passage)).toStrictEqual([
      LINES.syllabus,
      LINES.table,
    ]);
  });

  it("keeps a test that only has to reach its minimum", () => {
    const scoring = readScoring({
      scoring: { parts: [{ ...PART_P3, maxPoints: null, qualifying: true }] },
    });

    expect(scoring?.parts).toMatchObject([{ name: P3, qualifying: true }]);
  });
});
