import { describe, expect, it } from "vitest";
import { type BlueprintContent } from "./blueprint-contract";
import { mergeBlueprintContent } from "./blueprint-diff";

const OLD_CITATION = { passage: "A prova terá 50 questões.", sourceId: "source-1" };
const NEW_CITATION = { passage: "A prova terá 60 questões.", sourceId: "source-2" };

function content(overrides: Partial<BlueprintContent> = {}): BlueprintContent {
  return {
    edition: {
      citations: [],
      dates: [
        {
          citation: OLD_CITATION,
          date: "2026-11-08",
          kind: "exam",
          label: "Prova",
          startTime: null,
        },
      ],
      noticeUrl: "https://example.gov.br/edital.pdf",
      questionCount: 50,
      sourceHash: "hash-1",
      timeZone: null,
      year: 2026,
    },
    structure: {
      formats: [
        {
          citation: OLD_CITATION,
          description: "Certo ou errado",
          kind: "trueFalse",
          options: null,
        },
      ],
      mock: null,
      rules: [{ citation: OLD_CITATION, text: "Uma resposta errada anula uma certa." }],
      subjects: [
        { citation: OLD_CITATION, name: "Direito", questions: 50, topics: ["Leis"], weight: null },
      ],
    },
    topicFrequency: [],
    ...overrides,
  };
}

