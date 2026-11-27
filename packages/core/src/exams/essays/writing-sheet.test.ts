import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { type WritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { describe, expect, it } from "vitest";
import { sectionTaskSchema, writtenGradingSchema } from "../../library/exams/written-grading";
import cguIssuedTask from "./_test-utils/cgu-issued-task.json";
import { SCORING_SHEET_EXAMPLES, type ScoringSheetExample } from "./_test-utils/scoring-sheets";
import { applyWritingArithmetic, buildWritingFeedback } from "./_utils/writing-feedback";
import { isComputableSheet, listWritingRows } from "./_utils/writing-sheet";
import { matchesWritingTaskBasis } from "./_utils/writing-task-basis";
import { writtenItemSchema } from "./writing-contract";

type Evidence = Pick<WritingEvidence, "awards"> &
  Partial<Pick<WritingEvidence, "elements" | "errors" | "limits">>;

function issue({ aspects, grading, keySource, lines, points }: ScoringSheetExample) {
  return writtenItemSchema.parse({
    aspects,
    assessedSkillIds: ["0195f1d2-7c4a-7d3e-9a10-4b5c6d7e8f90"],
    criteria: grading.criteria.map(({ id, points: max, text }) => ({
      id,
      name: text,
      points: max,
    })),
    grading,
    keySource,
    lines,
    minimumWords: 0,
    points,
    taskKey: "task",
    title: "A question",
    unit: "answer",
  });
}

function mark({
  basis,
  estimatedLines = 10,
  evidence,
  text,
}: {
  basis: ReturnType<typeof issue>;
  estimatedLines?: number;
  evidence: Evidence;
  text: string;
}) {
  const reported: WritingEvidence = {
    criteria: [],
    elements: [],
    errors: [],
    limits: [],
    nextStep: null,
    onTopicQuote: null,
    zeroKind: null,
    zeroQuote: null,
    zeroRuleIndex: null,
    ...evidence,
  };

  const feedback = buildWritingFeedback({
    basis,
    eligible: text,
    evidence: reported,
    ignoredFrom: null,
    previousNextSteps: [],
  });

  return applyWritingArithmetic({
    basis,
    context: null,
    eligible: text,
    estimatedLines,
    evidence: reported,
    feedback,
    numeric: true,
  });
}

function awards(...chosen: [award: number, quote: string | null][]) {
  return chosen.map(([award, quote], row) => ({ award, quote, row }));
}

const FILLER = Array.from(
  { length: 8 },
  () => "Sem salas por perto, quem mora longe dos grandes centros quase nunca vê um filme.",
).join(" ");

const ESSAY = `O governo federal deve abrir salas em cidades pequenas, por meio de editais anuais, para ampliar o acesso. ${FILLER}`;

describe("a banded essay with counted elements and caps", () => {
  const basis = issue(SCORING_SHEET_EXAMPLES.enem);

  const bands = awards(
    [5, "O governo federal deve abrir salas"],
    [4, "abrir salas em cidades pequenas"],
    [3, "para ampliar o acesso"],
    [5, "por meio de editais anuais"],
    [5, "O governo federal deve abrir salas em cidades pequenas"],
  );

  const elements = [
    { part: "agent", quote: "O governo federal", row: 4 },
    { part: "action", quote: "abrir salas em cidades pequenas", row: 4 },
    { part: "means", quote: "por meio de editais anuais", row: 4 },
    { part: "means", quote: "editais anuais", row: 4 },
    { part: "effect", quote: "a passage the answer never wrote", row: 4 },
    { part: "sponsor", quote: "O governo federal", row: 4 },
  ];

  it("sums the bands and lowers an award to the elements the answer shows", () => {
    const grade = mark({ basis, evidence: { awards: bands, elements }, text: ESSAY });

    expect(grade).toMatchObject({
      content: { high: 800, low: 800 },
      kind: "points",
      max: 1000,
      total: { high: 800, low: 800 },
    });

    expect(grade.kind === "points" && grade.rows.map(({ earned }) => earned)).toStrictEqual([
      200, 160, 120, 200, 120,
    ]);
  });

  it("caps the named criteria only when the limit's quote is in the answer", () => {
    const capped = mark({
      basis,
      evidence: {
        awards: bands,
        elements,
        limits: [
          { limit: 0, quote: "deve abrir salas" },
          { limit: 1, quote: "a passage the answer never wrote" },
        ],
      },
      text: ESSAY,
    });

    expect(capped).toMatchObject({ content: { high: 760, low: 760 } });

    expect(capped.kind === "points" && capped.rows.at(-1)).toMatchObject({ earned: 80, max: 200 });
  });

  it("stays on levels when a band above the lowest has no passage in the answer", () => {
    const [, ...rest] = bands;

    const grade = mark({
      basis,
      evidence: { awards: [{ award: 5, quote: "invented words", row: 0 }, ...rest], elements },
      text: ESSAY,
    });

    expect(grade.kind).toBe("levels");

    expect(grade.criteria.map(({ level }) => level)).toStrictEqual([
      "complete",
      "strong",
      "partial",
      "complete",
      "partial",
    ]);
  });

  it.each([
    [5, "complete"],
    [4, "strong"],
    [3, "partial"],
    [2, "partial"],
    [1, "missing"],
    [0, "missing"],
  ] as const)("reads award %i of six as %s", (award, level) => {
    const grade = mark({
      basis,
      evidence: { awards: awards([award, "Sem salas por perto"]) },
      text: ESSAY,
    });

    expect(grade.criteria[0]?.level).toBe(level);
  });
});

describe("a question keyed by aspects", () => {
  const basis = issue(SCORING_SHEET_EXAMPLES.oab);
  const answer = "Não é preciso comum acordo. Art. 114. O prazo é de quatro anos. Art. 114.";

  it("adds decimal marks and counts a quote that occurs twice", () => {
    const grade = mark({
      basis,
      evidence: {
        awards: awards(
          [1, "Não é preciso comum acordo"],
          [1, "Art. 114."],
          [1, "quatro anos"],
          [0, null],
        ),
      },
      text: answer,
    });

    expect(grade).toMatchObject({ content: { high: 1.15, low: 1.15 }, max: 1.25 });

    expect(grade.kind === "points" && grade.rows).toMatchObject([
      { earned: 0.85, id: "a", max: 0.85 },
      { earned: 0.3, id: "b", max: 0.4 },
    ]);

    expect(grade.criteria.map(({ level }) => level)).toStrictEqual(["complete", "strong"]);
  });

  it("gives an aspect its lowest award when its quote is not in the answer", () => {
    const grade = mark({
      basis,
      evidence: {
        awards: awards(
          [1, "Não é preciso comum acordo"],
          [1, "Constituição, art. 114, § 2º"],
          [1, "quatro anos"],
          [1, null],
        ),
      },
      text: answer,
    });

    expect(grade).toMatchObject({ content: { high: 1.05, low: 1.05 }, kind: "points" });
  });

  it("takes an aspect's own steps of credit when its key writes them", () => {
    const [thesis, ...others] = basis.aspects;

    const stepped = {
      ...basis,
      aspects: [
        {
          ...thesis,
          awards: [
            { points: 0, text: "Not made" },
            { points: 0.4, text: "Named" },
            { points: 0.75, text: "Explained" },
          ],
        },
        ...others,
      ],
    };

    const grade = mark({
      basis: writtenItemSchema.parse(stepped),
      evidence: { awards: awards([1, "comum acordo"], [0, null], [0, null], [0, null]) },
      text: answer,
    });

    expect(grade).toMatchObject({ content: { high: 0.4, low: 0.4 } });
  });
});

describe("a keyed question with a language deduction", () => {
  const example = SCORING_SHEET_EXAMPLES.cebraspe;

  const answer =
    "O ajuste fiscal veio antes da moeda. Os planos anteriores fracasaram. Havia inflacao.";

  const evidence = {
    awards: awards([1, "O ajuste fiscal"], [1, "planos anteriores"], [1, "veio antes"], [0, null]),
    errors: [
      { correction: "fracassaram", kind: "spelling", quote: "fracasaram" },
      { correction: "inflação", kind: "spelling", quote: "inflacao" },
    ],
  };

  it("ranges the total only by the lines a handwritten sheet would take", () => {
    const grade = mark({ basis: issue(example), evidence, text: answer });

    expect(grade).toMatchObject({
      content: { high: 21, low: 21 },
      deduction: { high: 12 / 9, low: 1.2 },
      total: { high: 19.8, low: 21 - 12 / 9 },
    });
  });

  it("rounds at the stage the sheet cites", () => {
    const citation = { passage: "Marks keep two decimal places.", sourceId: "notice" };

    const rounded = issue({
      ...example,
      grading: {
        ...example.grading,
        rounding: { citation, mode: "nearest", stage: "total", step: 0.01, text: "Two places" },
      },
    });

    expect(mark({ basis: rounded, evidence, text: answer })).toMatchObject({
      total: { high: 19.8, low: 19.67 },
    });
  });

  it("gives a verified zero no points, whatever the awards say", () => {
    const grade = mark({ basis: issue(example), evidence: { awards: [] }, text: "" });

    expect(grade).toMatchObject({
      content: { high: 0, low: 0 },
      total: { high: 0, low: 0 },
      zeroKind: "blank",
    });
  });
});

describe("four scales averaged to a half band", () => {
  const basis = issue(SCORING_SHEET_EXAMPLES.ielts);
  const answer = "Cities should fund public transport because it cuts traffic and pollution.";

  it.each([
    { bands: [7, 6, 6, 6], total: 6.5 },
    { bands: [7, 7, 6, 6], total: 6.5 },
    { bands: [7, 7, 7, 6], total: 7 },
    { bands: [6, 6, 6, 6], total: 6 },
  ])("reports $bands as $total", ({ bands, total }) => {
    const grade = mark({
      basis,
      evidence: {
        awards: awards(...bands.map((band): [number, string] => [band, "Cities should"])),
      },
      text: answer,
    });

    expect(grade).toMatchObject({ decimals: 1, max: 9, total: { high: total, low: total } });
  });
});

describe("independent rows, one with a count condition", () => {
  const basis = issue(SCORING_SHEET_EXAMPLES.ap);

  const answer =
    "Railroads reshaped the West. The Homestead Act drew settlers. The Pacific Railway Act funded the lines.";

  const chosen = awards(
    [1, "Railroads reshaped the West"],
    [0, null],
    [2, "The Homestead Act drew settlers"],
    [1, "funded the lines"],
  );

  it("credits the evidence row when two separate passages show it", () => {
    const grade = mark({
      basis,
      evidence: {
        awards: chosen,
        elements: [
          { part: null, quote: "The Homestead Act drew settlers", row: 2 },
          { part: null, quote: "The Pacific Railway Act funded the lines", row: 2 },
        ],
      },
      text: answer,
    });

    expect(grade).toMatchObject({ max: 6, total: { high: 4, low: 4 } });
  });

  it("counts overlapping passages once", () => {
    const grade = mark({
      basis,
      evidence: {
        awards: chosen,
        elements: [
          { part: null, quote: "The Homestead Act drew settlers", row: 2 },
          { part: null, quote: "Homestead Act", row: 2 },
        ],
      },
      text: answer,
    });

    expect(grade).toMatchObject({ total: { high: 2, low: 2 } });
  });
});

describe("one holistic mark", () => {
  it("ranges the total by the span its band states", () => {
    const grade = mark({
      basis: issue(SCORING_SHEET_EXAMPLES.holistic),
      evidence: { awards: awards([4, "a balanced argument"]) },
      text: "The essay sets out a balanced argument and reaches a judgement.",
    });

    expect(grade).toMatchObject({
      content: { high: 20, low: 16 },
      max: 25,
      rows: [{ earned: 16, max: 25, range: { high: 20, low: 16 } }],
      total: { high: 20, low: 16 },
    });
  });

  it("takes a language penalty off each end of the band, never below zero", () => {
    const citation = { passage: "Each error costs ten marks.", sourceId: "notice" };
    const example = SCORING_SHEET_EXAMPLES.holistic;

    const penalized = issue({
      ...example,
      grading: {
        ...example.grading,
        language: {
          citation,
          factor: 10,
          formula: "mark = content - 10 × errors",
          method: "perError",
          text: "Ten marks an error",
        },
      },
    });

    const grade = mark({
      basis: penalized,
      evidence: {
        awards: awards([1, "in broad terms"]),
        errors: [{ correction: "essay", kind: "spelling", quote: "esay" }],
      },
      text: "The esay addresses the question in broad terms.",
    });

    expect(grade).toMatchObject({
      content: { high: 5, low: 1 },
      deduction: { high: 5, low: 1 },
      total: { high: 0, low: 0 },
    });
  });

  it("keeps a criterion rounded up at its maximum", () => {
    const citation = { passage: "Marks are rounded up to even numbers.", sourceId: "notice" };
    const example = SCORING_SHEET_EXAMPLES.holistic;

    const rounded = issue({
      ...example,
      grading: {
        ...example.grading,
        rounding: { citation, mode: "up", stage: "criterion", step: 2, text: "Even marks" },
      },
    });

    const grade = mark({
      basis: rounded,
      evidence: { awards: awards([5, "a well-substantiated judgement"]) },
      text: "The essay reaches a well-substantiated judgement.",
    });

    expect(grade).toMatchObject({ rows: [{ max: 25, range: { high: 25, low: 22 } }] });
  });
});

describe("a criterion with no scale and no key", () => {
  const basis = writtenItemSchema.parse({
    ...issue(SCORING_SHEET_EXAMPLES.holistic),
    criteria: [{ id: "argument", name: "Argument", points: null }],
    grading: { criteria: [], language: null, rounding: null, zeroing: [] },
    points: null,
  });

  it("is marked on four steps that carry no points", () => {
    expect(listWritingRows(basis)).toMatchObject([
      { awards: [{ points: null }, { points: null }, { points: null }, { points: null }] },
    ]);

    const grade = mark({
      basis,
      evidence: { awards: awards([2, "an argument"]) },
      text: "an argument",
    });

    expect(grade).toMatchObject({
      criteria: [{ id: "argument", level: "strong" }],
      kind: "levels",
    });
  });
});

describe("sheets stored before awards existed", () => {
  const citation = { passage: "Official grading rules", sourceId: "notice" };
  const stored = { language: null, rounding: null, zeroing: [] };

  it("reads a stored kind away and keeps a dropped rule as a suppressed total", () => {
    const pointed = [{ citation, id: "content", points: 30, text: "Content" }];

    const points = writtenGradingSchema.parse({ ...stored, criteria: pointed, kind: "points" });
    const dropped = writtenGradingSchema.parse({ ...stored, criteria: pointed, kind: "levels" });
    const unpointed = writtenGradingSchema.parse({ ...stored, criteria: [], kind: "levels" });

    expect(points).not.toHaveProperty("kind");
    expect(isComputableSheet({ grading: points, points: 30 })).toBe(true);
    expect(dropped).toMatchObject({ totalSuppressed: true });
    expect(isComputableSheet({ grading: dropped, points: 30 })).toBe(false);
    expect(unpointed).not.toHaveProperty("totalSuppressed");
  });

  it("still grades a question issued with a kind against its original key", () => {
    const task = sectionTaskSchema.parse(cguIssuedTask.task);

    const issued = writtenItemSchema.parse({
      ...cguIssuedTask.writing,
      grading: cguIssuedTask.task.grading,
      taskBasis: cguIssuedTask.taskBasis,
    });

    expect(
      matchesWritingTaskBasis({
        prompt: issued,
        task: { grading: task.grading ?? issued.grading, lines: 30, points: 30 },
      }),
    ).toBe(true);

    const grade = mark({
      basis: issued,
      evidence: { awards: awards([1, "Texto"], [1, "déficit"], [0, null], [1, "etapas"]) },
      text: "Texto sobre o déficit e as etapas do plano.",
    });

    expect(grade).toMatchObject({ content: { high: 21, low: 21 }, kind: "points", max: 30 });
  });

  it("keeps an issued question when a new reading of its notice splits or groups its zero rules", () => {
    const task = sectionTaskSchema.parse(cguIssuedTask.task);
    const grading = task.grading ?? writtenGradingSchema.parse(cguIssuedTask.task.grading);

    const issued = writtenItemSchema.parse({
      ...cguIssuedTask.writing,
      grading: cguIssuedTask.task.grading,
      taskBasis: cguIssuedTask.taskBasis,
    });

    const reread = (zeroing: typeof grading.zeroing, rounding = grading.rounding) =>
      matchesWritingTaskBasis({
        prompt: issued,
        task: { grading: { ...grading, rounding, zeroing }, lines: 30, points: 30 },
      });

    const split = [
      { citation, kinds: ["offTopic"], text: "fuga ao tema" },
      { citation, kinds: ["blank"], text: "ausência de texto" },
    ] satisfies typeof grading.zeroing;

    expect(reread(split)).toBe(true);
    expect(reread(split.toReversed())).toBe(true);
    expect(reread(split.slice(0, 1))).toBe(false);

  });

  it("keeps a question issued before rounding was read as numbers, whatever its rounding says", () => {
    const task = sectionTaskSchema.parse(cguIssuedTask.task);
    const grading = task.grading ?? writtenGradingSchema.parse(cguIssuedTask.task.grading);
    const rule = { citation, text: "duas casas decimais" };

    const matches = (saved: string, rounding: typeof grading.rounding) =>
      matchesWritingTaskBasis({
        prompt: { grading, lines: 30, points: 30, taskBasis: saved },
        task: { grading: { ...grading, rounding }, lines: 30, points: 30 },
      });

    const guessed = cguIssuedTask.taskBasis.replace(
      '"rounding":null',
      '"rounding":{"mode":"nearest","places":2}',
    );

    expect(guessed).not.toBe(cguIssuedTask.taskBasis);
    expect(matches(guessed, rule)).toBe(true);
    expect(matches(guessed, { ...rule, mode: "nearest", stage: "total", step: 0.01 })).toBe(true);
    expect(matches(cguIssuedTask.taskBasis.replace("[30,30,", "[30,70,"), rule)).toBe(false);
  });
});

const EXAM_NAMES = /\b(?:enem|oab|inep|fgv|cebraspe|cacd|cgu|ielts)\b/iu;

function withoutComments(source: string) {
  return source
    .split("\n")
    .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/u.test(line))
    .join("\n");
}

async function sources(folder: string, keep: (name: string) => boolean) {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && keep(path.join(entry.parentPath, entry.name)))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

describe("grading code", () => {
  it("names no exam or board in the essays code, the grader or its prompt", async () => {
    const essays = await sources(
      import.meta.dirname,
      (file) => !file.includes("_test-utils") && !file.includes(".test."),
    );

    const grader = await sources(
      path.join(import.meta.dirname, "../../../../ai/src/tasks/grading"),
      (file) => path.basename(file).startsWith("grade-essay") && !file.includes(".test."),
    );

    const texts = await Promise.all(
      [...essays, ...grader].map(async (file) => ({
        code: withoutComments(await readFile(file, "utf8")),
        file,
      })),
    );

    expect(grader.length).toBeGreaterThan(1);

    expect(texts.filter(({ code }) => EXAM_NAMES.test(code)).map(({ file }) => file)).toStrictEqual(
      [],
    );
  });
});
