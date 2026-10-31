import { type ItemFormat } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { type ExamStructure, type MarkingRow } from "../../library/exams/blueprint-contract";
import { markPlannedItems } from "../mocks/mock-marking";
import { type MockMarking } from "../mocks/mock-points-contract";
import { type PointsAnswer, scoreMockPoints } from "./mock-points";
import { type NetOutcome } from "./net-score";

type Scoring = NonNullable<ExamStructure["mock"]>["scoring"];

const citation = { passage: "", sourceId: "notice" };

function subject(name: string, group: string | null, questions: number | null) {
  return { citation, group, name, questions, topics: [], weight: null };
}

function examStructure({
  scoring,
  subjects,
  totalQuestions = null,
}: {
  scoring: Partial<Scoring>;
  subjects: ExamStructure["subjects"];
  totalQuestions?: number | null;
}): ExamStructure {
  return {
    formats: [],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "", method: "wrongCancelsRight", ...scoring },
      sections: [],
      timeLimitMinutes: null,
      totalQuestions,
    },
    rules: [],
    subjects,
  };
}

function row(
  name: string | null,
  points: number,
  extra: { format?: MarkingRow["format"]; questions?: number; wrongPoints?: number } = {},
) {
  return {
    citation,
    format: extra.format ?? null,
    part: name,
    points,
    questions: extra.questions ?? null,
    wrongPoints: extra.wrongPoints ?? null,
  };
}

function part(
  name: string,
  extra: Partial<{
    maxPoints: number;
    minimum: { unit: "percent" | "points"; value: number };
    qualifying: boolean;
    questions: number;
  }> = {},
) {
  return {
    citation,
    maxPoints: extra.maxPoints ?? null,
    minimum: extra.minimum ?? null,
    name,
    qualifying: extra.qualifying ?? false,
    questions: extra.questions ?? null,
  };
}

type Planned = { area: string; count: number; format?: ItemFormat };

function plannedItems(planned: Planned[]) {
  return planned.flatMap(({ area, count, format = "trueFalse" }) =>
    Array.from({ length: count }, (_, index) => ({
      area,
      itemFormat: format,
      itemId: `${area}:${format}:${index}`,
    })),
  );
}

function markItems({
  items,
  structure,
}: {
  items: ReturnType<typeof plannedItems>;
  structure: ExamStructure;
}) {
  const plan = {
    day: null,
    fullLength: true,
    minutes: 0,
    reused: 0,
    sections: [
      {
        essays: [],
        itemIds: items.map((item) => item.itemId),
        minutes: 1,
        name: null,
        questions: items.length,
        routing: null,
      },
    ],
    written: [],
  };

  return markPlannedItems({ candidates: items, plan, structure })?.marking ?? null;
}

function mark({ planned, structure }: { planned: Planned[]; structure: ExamStructure }) {
  const marking = markItems({ items: plannedItems(planned), structure });

  if (!marking) {
    throw new Error("Expected the exam to be scored in points");
  }

  return marking;
}

type Outcomes = Partial<Record<NetOutcome, number>>;

/** Answers an area's items in order: the rights first, then the wrongs, then the blanks. */
function answer({
  area,
  marking,
  outcomes,
}: {
  area: string;
  marking: MockMarking;
  outcomes: Outcomes;
}): PointsAnswer[] {
  const items = Object.entries(marking.items).filter(([itemId]) => itemId.startsWith(`${area}:`));

  const sequence = (["right", "wrong", "blank"] as const).flatMap((outcome) =>
    Array.from({ length: outcomes[outcome] ?? 0 }, () => outcome),
  );

  return items.map(([, item], index) => {
    const outcome = sequence[index] ?? "blank";
    return { credit: outcome === "right" ? 1 : 0, marking: item, outcome };
  });
}

const CGU = examStructure({
  scoring: {
    marking: [
      row("P1", 1, { questions: 40 }),
      row("P2", 1, { questions: 40 }),
      row("P3", 2, { questions: 90 }),
    ],
    parts: [
      part("P1", { minimum: { unit: "points", value: 8 } }),
      part("P2", { minimum: { unit: "points", value: 12 } }),
      part("P3", { minimum: { unit: "points", value: 54 } }),
      part("P4", { maxPoints: 100, minimum: { unit: "points", value: 50 } }),
    ],
    totalMinimum: { citation, unit: "points", value: 78 },
    wrongPenalty: 1,
  },
  subjects: [
    subject("Língua Portuguesa", "P1", 40),
    subject("Auditoria Governamental", "P2", 40),
    subject("Contabilidade Pública", "P3", 90),
    subject("Prova discursiva", "P4", null),
  ],
});