describe(mergeBlueprintContent, () => {
  it("reports nothing when only the passages differ", () => {
    const current = content();

    const next = content({
      structure: {
        ...current.structure,
        subjects: [
          {
            citation: NEW_CITATION,
            name: "Direito",
            questions: 50,
            topics: ["Leis"],
            weight: null,
          },
        ],
      },
    });

    expect(mergeBlueprintContent({ current, next }).changes).toStrictEqual([]);
  });

  it("updates only what changed and lists it without citations", () => {
    const current = content();

    const next = content({
      edition: { ...current.edition, questionCount: 60, sourceHash: "hash-2" },
      structure: {
        ...current.structure,
        subjects: [
          {
            citation: NEW_CITATION,
            name: "Direito",
            questions: 60,
            topics: ["Leis"],
            weight: null,
          },
        ],
      },
    });

    const merged = mergeBlueprintContent({ current, next });

    expect(merged.changes).toStrictEqual([
      {
        after: [{ name: "Direito", questions: 60, topics: ["Leis"], weight: null }],
        before: [{ name: "Direito", questions: 50, topics: ["Leis"], weight: null }],
        field: "subjects",
      },
      { after: 60, before: 50, field: "edition.questionCount" },
    ]);

    expect(merged.content.edition.questionCount).toBe(60);
    expect(merged.content.edition.sourceHash).toBe("hash-2");
    expect(merged.content.structure.rules).toBe(current.structure.rules);
    expect(merged.content.structure.subjects[0]?.citation).toStrictEqual(NEW_CITATION);
  });

  it("keeps what the new reading left empty instead of deleting it", () => {
    const current = content();

    const next = content({
      edition: { ...current.edition, dates: [], questionCount: null },
      structure: { formats: [], mock: null, rules: [], subjects: [] },
    });

    const merged = mergeBlueprintContent({ current, next });

    expect(merged.changes).toStrictEqual([]);
    expect(merged.content.structure.subjects).toBe(current.structure.subjects);
    expect(merged.content.edition.dates).toBe(current.edition.dates);
    expect(merged.content.edition.questionCount).toBe(50);
  });

  it("asks again for the subjects' counts a lookup didn't find once a reading changes the subjects", () => {
    const found = {
      checkedAt: "2026-10-01T00:00:00.000Z",
      edition: "47º Exame",
      source: { title: null, url: "https://example.com/distribuicao" },
      subjects: [{ name: "Direito", questions: 50 }],
    };

    const notFound = {
      checkedAt: "2026-10-01T00:00:00.000Z",
      edition: null,
      source: null,
      subjects: [],
    };

    const ethics = {
      citation: NEW_CITATION,
      name: "Ética Profissional",
      questions: null,
      topics: [],
      weight: null,
    };

    const withLookup = (pastQuestions: typeof found | typeof notFound) =>
      content({ structure: { ...content().structure, pastQuestions } });

    const next = content({
      structure: { ...content().structure, subjects: [...content().structure.subjects, ethics] },
    });

    // The subjects the lookup found nothing for weren't the exam's (Ética was missing), so the
    // new subjects are asked for again; counts it found stay, and so does a lookup for the
    // same subjects.
    expect(
      mergeBlueprintContent({ current: withLookup(notFound), next }).content.structure
        .pastQuestions,
    ).toBeUndefined();

    expect(
      mergeBlueprintContent({ current: withLookup(found), next }).content.structure.pastQuestions,
    ).toStrictEqual(found);

    expect(
      mergeBlueprintContent({ current: withLookup(notFound), next: content() }).content.structure
        .pastQuestions,
    ).toStrictEqual(notFound);
  });

  it("keeps a subject's stated counts, group and name when a new reading of it leaves them out", () => {
    const essay = {
      citation: OLD_CITATION,
      name: "Redação",
      questions: null,
      topics: [],
      weight: null,
    };

    const current = content({
      structure: {
        ...content().structure,
        subjects: [
          {
            citation: OLD_CITATION,
            group: "Conhecimentos básicos (P1)",
            name: "Linguagens",
            questions: 45,
            shortName: "Linguagens",
            topicGroups: [{ name: "Leitura", topics: ["Leis"] }],
            topics: ["Leis"],
            weight: 0.25,
          },
          essay,
        ],
      },
    });

    // ENEM read again from fewer documents: no counts, groups or headings, and "Prova de
    // Redação" for the part learners and plans call "Redação".
    const next = content({
      structure: {
        ...content().structure,
        subjects: [
          {
            citation: NEW_CITATION,
            group: null,
            name: "Linguagens, Códigos e suas Tecnologias",
            questions: null,
            topics: ["Leis"],
            weight: null,
          },
          { ...essay, citation: NEW_CITATION, name: "Prova de Redação" },
          { citation: NEW_CITATION, name: "Ética", questions: null, topics: [], weight: null },
        ],
      },
    });

    const merged = mergeBlueprintContent({ current, next });

    expect(merged.content.structure.subjects).toStrictEqual([
      { ...current.structure.subjects[0], citation: NEW_CITATION },
      { ...essay, citation: NEW_CITATION },
      { citation: NEW_CITATION, name: "Ética", questions: null, topics: [], weight: null },
    ]);

    // Only the subject the reading added is a change.
    expect(merged.changes.map((change) => change.field)).toStrictEqual(["subjects"]);

    // A subject a later reading leaves out stays where it was.
    const skipping = content({
      structure: { ...next.structure, subjects: [next.structure.subjects[2]!] },
    });

    expect(
      mergeBlueprintContent({ current: merged.content, next: skipping }).content.structure.subjects,
    ).toStrictEqual(merged.content.structure.subjects);
  });

  it("compares stored JSON regardless of key order", () => {
    const current = content();

    // Stored JSON comes back with its keys in another order.
    const reordered = current.structure.subjects.map(
      (subject) => Object.fromEntries(Object.entries(subject).toReversed()) as typeof subject,
    );

    const merged = mergeBlueprintContent({
      current: content({ structure: { ...current.structure, subjects: reordered } }),
      next: current,
    });

    expect(merged.changes).toStrictEqual([]);
  });

  it("keeps a known number of options when a new reading doesn't state it", () => {
    const fiveOptions = {
      citation: OLD_CITATION,
      description: "Múltipla escolha com cinco alternativas, de A a E",
      kind: "multipleChoice" as const,
      options: 5,
    };

    const essay = {
      citation: OLD_CITATION,
      description: "Redação",
      kind: "essay" as const,
      options: null,
    };

    const current = content({
      structure: { ...content().structure, formats: [fiveOptions, essay] },
    });

    const next = content({
      structure: {
        ...current.structure,
        formats: [
          {
            citation: NEW_CITATION,
            description: "Questões objetivas",
            kind: "multipleChoice",
            options: null,
          },
          { ...essay, citation: NEW_CITATION },
        ],
      },
    });

    const merged = mergeBlueprintContent({ current, next });

    expect(merged.changes).toStrictEqual([]);
    expect(merged.content.structure.formats).toStrictEqual([fiveOptions, essay]);
  });

  it("takes a new number of options, and the new reading's other formats", () => {
    const current = content({
      structure: {
        ...content().structure,
        formats: [
          { citation: OLD_CITATION, description: "Cinco", kind: "multipleChoice", options: 5 },
        ],
      },
    });

    const fourOptions = {
      citation: NEW_CITATION,
      description: "Quatro",
      kind: "multipleChoice" as const,
      options: 4,
    };

    const essay = {
      citation: NEW_CITATION,
      description: "Redação",
      kind: "essay" as const,
      options: null,
    };

    const merged = mergeBlueprintContent({
      current,
      next: content({ structure: { ...current.structure, formats: [fourOptions, essay] } }),
    });

    expect(merged.changes.map((change) => change.field)).toStrictEqual(["formats"]);
    expect(merged.content.structure.formats).toStrictEqual([fourOptions, essay]);
  });

  it("moves an exam date", () => {
    const current = content();

    const next = content({
      edition: {
        ...current.edition,
        dates: [
          {
            citation: NEW_CITATION,
            date: "2026-11-15",
            kind: "exam",
            label: "Prova",
            startTime: null,
          },
        ],
      },
    });

    expect(
      mergeBlueprintContent({ current, next }).changes.map((change) => change.field),
    ).toStrictEqual(["edition.dates"]);
  });
});
