import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { normalizeString } from "@zoonk/utils/string";

/**
 * Two questions whose words and math signs are at least this much the same, once numbers are set
 * aside, ask the same thing ("Which dot is at (3, 1)?" and "Which dot is at (2, -3)?"). Questions
 * about the same idea that ask something else ("How do you simplify 4³ × 4²?" and "How do you
 * simplify 6⁵ ÷ 6²?") share less.
 */
const SAME_QUESTION_SHARE = 0.75;
/** Shorter questions ("Why?", "Which one is right?") share words by chance. */
const MIN_QUESTION_WORDS = 5;

/** Numbers (exponents too), and the `{name}` placeholders a calculation puts where numbers go. */
const NUMBER_OR_PLACEHOLDER = /\{[\p{L}_][\p{L}\p{N}_]*\}|\p{N}[\p{N}.,]*/gu;
/** Words, and math signs such as × and ÷, which tell two calculations apart. */
const WORD = /[\p{L}#]+|\p{Sm}/gu;

/** A check that asks the same question as an earlier one. `screen` and `repeats` are 0-based. */
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

/** The question's words and math signs, with every number and placeholder read as the same word. */
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

/**
 * Finds checks that ask an earlier check's question again with other numbers, names or objects,
 * instead of asking something new about the idea. Each repeat names the first earlier check it
 * matches.
 */
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
