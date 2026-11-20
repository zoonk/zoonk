import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { toFacts } from "./blueprint-fact-claims";
import { type KeptFacts } from "./blueprint-kept";
import { type ExtractionDocument } from "./blueprint-passages";
import { writtenGradingSchema } from "./written-grading";

type Task = NonNullable<BlueprintExtraction["mock"]>["sections"][number]["tasks"][number];
type Grading = NonNullable<Task["grading"]>;

type Rule =
  | Grading["criteria"][number]
  | NonNullable<Grading["language"]>
  | NonNullable<Grading["rounding"]>;

function rules(grading: Grading): { key: string; rule: Rule }[] {
  return [
    ...grading.criteria.map((rule, index) => ({ key: `criteria.${index}`, rule })),
    ...grading.zeroing.map((rule, index) => ({ key: `zeroing.${index}`, rule })),
    ...(grading.language ? [{ key: "language", rule: grading.language }] : []),
    ...(grading.rounding ? [{ key: "rounding", rule: grading.rounding }] : []),
  ];
}

function describeRule(rule: Rule) {
  const points =
    "points" in rule && typeof rule.points === "number" ? ` (${rule.points} points)` : "";

  if ("formula" in rule && typeof rule.formula === "string") {
    return `${rule.text} (${rule.formula}; ${rule.method}; factor ${rule.factor})`;
  }

  return `${rule.text}${points}`;
}

export function writtenRuleFacts({
  documents,
  id,
  task,
}: {
  documents: ExtractionDocument[];
  id: string;
  task: Task;
}) {
  return task.grading
    ? rules(task.grading).flatMap(({ key, rule }) =>
        toFacts({
          claims: [
            { id: `${id}.grading.${key}`, statement: `${task.description}: ${describeRule(rule)}` },
          ],
          documents,
          passages: [rule],
        }),
      )
    : [];
}

export function toWrittenGrading({
  grading,
  id,
  kept,
}: {
  grading: Task["grading"];
  id: string;
  kept: KeptFacts;
}) {
  if (!grading) {
    return;
  }

  function cite<T extends { document: number; passage: string; text: string }>(
    rule: T,
    key: string,
  ) {
    const citation = kept.get(`${id}.grading.${key}`)?.[0];
    const { document: _document, passage: _passage, ...fields } = rule;
    return citation ? { ...fields, citation } : null;
  }

  const complete = rules(grading).every(({ key }) => kept.has(`${id}.grading.${key}`));

  return writtenGradingSchema.safeParse({
    criteria: grading.criteria.flatMap((rule, index) => cite(rule, `criteria.${index}`) ?? []),
    kind: complete ? grading.kind : "levels",
    language: grading.language ? cite(grading.language, "language") : null,
    rounding: grading.rounding ? cite(grading.rounding, "rounding") : null,
    zeroing: grading.zeroing.flatMap((rule, index) => cite(rule, `zeroing.${index}`) ?? []),
  }).data;
}
