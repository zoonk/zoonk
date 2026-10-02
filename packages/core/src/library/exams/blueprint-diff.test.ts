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
