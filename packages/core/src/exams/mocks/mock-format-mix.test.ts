import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listSectionParts } from "./exam-parts";
import {
  ONE_PICK_MIX,
  getAreaFormat,
  getFormatMixSource,
  getFormatQuotas,
  getItemFormatKey,
  getMockFormatMix,
} from "./mock-format-mix";

const citation = { passage: "From the notice.", sourceId: "notice" };

type Format = ExamStructure["formats"][number];
type Section = NonNullable<ExamStructure["mock"]>["sections"][number];

function structureOf(
  formats: Partial<Format>[],
  { sections = [], subjects = [] }: { sections?: Partial<Section>[]; subjects?: string[] } = {},
): ExamStructure {
  return {
    formats: formats.map((format) => ({
      citation,
      description: "",
      kind: "multipleChoice" as const,
      options: 4,
      ...format,
    })),
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "", method: "raw" },
      sections: sections.map((section) => ({
        day: null,
        kind: "objective",
        minutes: 30,
        name: "",
        questions: 10,
        ...section,
      })),
      timeLimitMinutes: null,
      totalQuestions: null,
    },
    pastOptions: null,
    rules: [],
    subjects: subjects.map((name) => ({ citation, name, questions: 10, topics: [], weight: null })),
  };
}

function keysIn({ section, structure }: { section: string; structure: ExamStructure }) {
  return getMockFormatMix(structure, listSectionParts({ section, structure })).map(
    (format) => format.key,
  );
}

const JEE_ADVANCED = structureOf([
  {},
  { select: "all" },
  { entry: { kind: "integer", places: null }, kind: "numeric", options: null },
]);

const VERBAL = "Verbal Reasoning";
const QUANT = "Quantitative Reasoning";

const GRE = structureOf(
  [
    { description: "Compare two quantities", sections: [QUANT] },
    { description: "One answer", options: 5 },
    { description: "Fill each blank from its column", options: 5, sections: [VERBAL] },
    { description: "Two equivalent answers", options: 6, sections: [VERBAL], select: 2 },
    { description: "All that apply", options: null, select: "all" },
    {
      description: "Type a number",
      entry: { kind: "fraction", places: null },
      kind: "numeric",
      options: null,
      sections: [QUANT],
    },
    { description: "Essay", kind: "essay", options: null, sections: ["Analytical Writing"] },
  ],
  {
    sections: [
      { kind: "written", name: "Analytical Writing" },
      { name: `${VERBAL} (Section 1)` },
      { name: `${VERBAL} (Section 2)` },
      { name: `${QUANT} (Section 1)` },
      { name: `${QUANT} (Section 2)` },
    ],
    subjects: ["Analytical Writing", VERBAL, QUANT],
  },
);

