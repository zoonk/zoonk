import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { normalizeString } from "@zoonk/utils/string";

const SAME_QUESTION_SHARE = 0.75;
const MIN_QUESTION_WORDS = 5;

const NUMBER_OR_PLACEHOLDER = /\{[\p{L}_][\p{L}\p{N}_]*\}|\p{N}[\p{N}.,]*/gu;
const WORD = /[\p{L}#]+|\p{Sm}/gu;

export type RepeatedQuestion = { repeats: number; screen: number };

function getQuestion(screen: WrittenScreen): string | null {
  switch (screen.kind) {
    case "check":
    case "mathCheck":
    case "typedAnswer":
      return screen.question;
    case "activity":
    case "explanation":
    case "hookGuess":
    case "hookText":
    case "workedExample":
      return null;
    default:
      throw new Error("Unknown written screen kind.");
  }
}

function toWords(question: string): Set<string> {
  const text = normalizeString(question.replaceAll(NUMBER_OR_PLACEHOLDER, " # "));
  return new Set(text.match(WORD));
}

function isSameQuestion(first: ReadonlySet<string>, second: ReadonlySet<string>): boolean {
  if (first.size < MIN_QUESTION_WORDS || second.size < MIN_QUESTION_WORDS) {
    return false;
  }

  const shared = [...first].filter((word) => second.has(word)).length;
  return shared / (first.size + second.size - shared) >= SAME_QUESTION_SHARE;
}

export function findRepeatedQuestions(screens: readonly WrittenScreen[]): RepeatedQuestion[] {
  const questions = screens.map((screen) => {
    const question = getQuestion(screen);
    return question === null ? null : toWords(question);
  });

  return questions.flatMap((words, screen) => {
    const repeats = words
      ? questions.findIndex(
          (earlier, index) => index < screen && earlier && isSameQuestion(earlier, words),
        )
      : -1;

    return repeats === -1 ? [] : [{ repeats, screen }];
  });
}