const CGU_FULL: Planned[] = [
  { area: "Língua Portuguesa", count: 40 },
  { area: "Auditoria Governamental", count: 40 },
  { area: "Contabilidade Pública", count: 90 },
];

describe("a certo/errado exam whose third test counts double", () => {
  const marking = mark({ planned: CGU_FULL, structure: CGU });

  const answers = [
    ...answer({ area: "Língua Portuguesa", marking, outcomes: { right: 10, wrong: 4 } }),
    ...answer({ area: "Auditoria Governamental", marking, outcomes: { right: 20 } }),
    ...answer({ area: "Contabilidade Pública", marking, outcomes: { right: 50, wrong: 10 } }),
  ];

  const points = scoreMockPoints({ answers, marking, scope: "full" });

  it("gives each P3 item 2 points and takes 2 away for each wrong one", () => {
    expect(marking.items["Contabilidade Pública:trueFalse:0"]).toStrictEqual({
      part: "P3",
      points: 2,
      wrongPenalty: 1,
    });

    expect(points.parts.find((item) => item.name === "P3")).toMatchObject({
      asked: 180,
      earned: 80,
      max: 180,
      met: true,
    });
  });

  it("eliminates the learner when P1 ends 2 points short of its minimum of 8", () => {
    expect(points.parts.find((item) => item.name === "P1")).toMatchObject({
      earned: 6,
      met: false,
      minimum: { unit: "points", value: 8 },
      short: 2,
    });
  });

  it("adds the three objective tests up against their minimum of 78 out of 260", () => {
    expect(points).toMatchObject({ asked: 260, earned: 106, max: 260, met: true, projected: null });
  });

  it("lists the written test's minimum as not checked here", () => {
    expect(points.unjudged).toStrictEqual([{ minimum: { unit: "points", value: 50 }, name: "P4" }]);

    expect(points.parts.map((item) => item.name)).toStrictEqual(["P1", "P2", "P3"]);
  });

  it("can go below zero when wrong answers outweigh the right ones", () => {
    const wrong = [
      ...answer({ area: "Língua Portuguesa", marking, outcomes: { right: 5, wrong: 15 } }),
      ...answer({ area: "Auditoria Governamental", marking, outcomes: { wrong: 3 } }),
      ...answer({ area: "Contabilidade Pública", marking, outcomes: { right: 2, wrong: 6 } }),
    ];

    expect(scoreMockPoints({ answers: wrong, marking, scope: "full" })).toMatchObject({
      earned: -21,
      met: false,
      short: 99,
    });
  });
});

describe("a half mock", () => {
  const marking = mark({
    planned: [
      { area: "Língua Portuguesa", count: 20 },
      { area: "Auditoria Governamental", count: 20 },
      { area: "Contabilidade Pública", count: 45 },
    ],
    structure: CGU,
  });

  const points = scoreMockPoints({
    answers: [
      ...answer({ area: "Língua Portuguesa", marking, outcomes: { right: 3 } }),
      ...answer({ area: "Auditoria Governamental", marking, outcomes: { right: 10 } }),
      ...answer({ area: "Contabilidade Pública", marking, outcomes: { right: 30 } }),
    ],
    marking,
    scope: "half",
  });

  it("projects each test onto its whole length without a verdict", () => {
    expect(points.parts.find((item) => item.name === "P1")).toMatchObject({
      asked: 20,
      earned: 3,
      max: 40,
      met: null,
      minimum: { unit: "points", value: 8 },
      projected: 6,
      short: null,
    });
  });

  it("projects the total from each test's projection", () => {
    expect(points).toMatchObject({ earned: 73, max: 260, met: null, projected: 146 });
  });

  it("gives no verdict for a full mock that asked fewer questions than the test has", () => {
    const short = scoreMockPoints({
      answers: answer({ area: "Língua Portuguesa", marking, outcomes: { right: 3 } }),
      marking,
      scope: "full",
    });

    expect(short.parts[0]).toMatchObject({ met: null, projected: 6 });
    expect(short.unjudged.map((item) => item.name)).toStrictEqual(["P2", "P3", "P4", null]);
  });
});

