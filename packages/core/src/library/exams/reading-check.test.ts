import { describe, expect, it } from "vitest";
import { type BlueprintContent, type ReadingProblem } from "./blueprint-contract";
import { findReadingProblems, pickBetterReading } from "./reading-check";

const NOTICE = [
  "| Área de conhecimento | Conteúdos de formação geral, Direitos Humanos, Direito do Consumidor, Filosofia do Direito, bem como Estatuto da Advocacia e da OAB, seu Regulamento Geral e Código de Ética e Disciplina da OAB. |",
  "3.4.1. A prova objetiva, sem consulta, será composta de 80 (oitenta) questões.",
  "3.4.2. Direitos Humanos terá 6 (seis) questões.",
].join("\n");

const documents = [{ sourceId: "notice", text: NOTICE }];

/** A notice subject with its count, as a reading writes it; `extra` adds a choice's fields. */
function noticeSubject(name: string, questions: number | null, extra: object = {}) {
  return {
    citation: { passage: name, sourceId: "notice" },
    name,
    questions,
    topics: [],
    weight: null,
    ...extra,
  };
}

function reading(subjects: { name: string; questions?: number | null }[]): BlueprintContent {
  return {
    edition: {
      citations: [],
      dates: [],
      noticeUrl: null,
      questionCount: 80,
      sourceHash: "hash",
      timeZone: null,
      year: null,
    },
    structure: {
      formats: [],
      mock: null,
      rules: [],
      subjects: subjects.map((subject) => ({
        citation: { passage: subject.name, sourceId: "notice" },
        group: null,
        name: subject.name,
        questions: subject.questions ?? null,
        shortName: null,
        topics: [],
        weight: null,
      })),
    },
    topicFrequency: [],
  };
}

const ETHICS_PASSAGE =
  "Filosofia do Direito, bem como Estatuto da Advocacia e da OAB, seu Regulamento Geral e Código de Ética e Disciplina da OAB.";

