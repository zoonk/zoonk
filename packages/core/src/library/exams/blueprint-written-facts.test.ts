import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { describe, expect, it } from "vitest";
import { toKeptFacts } from "./blueprint-kept";
import { toWrittenGrading, writtenRuleFacts } from "./blueprint-written-facts";

type Task = NonNullable<BlueprintExtraction["mock"]>["sections"][number]["tasks"][number];
type Grading = NonNullable<Task["grading"]>;

const LINES = {
  argument: "Argument (0–4 marks): how well the essay supports its position.",
  argumentFour: "4 marks: a clear position supported by two developed reasons.",
  argumentTwo: "2 marks: a position with one undeveloped reason.",
  argumentZero: "0 marks: no position is taken.",
  average: "The essay mark is the mean of the two criteria, given in half marks.",
  cap: "An essay that ignores the set question scores at most 1 mark for Argument.",
  convention: "Quoting the source text without comment earns no credit.",
  language: "Language (0–4 marks): accuracy and range of vocabulary and grammar.",
  rounding: "Marks are rounded down to the nearest half mark.",
  zero: "A blank answer scores 0.",
  zeroConduct: "Candidates who sign the answer sheet are disqualified.",
};

const DOCUMENTS = [{ sourceId: "guide", text: Object.values(LINES).join("\n") }];

function rule(passage: string) {
  return { document: 1, passage, text: passage };
}

function award({ passage, points }: { passage: string; points: number }) {
  return { ...rule(passage), count: null, points, pointsHigh: null };
}

function sheet(overrides: Partial<Grading> = {}): Grading {
  return {
    combination: null,
    conventions: [],
    criteria: [
      {
        ...rule(LINES.argument),
        awards: [
          award({ passage: LINES.argumentZero, points: 0 }),
          award({ passage: LINES.argumentTwo, points: 2 }),
          award({ passage: LINES.argumentFour, points: 4 }),
        ],
        id: "argument",
        parts: [],
        points: 4,
        weight: null,
      },
      { ...rule(LINES.language), awards: [], id: "language", parts: [], points: 4, weight: null },
    ],
    deductions: [],
    language: null,
    limits: [],
    rounding: null,
    zeroing: [{ ...rule(LINES.zero), kinds: ["blank"], maxLines: null }],
    ...overrides,
  };
}

function task(grading: Grading): Task {
  return {
    count: 1,
    description: "the essay",
    grading,
    handwritten: null,
    lines: null,
    officialIdentifier: null,
    passages: [{ document: 1, passage: LINES.argument }],
    plays: null,
    points: 8,
  };
}

const ID = "mock.sections.0.tasks.0";

function keep({
  grading,
  unsupported = [],
}: {
  grading: Grading;
  unsupported?: string[];
}): ReturnType<typeof toWrittenGrading> {
  const facts = writtenRuleFacts({ documents: DOCUMENTS, id: ID, task: task(grading) });
  const dropped = new Set(unsupported.map((key) => `${ID}.grading.${key}`));

  const kept = toKeptFacts({
    facts,
    supportedIds: facts.map(({ id }) => id).filter((id) => !dropped.has(id)),
  });

  return toWrittenGrading({ grading, id: ID, kept });
}

function statements(grading: Grading): Map<string, string> {
  const facts = writtenRuleFacts({ documents: DOCUMENTS, id: ID, task: task(grading) });
  return new Map(facts.map(({ id, statement }) => [id.replace(`${ID}.grading.`, ""), statement]));
}