describe("an exam scored by question type", () => {
  const structure = examStructure({
    scoring: {
      marking: [
        row(null, 3, { format: "multipleChoice", wrongPoints: 1 }),
        row(null, 4, { format: "numeric", wrongPoints: 0 }),
      ],
    },
    subjects: [subject("Physics", "Paper 1", null)],
  });

  const marking = mark({
    planned: [
      { area: "Physics", count: 2, format: "multipleChoice" },
      { area: "Physics", count: 2, format: "numeric" },
    ],
    structure,
  });

  it("scores each format by its own row: +3/−1 for choices, +4/0 for numbers", () => {
    const answers = Object.entries(marking.items).map(([itemId, item]) => {
      const outcome: NetOutcome = itemId.endsWith(":0") ? "right" : "wrong";
      return { credit: outcome === "right" ? 1 : 0, marking: item, outcome };
    });

    expect(scoreMockPoints({ answers, marking, scope: "full" })).toMatchObject({
      asked: 14,
      earned: 6,
    });
  });
});

function sectionAPoints(marking: MockMarking): number[] {
  return Object.values(marking.items)
    .filter((item) => item.part === "Section A")
    .map((item) => item.points);
}

describe("a section mixing 1-point and 2-point questions", () => {
  const structure = examStructure({
    scoring: {
      marking: [
        row("Section A", 1, { format: "multipleChoice", questions: 10, wrongPoints: 1 / 3 }),
        row("Section A", 2, { format: "multipleChoice", questions: 20, wrongPoints: 2 / 3 }),
        row("Section B", 2, { questions: 10, wrongPoints: 0 }),
      ],
      parts: [part("Section A"), part("Section B")],
    },
    subjects: [subject("Mathematics", "Section A", 30), subject("Statistics", "Section B", 10)],
  });

  it("gives the first 10 questions 1 point and the next 20 2 points, in the notice's order", () => {
    const marking = mark({
      planned: [
        { area: "Mathematics", count: 30, format: "multipleChoice" },
        { area: "Statistics", count: 10, format: "numeric" },
      ],
      structure,
    });

    expect(sectionAPoints(marking)).toStrictEqual([
      ...Array.from({ length: 10 }, () => 1),
      ...Array.from({ length: 20 }, () => 2),
    ]);

    expect(marking.maxPoints).toBe(70);
  });

  it("keeps the notice's mix in a mock that asks half the questions", () => {
    const marking = mark({
      planned: [{ area: "Mathematics", count: 15, format: "multipleChoice" }],
      structure,
    });

    expect(sectionAPoints(marking)).toStrictEqual([
      ...Array.from({ length: 5 }, () => 1),
      ...Array.from({ length: 10 }, () => 2),
    ]);
  });
});

describe("an exam with a qualifying paper", () => {
  const structure = examStructure({
    scoring: {
      marking: [
        row("General Studies Paper I", 2, { questions: 100, wrongPoints: 2 / 3 }),
        row("CSAT Paper II", 2.5, { questions: 80, wrongPoints: 2.5 / 3 }),
      ],
      parts: [
        part("General Studies Paper I", { maxPoints: 200 }),
        part("CSAT Paper II", {
          maxPoints: 200,
          minimum: { unit: "percent", value: 33 },
          qualifying: true,
        }),
      ],
    },
    subjects: [
      subject("Indian Polity", "General Studies Paper I", null),
      subject("Comprehension", "CSAT Paper II", null),
    ],
  });

  const marking = mark({
    planned: [
      { area: "Indian Polity", count: 100, format: "multipleChoice" },
      { area: "Comprehension", count: 80, format: "multipleChoice" },
    ],
    structure,
  });

  const score = (csat: Outcomes) =>
    scoreMockPoints({
      answers: [
        ...answer({ area: "Indian Polity", marking, outcomes: { right: 60, wrong: 30 } }),
        ...answer({ area: "Comprehension", marking, outcomes: csat }),
      ],
      marking,
      scope: "full",
    });

  it("leaves the qualifying paper out of the total", () => {
    expect(score({ right: 30 })).toMatchObject({ asked: 200, earned: 100, max: 200 });
  });

  it("judges the qualifying paper against 33% of its points", () => {
    expect(score({ right: 30 }).parts[1]).toMatchObject({
      earned: 75,
      met: true,
      qualifying: true,
    });

    const below = score({ right: 25, wrong: 3 }).parts[1];

    expect(below).toMatchObject({ earned: 60, met: false, short: 3 });
  });
});

