import { type WrittenItemSet } from "@zoonk/ai/tasks/v2/items/write-set";
import { normalizeString, replaceEmDashes, segmentWords } from "@zoonk/utils/string";
import { findPlaceholderText, findUnrenderedMarkdown } from "@zoonk/utils/text-flaws";

export const MIN_SET_QUESTIONS = 2;

const WORD_LIMITS = {
  case: { max: 320, min: 60 },
  chart: { max: 120, min: 0 },
  text: { max: 450, min: 90 },
};

export function repairWrittenItemSet(set: WrittenItemSet): WrittenItemSet {
  const kind = set.visual ? "chart" : set.kind;

  return {
    ...set,
    kind,
    text: replaceEmDashes(set.text),
    title: set.title === null ? null : replaceEmDashes(set.title),
  };
}

function isInStimulus({ evidence, text }: { evidence: string; text: string }): boolean {
  const quoted = normalizeString(evidence).replace(/[.…]+$/u, "");
  return quoted.length > 0 && normalizeString(text).includes(quoted);
}

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