describe(getMockFormatMix, () => {
  it("asks each format the notice lists in equal parts when it gives no counts", () => {
    const mix = getMockFormatMix(JEE_ADVANCED);

    expect(mix.map(({ key, share }) => ({ key, share }))).toStrictEqual([
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

    expect(getMockFormatMix(jeeMain).map(({ key, share }) => ({ key, share }))).toStrictEqual([
      { key: "choice:4", share: 0.8 },
      { key: "numeric:number:", share: 0.2 },
    ]);

    expect(getFormatMixSource(jeeMain)).toBe("notice");
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

  it("asks the GRE's Verbal formats in Verbal sections and its Quant formats in Quant ones", () => {
    expect(keysIn({ section: `${VERBAL} (Section 1)`, structure: GRE })).toStrictEqual([
      "choice:5",
      "picks:2",
      "picks:all",
    ]);

    expect(keysIn({ section: `${QUANT} (Section 2)`, structure: GRE })).toStrictEqual([
      "choice:4",
      "choice:5",
      "picks:all",
      "numeric:fraction:",
    ]);
  });

  it("asks a JEE's choices in every subject and its numbers only where the notice ties them", () => {
    const formats = [{}, { kind: "numeric" as const, options: null, sections: ["Mathematics"] }];
    const subjects = ["Physics", "Chemistry", "Mathematics"];

    const bySubject = structureOf(formats, {
      sections: subjects.map((name) => ({ name })),
      subjects,
    });

    expect(keysIn({ section: "Physics", structure: bySubject })).toStrictEqual(["choice:4"]);

    expect(keysIn({ section: "Mathematics", structure: bySubject })).toStrictEqual([
      "choice:4",
      "numeric:number:",
    ]);

    const byPaper = structureOf(formats, {
      sections: [{ name: "Paper 1" }, { name: "Paper 2" }],
      subjects,
    });

    expect(keysIn({ section: "Paper 1", structure: byPaper })).toStrictEqual([
      "choice:4",
      "numeric:number:",
    ]);
  });

  it("asks an exam's one format in every section when the notice ties it to none", () => {
    const oab = structureOf([{ options: 4 }], {
      sections: [
        { name: "Prova objetiva" },
        { kind: "written", name: "Prova prático-profissional" },
      ],
      subjects: ["Ética profissional", "Direito constitucional"],
    });

    const cebraspe = structureOf([{ kind: "trueFalse", options: null }], {
      sections: [{ name: "Conhecimentos básicos" }, { name: "Conhecimentos específicos" }],
      subjects: ["Língua portuguesa", "Auditoria"],
    });

    expect(keysIn({ section: "Prova objetiva", structure: oab })).toStrictEqual(["choice:4"]);

    expect(keysIn({ section: "Conhecimentos específicos", structure: cebraspe })).toStrictEqual([
      "choice:tf",
    ]);
  });

  it("tells parts apart by their whole name, whatever language names them", () => {
    const notice = structureOf(
      [
        { options: 5, sections: ["Parte A"] },
        { kind: "trueFalse", options: null, sections: ["Parte B"] },
      ],
      { sections: [{ name: "Parte A" }, { name: "Parte B" }], subjects: ["Matemática"] },
    );

    expect(keysIn({ section: "Parte A", structure: notice })).toStrictEqual(["choice:5"]);
    expect(keysIn({ section: "Parte B", structure: notice })).toStrictEqual(["choice:tf"]);
  });

  it("places a subject in the section of its exact name before any looser match", () => {
    const parts = structureOf(
      [
        { options: 5, sections: ["Parte A"] },
        { kind: "trueFalse", options: null, sections: ["Parte B"] },
      ],
      { sections: [{ name: "Parte A" }, { name: "Parte B" }], subjects: ["Parte A", "Parte B"] },
    );

    expect(keysIn({ section: "Parte A", structure: parts })).toStrictEqual(["choice:5"]);
    expect(keysIn({ section: "Parte B", structure: parts })).toStrictEqual(["choice:tf"]);
  });
});

function greFormat(key: string) {
  const found = getMockFormatMix(GRE).find((candidate) => candidate.key === key);

  if (!found) {
    throw new Error(`No ${key} format`);
  }

  return found;
}

describe(getAreaFormat, () => {
  it("gives a skill the formats its subject's sections ask, in their own style", () => {
    expect(
      getAreaFormat({ area: VERBAL, format: greFormat("choice:5"), structure: GRE }),
    ).toMatchObject({
      sections: [],
      style:
        "multipleChoice (5 options): One answer multipleChoice (5 options): Fill each blank from its column",
    });

    expect(
      getAreaFormat({ area: QUANT, format: greFormat("choice:5"), structure: GRE }),
    ).toMatchObject({ style: "multipleChoice (5 options): One answer" });

    expect(getAreaFormat({ area: QUANT, format: greFormat("picks:2"), structure: GRE })).toBeNull();

    expect(
      getAreaFormat({ area: QUANT, format: greFormat("numeric:fraction:"), structure: GRE }),
    ).toMatchObject({ sections: [QUANT] });
  });

  it("gives a skill of no known area every format", () => {
    expect(
      getAreaFormat({ area: null, format: greFormat("picks:2"), structure: GRE }),
    ).toMatchObject({ key: "picks:2" });
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
    expect(keyOf("multipleChoice", { options: options(4) }, GRE)).toBe("choice:4");
    expect(keyOf("multipleChoice", { options: options(5) }, GRE)).toBe("choice:5");
    expect(keyOf("multipleChoice", { options: options(3) }, GRE)).toBeNull();

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
