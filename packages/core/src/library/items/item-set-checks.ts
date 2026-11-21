import { type WrittenItemSet } from "@zoonk/ai/tasks/items/write-set";
import { type ChartVisual, type PlotVisual } from "@zoonk/ai/tasks/visuals/schema";
import { wrapBareLatex } from "@zoonk/utils/bare-latex";
import { normalizeString, replaceEmDashes, segmentWords } from "@zoonk/utils/string";
import { findPlaceholderText } from "@zoonk/utils/text-flaws";
import { findUnrenderedText } from "@zoonk/utils/unrendered-text";
import { getChartProblems } from "../quality/_utils/visual-references";

export const MIN_SET_QUESTIONS = 2;

const WORD_LIMITS = {
  case: { max: 320, min: 60 },
  chart: { max: 120, min: 0 },
  text: { max: 450, min: 90 },
};

/** Evidence quotes the stimulus word for word, so both get the same repairs. */
function repairQuotable(text: string): string {
  return wrapBareLatex({ layout: "blocks", text: replaceEmDashes(text) });
}

export function repairWrittenItemSet(set: WrittenItemSet): WrittenItemSet {
  const kind = set.visual ? "chart" : set.kind;

  return {
    ...set,
    kind,
    questions: set.questions.map((question) => ({
      ...question,
      evidence: repairQuotable(question.evidence),
    })),
    text: repairQuotable(set.text),
    title: set.title === null ? null : replaceEmDashes(set.title),
  };
}

function normalizeEvidence(text: string): string {
  return normalizeString(text).replace(/[.…]+$/u, "");
}

function checkStimulus(set: WrittenItemSet): string[] {
  const words = segmentWords(set.text).length;
  const limits = WORD_LIMITS[set.kind];

  return [
    set.kind === "chart" && !set.visual && "A chart set has no chart.",
    set.visual ? getChartProblems(set.visual) : [],
    set.kind !== "chart" && findPlaceholderText(set.text),
    words < limits.min && `The ${set.kind} has ${words} words, fewer than ${limits.min}.`,
    words > limits.max && `The ${set.kind} has ${words} words, more than ${limits.max}.`,
    findUnrenderedText({ layout: "blocks", text: set.text }),
  ]
    .flat()
    .filter((problem) => typeof problem === "string");
}

function getVisibleChartLabels(visual: ChartVisual | PlotVisual): (string | null)[] {
  const legendNames = visual.series.length > 1 ? visual.series.map(({ name }) => name) : [];

  if (visual.kind === "plot") {
    return [
      visual.title,
      visual.xLabel,
      visual.yLabel,
      ...visual.references.map(({ label }) => label),
      ...visual.series.flatMap(({ points }) => points.map(({ label }) => label)),
      ...legendNames,
    ];
  }

  return [
    visual.title,
    visual.categoryLabel,
    visual.valueLabel,
    ...visual.categories,
    ...legendNames,
    ...visual.categories.flatMap((category) => legendNames.map((name) => `${category}, ${name}`)),
  ];
}

function hasEvidence({ evidence, set }: { evidence: string; set: WrittenItemSet }): boolean {
  const visual = set.visual;
  const quoted = normalizeEvidence(evidence);

  if (visual?.kind === "plot" || visual?.kind === "chart") {
    return (
      quoted.length > 0 &&
      getVisibleChartLabels(visual).some(
        (label) => label !== null && normalizeEvidence(repairQuotable(label)) === quoted,
      )
    );
  }

  return set.kind === "chart" || (quoted.length > 0 && normalizeString(set.text).includes(quoted));
}

function checkQuestion({
  question,
  set,
  skillCount,
}: {
  question: WrittenItemSet["questions"][number];
  set: WrittenItemSet;
  skillCount: number;
}): string[] {
  return [
    (question.skill < 1 || question.skill > skillCount) &&
      `Tests skill ${question.skill}, which isn't one of the ${skillCount} skills.`,
    !hasEvidence({ evidence: question.evidence, set }) && "Its evidence isn't in the stimulus.",
  ].filter((problem) => typeof problem === "string");
}

export type ItemSetCheck = { questions: string[][]; set: string[] };

export function checkWrittenItemSet({
  set,
  skillCount,
}: {
  set: WrittenItemSet;
  skillCount: number;
}): ItemSetCheck {
  const questions = set.questions.map((question) => checkQuestion({ question, set, skillCount }));
  const passing = questions.filter((problems) => problems.length === 0).length;

  return {
    questions,
    set: [
      ...checkStimulus(set),
      ...(passing < MIN_SET_QUESTIONS
        ? [`Has ${passing} askable questions, fewer than ${MIN_SET_QUESTIONS}.`]
        : []),
    ],
  };
}
