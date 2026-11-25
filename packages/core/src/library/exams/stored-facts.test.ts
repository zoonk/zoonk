import { describe, expect, it } from "vitest";
import { type BlueprintContent, type ExamStructure } from "./blueprint-contract";
import { keepStoredFacts } from "./stored-facts";

type Mock = NonNullable<ExamStructure["mock"]>;

const CITATION = { passage: "Część pisemna trwa 60 minut.", sourceId: "source-1" };

function content({
  conditions,
  sourceHash = "hash-1",
}: {
  conditions: Mock | null;
  sourceHash?: string;
}) {
  return {
    edition: {
      check: null,
      citations: [],
      dates: [],
      noticeUrl: null,
      questionCount: null,
      sourceHash,
      timeZone: null,
      year: 2027,
    },
    structure: { formats: [], mock: conditions, rules: [], subjects: [] },
    topicFrequency: [],
  } satisfies BlueprintContent;
}

function mock(overrides: Partial<Mock> = {}): Mock {
  return {
    adaptive: false,
    citations: [CITATION],
    order: null,
    scoring: { description: "Punkty", method: "raw", wrongPenalty: 0.25 },
    sections: [
      {
        day: 1,
        kind: "listening",
        minutes: 55,
        name: "Comprensión auditiva",
        questions: 38,
        tasks: [
          { count: 5, description: "Conversación", plays: 2 },
          { count: 8, description: "Entrevista", plays: 2 },
        ],
      },
    ],
    timeLimitMinutes: 180,
    totalQuestions: 38,
    ...overrides,
  };
}

function keep({ read, stored }: { read: Mock | null; stored: Mock | null }) {
  return keepStoredFacts({
    isCited: () => true,
    read: content({ conditions: read }),
    stored: content({ conditions: stored }),
  }).structure.mock;
}

describe(keepStoredFacts, () => {
  it("takes the stored scoring when the re-read couldn't confirm one", () => {
    const stored = mock();
    const read = mock({ scoring: { description: "", method: "other" } });

    expect(keep({ read, stored })?.scoring).toStrictEqual(stored.scoring);
  });

  it("fills a scoring of the same method and takes another method as read", () => {
    const stored = mock();

    expect(
      keep({ read: mock({ scoring: { description: "", method: "raw" } }), stored })?.scoring,
    ).toStrictEqual({ description: "Punkty", method: "raw", wrongPenalty: 0.25 });

    const scaled = { description: "Escala", method: "scaled" as const };
    expect(keep({ read: mock({ scoring: scaled }), stored })?.scoring).toStrictEqual(scaled);
  });

  it("keeps the stored sections when the re-read confirmed none", () => {
    const stored = mock();
    expect(keep({ read: mock({ sections: [] }), stored })?.sections).toStrictEqual(stored.sections);
  });

  it("takes the task list that says more, so a richer re-read wins and a thinner one doesn't", () => {
    const stored = mock();
    const [section] = stored.sections;

    if (!section?.tasks) {
      throw new Error("fixture");
    }

    const thinner = mock({ sections: [{ ...section, tasks: section.tasks.slice(0, 1) }] });

    const richer = mock({
      sections: [{ ...section, tasks: section.tasks.map((task) => ({ ...task, points: 1 })) }],
    });

    expect(keep({ read: thinner, stored })?.sections[0]?.tasks).toStrictEqual(section.tasks);
    expect(keep({ read: richer, stored })?.sections).toStrictEqual(richer.sections);
  });

  it("never adds a stored section the re-read named differently", () => {
    const stored = mock();
    const [section] = stored.sections;

    if (!section) {
      throw new Error("fixture");
    }

    const renamed = { ...section, minutes: null, name: "Prueba de comprensión auditiva" };
    const read = mock({ sections: [renamed] });

    expect(keep({ read, stored })?.sections).toStrictEqual([renamed]);
  });

  it("takes a changed notice's mock as read, since its parts carry no passage to check", () => {
    const read = mock({ sections: [], timeLimitMinutes: null });

    const merged = keepStoredFacts({
      isCited: () => true,
      read: content({ conditions: read, sourceHash: "hash-2" }),
      stored: content({ conditions: mock() }),
    });

    expect(merged.structure.mock).toStrictEqual(read);
  });
});