describe(findReadingProblems, () => {
  it("keeps a subject the notice names that the reading lacks, with the passage code found", () => {
    const content = reading([{ name: "Direitos Humanos" }, { name: "Filosofia do Direito" }]);

    const problems = findReadingProblems({
      checked: content.structure.subjects,
      content,
      documents,
      findings: {
        missingSubjects: [
          { document: 1, name: "Estatuto da Advocacia e da OAB", passage: ETHICS_PASSAGE },
          // The reading has it, under a shorter name.
          { document: 1, name: "Filosofia do Direito e Ética", passage: ETHICS_PASSAGE },
          // No such passage in the notice: the check made it up.
          { document: 1, name: "Direito Militar", passage: "Direito Militar terá 4 questões." },
        ],
        statedCounts: [],
      },
    });

    expect(problems).toStrictEqual([
      {
        citation: { passage: ETHICS_PASSAGE, sourceId: "notice" },
        kind: "missingSubject",
        name: "Estatuto da Advocacia e da OAB",
      },
    ]);
  });

  it("keeps a count the notice states for a subject only when its passage has that number", () => {
    const content = reading([{ name: "Direitos Humanos" }, { name: "Filosofia do Direito" }]);
    const passage = "3.4.2. Direitos Humanos terá 6 (seis) questões.";

    const problems = findReadingProblems({
      checked: content.structure.subjects,
      content,
      documents,
      findings: {
        missingSubjects: [],
        statedCounts: [
          { document: 1, passage, questions: 6, subject: 1 },
          { document: 1, passage, questions: 8, subject: 2 },
        ],
      },
    });

    expect(problems).toStrictEqual([
      {
        citation: { passage, sourceId: "notice" },
        kind: "missingCount",
        questions: 6,
        subject: "Direitos Humanos",
      },
    ]);
  });

  it("finds subjects' counts that don't add up to the exam's questions", () => {
    const content = reading([
      { name: "Direitos Humanos", questions: 6 },
      { name: "Filosofia do Direito", questions: 70 },
    ]);

    expect(
      findReadingProblems({
        checked: content.structure.subjects,
        content,
        documents,
        findings: { missingSubjects: [], statedCounts: [] },
      }),
    ).toStrictEqual([{ kind: "countsOffTotal", sum: 76, total: 80 }]);
  });

  it("counts a choice's questions once, and an option counted inside another subject not again", () => {
    const content = reading([]);
    const choice = { choiceGroup: "Língua Estrangeira" };
    const inside = { ...choice, partOf: "Linguagens" };

    const check = (subjects: BlueprintContent["structure"]["subjects"]) =>
      findReadingProblems({
        checked: subjects,
        content: { ...content, structure: { ...content.structure, subjects } },
        documents,
        findings: { missingSubjects: [], statedCounts: [] },
      });

    expect(
      check([
        noticeSubject("Linguagens", 40),
        noticeSubject("Língua Inglesa", 5, choice),
        noticeSubject("Língua Espanhola", 5, choice),
        noticeSubject("Ciências Humanas", 35),
      ]),
    ).toStrictEqual([]);

    expect(
      check([
        noticeSubject("Linguagens", 45),
        noticeSubject("Língua Inglesa", 5, inside),
        noticeSubject("Língua Espanhola", null, inside),
        noticeSubject("Ciências Humanas", 35),
      ]),
    ).toStrictEqual([]);
  });

  /*
   * TJ-SP's notice (read from a copy, 11 Oct 2026): the reading stated the objective test's 0 to 10
   * scale, the exam's day and Língua Portuguesa's syllabus, and no check kept any of them, so the
   * blueprint had no scale for the cut-off, no exam date and a subject without topics.
   */
  it("finds what the reading stated that no check kept: the scale, the exam's day, a subject's topics", () => {
    const content = reading([
      { name: "Língua Portuguesa" },
      { name: "Direitos Humanos" },
      { name: "Redação" },
    ]);

    const scale = { fromPercent: null, max: 10, min: 0, name: null, passScore: 5, step: null };

    const read = {
      dates: [{ kind: "registrationEnd" as const }, { kind: "exam" as const }],
      mock: { scoring: { scale } },
      subjects: [
        { name: "Língua Portuguesa", topics: ["1. Crase", "2. Pontuação"] },
        // A subject the notice lists without a syllabus has no topics to lose.
        { name: "Direitos Humanos", topics: [] },
        // A subject the check dropped is a problem of its own, not of its topics.
        { name: "Direito Militar", topics: ["Hierarquia"] },
        // An essay's themes are in the reading's words, not a syllabus's.
        { name: "Redação", topics: ["Texto dissertativo-argumentativo"] },
      ],
    };

    const findProblems = (kept: BlueprintContent) =>
      findReadingProblems({
        checked: read.subjects,
        content: kept,
        documents,
        findings: { missingSubjects: [], statedCounts: [] },
        read,
      });

    expect(findProblems(content)).toStrictEqual([
      { kind: "unconfirmed", part: "scale", subject: null },
      { kind: "unconfirmed", part: "examDate", subject: null },
      { kind: "unconfirmed", part: "topics", subject: "Língua Portuguesa" },
    ]);

    const [portuguese, rights, essay] = content.structure.subjects;

    const kept: BlueprintContent = {
      ...content,
      edition: {
        ...content.edition,
        dates: [
          {
            citation: { passage: "07/12/2025", sourceId: "notice" },
            date: "2025-12-07",
            kind: "exam",
            label: "Aplicação das provas",
            startTime: null,
          },
        ],
      },
      structure: {
        ...content.structure,
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "", method: "raw", scale },
          sections: [],
          timeLimitMinutes: null,
          totalQuestions: 70,
        },
        subjects: [{ ...portuguese!, topics: ["Crase", "Pontuação"] }, rights!, essay!],
      },
    };

    expect(findProblems(kept)).toStrictEqual([]);
  });
});

describe(pickBetterReading, () => {
  const missing = { kind: "countsOffTotal" as const, sum: 79, total: 80 };

  it("keeps the reading with fewer problems, the later one on a tie, never an unchecked one", () => {
    type Reading = { id: string; problems: ReadingProblem[] | null };

    const first: Reading = { id: "first", problems: [missing] };
    const fixed: Reading = { id: "second", problems: [] };
    const worse: Reading = { id: "second", problems: [missing, missing] };
    const unchecked: Reading = { id: "second", problems: null };

    expect(pickBetterReading({ first, second: fixed }).id).toBe("second");
    expect(pickBetterReading({ first, second: { ...first, id: "second" } }).id).toBe("second");
    expect(pickBetterReading({ first, second: worse }).id).toBe("first");
    expect(pickBetterReading({ first, second: unchecked }).id).toBe("first");
  });
});
