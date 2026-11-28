import { type DomainShareFinding } from "@zoonk/ai/tasks/research/find-domain-shares";
import { describe, expect, it } from "vitest";
import { type BlueprintContent } from "./blueprint-contract";
import { applyDomainShares, listShareSubjects } from "./domain-shares";

type Row = { heading: string; max: number; min: number };

const MATH: Row[] = [
  { heading: "Algebra", max: 35, min: 35 },
  { heading: "Advanced Math", max: 35, min: 35 },
  { heading: "Problem-Solving and Data Analysis", max: 15, min: 15 },
  { heading: "Geometry and Trigonometry", max: 15, min: 15 },
];

const MECHANICAL: Row[] = [
  { heading: "Mathematics", max: 9, min: 6 },
  { heading: "Statics", max: 14, min: 9 },
  { heading: "Thermodynamics", max: 15, min: 10 },
];

const CIVIL: Row[] = [
  { heading: "Mathematics", max: 12, min: 8 },
  { heading: "Statics", max: 17, min: 11 },
  { heading: "Surveying", max: 9, min: 6 },
];

function percentLine(row: Row): string {
  return `${row.heading} ≈${row.min}% of the section's questions`;
}

function countLine(row: Row, index: number): string {
  return `${index + 1}. ${row.heading} ${row.min}–${row.max}`;
}

const documents = [
  { sourceId: "spec", text: MATH.map((row) => percentLine(row)).join("\n") },
  {
    sourceId: "mechanical",
    text: MECHANICAL.map((row, index) => countLine(row, index)).join("\n"),
  },
  { sourceId: "civil", text: CIVIL.map((row, index) => countLine(row, index)).join("\n") },
];

function subject(name: string, headings: string[], questions: number | null = null) {
  return {
    citation: { passage: name, sourceId: "spec" },
    name,
    questions,
    topicGroups: headings.map((heading) => ({ name: heading, topics: [`${heading} topic`] })),
    topics: headings.map((heading) => `${heading} topic`),
    weight: null,
  };
}

function content(subjects: BlueprintContent["structure"]["subjects"]): BlueprintContent {
  return {
    edition: {
      check: null,
      citations: [],
      dates: [],
      noticeUrl: null,
      questionCount: null,
      sourceHash: "hash",
      timeZone: null,
      year: null,
    },
    structure: { formats: [], mock: null, rules: [], subjects },
    topicFrequency: [],
  };
}

function percentFindings(rows: Row[]): DomainShareFinding[] {
  return rows.map((row) => ({
    basis: "questions",
    document: 1,
    heading: row.heading,
    passage: percentLine(row),
    percent: { max: row.max, min: row.min },
    questions: null,
    subject: 1,
  }));
}

function countFindings({
  document,
  rows,
  subjectNumber,
}: {
  document: number;
  rows: Row[];
  subjectNumber: number;
}): DomainShareFinding[] {
  return rows.map((row, index) => ({
    basis: "questions",
    document,
    heading: row.heading,
    passage: countLine(row, index),
    percent: null,
    questions: { max: row.max, min: row.min },
    subject: subjectNumber,
  }));
}

function finding(heading: string, percent: number, passage: string): DomainShareFinding {
  return {
    basis: "questions",
    document: 1,
    heading,
    passage,
    percent: { max: percent, min: percent },
    questions: null,
    subject: 1,
  };
}

function shares(read: BlueprintContent) {
  return read.structure.subjects.map((item) =>
    (item.topicGroups ?? []).map((group) => group.share),
  );
}

const MATH_HEADINGS = MATH.map((row) => row.heading);
const NO_SHARES = [[undefined, undefined, undefined, undefined]];