describe("citing a written task's scoring sheet", () => {
  it("keeps a board's scale with each level's points and descriptor", () => {
    const kept = keep({ grading: sheet() });

    expect(kept?.criteria[0]?.awards).toStrictEqual([
      {
        citation: { passage: LINES.argumentZero, sourceId: "guide" },
        points: 0,
        text: LINES.argumentZero,
      },
      {
        citation: { passage: LINES.argumentTwo, sourceId: "guide" },
        points: 2,
        text: LINES.argumentTwo,
      },
      {
        citation: { passage: LINES.argumentFour, sourceId: "guide" },
        points: 4,
        text: LINES.argumentFour,
      },
    ]);

    expect(kept?.criteria[1]).toStrictEqual({
      citation: { passage: LINES.language, sourceId: "guide" },
      id: "language",
      points: 4,
      text: LINES.language,
    });

    expect(kept?.totalSuppressed).toBeUndefined();
  });

  it("asks each rule's own passage for every number the rule carries", () => {
    const grading = sheet({
      combination: { ...rule(LINES.average), method: "mean", step: 0.5 },
      criteria: sheet().criteria.map((criterion, index) => ({ ...criterion, weight: index + 2 })),
      limits: [{ ...rule(LINES.cap), criteria: ["argument"], max: 1 }],
      rounding: { ...rule(LINES.rounding), mode: "down", stage: "total", step: 0.5 },
    });

    const claims = statements(grading);

    expect(claims.get("criteria.0")).toMatch(/at most 4 points.*weight 2/u);
    expect(claims.get("criteria.0.awards.1")).toContain("2 points");
    expect(claims.get("combination")).toMatch(/weighted mean.*steps of 0\.5/u);
    expect(claims.get("limits.0")).toMatch(/Argument.*at most 1 point\b/u);
    expect(claims.get("rounding")).toMatch(/down.*0\.5.*answer's mark/u);
  });

  it("keeps a weighted mean, its step, a cap and a rounding rule when each is cited", () => {
    const kept = keep({
      grading: sheet({
        combination: { ...rule(LINES.average), method: "mean", step: 0.5 },
        conventions: [rule(LINES.convention)],
        criteria: sheet().criteria.map((criterion) => ({ ...criterion, weight: 2 })),
        limits: [{ ...rule(LINES.cap), criteria: ["argument"], max: 1 }],
        rounding: { ...rule(LINES.rounding), mode: "down", stage: "total", step: 0.5 },
      }),
    });

    expect(kept).toMatchObject({
      combination: { method: "mean", step: 0.5, text: LINES.average },
      conventions: [{ text: LINES.convention }],
      criteria: [{ weight: 2 }, { weight: 2 }],
      limits: [{ criteria: ["argument"], max: 1, text: LINES.cap }],
      rounding: { mode: "down", stage: "total", step: 0.5 },
    });

    expect(kept?.totalSuppressed).toBeUndefined();
  });

  it("stores no rule for a plain sum, since criteria add up when nothing says otherwise", () => {
    const kept = keep({
      grading: sheet({ combination: { ...rule(LINES.average), method: "sum", step: null } }),
    });

    expect(kept?.combination).toBeNull();
    expect(kept?.totalSuppressed).toBeUndefined();
  });

  it.each([
    ["one of a scale's levels", "criteria.0.awards.1"],
    ["a criterion", "criteria.1"],
    ["a cap", "limits.0"],
    ["the combination", "combination"],
    ["a convention", "conventions.0"],
    ["the rounding", "rounding"],
    ["a zero rule", "zeroing.0"],
  ])("works out no total when %s fails its check", (_rule, key) => {
    const grading = sheet({
      combination: { ...rule(LINES.average), method: "mean", step: 0.5 },
      conventions: [rule(LINES.convention)],
      limits: [{ ...rule(LINES.cap), criteria: ["argument"], max: 1 }],
      rounding: { ...rule(LINES.rounding), mode: "down", stage: "total", step: 0.5 },
    });

    expect(keep({ grading })?.totalSuppressed).toBeUndefined();
    expect(keep({ grading, unsupported: [key] })?.totalSuppressed).toBe(true);
  });

  it("drops a scale with an unconfirmed level and keeps the criterion's maximum", () => {
    const kept = keep({ grading: sheet(), unsupported: ["criteria.0.awards.0"] });

    expect(kept?.criteria[0]).toMatchObject({ id: "argument", points: 4 });
    expect(kept?.criteria[0]?.awards).toBeUndefined();
  });

  it("keeps counted elements only when every one is cited", () => {
    const parts = [
      { ...rule(LINES.argumentTwo), id: "reason" },
      { ...rule(LINES.argumentFour), id: "development" },
    ];

    const grading = sheet({
      criteria: sheet().criteria.map((criterion, index) =>
        index === 0 ? { ...criterion, parts } : criterion,
      ),
    });

    expect(keep({ grading })?.criteria[0]?.parts?.map(({ id }) => id)).toStrictEqual([
      "reason",
      "development",
    ]);

    const lost = keep({ grading, unsupported: ["criteria.0.parts.1"] });

    expect(lost?.criteria[0]?.parts).toBeUndefined();
    expect(lost?.totalSuppressed).toBe(true);
  });

  it("works out no total when the criteria combine in a way it can't compute", () => {
    const kept = keep({
      grading: sheet({ combination: { ...rule(LINES.average), method: "other", step: null } }),
    });

    expect(kept?.combination).toBeNull();
    expect(kept?.totalSuppressed).toBe(true);
  });

  it("works out no total when the documents take marks off in a way the sheet can't hold", () => {
    const kept = keep({ grading: sheet({ deductions: [rule(LINES.convention)] }) });

    expect(kept?.totalSuppressed).toBe(true);
  });

  it("works out no total from a single level, which is no scale", () => {
    const [lowest] = sheet().criteria[0]!.awards;

    const kept = keep({
      grading: sheet({
        criteria: sheet().criteria.map((criterion, index) =>
          index === 0 ? { ...criterion, awards: [lowest!] } : criterion,
        ),
      }),
    });

    expect(kept?.criteria[0]?.awards).toBeUndefined();
    expect(kept?.totalSuppressed).toBe(true);
  });

  it("asks nothing about a conduct rule a typed answer can't break", () => {
    const grading = sheet({
      zeroing: [{ ...rule(LINES.zeroConduct), kinds: ["other"], maxLines: null }],
    });

    expect(statements(grading).has("zeroing.0")).toBe(false);
    expect(keep({ grading })).toMatchObject({ zeroing: [] });
    expect(keep({ grading })?.totalSuppressed).toBeUndefined();
  });
});
