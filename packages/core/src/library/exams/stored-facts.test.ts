import { describe, expect, it } from "vitest";
import { type BlueprintContent, type ExamStructure } from "./blueprint-contract";
import { mergeBlueprintContent } from "./blueprint-diff";
import { keepStoredFacts } from "./stored-facts";

type Mock = NonNullable<ExamStructure["mock"]>;
type Format = ExamStructure["formats"][number];

const CITATION = { passage: "Część pisemna trwa 60 minut.", sourceId: "source-1" };

function format(kind: Format["kind"], description: string): Format {
  return { citation: CITATION, description, kind, options: null };
}

function content({
  conditions = null,
  formats = [],
  sourceHash = "hash-1",
}: {
  conditions?: Mock | null;
  formats?: Format[];
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
    structure: { formats, mock: conditions, rules: [], subjects: [] },
    topicFrequency: [],
  } satisfies BlueprintContent;
}

function mock(sections: Mock["sections"]): Mock {
  return {
    adaptive: false,
    citations: [CITATION],
    order: null,
    scoring: { description: "Punkty", method: "raw" },
    sections,
    timeLimitMinutes: 180,
    totalQuestions: 38,
  };
}

const LISTENING: Mock["sections"][number] = {
  day: 1,
  kind: "listening",
  minutes: 55,
  name: "Comprensión auditiva",
  questions: 38,
  tasks: [
    { count: 5, description: "Conversación", plays: 2 },
    { count: 8, description: "Entrevista", plays: 2 },
  ],
};

const WRITING: Mock["sections"][number] = {
  day: 1,
  kind: "written",
  minutes: 50,
  name: "Expresión escrita",
  questions: null,
  tasks: [
    { count: 1, description: "Essay", key: "written-a", points: 10 },
    { count: 1, description: "Essay", key: "written-b", points: 10 },
  ],
};

describe(keepStoredFacts, () => {
  it("keeps the stored mock whole when a re-read of the same notice confirmed less of it", () => {
    const stored = content({ conditions: mock([LISTENING, WRITING]) });

    const read = content({
      conditions: mock([{ ...LISTENING, minutes: null, tasks: LISTENING.tasks?.slice(0, 1) }]),
    });

    expect(keepStoredFacts({ isCited: () => false, read, stored }).structure.mock).toBe(
      stored.structure.mock,
    );
  });

  it("takes a re-read of the same notice that confirmed as much or more, corrections included", () => {
    const stored = content({ conditions: mock([LISTENING]) });
    const corrected = content({ conditions: mock([{ ...LISTENING, minutes: 60 }]) });

    expect(
      keepStoredFacts({ isCited: () => false, read: corrected, stored }).structure.mock,
    ).toStrictEqual(corrected.structure.mock);
  });

  it("takes a re-read of the same notice that corrects a rule from true to false", () => {
    const navigation = {
      answerChanges: null,
      forwardOnly: true,
      itemSeconds: null,
      mustAnswer: true,
    };

    const stored = content({ conditions: mock([{ ...LISTENING, navigation }]) });

    const read = content({
      conditions: mock([{ ...LISTENING, navigation: { ...navigation, forwardOnly: false } }]),
    });

    expect(keepStoredFacts({ isCited: () => false, read, stored }).structure.mock).toBe(
      read.structure.mock,
    );
  });

  it("keeps both essays when a re-read of the same notice found only one", () => {
    const formats = [format("essay", "Letter"), format("essay", "Report")];
    const stored = content({ formats });
    const read = content({ formats: [format("essay", "Letter")] });

    expect(keepStoredFacts({ isCited: () => false, read, stored }).structure.formats).toBe(formats);
  });

  it("keeps the keys of written tasks taken from the stored mock, so saved answers still match", () => {
    const stored = content({ conditions: mock([LISTENING, WRITING]) });
    const read = content({ conditions: mock([LISTENING]) });

    const merged = mergeBlueprintContent({
      current: stored,
      next: keepStoredFacts({ isCited: () => true, read, stored }),
    });

    expect(merged.changes).toStrictEqual([]);

    expect(
      merged.content.structure.mock?.sections[1]?.tasks?.map((task) => task.key),
    ).toStrictEqual(["written-a", "written-b"]);
  });

  it("keeps a changed notice's left-out kind only while its passage is still there, and its mock as read", () => {
    const stored = content({
      conditions: mock([LISTENING]),
      formats: [format("multipleChoice", "Test"), format("essay", "Letter")],
    });

    const read = content({
      conditions: mock([{ ...LISTENING, minutes: null }]),
      formats: [format("multipleChoice", "Zamknięte")],
      sourceHash: "hash-2",
    });

    const quoted = keepStoredFacts({ isCited: () => true, read, stored });
    const silent = keepStoredFacts({ isCited: () => false, read, stored });

    expect(quoted.structure.formats.map((item) => item.description)).toStrictEqual([
      "Zamknięte",
      "Letter",
    ]);

    expect(silent.structure.formats).toBe(read.structure.formats);
    expect(quoted.structure.mock).toBe(read.structure.mock);
  });

  it("leaves a changed notice's reading in its own order when it keeps nothing", () => {
    const formats = [
      format("essay", "Letter"),
      format("oral", "Interview"),
      format("essay", "Report"),
    ];

    const read = content({ formats, sourceHash: "hash-2" });

    expect(
      keepStoredFacts({ isCited: () => true, read, stored: content({ formats }) }).structure
        .formats,
    ).toBe(formats);
  });
});