describe(applyDomainShares, () => {
  it("takes every heading's stated percentage as its share of the subject, with its passage", () => {
    const read = applyDomainShares({
      content: content([subject("Math", MATH_HEADINGS), subject("Essay", [])]),
      documents,
      findings: percentFindings(MATH),
    });

    expect(shares(read)).toStrictEqual([[0.35, 0.35, 0.15, 0.15], []]);

    expect(read.structure.subjects[0]?.topicGroups?.[0]).toMatchObject({
      basis: "questions",
      citation: { passage: "Algebra ≈35% of the section's questions", sourceId: "spec" },
    });
  });

  it("splits by the midpoints of question ranges, each subject by its own table", () => {
    const read = applyDomainShares({
      content: content([
        subject("Mechanical", ["Mathematics", "Statics", "Thermodynamics"], 30),
        subject("Civil", ["Mathematics", "Statics", "Surveying"], 30),
      ]),
      documents,
      findings: [
        ...countFindings({ document: 2, rows: MECHANICAL, subjectNumber: 1 }),
        ...countFindings({ document: 3, rows: CIVIL, subjectNumber: 2 }),
      ],
    });

    expect(shares(read)).toStrictEqual([
      [7.5 / 31.5, 11.5 / 31.5, 12.5 / 31.5],
      [10 / 31.5, 14 / 31.5, 7.5 / 31.5],
    ]);

    expect(read.structure.subjects[1]?.topicGroups?.[2]?.questions).toStrictEqual({
      max: 9,
      min: 6,
    });
  });

  it("leaves a subject without shares unless every heading has one its passage states", () => {
    const math = content([subject("Math", MATH_HEADINGS)]);
    const [algebra, advanced, data, geometry] = percentFindings(MATH);

    const apply = (findings: (DomainShareFinding | undefined)[]) =>
      shares(
        applyDomainShares({
          content: math,
          documents,
          findings: findings.filter((item) => item !== undefined),
        }),
      );

    expect(apply([algebra, advanced, data])).toStrictEqual(NO_SHARES);

    expect(
      apply([algebra, advanced, data, geometry && { ...geometry, percent: { max: 25, min: 25 } }]),
    ).toStrictEqual(NO_SHARES);

    expect(
      apply([algebra, advanced, data, geometry && { ...geometry, heading: "Algebra" }]),
    ).toStrictEqual(NO_SHARES);
  });

  it("takes a heading's number only from beside that heading in the document", () => {
    const text = "Algebra 80% of questions. Geometry 20% of questions.";

    const apply = (findings: DomainShareFinding[]) =>
      shares(
        applyDomainShares({
          content: content([subject("Math", ["Algebra", "Geometry"])]),
          documents: [{ sourceId: "spec", text }],
          findings,
        }),
      );

    expect(
      apply([finding("Algebra", 80, text), finding("Geometry", 20, "Geometry 20% of questions")]),
    ).toStrictEqual([[0.8, 0.2]]);

    expect(
      apply([finding("Algebra", 20, "Algebra 20%"), finding("Geometry", 80, "Geometry 80%")]),
    ).toStrictEqual([[undefined, undefined]]);

    expect(apply([finding("Algebra", 20, text), finding("Geometry", 80, text)])).toStrictEqual([
      [undefined, undefined],
    ]);

    expect(
      apply([
        finding("Algebra", 20, "Algebra … 20% of questions"),
        finding("Geometry", 80, "Geometry … 80%"),
      ]),
    ).toStrictEqual([[undefined, undefined]]);

    expect(
      apply([finding("Algebra", 80, "Algebra … 80%"), finding("Geometry", 20, "Geometry … 20%")]),
    ).toStrictEqual([[0.8, 0.2]]);
  });

  it("leaves a subject without shares when its percentages are far from the whole", () => {
    const low = MATH.map((row) => ({ ...row, max: row.min - 10, min: row.min - 10 }));

    const read = applyDomainShares({
      content: content([subject("Math", MATH_HEADINGS)]),
      documents: [{ sourceId: "low", text: low.map((row) => percentLine(row)).join("\n") }],
      findings: percentFindings(low),
    });

    expect(shares(read)).toStrictEqual(NO_SHARES);
  });
});

describe(listShareSubjects, () => {
  it("numbers the subjects with headings to split", () => {
    expect(
      listShareSubjects(content([subject("Essay", []), subject("Math", ["Algebra", "Geometry"])])),
    ).toStrictEqual([{ headings: ["Algebra", "Geometry"], name: "Math" }]);
  });
});
