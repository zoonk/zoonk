import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { toFacts } from "./blueprint-fact-claims";
import { type KeptFacts } from "./blueprint-kept";
import { type ExtractionDocument } from "./blueprint-passages";
import { writtenGradingSchema } from "./written-grading";

type Task = NonNullable<BlueprintExtraction["mock"]>["sections"][number]["tasks"][number];
type Grading = NonNullable<Task["grading"]>;

const ZERO_TRIGGERS: Record<Grading["zeroing"][number]["kinds"][number], string> = {
  blank: "a blank answer",
  copiedSupport: "too few original lines after excluding copied support text",
  identification: "identifying oneself in the answer text",
  offTopic: "an answer entirely off topic",
  other: "",
  tooFewLines: "too few lines",
  wrongForm: "an answer in the wrong text type",
};

type Rule =
  | Grading["zeroing"][number]
  | Grading["criteria"][number]
  | NonNullable<Grading["language"]>
  | NonNullable<Grading["rounding"]>;

function scoringRules(grading: Grading): { key: string; rule: Rule }[] {
  return [
    ...grading.criteria.map((rule, index) => ({ key: `criteria.${index}`, rule })),
    ...(grading.language ? [{ key: "language", rule: grading.language }] : []),
    ...(grading.rounding ? [{ key: "rounding", rule: grading.rounding }] : []),
  ];
}

function describeRule(rule: Rule) {
  const points =
    "points" in rule && typeof rule.points === "number" ? ` (${rule.points} points)` : "";

  if ("kinds" in rule) {
    const lines = rule.maxLines === null ? "" : ` (zero through ${rule.maxLines} original lines)`;

    const triggers = rule.kinds
      .map((kind) => ZERO_TRIGGERS[kind])
      .filter(Boolean)
      .join(", ");

    return `${rule.text}${lines}${triggers ? ` (a zero applies for ${triggers})` : ""}`;
  }

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
    ? [
        ...scoringRules(task.grading),
        ...task.grading.zeroing.map((rule, index) => ({ key: `zeroing.${index}`, rule })),
      ].flatMap(({ key, rule }) =>
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

  const complete = scoringRules(grading).every(({ key }) => kept.has(`${id}.grading.${key}`));

  return writtenGradingSchema.safeParse({
    criteria: grading.criteria.flatMap((rule, index) => cite(rule, `criteria.${index}`) ?? []),
    kind: complete ? grading.kind : "levels",
    language: grading.language ? cite(grading.language, "language") : null,
    rounding: grading.rounding ? cite(grading.rounding, "rounding") : null,
    zeroing: grading.zeroing.flatMap((rule, index) => {
      const kinds = rule.kinds.filter((kind) => kind !== "other");
      const cited = cite(rule, `zeroing.${index}`);
      return cited && kinds.length > 0 ? [{ ...cited, kinds }] : [];
    }),
  }).data;
}
