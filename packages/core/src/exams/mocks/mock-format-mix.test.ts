import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import {
  ONE_PICK_MIX,
  getFormatMixSource,
  getFormatQuotas,
  getItemFormatKey,
  getMockFormatMix,
  getMockWritingFormat,
} from "./mock-format-mix";

const citation = { passage: "From the notice.", sourceId: "notice" };

type Format = ExamStructure["formats"][number];

function structureOf(formats: Partial<Format>[], names: string[] = []): ExamStructure {
  return {
    formats: formats.map((format) => ({
      citation,
      description: "",
      kind: "multipleChoice" as const,
      options: 4,
      ...format,
    })),
    mock: null,
    pastOptions: null,
    rules: [],
    subjects: names.map((name) => ({ citation, name, questions: 6, topics: [], weight: null })),
  };
}

const JEE_ADVANCED = structureOf([
  {},
  { select: "all" },
  { entry: { kind: "integer", places: null }, kind: "numeric", options: null },
]);

const GRE_LIKE = structureOf(
  [
    { description: "Compare two quantities", sections: ["Quantitative Reasoning"] },
    { description: "One answer", options: 5, sections: ["Verbal Reasoning", "Quantitative"] },
    { description: "Fill each blank from its column", options: 5, sections: ["Verbal"] },
    { description: "Two equivalent answers", options: 6, sections: ["Verbal"], select: 2 },
    {
      description: "Type a number",
      entry: { kind: "fraction", places: null },
      kind: "numeric",
      options: null,
      sections: ["Quantitative Reasoning"],
    },
    { description: "Essay", kind: "essay", options: null, sections: ["Analytical Writing"] },
  ],
  ["Verbal Reasoning", "Quantitative Reasoning", "Analytical Writing"],
);

function keysOf(mix: { key: string; share: number }[]) {
  return mix.map(({ key, share }) => ({ key, share }));
}

describe(getMockFormatMix, () => {
  it("resolves a subject's format through its declared group", () => {
    const base = structureOf(
      [
        { options: 4, sections: ["Physics", "Chemistry"] },
        { kind: "numeric", options: null, sections: ["Paper 1"] },
      ],
      ["Physics", "Chemistry"],
    );

    const structure = {
      ...base,
      subjects: base.subjects.map((subject) => ({
        ...subject,
        group: subject.name === "Physics" ? "Paper 1" : "Paper 2",
      })),
    };

    expect(getMockFormatMix(structure, ["Physics"]).map(({ key }) => key)).toStrictEqual([
      "choice:4",
      "numeric:number:",
    ]);

    expect(getMockFormatMix(structure, ["Chemistry"]).map(({ key }) => key)).toStrictEqual([
      "choice:4",
    ]);
  });

  it("keeps a globally unmatched numeric label when the choice scope matches a subject", () => {
    const structure = structureOf(
      [
        { options: 4, sections: ["Physics", "Chemistry", "Mathematics"] },
        { kind: "numeric", options: null, sections: ["Section B"] },
      ],
      ["Physics", "Chemistry", "Mathematics"],
    );

    expect(keysOf(getMockFormatMix(structure, ["Physics"]))).toStrictEqual([
      { key: "choice:4", share: 0.5 },
      { key: "numeric:number:", share: 0.5 },
    ]);
  });

  it("excludes unknown-scope Text Completion when Quant formats are known", () => {
    const structure = structureOf(
      [
        { description: "Text Completion", options: 3, sections: [] },
        { description: "Compare quantities", sections: ["Quantitative"] },
      ],
      ["Quantitative"],
    );

    expect(getMockFormatMix(structure, ["Quantitative"]).map(({ key }) => key)).toStrictEqual([
      "choice:4",
    ]);
  });

  it("asks each format the notice lists in equal parts when it gives no counts", () => {
    const mix = getMockFormatMix(JEE_ADVANCED);

    expect(keysOf(mix)).toStrictEqual([
      { key: "choice:4", share: 1 / 3 },
      { key: "picks:all", share: 1 / 3 },
      { key: "numeric:integer:", share: 1 / 3 },
    ]);

    expect(mix.map((format) => format.writer)).toStrictEqual([
      { choice: { kind: "multipleChoice", options: 4 }, kind: "quick" },
      {
        answerFormat: { entry: null, format: "multipleChoice", options: 4, select: "all" },
        kind: "item",
      },
      {
        answerFormat: {
          entry: { kind: "integer", places: null },
          format: "numeric",
          options: null,
          select: null,
        },
        kind: "item",
      },
    ]);

    expect(getFormatMixSource(JEE_ADVANCED)).toBe("even");
  });

  it("asks the notice's own mix, and gives a format it doesn't count what's left", () => {
    const jeeMain = structureOf([
      { share: 0.8 },
      { kind: "numeric", options: null, share: 0.2 },
      { kind: "essay", options: null },
    ]);

    expect(keysOf(getMockFormatMix(jeeMain))).toStrictEqual([
      { key: "choice:4", share: 0.8 },
      { key: "numeric:number:", share: 0.2 },
    ]);

    expect(getFormatMixSource(jeeMain)).toBe("notice");

    const sat = structureOf([{ share: 0.75 }, { kind: "shortAnswer", options: null }]);

    expect(keysOf(getMockFormatMix(sat))).toStrictEqual([
      { key: "choice:4", share: 0.75 },
      { key: "typed", share: 0.25 },
    ]);
  });

  it("asks one pick only for an exam that lists only one, and without a blueprint", () => {
    const enem = structureOf([{ description: "Five options", options: 5 }]);

    expect(getMockFormatMix(enem)).toStrictEqual([
      {
        key: "choice:5",
        sections: [],
        share: 1,
        style: "multipleChoice (5 options): Five options",
        writer: { choice: { kind: "multipleChoice", options: 5 }, kind: "quick" },
      },
    ]);

    expect(getMockFormatMix(null)).toStrictEqual(ONE_PICK_MIX);
  });

  it("keeps one-pick formats with their own options apart, each asked only where the notice asks it", () => {
    expect(keysOf(getMockFormatMix(GRE_LIKE, ["Verbal Reasoning (Section 1)"]))).toStrictEqual([
      { key: "choice:5", share: 2 / 3 },
      { key: "picks:2", share: 1 / 3 },
    ]);

    const quantitative = getMockFormatMix(GRE_LIKE, ["Quantitative Reasoning (Section 2)"]);

    expect(keysOf(quantitative)).toStrictEqual([
      { key: "choice:4", share: 1 / 3 },
      { key: "choice:5", share: 1 / 3 },
      { key: "numeric:fraction:", share: 1 / 3 },
    ]);

    expect(quantitative.map(({ sections, style }) => ({ sections, style }))).toStrictEqual([
      {
        sections: ["Quantitative Reasoning"],
        style: "multipleChoice (4 options): Compare two quantities",
      },
      {
        sections: ["Verbal Reasoning", "Quantitative"],
        style: "multipleChoice (5 options): One answer",
      },
      { sections: ["Quantitative Reasoning"], style: "numeric: Type a number" },
    ]);
  });

  it("includes all objective formats only when planning the whole exam", () => {
    expect(getMockFormatMix(GRE_LIKE, ["Analytical Writing"])).toStrictEqual([]);
    expect(getMockFormatMix(GRE_LIKE, [])).toHaveLength(4);

    expect(getMockFormatMix(GRE_LIKE).find((format) => format.key === "choice:5")).toMatchObject({
      sections: ["Verbal Reasoning", "Quantitative", "Verbal"],
      style:
        "multipleChoice (5 options): One answer multipleChoice (5 options): Fill each blank from its column",
    });
  });
});

