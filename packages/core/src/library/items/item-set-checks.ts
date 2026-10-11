import { type WrittenItemSet } from "@zoonk/ai/tasks/v2/items/write-set";
import { normalizeString, replaceEmDashes, segmentWords } from "@zoonk/utils/string";
import { findPlaceholderText, findUnrenderedMarkdown } from "@zoonk/utils/text-flaws";

/** A set asks two questions at least; one question on a text is an item with a long context. */
export const MIN_SET_QUESTIONS = 2;

/** Words a stimulus may have, by kind: enough for every question to need it, short enough to read. */
const WORD_LIMITS = {
  case: { max: 320, min: 60 },
  chart: { max: 120, min: 0 },
  text: { max: 450, min: 90 },
};

/**
 * A written set as code repairs it before its checks: no em dashes in our own wording (the
 * stimulus is written, never quoted), and a stimulus that draws a chart is a `chart` set.
 */
export function repairWrittenItemSet(set: WrittenItemSet): WrittenItemSet {
  const kind = set.visual ? "chart" : set.kind;

  return {
    ...set,
    kind,
    text: replaceEmDashes(set.text),
    title: set.title === null ? null : replaceEmDashes(set.title),
  };
}

/** Whether evidence copied from the stimulus is in it, ignoring case, accents and spacing. */
function isInStimulus({ evidence, text }: { evidence: string; text: string }): boolean {
  const quoted = normalizeString(evidence).replace(/[.…]+$/u, "");
  return quoted.length > 0 && normalizeString(text).includes(quoted);
}

/** Problems with a set's stimulus that leave none of its questions askable. */
function checkStimulus(set: WrittenItemSet): string[] {
  const words = segmentWords(set.text).length;
  const limits = WORD_LIMITS[set.kind];

  return [
    set.kind === "chart" && !set.visual && "A chart set has no chart.",
    set.kind !== "chart" && findPlaceholderText(set.text),
    words < limits.min && `The ${set.kind} has ${words} words, fewer than ${limits.min}.`,
    words > limits.max && `The ${set.kind} has ${words} words, more than ${limits.max}.`,
    findUnrenderedMarkdown({ layout: "blocks", text: set.text }),
  ]
    .flat()
    .filter((problem) => typeof problem === "string");
}

/**
 * Problems with one of the set's questions that only the set can see: a skill number outside the
 * call's list, or evidence that isn't in the stimulus (a chart's questions read data, so theirs
 * isn't looked for in its words).
 */
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
    set.kind !== "chart" &&
      !isInStimulus({ evidence: question.evidence, text: set.text }) &&
      "Its evidence isn't in the stimulus.",
  ].filter((problem) => typeof problem === "string");
}

export type ItemSetCheck = {
  /** Each question's own problems, in the order written; empty when it passes. */
  questions: string[][];
  /** Problems with the stimulus, or too few questions: the set can't be stored. */
  set: string[];
};

/**
 * What code finds wrong with a written set (after `repairWrittenItemSet`), apart from the item
 * checks every question runs too: a stimulus too short, too long, unfinished or without its chart,
 * a question on a skill the call didn't ask for or whose evidence isn't in the stimulus, and fewer
 * than two questions left. The pipeline and the set writer's eval run the same checks.
 */
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
