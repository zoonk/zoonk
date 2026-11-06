import { type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { normalizeString } from "@zoonk/utils/string";
import { getScreenTexts } from "./screen-texts";

const NUMBER = /\p{N}+(?:[.,]\p{N}+)*/gu;
const WORD = /\p{L}+/gu;
const MIN_ANSWER_LETTERS = 4;

/** A right option this short around its number is the number itself, such as "R$ 3.000". */
const MAX_WORDS_AROUND_NUMBER = 2;

type GuessGiveaway = { problem: string; screen: number };

function contains({ answer, question }: { answer: string; question: string }): boolean {
  const wanted = normalizeString(answer).replaceAll(/[.!?]+$/gu, "");
  return wanted.replaceAll(/\P{L}/gu, "").length >= MIN_ANSWER_LETTERS && question.includes(wanted);
}

/** Every option named in the question is an either-or question, which gives nothing away. */
function namesOnlyItsAnswer(screen: Extract<WrittenScreen, { kind: "hookGuess" }>): boolean {
  const question = normalizeString(screen.question);
  const named = screen.options.filter((option) => contains({ answer: option.text, question }));

  return named.length === 1 && named[0]?.isCorrect === true;
}

function readsNumberAnswer(answer: string): string[] {
  const numbers = answer.match(NUMBER) ?? [];
  const words = answer.replaceAll(NUMBER, " ").match(WORD) ?? [];

  return numbers.length > 0 && words.length <= MAX_WORDS_AROUND_NUMBER ? numbers : [];
}

function repeatsCalculation({
  answer,
  previous,
}: {
  answer: string;
  previous: WrittenScreen | undefined;
}): boolean {
  const numbers = readsNumberAnswer(answer);

  if (!previous || numbers.length === 0) {
    return false;
  }

  const shown = new Set(
    getScreenTexts(previous).flatMap((piece) => piece.text.match(NUMBER) ?? []),
  );

  return numbers.every((number) => shown.has(number));
}

/**
 * A guess is a hunch about what the next screen explains, so a question that holds its own right
 * answer, or asks for a number the screen before already worked out, isn't one.
 */
export function findGuessGiveaways(screens: readonly WrittenScreen[]): GuessGiveaway[] {
  return screens.flatMap((screen, index) => {
    if (screen.kind !== "hookGuess") {
      return [];
    }

    const answer = screen.options.find((option) => option.isCorrect)?.text ?? "";

    if (namesOnlyItsAnswer(screen)) {
      return [
        {
          problem: `The guess's question contains its own answer ("${answer}"). Ask for a prediction whose answer the question doesn't say.`,
          screen: index,
        },
      ];
    }

    return repeatsCalculation({ answer, previous: screens[index - 1] })
      ? [
          {
            problem: `The guess asks for ${answer}, which the screen before already worked out. Ask what the learner thinks happens next, about the idea the next screen explains.`,
            screen: index,
          },
        ]
      : [];
  });
}
