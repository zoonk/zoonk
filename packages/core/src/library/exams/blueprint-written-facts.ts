import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { type Citation } from "./blueprint-contract";
import { toFacts } from "./blueprint-fact-claims";
import { type KeptFacts } from "./blueprint-kept";
import { type ExtractionDocument, type Passage } from "./blueprint-passages";
import { writtenGradingSchema } from "./written-grading";

type Task = NonNullable<BlueprintExtraction["mock"]>["sections"][number]["tasks"][number];
type Grading = NonNullable<Task["grading"]>;
type Criterion = Grading["criteria"][number];
type Award = Criterion["awards"][number];
type Limit = Grading["limits"][number];
type ZeroRule = Grading["zeroing"][number];
type Rule = Passage & { text: string };
type Claim = { key: string; rule: Rule; statement: string };

const ZERO_TRIGGERS: Record<ZeroRule["kinds"][number], string> = {
  blank: "a blank answer",
  copiedSupport: "too few original lines after excluding copied support text",
  identification: "identifying oneself in the answer text",
  offTopic: "an answer entirely off topic",
  other: "",
  tooFewLines: "too few lines",
  wrongForm: "an answer in the wrong text type",
};

const ROUNDING_MODES: Record<NonNullable<NonNullable<Grading["rounding"]>["mode"]>, string> = {
  down: "rounded down",
  nearest: "rounded to the nearest step",
  up: "rounded up",
};

function describePoints(value: number): string {
  return `${value} ${value === 1 ? "point" : "points"}`;
}

function isMark(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 0);
}

function isReadableAward({ count, points, pointsHigh }: Award): boolean {
  return (
    isMark(points) &&
    (pointsHigh === null || (points !== null && pointsHigh >= points)) &&
    (count === null || (Number.isInteger(count) && count > 0))
  );
}

function isReadableScale(awards: Award[]): boolean {
  return awards.length !== 1 && awards.every((award) => isReadableAward(award));
}

function isReadableCriterion({ points, weight }: Criterion): boolean {
  return (points === null || points > 0) && (weight === null || weight > 0);
}

function isReadableLimit({ criteria, max }: Limit): boolean {
  return criteria.length > 0 && isMark(max);
}

function storedZeroKinds({ kinds }: ZeroRule) {
  return kinds.filter((kind) => kind !== "other");
}

function describeCriterion({ points, weight }: Criterion): string {
  return [
    points === null ? "is assessed" : `is assessed, worth at most ${describePoints(points)}`,
    weight === null ? "" : `, with weight ${weight} in the weighted mean of the criteria's marks`,
  ].join("");
}

function describeAward({ count, points, pointsHigh, text }: Award): string {
  const level = `the level "${text}"`;
  const counted = count === null ? "" : `, given for ${count} of the counted elements`;

  if (points === null) {
    return `the scale has ${level}${counted}`;
  }

  const earns = pointsHigh === null ? describePoints(points) : `${points} to ${pointsHigh} points`;
  return `an answer at ${level} earns ${earns}${counted}`;
}

function criterionClaims({ criterion, key }: { criterion: Criterion; key: string }): Claim[] {
  const name = `"${criterion.text}"`;

  return [
    { key, rule: criterion, statement: `${name} ${describeCriterion(criterion)}` },
    ...criterion.awards.map((award, index) => ({
      key: `${key}.awards.${index}`,
      rule: award,
      statement: `under ${name}, ${describeAward(award)}`,
    })),
    ...criterion.parts.map((part, index) => ({
      key: `${key}.parts.${index}`,
      rule: part,
      statement: `under ${name}, the marker counts the element "${part.text}"`,
    })),
  ];
}

function describeCombination({
  combination,
  criteria,
}: {
  combination: NonNullable<Grading["combination"]>;
  criteria: Criterion[];
}): string {
  const weighted = criteria.some(({ weight }) => weight !== null);
  const mean = weighted ? "the weighted mean" : "the mean";
  const method = combination.method === "mean" ? mean : "the sum";
  const step = combination.step === null ? "" : `, given in steps of ${combination.step}`;

  return `${combination.text} (the answer's mark is ${method} of the criteria's marks${step})`;
}

function describeLimit({ criteria, limit }: { criteria: Criterion[]; limit: Limit }): string {
  const names = limit.criteria.map(
    (id) => criteria.find((criterion) => criterion.id === id)?.text ?? id,
  );

  return `${limit.text} (in that case ${names.join(", ")} score at most ${describePoints(limit.max)})`;
}

function describeRounding({ mode, stage, step, text }: NonNullable<Grading["rounding"]>): string {
  const numbers = [
    mode && ROUNDING_MODES[mode],
    step !== null && `in steps of ${step}`,
    stage &&
      (stage === "criterion" ? "applied to each criterion's mark" : "applied to the answer's mark"),
  ].filter(Boolean);

  return numbers.length > 0 ? `${text} (marks ${numbers.join(", ")})` : text;
}

function describeLanguage({ factor, formula, method, text }: NonNullable<Grading["language"]>) {
  return formula === null ? text : `${text} (${formula}; ${method}; factor ${factor})`;
}

