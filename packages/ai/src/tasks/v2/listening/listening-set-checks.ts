import { replaceEmDashes } from "@zoonk/utils/string";
import { findPlaceholderText, findUnrenderedMarkdown } from "@zoonk/utils/text-flaws";
import { normalizeTypedAnswer } from "../grading/typed-answer-match";
import {
  type ListeningQuestion,
  type ListeningQuestionFormat,
  type ListeningSet,
  type ListeningTurn,
} from "./listening-set-schema";

/**
 * A script shorter than this is a sentence, not a recording; longer than this runs past the longest
 * exam recordings (a lecture of about six minutes at an exam's pace).
 */
const MIN_SCRIPT_WORDS = 40;
const MAX_SCRIPT_WORDS = 1000;

/** Exam recordings rarely have more voices than this (IELTS Part 3 has up to four). */
const MAX_SPEAKERS = 4;

/** Stage directions and sound cues a voice would read aloud: "[laughs]", "(pause)". */
const STAGE_DIRECTIONS = /\[[^\]]*\]|\([^)]*\)/gu;

/** Emphasis marks a voice can't say; the words inside them stay. */
const EMPHASIS_MARKS = /[*_]+/gu;
const SPACES = /\s+/gu;

/** What a set must look like, from the task that asked for it. */
export type ListeningSetRequest = {
  count: number;
  formats: readonly ListeningQuestionFormat[];
  optionCount: number | null;
  /** How many skills the call listed; a question's `skill` is one of them, from 1. */
  skillCount: number;
};

function cleanLine(text: string): string {
  return replaceEmDashes(text.replaceAll(STAGE_DIRECTIONS, " ").replaceAll(EMPHASIS_MARKS, ""))
    .replaceAll(SPACES, " ")
    .trim();
}

/**
 * In a conversation, consecutive lines of one speaker are one turn: the voice reads them without a
 * pause between. A talk or a lecture (one speaker) keeps its paragraphs, so its transcript reads in
 * paragraphs and the recording pauses between them.
 */
function mergeTurns(turns: readonly ListeningTurn[]): ListeningTurn[] {
  if (new Set(turns.map((turn) => turn.speaker)).size <= 1) {
    return [...turns];
  }

  const merged: ListeningTurn[] = [];

  for (const turn of turns) {
    const last = merged.at(-1);

    if (last?.speaker === turn.speaker) {
      merged[merged.length - 1] = { ...last, text: `${last.text} ${turn.text}` };
    } else {
      merged.push(turn);
    }
  }

  return merged;
}

/** The whole script as one normalized string, the way evidence and answers are looked up in it. */
function getScriptText(turns: readonly ListeningTurn[]): string {
  return normalizeTypedAnswer(turns.map((turn) => turn.text).join(" "));
}

/** Where a question's evidence is heard in the script, or -1 when the script doesn't say it. */
function findEvidence(script: string, question: ListeningQuestion): number {
  const evidence = normalizeTypedAnswer(question.evidence);
  return evidence ? script.indexOf(evidence) : -1;
}

/** Questions whose evidence is heard first come first; ones not found keep their place at the end. */
function sortByEvidence(
  questions: readonly ListeningQuestion[],
  script: string,
): ListeningQuestion[] {
  const position = (question: ListeningQuestion) => {
    const found = findEvidence(script, question);
    return found === -1 ? Number.POSITIVE_INFINITY : found;
  };

  return questions.toSorted((a, b) => position(a) - position(b));
}

/** What a question's right answer says: a typed answer's accepted words, a right option's text. */
function getAnswerTexts(question: ListeningQuestion): string[] {
  if (question.format === "typed") {
    return [question.sampleAnswer, ...question.acceptedAnswers];
  }

  if (question.format === "multipleChoice") {
    return question.options.filter((option) => option.isCorrect).map((option) => option.text);
  }

  return [];
}

/**
 * The recording's title, or nothing when it says one of the answers ("The Hadley party" for a
 * surname to write): it shows with the player before any question is answered.
 */
function toTitle({
  questions,
  title,
}: {
  questions: readonly ListeningQuestion[];
  title: string;
}): string {
  const words = ` ${normalizeTypedAnswer(title)} `;

  const givesAway = questions
    .flatMap((question) => getAnswerTexts(question))
    .some((answer) => {
      const normalized = normalizeTypedAnswer(answer);
      return normalized.length > 0 && words.includes(` ${normalized} `);
    });

  return givesAway ? "" : title;
}

/** A skill number outside the list becomes the first skill, the one the set mainly tests. */
function toKnownSkill(skill: number, request: ListeningSetRequest): number {
  return skill >= 1 && skill <= request.skillCount ? skill : 1;
}

