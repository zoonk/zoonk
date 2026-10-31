import { describe, expect, it } from "vitest";
import { scoreMockPoints } from "../../exams/scoring/mock-points";
import { blueprintExtraction } from "./_test-utils/blueprint-extraction";
import { toBlueprintContent } from "./blueprint-content";
import { listBlueprintFacts } from "./blueprint-facts";
import { getMarkingPenalty } from "./marking-penalty";

const P1 = "Conhecimentos básicos (P1)";
const P2 = "Conhecimentos específicos (P2)";
const P3 = "Prova discursiva (P3)";

const LINES = {
  formula:
    "8.6 A nota final será NF = NPO/13 + NPD/4, em que NPO é a soma das notas nas provas objetivas P1 e P2 e NPD é a nota na prova discursiva P3.",
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

function extractionWith(scoring: Partial<Scoring>, written = "Prova discursiva") {
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
      subject(written, P3, LINES.p3Subject),
    ],
  };
}

function readScoring({
  keep = () => true,
  scoring,
  written,
}: {
  keep?: (id: string) => boolean;
  scoring: Partial<Scoring>;
  written?: string;
}) {
  const extraction = extractionWith(scoring, written);
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
  select: null,
  wrongPoints: 1,
};

const ROW_P2: Row = {
  format: null,
  part: "conhecimentos específicos (p2)",
  passages: cite(LINES.p2, LINES.penalty),
  points: 1.5,
  questions: 60,
  select: null,
  wrongPoints: 1.5,
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

type Share = Scoring["finalShares"][number];

const SHARE_OBJECTIVE: Share = {
  parts: [P1, "conhecimentos específicos (p2)"],
  passages: cite(LINES.formula, LINES.p1, LINES.p2),
  share: 0.5,
};

const SHARE_WRITTEN: Share = { parts: [P3], passages: cite(LINES.formula, LINES.p3), share: 0.5 };

describe("the points a notice gives", () => {
  it("keeps each row, test and minimum its passages state, by the subjects' own names", () => {
    const scoring = readScoring({ scoring: { marking: ROWS, parts: PARTS, totalMinimum: TOTAL } });

    expect(scoring?.marking).toMatchObject([
      { format: "trueFalse", part: P1, points: 1, questions: 40, wrongPoints: 1 },
      { format: null, part: P2, points: 1.5, questions: 60, wrongPoints: 1.5 },
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
      keep: (id) => !id.endsWith(".questions") && !id.endsWith(".wrongPoints"),
      scoring: { marking: ROWS },
    });

    expect(scoring?.marking).toMatchObject([
      { points: 1, questions: null, wrongPoints: null },
      { points: 1.5, questions: null, wrongPoints: null },
    ]);
  });

  it("keeps a row, test or share named by the label of the table's other column", () => {
    const other = "Prova objetiva (P1)";

    const scoring = readScoring({
      scoring: {
        finalShares: [{ ...SHARE_OBJECTIVE, parts: [other, P2] }, SHARE_WRITTEN],
        marking: [{ ...ROW_P1, part: other }],
        parts: [{ ...PART_P1, name: other, passages: cite(LINES.table, LINES.minimums) }],
      },
    });

    expect(scoring?.marking?.map((row) => row.part)).toStrictEqual([P1]);
    expect(scoring?.parts?.map((part) => part.name)).toStrictEqual([P1]);
    expect(scoring?.finalShares?.map((share) => share.parts)).toStrictEqual([[P1, P2], [P3]]);
  });

  it.each([
    { kept: [P3], name: "the same label as its group", written: P3 },
    { kept: [], name: "a label another of its names shares", written: "Redação (P3)" },
  ])("resolves a part by $name only when that label names one test", ({ kept, written }) => {
    const other = "Prova escrita (P3)";

    const scoring = readScoring({
      scoring: {
        finalShares: [{ ...SHARE_WRITTEN, parts: [other] }],
        marking: [{ ...ROW_P2, part: other, passages: cite(LINES.p3) }],
        parts: [{ ...PART_P3, name: other }],
      },
      written,
    });

    expect(scoring?.marking?.map((row) => row.part) ?? []).toStrictEqual(kept);
    expect(scoring?.parts?.map((part) => part.name) ?? []).toStrictEqual(kept);
    expect(scoring?.finalShares?.flatMap((share) => share.parts) ?? []).toStrictEqual(kept);
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

describe("the final score's formula", () => {
  it("keeps each term's tests by the subjects' own names", () => {
    const scoring = readScoring({ scoring: { finalShares: [SHARE_OBJECTIVE, SHARE_WRITTEN] } });

    expect(scoring?.finalShares).toMatchObject([
      { parts: [P1, P2], share: 0.5 },
      { parts: [P3], share: 0.5 },
    ]);
  });

  it("checks each term's share against every term's passages, since it depends on all their maximums", () => {
    const extraction = extractionWith({ finalShares: [SHARE_OBJECTIVE, SHARE_WRITTEN] });
    const facts = listBlueprintFacts({ documents: DOCUMENTS, extraction });
    const written = facts.find((fact) => fact.id === "mock.scoring.finalShares.1");

    expect(written?.citations.map((citation) => citation.passage)).toStrictEqual(
      expect.arrayContaining([LINES.formula, LINES.p1, LINES.p2, LINES.p3]),
    );
  });

  it("drops a term its passages don't support or that names no kept group or subject", () => {
    const titles = { ...SHARE_WRITTEN, parts: ["Avaliação de títulos"], share: 0.1 };

    const scoring = readScoring({
      keep: (id) => id !== "mock.scoring.finalShares.1",
      scoring: { finalShares: [SHARE_OBJECTIVE, SHARE_WRITTEN, titles] },
    });

    expect(scoring?.finalShares).toMatchObject([{ parts: [P1, P2], share: 0.5 }]);
    expect(scoring?.finalShares).toHaveLength(1);
  });

  it.each([
    { name: "add up past the whole", shares: [SHARE_OBJECTIVE, { ...SHARE_WRITTEN, share: 0.6 }] },
    { name: "name a test twice", shares: [SHARE_OBJECTIVE, { ...SHARE_WRITTEN, parts: [P1] }] },
  ])("keeps no term when they $name", ({ shares }) => {
    expect(readScoring({ scoring: { finalShares: shares } })?.finalShares).toBeUndefined();
  });
});

describe("exact point deductions", () => {
  it("checks the exact deduction and derives a repeating ratio in code", () => {
    const marking = { ...ROW_P1, points: 3, wrongPoints: 1 };
    const extraction = extractionWith({ marking: [marking] });
    const facts = listBlueprintFacts({ documents: DOCUMENTS, extraction });

    expect(
      facts.find((fact) => fact.id === "mock.scoring.marking.0.wrongPoints")?.statement,
    ).toContain("exactly 1 point");

    expect(readScoring({ scoring: { marking: [marking] } })?.marking?.[0]?.wrongPoints).toBe(1);
  });

  it("scores five right and five wrong at +3/−1 as exactly ten points", () => {
    const row = readScoring({ scoring: { marking: [{ ...ROW_P1, points: 3, wrongPoints: 1 }] } })
      ?.marking?.[0];

    const penalty = row ? getMarkingPenalty(row) : null;

    expect(penalty).toBeDefined();
    const item = { part: null, points: 3, wrongPenalty: penalty ?? 0 };

    const answers = Array.from({ length: 10 }, (_, index) => ({
      credit: index < 5 ? 1 : 0,
      marking: item,
      outcome: index < 5 ? ("right" as const) : ("wrong" as const),
    }));

    expect(
      scoreMockPoints({
        answers,
        marking: { items: {}, maxPoints: null, parts: [], totalMinimum: null },
        scope: "none",
      }).earned,
    ).toBe(10);
  });

  it("does not round an approximate deduction into an exact cited claim", () => {
    const extraction = extractionWith({ marking: [{ ...ROW_P1, points: 3, wrongPoints: 0.999 }] });
    const facts = listBlueprintFacts({ documents: DOCUMENTS, extraction });

    expect(
      facts.find((fact) => fact.id === "mock.scoring.marking.0.wrongPoints")?.statement,
    ).toContain("exactly 0.999 points");
  });
});

describe("fractional deductions at the minimum", () => {
  it.each([
    { lost: 0.333, minimum: 40, points: 1, right: 45, wrong: 15 },
    { lost: 0.666667, minimum: 40, points: 2, right: 25, wrong: 15 },
    { lost: 0.6667, minimum: 40, points: 2, right: 25, wrong: 15 },
    { lost: 0.67, minimum: 40, points: 2, right: 25, wrong: 15 },
    { lost: 0.666667, minimum: 80, points: 2, right: 45, wrong: 15 },
    { lost: 2.67, minimum: 140, points: 4, right: 45, wrong: 15 },
  ])(
    "keeps the exact boundary with $points points and a $lost deduction",
    ({ points, right, wrong, lost, minimum }) => {
      const row = readScoring({ scoring: { marking: [{ ...ROW_P1, points, wrongPoints: lost }] } })
        ?.marking?.[0];

      const penalty = row ? (getMarkingPenalty(row) ?? 0) : 0;

      const marking = { part: null, points, wrongPenalty: penalty };

      const answers = Array.from({ length: right + wrong }, (_, index) => ({
        credit: index < right ? 1 : 0,
        marking,
        outcome: index < right ? ("right" as const) : ("wrong" as const),
      }));

      const result = scoreMockPoints({
        answers,
        marking: {
          items: {},
          maxPoints: (right + wrong) * points,
          parts: [],
          totalMinimum: { unit: "points", value: minimum },
        },
        scope: "full",
      });

      expect(result).toMatchObject({ earned: minimum, met: true, short: null });
    },
  );

  it("normalizes the exam-wide share too", () => {
    expect(readScoring({ scoring: { wrongPenalty: 0.333 } })?.wrongPenalty).toBe(1 / 3);
  });

  it("retains a real small miss with a displayable shortfall", () => {
    const marking = { part: null, points: 1, wrongPenalty: 0 };

    const result = scoreMockPoints({
      answers: [{ credit: 0.999, marking, outcome: "partial" }],
      marking: { items: {}, maxPoints: 1, parts: [], totalMinimum: { unit: "points", value: 1 } },
      scope: "full",
    });

    expect(result).toMatchObject({ met: false, short: 0.01 });
  });
});

describe("stated decimal deductions", () => {
  it.each([
    { points: 5, wrongPoints: 0.4 },
    { points: 2.5, wrongPoints: 0.21 },
    { points: 10, wrongPoints: 2.45 },
  ])("stores the cited $wrongPoints deduction unchanged for $points point items", (row) => {
    const scoring = readScoring({ scoring: { marking: [{ ...ROW_P1, ...row }] } });
    expect(scoring?.marking?.[0]?.wrongPoints).toBe(row.wrongPoints);
  });
});

describe("exact exam-wide deduction digits", () => {
  it.each([0.09, 0.12, 0.23, 0.45, 0.59, 0.4, 0.21])(
    "keeps the stated %s exam-wide share without a matching fraction",
    (wrongPenalty) => {
      expect(readScoring({ scoring: { wrongPenalty } })?.wrongPenalty).toBe(wrongPenalty);
    },
  );
});