describe("an exam passed with 40 of its 80 points", () => {
  const structure = examStructure({
    scoring: { method: "raw", totalMinimum: { citation, unit: "points", value: 40 } },
    subjects: [subject("Ética Profissional", null, 80)],
    totalQuestions: 80,
  });

  const marking = mark({
    planned: [{ area: "Ética Profissional", count: 80, format: "multipleChoice" }],
    structure,
  });

  const score = (right: number) =>
    scoreMockPoints({
      answers: answer({
        area: "Ética Profissional",
        marking,
        outcomes: { right, wrong: 80 - right },
      }),
      marking,
      scope: "full",
    });

  it("meets the minimum at exactly 40", () => {
    expect(score(40)).toMatchObject({ earned: 40, max: 80, met: true, short: null });
  });

  it("misses it by one point at 39", () => {
    expect(score(39)).toMatchObject({ earned: 39, met: false, short: 1 });
  });
});

describe("a minimum this mock can't put in its unit", () => {
  const structure = examStructure({
    scoring: {
      parts: [
        part("Paper 1", { minimum: { unit: "points", value: 30 } }),
        part("Paper 2", { minimum: { unit: "percent", value: 40 } }),
      ],
      wrongPenalty: 0,
    },
    subjects: [subject("Geometry", "Paper 1", null), subject("Algebra", "Paper 2", null)],
  });

  const marking = mark({
    planned: [
      { area: "Geometry", count: 10, format: "multipleChoice" },
      { area: "Algebra", count: 10, format: "multipleChoice" },
    ],
    structure,
  });

  const answers = [
    ...answer({ area: "Geometry", marking, outcomes: { right: 5 } }),
    ...answer({ area: "Algebra", marking, outcomes: { right: 5 } }),
  ];

  it("projects no points for a test whose maximum the notice doesn't give", () => {
    const [paper1, paper2] = scoreMockPoints({ answers, marking, scope: "half" }).parts;

    expect(paper1).toMatchObject({ met: null, projected: null });
    expect(paper2).toMatchObject({ met: null, projected: null });
  });

  it("leaves a percent minimum unjudged without a known paper size", () => {
    const [, paper2] = scoreMockPoints({ answers, marking, scope: "full" }).parts;
    expect(paper2).toMatchObject({ earned: 5, met: null });
  });
});

describe("mocks that judge nothing", () => {
  it("only adds up the points of a one-subject or placement mock", () => {
    const marking = mark({ planned: CGU_FULL, structure: CGU });

    const points = scoreMockPoints({
      answers: answer({ area: "Contabilidade Pública", marking, outcomes: { right: 10 } }),
      marking,
      scope: "none",
    });

    expect(points).toStrictEqual({
      asked: 180,
      earned: 20,
      max: null,
      met: null,
      minimum: null,
      parts: [],
      projected: null,
      short: null,
      unjudged: [],
    });
  });

  it.each(["itemResponseTheory", "scaled", "other"] as const)(
    "gives a %s exam no points",
    (method) => {
      const structure = examStructure({
        scoring: { marking: [row(null, 2)], method },
        subjects: [subject("Matemática", null, 45)],
      });

      expect(
        markItems({ items: plannedItems([{ area: "Matemática", count: 5 }]), structure }),
      ).toBeNull();
    },
  );
});

describe("incomplete notice evidence", () => {
  it("judges an unlisted paper when all subject counts are known", () => {
    const structure = examStructure({
      scoring: {
        parts: [part("P1", { maxPoints: 40 })],
        totalMinimum: { citation, unit: "points", value: 50 },
      },
      subjects: [subject("A", "P1", 40), subject("B", "P2", 40)],
    });

    const marking = mark({
      planned: [
        { area: "A", count: 40 },
        { area: "B", count: 40 },
      ],
      structure,
    });

    const result = scoreMockPoints({
      answers: Object.values(marking.items).map((item) => ({
        credit: 1,
        marking: item,
        outcome: "right",
      })),
      marking,
      scope: "full",
    });

    expect(result.earned).toBe(80);
    expect(result).toMatchObject({ max: 80, met: true });
    expect(result.unjudged).toStrictEqual([]);
  });

  it("does not judge an unknown-length paper", () => {
    const structure = examStructure({
      scoring: { parts: [part("P1", { minimum: { unit: "points", value: 30 } })] },
      subjects: [subject("A", "P1", null)],
    });

    const marking = mark({ planned: [{ area: "A", count: 10 }], structure });

    const result = scoreMockPoints({
      answers: Object.values(marking.items).map((item) => ({
        credit: 1,
        marking: item,
        outcome: "right",
      })),
      marking,
      scope: "full",
    });

    expect(result.parts[0]?.met).toBeNull();
    expect(result.unjudged).toContainEqual({ minimum: { unit: "points", value: 30 }, name: "P1" });
  });
});

