import { describe, expect, it } from "vitest";
import { type ExamStructure } from "./blueprint-contract";
import {
  getPastQuestionsSource,
  getSubjectQuestions,
  needsPastQuestions,
  orderByQuestions,
} from "./subject-questions";

const citation = { passage: "…", sourceId: "notice" };
const NOW = new Date("2026-10-06T12:00:00.000Z");

function subject(name: string, questions: number | null = null) {
  return { citation, group: null, name, questions, shortName: null, topics: [], weight: null };
}

const oab: ExamStructure = {
  formats: [{ citation, description: "Quatro opções", kind: "multipleChoice", options: 4 }],
  mock: null,
  rules: [],
  subjects: [subject("Direito Civil"), subject("Direito Processual Civil"), subject("Ética")],
};

const looked: ExamStructure = {
  ...oab,
  pastQuestions: {
    checkedAt: "2026-10-01T00:00:00.000Z",
    edition: "45º Exame",
    source: { title: "Distribuição", url: "https://example.com/oab" },
    subjects: [
      { name: "Direito Civil", questions: 7 },
      { name: "Direito Processual Civil", questions: 6 },
      { name: "Ética", questions: 8 },
    ],
  },
};

describe(getSubjectQuestions, () => {
  it("takes the notice's count first, then the latest edition's for the same subject", () => {
    const [civil, process] = looked.subjects;

    expect(civil && getSubjectQuestions({ structure: looked, subject: civil })).toBe(7);
    expect(process && getSubjectQuestions({ structure: looked, subject: process })).toBe(6);

    const stated = { ...looked, subjects: [subject("Direito Civil", 10)] };
    const [own] = stated.subjects;
    expect(own && getSubjectQuestions({ structure: stated, subject: own })).toBe(10);

    expect(getPastQuestionsSource(looked)).toStrictEqual({
      edition: "45º Exame",
      title: "Distribuição",
      url: "https://example.com/oab",
    });

    expect(getPastQuestionsSource(oab)).toBeNull();
  });

  it("never counts questions for a written test, whatever the latest edition's count says", () => {
    const withEssay: ExamStructure = {
      ...looked,
      formats: [...looked.formats, { citation, description: "", kind: "essay", options: null }],
      pastQuestions: looked.pastQuestions && {
        ...looked.pastQuestions,
        subjects: [...looked.pastQuestions.subjects, { name: "Redação", questions: 0 }],
      },
      subjects: [...looked.subjects, subject("Redação")],
    };

    const essay = withEssay.subjects.at(-1);

    expect(essay && getSubjectQuestions({ structure: withEssay, subject: essay })).toBeNull();
  });
});

describe(needsPastQuestions, () => {
  it("looks up an objective exam whose notice weighs none of its subjects, once", () => {
    expect(needsPastQuestions({ now: NOW, structure: oab })).toBe(true);
    expect(needsPastQuestions({ now: NOW, structure: looked })).toBe(false);
  });

  it("tries again a month after finding nothing, or when the notice renames a subject", () => {
    const empty = {
      ...oab,
      pastQuestions: {
        checkedAt: "2026-10-01T00:00:00.000Z",
        edition: null,
        source: null,
        subjects: [],
      },
    };

    expect(needsPastQuestions({ now: NOW, structure: empty })).toBe(false);

    expect(
      needsPastQuestions({ now: new Date("2026-11-15T00:00:00.000Z"), structure: empty }),
    ).toBe(true);

    const renamed = { ...looked, subjects: [...looked.subjects, subject("Direito Eleitoral")] };
    expect(needsPastQuestions({ now: NOW, structure: renamed })).toBe(true);
  });

  it("leaves exams the notice weighs, discursive-only exams and short lists alone", () => {
    const weighed = { ...oab, subjects: [subject("A", 10), subject("B"), subject("C")] };

    const essay = {
      ...oab,
      formats: [{ citation, description: "Uma redação", kind: "essay" as const, options: null }],
    };

    const short = { ...oab, subjects: oab.subjects.slice(0, 2) };

    expect(needsPastQuestions({ now: NOW, structure: weighed })).toBe(false);
    expect(needsPastQuestions({ now: NOW, structure: essay })).toBe(false);
    expect(needsPastQuestions({ now: NOW, structure: short })).toBe(false);
  });
});

describe(orderByQuestions, () => {
  it("puts an ungrouped notice's subjects with the most questions first, ties in its order", () => {
    const subjects = [
      { group: null, name: "Administrativo", questions: 5 },
      { group: null, name: "Civil", questions: 7 },
      { group: null, name: "Financeiro", questions: 2 },
      { group: null, name: "Ética", questions: 8 },
      { group: null, name: "Tributário", questions: 5 },
    ];

    expect(orderByQuestions(subjects).map((item) => item.name)).toStrictEqual([
      "Ética",
      "Civil",
      "Administrativo",
      "Tributário",
      "Financeiro",
    ]);
  });

  it("keeps the notice's order when it groups its subjects or doesn't count them all", () => {
    const grouped = [
      { group: "P1", name: "Português", questions: 10 },
      { group: "P2", name: "Processo Legislativo", questions: 30 },
    ];

    const partial = [
      { group: null, name: "Linguagens", questions: 45 },
      { group: null, name: "Redação", questions: null },
      { group: null, name: "Matemática", questions: 45 },
    ];

    expect(orderByQuestions(grouped)).toStrictEqual(grouped);
    expect(orderByQuestions(partial)).toStrictEqual(partial);
  });
});
