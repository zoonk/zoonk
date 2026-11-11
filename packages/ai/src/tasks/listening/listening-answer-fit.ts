import { ANSWER_GAP } from "../_utils/answer-gap";
import { normalizeTypedAnswer } from "../grading/typed-answer-match";

/** The answer length a typed question states: "ONE WORD AND/OR A NUMBER" is 1 word plus a number. */
type AnswerLimit = { plusNumber: boolean; words: number };

type TypedAnswerQuestion = { answerLimit: AnswerLimit; context: string | null; question: string };

const SPACES = /\s+/u;
const DIGIT = /\p{N}/u;
const LETTER = /\p{L}/u;

/** A form's question number sits between the gap and the word before it: "Name: Kevin (1) ____". */
const QUESTION_NUMBER = /\(\d+\)\s*$/u;

/**
 * Digits next to each other are one number ("07702 554190"); a number written in words is words,
 * so "nine thirty" is two words and "9:30" one number.
 */
function countWordsAndNumbers(answer: string): { numbers: number; words: number } {
  const tokens = answer.split(SPACES).filter((token) => LETTER.test(token) || DIGIT.test(token));

  return tokens.reduce(
    (count, token, index) => {
      if (!DIGIT.test(token)) {
        return { ...count, words: count.words + 1 };
      }

      const continuesNumber = index > 0 && DIGIT.test(tokens[index - 1] ?? "");
      return continuesNumber ? count : { ...count, numbers: count.numbers + 1 };
    },
    { numbers: 0, words: 0 },
  );
}

function fitsLimit(answer: string, limit: AnswerLimit): boolean {
  const { numbers, words } = countWordsAndNumbers(answer);
  return limit.plusNumber ? words <= limit.words && numbers <= 1 : words + numbers <= limit.words;
}

function getWords(text: string): string[] {
  return normalizeTypedAnswer(text).split(" ").filter(Boolean);
}

/** The words printed right before and after the gap, when the question has exactly one. */
function getGapNeighbors({ context, question }: TypedAnswerQuestion) {
  const text = [context, question].filter(Boolean).join("\n");
  const gaps = [...text.matchAll(ANSWER_GAP)];
  const [gap] = gaps;

  if (gaps.length !== 1 || !gap) {
    return null;
  }

  return {
    after: getWords(text.slice(gap.index + gap[0].length)).at(0),
    before: getWords(text.slice(0, gap.index).replace(QUESTION_NUMBER, "")).at(-1),
  };
}

function repeatsGapNeighbor(answer: string, question: TypedAnswerQuestion): boolean {
  const neighbors = getGapNeighbors(question);
  const words = getWords(answer);

  return (
    neighbors !== null &&
    ((neighbors.before !== undefined && words.at(0) === neighbors.before) ||
      (neighbors.after !== undefined && words.at(-1) === neighbors.after))
  );
}

export function fitsTypedQuestion(answer: string, question: TypedAnswerQuestion): boolean {
  return fitsLimit(answer, question.answerLimit) && !repeatsGapNeighbor(answer, question);
}