/**
 * Repairs in code what code can repair, before any check: stage directions and em dashes leave the
 * spoken lines, empty lines go, one speaker's consecutive lines in a conversation become one turn
 * (a talk keeps its paragraphs), speakers who never speak leave, the questions follow the order
 * their answers are heard, as every exam asks them, cut to the count asked for, a skill number
 * outside the list becomes the first skill, and a title that says an answer goes.
 */
export function repairListeningSet(set: ListeningSet, request: ListeningSetRequest): ListeningSet {
  const turns = mergeTurns(
    set.turns
      .map((turn) => ({ speaker: turn.speaker.trim(), text: cleanLine(turn.text) }))
      .filter((turn) => turn.text.length > 0),
  );

  const speaking = new Set(turns.map((turn) => turn.speaker));
  const script = getScriptText(turns);

  return {
    questions: sortByEvidence(set.questions, script)
      .slice(0, request.count)
      .map((question) => ({ ...question, skill: toKnownSkill(question.skill, request) })),
    speakers: set.speakers
      .map((speaker) => ({ ...speaker, name: speaker.name.trim() }))
      .filter((speaker) => speaking.has(speaker.name)),
    title: toTitle({ questions: set.questions, title: cleanLine(set.title) }),
    turns,
  };
}

function countWords(turns: readonly ListeningTurn[]): number {
  return turns.flatMap((turn) => turn.text.split(" ").filter(Boolean)).length;
}

function getQuestionText(question: ListeningQuestion): string {
  return question.format === "trueFalse" ? question.statement : question.question;
}

/** A typed answer is words the learner heard, so one of its accepted answers is in the script. */
function isAnswerHeard(script: string, question: ListeningQuestion): boolean {
  if (question.format !== "typed") {
    return true;
  }

  return [question.sampleAnswer, ...question.acceptedAnswers].some((answer) => {
    const normalized = normalizeTypedAnswer(answer);
    return normalized.length > 0 && script.includes(normalized);
  });
}

function findQuestionProblems(script: string, question: ListeningQuestion): string[] {
  const label = `"${getQuestionText(question).slice(0, 60)}"`;

  return [
    findEvidence(script, question) === -1 &&
      `${label}: its evidence isn't in the script word for word.`,
    !isAnswerHeard(script, question) &&
      `${label}: none of its accepted answers is said in the script.`,
  ].filter((problem) => typeof problem === "string");
}

function findScriptProblems(set: ListeningSet): string[] {
  const names = new Set(set.speakers.map((speaker) => speaker.name));
  const words = countWords(set.turns);

  const strangers = new Set(
    set.turns.map((turn) => turn.speaker).filter((speaker) => !names.has(speaker)),
  );

  return [
    names.size !== set.speakers.length && "Two speakers have the same name.",
    set.speakers.length > MAX_SPEAKERS && `Has ${set.speakers.length} speakers; at most 4.`,
    strangers.size > 0 &&
      `Lines are said by people not in the speakers: ${[...strangers].join(", ")}.`,
    words < MIN_SCRIPT_WORDS && `The script has ${words} words; a recording needs at least 40.`,
    words > MAX_SCRIPT_WORDS && `The script has ${words} words; at most 1000.`,
    ...set.turns.flatMap((turn) => [
      ...findPlaceholderText(turn.text),
      ...findUnrenderedMarkdown({ layout: "inline", text: turn.text }),
    ]),
  ].filter((problem) => typeof problem === "string");
}

/** Two questions answered by the same words test the same thing. */
function findRepeatedEvidence(questions: readonly ListeningQuestion[]): string[] {
  const evidence = questions.map((question) => normalizeTypedAnswer(question.evidence));
  const isRepeated = new Set(evidence).size !== evidence.length;
  return isRepeated ? ["Two questions have the same evidence."] : [];
}

/**
 * The flaws of a repaired set code can see and can't repair: the script's speakers and length,
 * placeholders and Markdown in what's said, the question count, evidence that isn't heard word for
 * word, and typed answers nobody says. The task drafts again when there are any; the pipeline and
 * the eval scorer read the same list. Each question's own checks (options, keys) run in core.
 */
export function findListeningSetProblems(
  set: ListeningSet,
  request: ListeningSetRequest,
): string[] {
  const script = getScriptText(set.turns);

  return [
    ...findScriptProblems(set),
    ...(set.questions.length < request.count
      ? [`Wrote ${set.questions.length} questions instead of ${request.count}.`]
      : []),
    ...set.questions.flatMap((question) => findQuestionProblems(script, question)),
    ...findRepeatedEvidence(set.questions),
  ];
}
