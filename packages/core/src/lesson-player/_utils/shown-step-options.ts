import { showInOrder } from "../../sessions/_utils/shown-order";
import { type PlayableLanguageStep, type PlayableLibraryStep } from "../playable-lesson";

type Exercise = PlayableLanguageStep["exercise"];

function showExercise({ exercise, seed }: { exercise: Exercise; seed: string }): Exercise {
  const { content } = exercise;

  return {
    ...exercise,
    content:
      "options" in content
        ? { ...content, options: showInOrder({ items: content.options, seed: `${seed}:options` }) }
        : content,
    fillBlankOptions: showInOrder({ items: exercise.fillBlankOptions, seed: `${seed}:fillBlank` }),
    matchColumnsRightItems: showInOrder({
      items: exercise.matchColumnsRightItems,
      seed: `${seed}:matchColumns`,
    }),
    sentenceWordOptions: showInOrder({
      items: exercise.sentenceWordOptions,
      seed: `${seed}:sentenceWords`,
    }),
    translationOptions: showInOrder({
      items: exercise.translationOptions,
      seed: `${seed}:translation`,
    }),
    wordBankOptions: showInOrder({ items: exercise.wordBankOptions, seed: `${seed}:wordBank` }),
  };
}

function showScreen({ seed, step }: { seed: string; step: PlayableLibraryStep }) {
  if ("exercise" in step) {
    return { ...step, exercise: showExercise({ exercise: step.exercise, seed }) };
  }

  if (step.kind === "check") {
    const options = showInOrder({ items: step.content.options, seed });
    return { ...step, content: { ...step.content, options } };
  }

  if (step.kind === "hook" && step.content.variant === "guess") {
    const options = showInOrder({ items: step.content.options, seed });
    return { ...step, content: { ...step.content, options } };
  }

  return step;
}

/**
 * Lays out what a screen offers to pick from in the order one sitting shows it. Answers name an
 * option or a word, never a place, so a sitting can move them and a replay tests what they say.
 */
export function showStepOptions({
  seed,
  step,
}: {
  seed: string;
  step: PlayableLibraryStep;
}): PlayableLibraryStep {
  return showScreen({ seed: `${seed}:${step.id}`, step });
}
