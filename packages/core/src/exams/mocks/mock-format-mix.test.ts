import { describe, expect, it } from "vitest";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import {
  getFormatMixSource,
  getFormatQuotas,
  getItemFormatKey,
  getMockFormatMix,
} from "./mock-format-mix";

const citation = { passage: "From the notice.", sourceId: "notice" };

type Format = ExamStructure["formats"][number];

function structureOf(formats: Partial<Format>[]) {
  return {
    formats: formats.map((format) => ({
      citation,
      description: "",
      kind: "multipleChoice" as const,
      options: 4,
      ...format,
    })),
    pastOptions: null,
  };
}

/** JEE Advanced's brochure: one right option, one or more, an integer typed in; no counts. */
const JEE_ADVANCED = structureOf([
  {},
  { select: "all" },
  { entry: { kind: "integer", places: null }, kind: "numeric", options: null },
]);

describe(getMockFormatMix, () => {
  it("asks each format the notice lists in equal parts when it gives no counts", () => {
    const mix = getMockFormatMix(JEE_ADVANCED);

    expect(mix.map(({ key, share }) => ({ key, share }))).toStrictEqual([
      { key: "choice", share: 1 / 3 },
      { key: "picks:all", share: 1 / 3 },
      { key: "numeric:integer:", share: 1 / 3 },
    ]);

    expect(mix.map((format) => format.writer)).toStrictEqual([
      { kind: "quick" },
      { answerFormat: { entry: null, format: "multipleChoice", select: "all" }, kind: "item" },
      {
        answerFormat: { entry: { kind: "integer", places: null }, format: "numeric", select: null },
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
      { key: "choice", share: 0.8 },
      { key: "numeric:number:", share: 0.2 },
    ]);

    expect(getFormatMixSource(jeeMain)).toBe("notice");

    const sat = structureOf([{ share: 0.75 }, { kind: "shortAnswer", options: null }]);

    expect(getMockFormatMix(sat).map(({ key, share }) => ({ key, share }))).toStrictEqual([
      { key: "choice", share: 0.75 },
      { key: "typed", share: 0.25 },
    ]);
  });

  it("asks one pick only for an exam that lists only one, and without a blueprint", () => {
    const enem = structureOf([{ options: 5 }, { kind: "essay", options: null }]);

    expect(getMockFormatMix(enem)).toStrictEqual([
      { key: "choice", share: 1, writer: { kind: "quick" } },
    ]);

    expect(getMockFormatMix(null)).toStrictEqual([
      { key: "choice", share: 1, writer: { kind: "quick" } },
    ]);
  });
});

function keyOf(format: string, content: object) {
  return getItemFormatKey({ item: { content, format }, mix: getMockFormatMix(JEE_ADVANCED) });
}

describe(getItemFormatKey, () => {
  it("puts a bank question in the format it's answered in", () => {
    expect(keyOf("multipleChoice", { select: 1 })).toBe("choice");
    expect(keyOf("multipleChoice", {})).toBe("choice");
    expect(keyOf("multipleChoice", { select: "all" })).toBe("picks:all");
    expect(keyOf("multipleChoice", { select: 2 })).toBe("picks:all");
    expect(keyOf("numeric", { entry: { kind: "integer", places: null } })).toBe("numeric:integer:");
    expect(keyOf("numeric", {})).toBe("numeric:integer:");
    expect(keyOf("typed", {})).toBeNull();
  });
});

describe(getFormatQuotas, () => {
  it("shares a section's questions among the formats, all of them asked", () => {
    expect(getFormatQuotas({ mix: getMockFormatMix(JEE_ADVANCED), wanted: 17 })).toStrictEqual(
      new Map([
        ["choice", 6],
        ["picks:all", 6],
        ["numeric:integer:", 5],
      ]),
    );
  });
});