function describeZeroRule(rule: ZeroRule): string {
  const lines = rule.maxLines === null ? "" : ` (zero through ${rule.maxLines} original lines)`;

  const triggers = storedZeroKinds(rule)
    .map((kind) => ZERO_TRIGGERS[kind])
    .join(", ");

  return `${rule.text}${lines} (a zero applies for ${triggers})`;
}

function gradingClaims(grading: Grading): Claim[] {
  const { combination, conventions, criteria, language, limits, rounding, zeroing } = grading;

  return [
    ...criteria.flatMap((criterion, index) =>
      criterionClaims({ criterion, key: `criteria.${index}` }),
    ),
    ...(combination && combination.method !== "other"
      ? [
          {
            key: "combination",
            rule: combination,
            statement: describeCombination({ combination, criteria }),
          },
        ]
      : []),
    ...limits.map((limit, index) => ({
      key: `limits.${index}`,
      rule: limit,
      statement: describeLimit({ criteria, limit }),
    })),
    ...conventions.map((rule, index) => ({
      key: `conventions.${index}`,
      rule,
      statement: rule.text,
    })),
    ...(language
      ? [{ key: "language", rule: language, statement: describeLanguage(language) }]
      : []),
    ...(rounding
      ? [{ key: "rounding", rule: rounding, statement: describeRounding(rounding) }]
      : []),
    ...zeroing.flatMap((rule, index) =>
      storedZeroKinds(rule).length > 0
        ? [{ key: `zeroing.${index}`, rule, statement: describeZeroRule(rule) }]
        : [],
    ),
  ];
}

/** Every rule the reading returned can be stored as a mark's input; one that can't hides the total. */
function isReadableSheet(grading: Grading): boolean {
  return (
    grading.combination?.method !== "other" &&
    grading.deductions.length === 0 &&
    grading.criteria.every(
      (criterion) => isReadableCriterion(criterion) && isReadableScale(criterion.awards),
    ) &&
    grading.limits.every((limit) => isReadableLimit(limit))
  );
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
    ? gradingClaims(task.grading).flatMap(({ key, rule, statement }) =>
        toFacts({
          claims: [{ id: `${id}.grading.${key}`, statement: `${task.description}: ${statement}` }],
          documents,
          passages: [rule],
        }),
      )
    : [];
}

function toCitedSheet({
  cite,
  grading,
}: {
  cite: <T extends Rule>(
    rule: T,
    key: string,
  ) => (Omit<T, keyof Passage> & { citation: Citation }) | null;
  grading: Grading;
}) {
  function citeAll<T extends Rule>(rules: T[], key: string) {
    const cited = rules.map((rule, index) => cite(rule, `${key}.${index}`));
    return cited.length > 0 && cited.every((rule) => rule !== null) ? cited : undefined;
  }

  function toCriterion(criterion: Criterion, index: number) {
    const key = `criteria.${index}`;
    const { awards, parts, weight, ...rule } = criterion;
    const cited = isReadableCriterion(criterion) ? cite(rule, key) : null;

    const scale = (isReadableScale(awards) ? citeAll(awards, `${key}.awards`) : undefined)?.map(
      ({ count, pointsHigh, ...award }) => ({
        ...award,
        ...(count !== null && { count }),
        ...(pointsHigh !== null && { pointsHigh }),
      }),
    );

    const counted = citeAll(parts, `${key}.parts`);

    return cited
      ? [
          {
            ...cited,
            ...(scale && { awards: scale }),
            ...(counted && { parts: counted }),
            ...(weight !== null && { weight }),
          },
        ]
      : [];
  }

  const { combination } = grading;
  const isDefaultSum = combination?.method === "sum" && combination.step === null;

  return {
    combination:
      combination && !isDefaultSum && combination.method !== "other"
        ? cite({ ...combination, method: combination.method }, "combination")
        : null,
    conventions: grading.conventions.flatMap(
      (rule, index) => cite(rule, `conventions.${index}`) ?? [],
    ),
    criteria: grading.criteria.flatMap((criterion, index) => toCriterion(criterion, index)),
    language: grading.language ? cite(grading.language, "language") : null,
    limits: grading.limits.flatMap((limit, index) =>
      isReadableLimit(limit) ? (cite(limit, `limits.${index}`) ?? []) : [],
    ),
    rounding: grading.rounding ? cite(grading.rounding, "rounding") : null,
    zeroing: grading.zeroing.flatMap((rule, index) => {
      const kinds = storedZeroKinds(rule);
      const cited = kinds.length > 0 ? cite(rule, `zeroing.${index}`) : null;
      return cited ? [{ ...cited, kinds }] : [];
    }),
  };
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

  function cite<T extends Rule>(rule: T, key: string) {
    const citation = kept.get(`${id}.grading.${key}`)?.[0];
    const { document: _document, passage: _passage, ...fields } = rule;
    return citation ? { ...fields, citation } : null;
  }

  const complete =
    isReadableSheet(grading) &&
    gradingClaims(grading).every(({ key }) => kept.has(`${id}.grading.${key}`));

  return writtenGradingSchema.safeParse({
    ...toCitedSheet({ cite, grading }),
    ...(!complete && { totalSuppressed: true }),
  }).data;
}