function keyOf(format: string, content: object, structure = JEE_ADVANCED) {
  return getItemFormatKey({ item: { content, format }, mix: getMockFormatMix(structure) });
}

function options(count: number) {
  return Array.from({ length: count }, (_, index) => ({ isCorrect: index === 0, text: "" }));
}

describe(getItemFormatKey, () => {
  it("puts a bank question in the format it's answered in", () => {
    expect(keyOf("multipleChoice", { options: options(4), select: 1 })).toBe("choice:4");
    expect(keyOf("multipleChoice", { options: options(4) })).toBe("choice:4");
    expect(keyOf("multipleChoice", { select: "all" })).toBe("picks:all");
    expect(keyOf("multipleChoice", { select: 2 })).toBe("picks:all");
    expect(keyOf("numeric", { entry: { kind: "integer", places: null } })).toBe("numeric:integer:");
    expect(keyOf("numeric", {})).toBe("numeric:integer:");
    expect(keyOf("typed", {})).toBeNull();
  });

  it("tells one-pick formats apart by their options", () => {
    expect(keyOf("multipleChoice", { options: options(4) }, GRE_LIKE)).toBe("choice:4");
    expect(keyOf("multipleChoice", { options: options(5) }, GRE_LIKE)).toBe("choice:5");
    expect(keyOf("multipleChoice", { options: options(3) }, GRE_LIKE)).toBeNull();

    expect(keyOf("trueFalse", {}, structureOf([{ kind: "trueFalse", options: null }]))).toBe(
      "choice:tf",
    );
  });
});

describe(getFormatQuotas, () => {
  it("shares a section's questions among the formats, all of them asked", () => {
    expect(getFormatQuotas({ mix: getMockFormatMix(JEE_ADVANCED), wanted: 17 })).toStrictEqual(
      new Map([
        ["choice:4", 6],
        ["picks:all", 6],
        ["numeric:integer:", 5],
      ]),
    );
  });
});

describe(getMockWritingFormat, () => {
  it("resolves Paper 1 through subjects' group and partOf without selecting Law", () => {
    const structure = {
      formats: [
        {
          citation: { passage: "", sourceId: "notice" },
          description: "",
          kind: "multipleChoice",
          options: 5,
          sections: ["Paper 1"],
        },
        {
          citation: { passage: "", sourceId: "notice" },
          description: "",
          kind: "numeric",
          options: null,
          sections: ["Paper 2"],
        },
      ],
      subjects: [
        { group: "Paper 1", name: "Mathematics" },
        { name: "Algebra", partOf: "Mathematics" },
        { group: "Paper 2", name: "Law" },
      ],
    } as ExamStructure;

    const format = getMockFormatMix(structure)[0];

    if (!format) {
      throw new Error("Expected a choice format");
    }

    const skills = [{ area: "Mathematics" }, { area: "Algebra" }, { area: "Law" }];

    expect(
      skills.filter(
        (skill) => getMockWritingFormat({ format, names: [skill.area], structure }) !== null,
      ),
    ).toStrictEqual(skills.slice(0, 2));
  });
});