describe("selection marking", () => {
  it("matches single and multiple selection marking regardless of item order", () => {
    const structure = examStructure({
      scoring: {
        marking: [
          {
            ...row(null, 3, { format: "multipleChoice", questions: 2, wrongPoints: 1 }),
            select: 1,
          },
          {
            ...row(null, 4, { format: "multipleChoice", questions: 2, wrongPoints: 2 }),
            select: "all",
          },
        ],
      },
      subjects: [subject("Physics", null, 4)],
    });

    const items = [
      {
        area: "Physics",
        format: "picks:all",
        itemFormat: "multipleChoice" as const,
        itemId: "multi",
      },
      {
        area: "Physics",
        format: "choice",
        itemFormat: "multipleChoice" as const,
        itemId: "single",
      },
    ];

    expect(markItems({ items, structure })?.items).toStrictEqual({
      multi: { part: "Physics", points: 4, wrongPenalty: 0.5 },
      single: { part: "Physics", points: 3, wrongPenalty: 1 / 3 },
    });
  });
});

describe("conflicting whole-paper evidence", () => {
  it("derives each item's points from a paper maximum and count", () => {
    const structure = examStructure({
      scoring: {
        parts: [
          part("P1", { maxPoints: 20, minimum: { unit: "points", value: 15 }, questions: 10 }),
        ],
      },
      subjects: [subject("A", "P1", 10)],
    });

    const marking = mark({ planned: [{ area: "A", count: 10 }], structure });

    const result = scoreMockPoints({
      answers: Object.values(marking.items).map((item) => ({
        credit: 1,
        marking: item,
        outcome: "right",
      })),
      marking,
      scope: "full",
    });

    expect(result.parts[0]).toMatchObject({ asked: 20, earned: 20, met: true, projected: null });
  });

  it("leaves the total unjudged when an unlisted paper has no bank questions", () => {
    const structure = examStructure({
      scoring: {
        parts: [part("P1", { maxPoints: 40 })],
        totalMinimum: { citation, unit: "points", value: 50 },
      },
      subjects: [subject("A", "P1", 40), subject("B", "P2", null)],
    });

    const marking = mark({ planned: [{ area: "A", count: 40 }], structure });

    const result = scoreMockPoints({
      answers: Object.values(marking.items).map((item) => ({
        credit: 1,
        marking: item,
        outcome: "right",
      })),
      marking,
      scope: "full",
    });

    expect(result).toMatchObject({ max: null, met: null });
    expect(result.unjudged).toContainEqual({ minimum: { unit: "points", value: 50 }, name: null });
  });
});

describe("whole papers with known counts", () => {
  it("includes a whole paper without a known maximum when summing half-mock projections", () => {
    const marking: MockMarking = {
      items: {},
      maxPoints: null,
      parts: [
        {
          maxPoints: null,
          minimum: null,
          name: "A",
          objective: true,
          qualifying: false,
          questions: 2,
        },
        {
          maxPoints: 4,
          minimum: null,
          name: "B",
          objective: true,
          qualifying: false,
          questions: 2,
        },
      ],
      totalMinimum: { unit: "points", value: 4 },
    };

    const answers: PointsAnswer[] = ["A", "A", "B"].map((name) => ({
      credit: 1,
      marking: { part: name, points: 2, wrongPenalty: 0 },
      outcome: "right",
    }));

    const result = scoreMockPoints({ answers, marking, scope: "half" });
    expect(result.projected).toBe(8);
    expect(result.parts[0]).not.toHaveProperty("whole");
  });
});

describe("real percentage misses", () => {
  it("fails 299.75 points out of 500 against a 60 percent minimum", () => {
    const marking = { part: null, points: 1, wrongPenalty: 0.25 };

    const answers: PointsAnswer[] = [
      ...Array.from({ length: 320 }, () => ({ credit: 1, marking, outcome: "right" as const })),
      ...Array.from({ length: 81 }, () => ({ credit: 0, marking, outcome: "wrong" as const })),
      ...Array.from({ length: 99 }, () => ({ credit: 0, marking, outcome: "blank" as const })),
    ];

    const result = scoreMockPoints({
      answers,
      marking: {
        items: {},
        maxPoints: 500,
        parts: [],
        totalMinimum: { unit: "percent", value: 60 },
      },
      scope: "full",
    });

    expect(result).toMatchObject({ earned: 299.75, met: false });
    expect(result.short).toBeGreaterThanOrEqual(0.1);
  });
});
